/**
 * Flow control with receiver-driven sliding window.
 *
 * BACKPRESSURE INVARIANTS:
 * 1. Sender never has more than maxOutstandingBytes in flight
 * 2. Receiver ACKs trigger window advancement
 * 3. NACKs trigger selective retransmission
 *
 * MEMORY BOUNDS:
 * - Sender: outstandingChunks map bounded by maxOutstandingBytes / CHUNK_SIZE
 * - Receiver: does not buffer (streams to disk or accumulates in controlled manner)
 */

import {CHUNK_SIZE} from './ChunkProtocol';

export interface FlowControlConfig {
    maxOutstandingBytes: number;  // Default 8MB
    chunkSize: number;            // Default 64KB
}

const DEFAULT_CONFIG: FlowControlConfig = {
    maxOutstandingBytes: 8 * 1024 * 1024, // 8MB
    chunkSize: CHUNK_SIZE,
};

/**
 * Sliding window for sender-side flow control.
 *
 * CONCURRENCY MODEL:
 * - Single-threaded (JavaScript event loop)
 * - Async operations coordinate via callbacks/promises
 * - No explicit locking needed
 */
export class SlidingWindow {
    private readonly config: FlowControlConfig;
    private readonly maxChunksInFlight: number;

    // Chunks sent but not yet ACKed (chunkIndex -> timestamp)
    private outstandingChunks: Map<number, number> = new Map();

    // Callbacks waiting for window space
    private waitQueue: Array<() => void> = [];

    // Flow control state
    private paused = false;

    constructor(config: Partial<FlowControlConfig> = {}) {
        this.config = {...DEFAULT_CONFIG, ...config};
        this.maxChunksInFlight = Math.floor(
            this.config.maxOutstandingBytes / this.config.chunkSize
        );
    }

    /** --- Returns the number of bytes currently in flight (sent but not ACKed) --- */
    get outstandingBytes(): number {
        return this.outstandingChunks.size * this.config.chunkSize;
    }

    /** --- Checks if we can send more chunks without exceeding the window --- */
    canSend(): boolean {
        return !this.paused && this.outstandingChunks.size < this.maxChunksInFlight;
    }

    /**
     * Registers a chunk as sent (in flight).
     * Call this after sending a chunk to track it for ACK.
     */
    markSent(chunkIndex: number): void {
        if (this.outstandingChunks.size >= this.maxChunksInFlight) {
            throw new Error('Window full - should not call markSent when canSend() is false');
        }
        this.outstandingChunks.set(chunkIndex, Date.now());
    }

    /** --- Processes an ACK for a chunk, advancing the window --- */
    onAck(chunkIndex: number): void {
        this.outstandingChunks.delete(chunkIndex);
        this.notifyWaiters();
    }

    /** --- Processes multiple ACKs at once (batch ACK optimization) --- */
    onAckBatch(chunkIndices: number[]): void {
        for (const idx of chunkIndices) {
            this.outstandingChunks.delete(idx);
        }
        this.notifyWaiters();
    }

    /** --- Returns chunks that should be retransmitted (from NACK) --- */
    getChunksForRetransmit(missingChunks: number[]): number[] {
        // Only retransmit chunks we actually have in flight
        return missingChunks.filter(idx => this.outstandingChunks.has(idx));
    }

    /** --- Pauses sending (receiver requested pause) --- */
    pause(): void {
        this.paused = true;
    }

    /** --- Resumes sending (receiver ready again) --- */
    resume(): void {
        this.paused = false;
        this.notifyWaiters();
    }

    /**
     * Waits until the window has space for more chunks.
     * Use with async/await for backpressure.
     */
    async waitForSpace(): Promise<void> {
        if (this.canSend()) {
            return;
        }

        return new Promise<void>((resolve) => {
            this.waitQueue.push(resolve);
        });
    }

    /** --- Clears all state (for cleanup/reset) --- */
    clear(): void {
        this.outstandingChunks.clear();
        this.paused = false;
        // Reject all waiters
        this.waitQueue.forEach(() => {
        }); // Let them GC
        this.waitQueue = [];
    }

    /** --- Returns statistics for progress reporting --- */
    getStats(): { outstandingChunks: number; outstandingBytes: number; paused: boolean } {
        return {
            outstandingChunks: this.outstandingChunks.size,
            outstandingBytes: this.outstandingBytes,
            paused: this.paused,
        };
    }

    private notifyWaiters(): void {
        while (this.waitQueue.length > 0 && this.canSend()) {
            const waiter = this.waitQueue.shift();
            waiter?.();
        }
    }
}

/** --- Receiver-side tracking of received chunks for resume support --- */
export class ReceivedRanges {
    // Tracks received chunk indices as ranges for efficient representation
    private ranges: [number, number][] = [];
    private receivedSet: Set<number> = new Set();
    private totalChunks: number;

    constructor(totalChunks: number) {
        this.totalChunks = totalChunks;
    }

    /** --- Marks a chunk as received --- */
    markReceived(chunkIndex: number): void {
        if (this.receivedSet.has(chunkIndex)) {
            return; // Already received (duplicate)
        }
        this.receivedSet.add(chunkIndex);
        this.updateRanges();
    }

    /** --- Checks if a chunk has been received --- */
    hasChunk(chunkIndex: number): boolean {
        return this.receivedSet.has(chunkIndex);
    }

    /** --- Returns missing chunk indices (for NACK) --- */
    getMissingChunks(): number[] {
        const missing: number[] = [];
        for (let i = 0; i < this.totalChunks; i++) {
            if (!this.receivedSet.has(i)) {
                missing.push(i);
            }
        }
        return missing;
    }

    /** --- Returns received ranges for resume protocol --- */
    getRanges(): [number, number][] {
        return [...this.ranges];
    }

    /** --- Initializes from previously received ranges (resume scenario) --- */
    loadFromRanges(ranges: [number, number][]): void {
        for (const [start, end] of ranges) {
            for (let i = start; i <= end; i++) {
                this.receivedSet.add(i);
            }
        }
        this.updateRanges();
    }

    /** --- Returns progress as percentage complete --- */
    getProgress(): number {
        if (this.totalChunks === 0) return 100;
        return (this.receivedSet.size / this.totalChunks) * 100;
    }

    /** --- Checks if all chunks have been received --- */
    isComplete(): boolean {
        return this.receivedSet.size >= this.totalChunks;
    }

    private updateRanges(): void {
        // Convert set to sorted array and compress into ranges
        const sorted = Array.from(this.receivedSet).sort((a, b) => a - b);

        if (sorted.length === 0) {
            this.ranges = [];
            return;
        }

        const newRanges: [number, number][] = [];
        let rangeStart = sorted[0];
        let rangeEnd = sorted[0];

        for (let i = 1; i < sorted.length; i++) {
            if (sorted[i] === rangeEnd + 1) {
                rangeEnd = sorted[i];
            } else {
                newRanges.push([rangeStart, rangeEnd]);
                rangeStart = sorted[i];
                rangeEnd = sorted[i];
            }
        }
        newRanges.push([rangeStart, rangeEnd]);

        this.ranges = newRanges;
    }
}
