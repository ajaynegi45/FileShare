/**
 * Sender transport for chunked file transfer with backpressure.
 *
 * MEMORY INVARIANTS:
 * - Never loads entire file into memory
 * - Uses File.slice() for streaming reads
 * - Outstanding bytes bounded by SlidingWindow
 *
 * BACKPRESSURE IMPLEMENTATION:
 * 1. Checks SlidingWindow before sending
 * 2. Monitors DataChannel.bufferedAmount
 * 3. Waits for ACKs before sending more
 */

import {
    type AckMessage,
    CHUNK_SIZE,
    type ControlMessage,
    createFileMetadata,
    encodeChunk,
    type NackMessage,
    type ProtocolMessage
} from '../protocol/ChunkProtocol';
import {SlidingWindow} from '../protocol/FlowControl';
import {calculateEta, SpeedCalculator, type TransferProgress} from '../protocol/TransferState';
import {toast} from "sonner";

export interface SenderConfig {
    maxOutstandingBytes: number;
    bufferedAmountLowThreshold: number;
}

const DEFAULT_CONFIG: SenderConfig = {
    maxOutstandingBytes: 8 * 1024 * 1024, // 8MB
    bufferedAmountLowThreshold: 256 * 1024, // 256KB - resume sending when buffer drops below this
};

type ProgressCallback = (progress: TransferProgress) => void;

/** --- Manages file sending with flow control --- */
export class Sender {
    private readonly config: SenderConfig;
    private readonly window: SlidingWindow;
    private readonly speedCalc = new SpeedCalculator();

    private dataChannel: RTCDataChannel | null = null;
    private file: File | null = null;
    private currentChunkIndex = 0;
    private totalChunks = 0;
    private sentBytes = 0;
    private startTime: number | null = null;
    private onProgress: ProgressCallback | null = null;

    // State
    private sending = false;
    private cancelled = false;

    // Resolve for sendFile promise
    private transferResolver: (() => void) | null = null;
    private transferRejecter: ((reason?: any) => void) | null = null;

    // Resolve for bufferedAmountLow callback
    private bufferLowResolver: (() => void) | null = null;

    constructor(config: Partial<SenderConfig> = {}) {
        this.config = {...DEFAULT_CONFIG, ...config};
        this.window = new SlidingWindow({
            maxOutstandingBytes: this.config.maxOutstandingBytes
        });
    }

    /** --- Initializes the sender with a data channel and progress callback --- */
    initialize(dataChannel: RTCDataChannel, onProgress: ProgressCallback): void {
        this.dataChannel = dataChannel;
        this.onProgress = onProgress;

        // Configure bufferedAmountLowThreshold for backpressure
        dataChannel.bufferedAmountLowThreshold = this.config.bufferedAmountLowThreshold;

        dataChannel.onbufferedamountlow = () => {
            // Resume sending when buffer drains
            if (this.bufferLowResolver) {
                this.bufferLowResolver();
                this.bufferLowResolver = null;
            }
        };
    }

    /** --- Handles incoming protocol messages from receiver --- */
    handleMessage(message: ProtocolMessage): void {
        switch (message.type) {
            case 'ack':
                this.handleAck(message as AckMessage);
                break;
            case 'nack':
                this.handleNack(message as NackMessage);
                break;
            case 'control':
                this.handleControl(message as ControlMessage);
                break;
            case 'transfer-complete': // Handle explicit completion message if needed
                // Usually handled via ACKs, but good for robustness
                break;
        }
    }

    /** --- Starts sending a file. Resolves when transfer is fully acknowledged --- */
    async sendFile(file: File): Promise<void> {
        if (!this.dataChannel || this.dataChannel.readyState !== 'open') {
            throw new Error('Data channel not ready');
        }

        this.file = file;
        this.totalChunks = Math.ceil(file.size / CHUNK_SIZE);
        this.currentChunkIndex = 0;
        this.sentBytes = 0;
        this.startTime = Date.now();
        this.sending = true;
        this.cancelled = false;
        this.speedCalc.reset();

        // Send file metadata first
        const metadata = createFileMetadata(file);
        this.dataChannel.send(JSON.stringify(metadata));

        this.updateProgress('transferring');

        // Create promise that resolves when transfer is complete
        return new Promise<void>((resolve, reject) => {
            this.transferResolver = resolve;
            this.transferRejecter = reject;

            // Start the send loop
            this.sendLoop().catch(error => {
                console.error("Send loop error:", error);
                this.cancel();
                reject(error);
            });
        });
    }

