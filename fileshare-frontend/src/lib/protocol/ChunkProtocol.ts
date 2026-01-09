/**
 * Chunked streaming protocol for P2P file transfer.
 * 
 * BINARY FRAME FORMAT:
 * [0-3]   chunkIndex    (uint32, big-endian)
 * [4-7]   payloadLength (uint32, big-endian)
 * [8-N]   payload       (raw bytes)
 * 
 * DESIGN DECISIONS:
 * - Fixed 64KB chunks balance throughput with memory usage
 * - Binary format avoids base64 overhead (33% savings)
 * - Big-endian for network byte order consistency
 * - Separate metadata message for file info (not in every chunk)
 */

export const CHUNK_SIZE = 64 * 1024; // 64KB per chunk
export const HEADER_SIZE = 8; // 4 bytes chunkIndex + 4 bytes payloadLength

/** --- Encodes a chunk with binary header for transport --- */
export function encodeChunk(chunkIndex: number, payload: Uint8Array): ArrayBuffer {
    const buffer = new ArrayBuffer(HEADER_SIZE + payload.byteLength);
    const view = new DataView(buffer);

    view.setUint32(0, chunkIndex, false); // Big-endian
    view.setUint32(4, payload.byteLength, false);

    new Uint8Array(buffer, HEADER_SIZE).set(payload);

    return buffer;
}

/** --- Decodes a chunk from binary transport format --- */
export function decodeChunk(buffer: ArrayBuffer): { chunkIndex: number; payload: Uint8Array } {
    const view = new DataView(buffer);

    const chunkIndex = view.getUint32(0, false);
    const payloadLength = view.getUint32(4, false);

    // Validate payload length matches buffer size
    if (payloadLength !== buffer.byteLength - HEADER_SIZE) {
        throw new Error(`Payload length mismatch: expected ${payloadLength}, got ${buffer.byteLength - HEADER_SIZE}`);
    }

    const payload = new Uint8Array(buffer, HEADER_SIZE, payloadLength);

    return { chunkIndex, payload };
}

/** --- Calculates total number of chunks for a file --- */
export function calculateTotalChunks(fileSize: number): number {
    return Math.ceil(fileSize / CHUNK_SIZE);
}

/** --- File metadata sent before transfer begins --- */
export interface FileMetadata {
    type: 'file-meta';
    name: string;
    size: number;
    mimeType: string;
    totalChunks: number;
    checksum?: string; // Optional SHA-256 for integrity verification
}

/** --- Creates file metadata message --- */
export function createFileMetadata(file: File): FileMetadata {
    return {
        type: 'file-meta',
        name: file.name,
        size: file.size,
        mimeType: file.type || 'application/octet-stream',
        totalChunks: calculateTotalChunks(file.size),
    };
}

/** --- ACK message sent by receiver to acknowledge received chunks --- */
export interface AckMessage {
    type: 'ack';
    chunkIndex: number;
}

/** --- NACK message sent by receiver to request missing chunks --- */
export interface NackMessage {
    type: 'nack';
    missingChunks: number[];
}

/** --- Transfer complete message --- */
export interface TransferCompleteMessage {
    type: 'transfer-complete';
    success: boolean;
    bytesReceived: number;
}

/** --- Received ranges for resume support --- */
export interface ReceivedRangesMessage {
    type: 'received-ranges';
    ranges: [number, number][]; // Array of [start, end] inclusive ranges
}

/** --- Control messages for flow control --- */
export interface ControlMessage {
    type: 'control';
    action: 'ready' | 'pause' | 'resume';
}

export type ProtocolMessage =
    | FileMetadata
    | AckMessage
    | NackMessage
    | TransferCompleteMessage
    | ReceivedRangesMessage
    | ControlMessage;

/**
 * Type guard for protocol messages (JSON control messages).
 * Binary chunks are handled separately.
 */
export function isProtocolMessage(data: unknown): data is ProtocolMessage {
    return typeof data === 'object' && data !== null && 'type' in data;
}

/** --- Checks if data is a binary chunk (ArrayBuffer) --- */
export function isBinaryChunk(data: unknown): data is ArrayBuffer {
    return data instanceof ArrayBuffer;
}
