/**
 * Transfer state management.
 * 
 * Immutable state updates via spread operator ensure
 * React can detect changes for re-rendering.
 */

export type TransferStatus =
    | 'idle'
    | 'connecting'
    | 'waiting-for-peer'
    | 'transferring'
    | 'paused'
    | 'completed'
    | 'failed';

export interface TransferProgress {
    status: TransferStatus;
    bytesTransferred: number;
    totalBytes: number;
    chunksTransferred: number;
    totalChunks: number;
    startTime: number | null;
    currentSpeed: number;      // bytes per second (instantaneous)
    averageSpeed: number;      // bytes per second (average)
    eta: number | null;         // seconds remaining
    error: string | null;
}

export const INITIAL_PROGRESS: TransferProgress = {
    status: 'idle',
    bytesTransferred: 0,
    totalBytes: 0,
    chunksTransferred: 0,
    totalChunks: 0,
    startTime: null,
    currentSpeed: 0,
    averageSpeed: 0,
    eta: null,
    error: null,
};

/** --- Speed calculator with moving average for smooth display --- */
export class SpeedCalculator {
    private samples: { timestamp: number; bytes: number }[] = [];
    private readonly windowMs = 3000; // 3 second moving window
    private readonly maxSamples = 30;

    addSample(bytes: number): void {
        const now = Date.now();
        this.samples.push({ timestamp: now, bytes });

        // Prune old samples
        const cutoff = now - this.windowMs;
        this.samples = this.samples.filter(s => s.timestamp > cutoff);

        // Keep bounded
        if (this.samples.length > this.maxSamples) {
            this.samples = this.samples.slice(-this.maxSamples);
        }
    }

    /** --- Returns instantaneous speed (last sample period) --- */
    getInstantaneousSpeed(): number {
        if (this.samples.length < 2) return 0;

        const recent = this.samples.slice(-2);
        const timeDiff = (recent[1].timestamp - recent[0].timestamp) / 1000;
        if (timeDiff <= 0) return 0;

        return recent[1].bytes / timeDiff;
    }

    /** --- Returns average speed over the window --- */
    getAverageSpeed(): number {
        if (this.samples.length < 2) return 0;

        const first = this.samples[0];
        const last = this.samples[this.samples.length - 1];
        const timeDiff = (last.timestamp - first.timestamp) / 1000;
        if (timeDiff <= 0) return 0;

        const totalBytes = this.samples.reduce((sum, s) => sum + s.bytes, 0);
        return totalBytes / timeDiff;
    }

    reset(): void {
        this.samples = [];
    }
}

/** --- Calculates ETA based on remaining bytes and current speed --- */
export function calculateEta( bytesRemaining: number, speedBytesPerSecond: number ): number | null {
    if (speedBytesPerSecond <= 0) return null;
    return Math.ceil(bytesRemaining / speedBytesPerSecond);
}

/** --- Formats bytes for human-readable display --- */
export function formatBytes( bytes: number ): string {
    if (bytes === 0) return '0 B';

    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const k = 1024;
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + units[i];
}

/** --- Formats speed for human-readable display --- */
export function formatSpeed( bytesPerSecond: number ): string {
    return formatBytes(bytesPerSecond) + '/s';
}

/** --- Formats ETA for human-readable display --- */
export function formatEta( seconds: number | null ): string {
    if (seconds === null) return '--:--';

    if (seconds < 60) {
        return `${seconds}s`;
    } else if (seconds < 3600) {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}m ${secs}s`;
    } else {
        const hours = Math.floor(seconds / 3600);
        const mins = Math.floor((seconds % 3600) / 60);
        return `${hours}h ${mins}m`;
    }
}
