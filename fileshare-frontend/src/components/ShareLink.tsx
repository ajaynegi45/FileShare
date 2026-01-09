'use client';

import {useState, useEffect, useRef} from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { FiCopy, FiCheck, FiLink, FiGrid } from 'react-icons/fi';
import { toast } from 'sonner'

interface ShareLinkProps {
    pin: string;
}

export default function ShareLink({ pin }: ShareLinkProps) {
    const [copied, setCopied] = useState(false);
    const [showQR, setShowQR] = useState(false);
    const [shareUrl, setShareUrl] = useState('');

    const [remaining, setRemaining] = useState(10 * 60); // 10 minutes in seconds
    const intervalRef = useRef<number | null>(null);

    useEffect(() => {
        const url = new URL(window.location.href);
        url.searchParams.set('join', pin);
        setShareUrl(url.toString());
    }, [pin]);


    useEffect(() => {
        // start countdown on mount
        if (intervalRef.current) window.clearInterval(intervalRef.current);
        intervalRef.current = window.setInterval(() => {
            setRemaining(prev => {
                if (prev <= 1) {
                    if (intervalRef.current) {
                        window.clearInterval(intervalRef.current);
                        intervalRef.current = null;
                    }
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => {
            if (intervalRef.current) {
                window.clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
        };
    }, [pin]); // restart timer if pin changes


    const expired = remaining <= 0;

    const formatRemainingLabel = (totalSeconds: number) => {
        const safe = Math.max(0, totalSeconds);

        if (safe === 0) return 'PIN expired';

        if (safe < 60) {
            return `PIN Expires in ${safe} seconds left. Hurry up.`;
        }

        const minutes = Math.floor(safe / 60);
        const seconds = safe % 60;

        return `PIN Expires in ${minutes}:${String(seconds).padStart(2, '0')} minutes`;
    };



    const showCopySuccess = (type: 'pin' | 'link') => {
        toast.success(
            type === 'pin'
                ? 'PIN copied'
                : 'Invite link copied',
            {
                description:
                    type === 'pin'
                        ? 'Share this PIN with the receiver.'
                        : 'Send this link to join instantly.',
                duration: 2500,
            }
        );
    };

    const showCopyError = () => {
        toast.error('Copy failed', {
            description: 'Long-press and copy manually.',
            duration: 3000,
        });
    };


    const copyToClipboard = async (text: string) => {

        if (expired) {
            toast.error('PIN expired', { description: 'This PIN has expired — try again.' });
            return;
        }

        // Fast path: modern Clipboard API (requires secure context & browser support)
        if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
            try {
                await navigator.clipboard.writeText(text);
                setCopied(true);
                showCopySuccess(text === pin ? 'pin' : 'link');
                setTimeout(() => setCopied(false), 2000);
            } catch (err) {
                console.warn('navigator.clipboard.writeText failed, falling back', err);
                showCopyError();

                // fallthrough to legacy fallback
            }
        }else {

        // Legacy fallback (widely supported, works on many mobile browsers / older Safari)
        try {
            const textarea = document.createElement('textarea');
            textarea.value = text;
            // Make textarea non-editable and visually off-screen
            textarea.setAttribute('readonly', '');
            textarea.style.position = 'absolute';
            textarea.style.left = '-9999px';
            document.body.appendChild(textarea);

            // iOS special handling: selectionRange is needed
            textarea.select();
            textarea.setSelectionRange(0, textarea.value.length);

            document.execCommand('copy');
            document.body.removeChild(textarea);
            setCopied(true);
            showCopySuccess(text === pin ? 'pin' : 'link');
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error('Fallback copy failed:', err);
            showCopyError();

        }
        }
    };


    return (
        <div className="space-y-4">
            {/* PIN Display */}
            <div className="flex flex-col items-center gap-3 p-4 bg-surface rounded-lg border border-border">
                <p className="text-xs text-secondary uppercase tracking-wider">Share this PIN</p>

                <div className="flex items-center gap-2">
                    <span className="text-3xl font-mono font-bold tracking-[0.2em] text-foreground">
                        {pin}
                    </span>
                    <button
                        onClick={() => copyToClipboard(pin)}
                        className={`p-2 rounded-md transition-colors cursor-pointer ${copied
                            ? 'text-green-500'
                            : 'text-secondary hover:text-foreground'
                        }`}
                        title="Copy PIN"
                    >
                        {copied ? <FiCheck className="w-5 h-5" /> : <FiCopy className="w-5 h-5" />}
                    </button>
                </div>
            </div>

            {/* Action buttons */}
            <div className="grid grid-cols-4 gap-2">
                <button
                    onClick={() => copyToClipboard(shareUrl)}
                    className="col-span-2 flex items-center justify-center gap-2 px-4 py-2 cursor-pointer bg-foreground text-background text-sm font-medium rounded-lg hover:opacity-90 transition-opacity"
                >
                    <FiLink className="w-4 h-4" />
                    Copy Link
                </button>

                <button
                    onClick={() => setShowQR(!showQR)}
                    className={`col-span-2 flex items-center justify-center gap-2  rounded-lg border transition-colors cursor-pointer ${showQR
                        ? 'bg-surface text-foreground border-border'
                        : 'bg-transparent border-border text-secondary hover:text-foreground'
                    }`}
                    title="Show QR Code"
                >
                    <FiGrid className="w-4 h-4" />
                    QR
                </button>
            </div>

            {/* QR Code */}
            {showQR && (
                <div className="flex justify-center p-4 bg-white rounded-lg animate-in fade-in zoom-in duration-200 border border-border">
                    <QRCodeSVG
                        value={shareUrl}
                        size={160}
                        level="M"
                        includeMargin={false}
                        fgColor="#000000"
                        bgColor="#ffffff"
                    />
                </div>
            )}

            <p className="text-xs text-center text-secondary">
                Keep this tab open. Transfers are direct peer-to-peer.
            </p>

            <p className="text-xs text-center text-secondary">
                {formatRemainingLabel(remaining)}
            </p>


        </div>
    );
}
