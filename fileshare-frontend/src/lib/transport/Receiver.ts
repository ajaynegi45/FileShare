/**
 * Receiver transport for chunked file transfer.
 *
 * MEMORY MANAGEMENT:
 * - Supports File System Access API for direct-to-disk streaming (Chrome/Edge)
 * - Falls back to in-memory Blob accumulation for other browsers
 * - Sends ACKs to enable sender backpressure
 *
 * RELIABILITY:
 * - Tracks received chunks for gap detection
 * - Sends NACKs for missing chunks
 * - Supports resume via received ranges exchange
 */

import { CHUNK_SIZE, decodeChunk, type FileMetadata, type AckMessage, type NackMessage, type TransferCompleteMessage, type ControlMessage, type ProtocolMessage, isBinaryChunk } from '../protocol/ChunkProtocol';
import { ReceivedRanges } from '../protocol/FlowControl';
import { type TransferProgress, SpeedCalculator, calculateEta } from '../protocol/TransferState';
import {toast} from "sonner";

export interface ReceiverConfig {
    // ACK frequency: send ACK every N chunks (batch ACK optimization)
    ackBatchSize: number;
    // NACK timeout: request missing chunks after this delay
    nackTimeoutMs: number;
}

const DEFAULT_CONFIG: ReceiverConfig = {
    ackBatchSize: 4, // ACK every 4 chunks (~256KB)
    nackTimeoutMs: 2000, // Request missing after 2 seconds
};

type ProgressCallback = (progress: TransferProgress) => void;

/** --- Manages file receiving with chunk reassembly --- */
export class Receiver {
    private readonly config: ReceiverConfig;
    private readonly speedCalc = new SpeedCalculator();

    private dataChannel: RTCDataChannel | null = null;
    private onProgress: ProgressCallback | null = null;

    // File metadata (received from sender)
    private fileMeta: FileMetadata | null = null;
    private receivedRanges: ReceivedRanges | null = null;

    // Chunk storage
    private chunks: Map<number, Uint8Array> = new Map();
    private receivedBytes = 0;
    private startTime: number | null = null;

    // File System Access API handle (for direct-to-disk streaming)
    private fileHandle: FileSystemFileHandle | null = null;
    private writableStream: FileSystemWritableFileStream | null = null;

    // ACK batching
    private pendingAcks: number[] = [];
    private nackTimer: ReturnType<typeof setTimeout> | null = null;

    constructor(config: Partial<ReceiverConfig> = {}) {
        this.config = { ...DEFAULT_CONFIG, ...config };
    }

    /** --- Initializes the receiver with a data channel and progress callback --- */
    initialize(dataChannel: RTCDataChannel, onProgress: ProgressCallback): void {
        this.dataChannel = dataChannel;
        this.onProgress = onProgress;

        dataChannel.binaryType = 'arraybuffer';
        dataChannel.onmessage = (event) => this.handleDataChannelMessage(event);
    }

    /** --- Handles incoming data (both binary chunks and JSON messages) --- */
    private handleDataChannelMessage(event: MessageEvent): void {
        const data = event.data;

        if (isBinaryChunk(data)) {
            this.handleBinaryChunk(data);
        } else if (typeof data === 'string') {
            try {
                const message = JSON.parse(data) as ProtocolMessage;
                this.handleProtocolMessage(message);
            } catch {
                console.error('Failed to parse message:', data);
            }
        }
    }

    /** --- Handles file metadata from sender --- */
    private handleProtocolMessage(message: ProtocolMessage): void {
        switch (message.type) {
            case 'file-meta':
                this.handleFileMetadata(message as FileMetadata);
                break;
            case 'control':
                // Handle sender control messages if needed
                break;
        }
    }

