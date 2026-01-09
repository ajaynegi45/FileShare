'use client';

import {useCallback, useEffect, useState} from 'react';
import {FiArrowRight, FiCamera, FiCheck, FiDownload, FiFile, FiX} from 'react-icons/fi';
import {Scanner} from '@yudiel/react-qr-scanner';
import {useP2P} from '@/lib/useP2P';
import TransferProgress from './TransferProgress';
import {formatBytes} from '@/lib/protocol/TransferState';
import {useTransferStore} from '@/store/useTransferStore';
import {validatePin} from '@/lib/ValidatePin';
import {toast} from "sonner";
import {ShimmeringText} from "@/components/ui/ShimmeringText";

interface FileDownloadProps {
    initialPin?: string;
    onCancel: () => void;
}


export default function FileDownload({initialPin, onCancel}: FileDownloadProps) {
    const [localPin, setLocalPin] = useState(initialPin || '');
    const [showScanner, setShowScanner] = useState(false);

    const {p2p, progress, resetAll} = useTransferStore();
    const {joinSession, pauseTransfer, resumeTransfer, cancelTransfer} = useP2P();

    // Joint state shorthand
    const isJoining = !!p2p.pin;

    const handleReset = async () => {
        setLocalPin('');
        setShowScanner(false);
        try {
            onCancel();
            cancelTransfer();
            resetAll();
        } catch (e) {
            console.warn('cancelTransfer failed', e);
        }
    };


    /** --- Orchestrates joining a session --- */
    const handleJoin = useCallback((targetPin?: string) => {
        const pinToUse = targetPin || localPin;
        if (validatePin(pinToUse)) {
            joinSession(pinToUse.toUpperCase());
        }
    }, [joinSession, localPin]);

    // Initial join from URL
    useEffect(() => {
        if (initialPin && !isJoining) {
            handleJoin(initialPin);
        }
    }, [initialPin, isJoining, handleJoin]);

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') handleJoin();
    };


    const handleScan = (text: string) => {
        if (text) {
            try {
                let extractedPin = text;
                if (text.includes('?join=')) {
                    const url = new URL(text);
                    const pinParam = url.searchParams.get('join');
                    if (pinParam) extractedPin = pinParam;
                }
                setLocalPin(extractedPin);
                setShowScanner(false);
                handleJoin(extractedPin);
            } catch (e) {
                toast.error("Invalid QR Code");
            }
        }
    };


    /* --- UI State: Completed --- */
    if (progress.status === 'completed') {
        return (
            <div className="text-center space-y-6 animate-in fade-in duration-300">
                <div
                    className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-surface text-green-500 mb-2 border border-border">
                    <FiCheck className="w-5 h-5"/>
                </div>
                <div>
                    <h3 className="text-lg font-medium text-foreground">Received</h3>
                    <p className="text-sm text-secondary">
                        Saved to device • {formatBytes(progress.bytesTransferred)}
                    </p>
                </div>
                <button
                    onClick={handleReset}
                    className="w-full py-2.5 bg-surface-hover text-foreground text-sm font-medium rounded-lg hover:bg-border transition-colors border border-border cursor-pointer">
                    Receive Another
                </button>
            </div>
        );
    }

    /* --- UI State: Transferring/Paused --- */
    if (progress.status === 'transferring' || progress.status === 'paused') {
        return (
            <div className="space-y-6">
                <div className="flex items-center gap-3 p-3 bg-surface rounded-lg border border-border">
                    <FiFile className="w-5 h-5 text-secondary"/>
                    <div className="flex-1">
                        <p className="text-sm font-medium text-foreground"><ShimmeringText text={"Receiving..."}
                                                                                           delay={1}/></p>
                        <p className="text-xs text-secondary">
                            {formatBytes(progress.bytesTransferred)} / {formatBytes(progress.totalBytes)}
                        </p>
                    </div>
                </div>
                <TransferProgress
                    progress={progress}
                    role="receiver"
                    onPause={pauseTransfer}
                    onResume={resumeTransfer}
                    onCancel={handleReset}
                />
            </div>
        );
    }

    /* --- UI State: Connected but Idle --- */
    if (p2p.isConnected) {
        return (
            <div className="text-center py-8 space-y-4">
                <div className="relative inline-flex">
                    <div className="w-3 h-3 bg-green-500 rounded-full animate-ping absolute top-0 right-0"/>
                    <FiDownload className="w-8 h-8 text-foreground"/>
                </div>
                <h3 className="text-lg font-medium text-foreground">Connected</h3>
                <p className="text-sm text-secondary">Waiting for sender...</p>
            </div>
        );
    }

    /* --- UI State: Connecting --- */
    if (isJoining) {
        return (
            <div className="text-center py-8 space-y-4">

                {p2p.error ? (
                    <p className="text-sm text-red-500 bg-red-500/10 py-1 px-3 rounded-full inline-block">
                        {p2p.error}
                    </p>
                ) : (<div>
                        <div
                            className="w-8 h-8 border-2 border-secondary mb-1 border-t-foreground rounded-full animate-spin mx-auto"/>
                        <h3 className="text-lg font-medium text-foreground"><ShimmeringText text={"Connecting..."}/>
                        </h3>
                    </div>
                )
                }
                <button onClick={handleReset}
                        className="block w-full text-xs text-secondary hover:text-foreground mt-4 transition-colors cursor-pointer">
                    Cancel
                </button>
            </div>
        );
    }

    /* --- UI State: QR Scanner --- */
    if (showScanner) {
        return (
            <div className="relative rounded-lg overflow-hidden bg-black aspect-square max-w-sm mx-auto shadow-lg">
                <Scanner onScan={(result) => handleScan(result[0].rawValue)}/>
                <button
                    onClick={() => setShowScanner(false)}
                    className="absolute top-4 right-4 p-2 bg-black/50 text-white rounded-full hover:bg-black/80 backdrop-blur-sm cursor-pointer">
                    <FiX className="w-5 h-5"/>
                </button>
            </div>
        );
    }

    /* --- Default: Input PIN UI --- */
    return (
        <div className="space-y-6 overflow-hidden">
            <div className="space-y-2">
                <label className="text-xs font-medium text-secondary uppercase tracking-wider">
                    Enter PIN
                </label>
                <div className="flex gap-2">
                    <input
                        type="text"
                        value={localPin}
                        maxLength={6}
                        onChange={(e) => setLocalPin(e.target.value.toUpperCase().substring(0, 6))}
                        onKeyPress={handleKeyPress}
                        placeholder="000000"
                        className="flex-1 bg-surface border border-border rounded-lg px-4 py-3 w-full
                        text-2xl font-mono text-center tracking-[0.2em] text-foreground placeholder-secondary
                        focus:outline-none focus:border-accent transition-colors"
                        autoComplete="off"
                    />
                </div>
            </div>

            <div className="grid grid-cols-4 gap-2">
                <button
                    onClick={() => handleJoin()}
                    disabled={localPin.length !== 6}
                    className={`col-span-2 flex items-center justify-center gap-2 py-3 rounded-lg font-medium text-sm transition-all
                    ${localPin.length >= 6
                        ? 'bg-foreground text-background hover:opacity-90 cursor-pointer'
                        : 'bg-surface text-secondary cursor-not-allowed'}`}>
                    Connect <FiArrowRight className="w-4 h-4"/>
                </button>

                <button
                    onClick={() => setShowScanner(true)}
                    className="col-span-2 flex items-center gap-2 justify-center bg-surface border border-border text-secondary hover:text-foreground rounded-lg transition-colors">
                    <FiCamera className="w-5 h-5"/> Scan QR
                </button>
            </div>
        </div>
    );
}
