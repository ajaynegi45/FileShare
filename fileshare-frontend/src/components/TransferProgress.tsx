'use client';

import { type TransferProgress, formatBytes, formatSpeed, formatEta } from '@/lib/protocol/TransferState';
import { FiX, FiPause, FiPlay, FiAlertCircle } from 'react-icons/fi';

interface ProgressDisplayProps {
    progress: TransferProgress;
    role: 'sender' | 'receiver';
    onPause?: () => void;
    onResume?: () => void;
    onCancel?: () => void;
}

export default function TransferProgress({
    progress,
    role,
    onPause,
    onResume,
    onCancel,
}: ProgressDisplayProps) {
    const percentage = progress.totalBytes > 0
        ? Math.round((progress.bytesTransferred / progress.totalBytes) * 100)
        : 0;

    const isActive = progress.status === 'transferring' || progress.status === 'paused';
    const isFailed = progress.status === 'failed';

    return (
        <div className="space-y-4">
            {/* Progress bar */}
            <div className="space-y-2">
                <div className="flex justify-between text-xs text-neutral-400">
                    <span>{percentage}%</span>
                    <span>{formatBytes(progress.bytesTransferred)} / {formatBytes(progress.totalBytes)}</span>
                </div>
                <div className="relative w-full h-1.5 bg-neutral-700 rounded-full overflow-hidden">
                    <div className={`absolute left-0 top-0 h-full transition-all duration-300 ease-out ${isFailed ? 'bg-red-500' : progress.status === 'paused' ? 'bg-amber-500' : 'bg-neutral-300' }`}
                        style={{ width: `${percentage}%` }}
                    />
                </div>
            </div>

            {/* Error Message */}
            {isFailed && (
                <div className="flex items-center gap-2 text-sm text-red-500 bg-red-500/10 p-2 rounded">
                    <FiAlertCircle className="w-4 h-4" />
                    <span>{progress.error || 'Transfer failed'}</span>
                </div>
            )}

            {/* Active Stats */}
            {isActive && (
                <div className="grid grid-cols-2 gap-4 text-xs text-neutral-500">
                    <div>
                        <span className="block text-neutral-600 uppercase tracking-wider text-[10px]">Speed</span>
                        <span className="text-neutral-400">{formatSpeed(progress.currentSpeed)}</span>
                    </div>
                    <div className="text-right">
                        <span className="block text-neutral-600 uppercase tracking-wider text-[10px]">ETA</span>
                        <span className="text-neutral-400">{formatEta(progress.eta)}</span>
                    </div>
                </div>
            )}

            {/* Controls */}
            {isActive && (
                <div className="flex gap-2 pt-2">
                    {progress.status === 'paused' ? (
                        <button
                            onClick={onResume}
                            className="flex-1 flex items-center justify-center gap-2 py-2 bg-neutral-800 hover:bg-neutral-700 text-white text-xs font-medium rounded transition-colors cursor-pointer"
                        >
                            <FiPlay className="w-3 h-3" /> Resume
                        </button>
                    ) : (
                        <button
                            onClick={onPause}
                            className="flex-1 flex items-center justify-center gap-2 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-medium rounded transition-colors cursor-pointer"
                        >
                            <FiPause className="w-3 h-3" /> Pause
                        </button>
                    )}
                    <button
                        onClick={onCancel}
                        className="px-3 py-2 bg-neutral-900 border border-neutral-800 hover:border-red-900/50 hover:text-red-500 text-neutral-500 text-xs font-medium rounded transition-colors cursor-pointer"
                    >
                        <FiX className="w-4 h-4" />
                    </button>
                </div>
            )}
        </div>
    );
}