    /** --- Sets up receiving for a new file --- */
    private handleFileMetadata(meta: FileMetadata): void {
        this.fileMeta = meta;
        this.receivedRanges = new ReceivedRanges(meta.totalChunks);
        this.chunks.clear();
        this.receivedBytes = 0;
        this.startTime = Date.now();
        this.speedCalc.reset();

        this.updateProgress('transferring');

        // Try to get file handle for direct-to-disk streaming
        this.tryGetFileHandle(meta.name);

        // Start NACK timer for detecting gaps
        this.startNackTimer();

        // Send ready message to sender
        this.sendControl('ready');
    }

    /** --- Handles a received binary chunk --- */
    private handleBinaryChunk(buffer: ArrayBuffer): void {
        if (!this.fileMeta || !this.receivedRanges) {
            console.error('Received chunk before metadata');
            return;
        }

        try {
            const { chunkIndex, payload } = decodeChunk(buffer);

            // Skip duplicates
            if (this.receivedRanges.hasChunk(chunkIndex)) {
                return;
            }

            // Store or stream chunk
            if (this.writableStream) {
                // Direct-to-disk: write immediately
                this.writeChunkToDisk(chunkIndex, payload);
            } else {
                // In-memory: store for later assembly
                this.chunks.set(chunkIndex, payload);
            }

            this.receivedRanges.markReceived(chunkIndex);
            this.receivedBytes += payload.byteLength;
            this.speedCalc.addSample(payload.byteLength);

            // Queue ACK
            this.pendingAcks.push(chunkIndex);
            if (this.pendingAcks.length >= this.config.ackBatchSize) {
                this.sendAcks();
            }

            this.updateProgress('transferring');

            // Check for completion
            if (this.receivedRanges.isComplete()) {
                this.completeTransfer();
            }
        } catch (error) {
            console.error('Failed to process chunk:', error);
        }
    }

    /** --- Writes a chunk directly to disk (File System Access API) --- */
    private async writeChunkToDisk(chunkIndex: number, payload: Uint8Array): Promise<void> {
        if (!this.writableStream || !this.fileMeta) return;

        const position = chunkIndex * CHUNK_SIZE;
        await this.writableStream.seek(position);
        await this.writableStream.write(new Uint8Array(payload.buffer) as BlobPart);
    }

    /** --- Attempts to get a file handle for direct-to-disk streaming --- */
    private async tryGetFileHandle(suggestedName: string): Promise<void> {
        // Check if File System Access API is available
        if (!('showSaveFilePicker' in window)) {
            console.log('File System Access API not available, using in-memory storage');
            return;
        }

        try {
            // Show save dialog to user
            this.fileHandle = await (window as any).showSaveFilePicker({
                suggestedName,
                types: [{
                    description: 'All Files',
                    accept: { '*/*': [] },
                }],
            });

            this.writableStream = await this.fileHandle!.createWritable();
        } catch (error) {
            // User cancelled or API not supported
            console.log('Using in-memory storage:', error);
        }
    }

    /** --- Sends batched ACKs to sender --- */
    private sendAcks(): void {
        if (!this.dataChannel || this.pendingAcks.length === 0) return;

        // Send individual ACKs (could optimize with batch ACK message)
        for (const chunkIndex of this.pendingAcks) {
            const ack: AckMessage = { type: 'ack', chunkIndex };
            this.dataChannel.send(JSON.stringify(ack));
        }
        this.pendingAcks = [];
    }

    /** --- Sends a control message to sender --- */
    private sendControl(action: ControlMessage['action']): void {
        if (!this.dataChannel) return;
        const msg: ControlMessage = { type: 'control', action };
        this.dataChannel.send(JSON.stringify(msg));
    }

    /** Receiver: improved sendNack + message handling */
    private sendNack(): void {
        if (!this.dataChannel || !this.receivedRanges) return;

        const missing = this.receivedRanges.getMissingChunks();
        if (missing.length === 0 || missing.length >= 100) return; // keep existing heuristics

        // If channel isn't open, don't attempt to send; inform user instead
        if (this.dataChannel.readyState !== 'open') {
            toast.error('Transfer aborted', {
                description: 'Sender disconnected or canceled.',
                duration: 5000,
            });
            return;
        }

        const nack: NackMessage = { type: 'nack', missingChunks: missing.slice(0, 20) };
        try {
            this.dataChannel.send(JSON.stringify(nack));
        } catch (err) {
            console.error('Failed to send NACK', err);
            toast.error('Network error', { description: 'Could not request missing chunks.' });
        }
    }