    /** --- Cancels the current transfer --- */
    cancel(): void {
        this.cancelled = true;
        this.sending = false;
        this.window.clear();
        this.updateProgress('failed', 'Transfer cancelled');
        toast.error('Transfer cancelled');

        if (this.transferRejecter) {
            this.transferRejecter(new Error('Transfer cancelled'));
            this.transferResolver = null;
            this.transferRejecter = null;
        }
    }

    /** --- Main send loop with backpressure --- */
    private async sendLoop(): Promise<void> {
        while (this.currentChunkIndex < this.totalChunks && this.sending && !this.cancelled) {
            // Wait for window space (receiver ACK backpressure)
            await this.window.waitForSpace();

            if (this.cancelled) break;

            // Wait for DataChannel buffer to drain (WebRTC backpressure)
            await this.waitForBufferLow();

            if (this.cancelled) break;

            // Send next chunk
            await this.sendChunk(this.currentChunkIndex);
            this.currentChunkIndex++;
        }
    }

    /** --- Sends a single chunk --- */
    private async sendChunk(chunkIndex: number): Promise<void> {
        if (!this.file || !this.dataChannel) return;

        const start = chunkIndex * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, this.file.size);
        const blob = this.file.slice(start, end);

        const buffer = await blob.arrayBuffer();
        const payload = new Uint8Array(buffer);
        const encodedChunk = encodeChunk(chunkIndex, payload);

        this.dataChannel.send(encodedChunk);
        this.window.markSent(chunkIndex);

        // Track for progress
        const chunkBytes = end - start;
        this.sentBytes += chunkBytes;
        this.speedCalc.addSample(chunkBytes);

        this.updateProgress('transferring');
    }

    /** --- Waits for DataChannel buffer to drain below threshold --- */
    private async waitForBufferLow(): Promise<void> {
        if (!this.dataChannel) return;

        if (this.dataChannel.bufferedAmount <= this.config.bufferedAmountLowThreshold) {
            return;
        }

        return new Promise<void>((resolve) => {
            this.bufferLowResolver = resolve;
        });
    }

    private handleAck(ack: AckMessage): void {
        this.window.onAck(ack.chunkIndex);

        // Check if transfer is complete
        if (this.currentChunkIndex >= this.totalChunks &&
            this.window.getStats().outstandingChunks === 0) {
            this.sending = false;
            this.updateProgress('completed');

            // Resolve the sendFile promise
            if (this.transferResolver) {
                this.transferResolver();
                this.transferResolver = null;
                this.transferRejecter = null;
            }
        }
    }

    private handleNack(nack: NackMessage): void {
        // Retransmit missing chunks
        const toRetransmit = this.window.getChunksForRetransmit(nack.missingChunks);
        for (const chunkIndex of toRetransmit) {
            this.sendChunk(chunkIndex);
        }
    }

    private handleControl(control: ControlMessage): void {
        switch (control.action) {
            case 'ready':
                // Receiver is ready to receive more
                this.window.resume();
                break;
            case 'pause':
                this.window.pause();
                this.updateProgress('paused');
                break;
            case 'resume':
                this.window.resume();
                this.updateProgress('transferring');
                break;
        }
    }

    private updateProgress(status: TransferProgress['status'], error?: string): void {
        if (!this.onProgress || !this.file) return;

        const now = Date.now();
        const elapsed = this.startTime ? (now - this.startTime) / 1000 : 0;
        const bytesRemaining = this.file.size - this.sentBytes;

        const progress: TransferProgress = {
            status,
            bytesTransferred: this.sentBytes,
            totalBytes: this.file.size,
            chunksTransferred: this.currentChunkIndex,
            totalChunks: this.totalChunks,
            startTime: this.startTime,
            currentSpeed: this.speedCalc.getInstantaneousSpeed(),
            averageSpeed: elapsed > 0 ? this.sentBytes / elapsed : 0,
            eta: calculateEta(bytesRemaining, this.speedCalc.getAverageSpeed()),
            error: error || null,
        };

        this.onProgress(progress);
    }
}