    /** --- Starts timer for detecting and NACKing missing chunks --- */
    private startNackTimer(): void {
        this.nackTimer = setInterval(() => {
            if (this.receivedRanges && !this.receivedRanges.isComplete()) {
                this.sendNack();
            }
        }, this.config.nackTimeoutMs);
    }

    /** --- Completes the transfer and assembles the file --- */
    private async completeTransfer(): Promise<void> {
        // Send any remaining ACKs
        this.sendAcks();

        // Clear NACK timer
        if (this.nackTimer) {
            clearInterval(this.nackTimer);
            this.nackTimer = null;
        }

        if (this.writableStream) {
            // Close the file stream
            await this.writableStream.close();
            this.updateProgress('completed');
        } else {
            // Assemble in-memory chunks into downloadable blob
            this.assembleAndDownload();
        }

        // Notify sender
        if (this.dataChannel && this.fileMeta) {
            const complete: TransferCompleteMessage = {
                type: 'transfer-complete',
                success: true,
                bytesReceived: this.receivedBytes,
            };
            this.dataChannel.send(JSON.stringify(complete));
        }
    }

    /** --- Assembles chunks into a blob and triggers download --- */
    private assembleAndDownload(): void {
        if (!this.fileMeta) return;

        // Sort chunks by index
        const sortedIndices = Array.from(this.chunks.keys()).sort((a, b) => a - b);
        const parts: Uint8Array[] = sortedIndices.map(i => this.chunks.get(i)!);

        const blob = new Blob(parts as BlobPart[], { type: this.fileMeta.mimeType });
        const url = URL.createObjectURL(blob);

        // Trigger download
        const a = document.createElement('a');
        a.href = url;
        a.download = this.fileMeta.name;
        a.click();

        // Cleanup
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        this.chunks.clear();

        this.updateProgress('completed');
    }

    /** --- Returns received ranges for resume protocol --- */
    getReceivedRanges(): [number, number][] {
        return this.receivedRanges?.getRanges() || [];
    }

    /** --- Loads previously received ranges for resume --- */
    loadReceivedRanges(ranges: [number, number][]): void {
        this.receivedRanges?.loadFromRanges(ranges);
    }

    /** --- Pauses receiving (e.g., for user interaction) --- */
    pause(): void {
        this.sendControl('pause');
        this.updateProgress('paused');
    }

    /** --- Resumes receiving --- */
    resume(): void {
        this.sendControl('resume');
        this.updateProgress('transferring');
    }

    private updateProgress(status: TransferProgress['status'], error?: string): void {
        if (!this.onProgress) return;

        const totalBytes = this.fileMeta?.size || 0;
        const bytesRemaining = totalBytes - this.receivedBytes;

        const progress: TransferProgress = {
            status,
            bytesTransferred: this.receivedBytes,
            totalBytes,
            chunksTransferred: this.receivedRanges?.getRanges().length || 0,
            totalChunks: this.fileMeta?.totalChunks || 0,
            startTime: this.startTime,
            currentSpeed: this.speedCalc.getInstantaneousSpeed(),
            averageSpeed: this.startTime
                ? this.receivedBytes / ((Date.now() - this.startTime) / 1000)
                : 0,
            eta: calculateEta(bytesRemaining, this.speedCalc.getAverageSpeed()),
            error: error || null,
        };

        this.onProgress(progress);
    }

    /** --- Cleans up resources --- */
    cleanup(): void {
        if (this.nackTimer) {
            clearInterval(this.nackTimer);
        }
        if (this.writableStream) {
            this.writableStream.close().catch(() => { });
        }
        this.chunks.clear();
    }
}
