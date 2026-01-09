'use client';

import React, {useEffect, useState} from 'react';
import {usePathname, useRouter, useSearchParams} from 'next/navigation';
import FileUpload from '@/components/FileUpload';
import FileDownload from '@/components/FileDownload';
import ThemeToggle from '@/components/ThemeToggle';
import {motion} from "framer-motion";

export default function Home() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const pathname = usePathname();
    const [activeTab, setActiveTab] = useState<'upload' | 'download'>('upload');
    const [joinPin, setJoinPin] = useState<string | null>(null);

    useEffect(() => {
        const pin = searchParams.get('join');
        if (!pin) return;
        setJoinPin(pin);
        setActiveTab('download');
    }, [searchParams]);


    const cancelJoin = () => {
        setJoinPin(null);

        const params = new URLSearchParams(searchParams.toString());
        params.delete('join');

        const nextUrl = params.toString().length > 0 ? `${pathname}?${params.toString()}` : pathname;
        router.replace(nextUrl, {scroll: false});
    };

    return (
        <main
            className="min-h-screen flex flex-col items-center justify-center py-6 px-2 bg-background text-foreground transition-colors duration-300">
            <div className="w-full max-w-md space-y-8">


                {/* --- Header with Theme Toggle --- */}
                <div className="flex items-center justify-between">
                    <div className="space-y-1">
                        <h1 className="text-2xl font-semibold tracking-tight">FileShare</h1>
                        <p className="text-secondary text-sm">Secure P2P File Transfer</p>
                    </div>
                    <ThemeToggle/>
                </div>


                {/* --- Tab Control --- */}
                <div
                    className="grid grid-cols-2 p-1 bg-surface rounded-lg border border-border relative overflow-hidden ">
                    <motion.button
                        onClick={() => setActiveTab('upload')}
                        className={` relative
              py-2 text-sm font-medium rounded-md transition-colors duration-200 focus:outline-none
              ${activeTab === 'upload'
                            ? 'bg-background text-foreground shadow-sm cursor-default'
                            : 'text-secondary hover:text-foreground cursor-pointer'}   
            `}
                        transition={{type: 'spring', bounce: 0.2, duration: 0.6}}
                    >Send
                    </motion.button>

                    <motion.button
                        onClick={() => setActiveTab('download')}
                        className={`
              py-2 text-sm font-medium rounded-md transition-all duration-200
              ${activeTab === 'download'
                            ? 'bg-background text-foreground shadow-sm cursor-default'
                            : 'text-secondary hover:text-foreground cursor-pointer'}
            `}
                        transition={{type: 'spring', bounce: 0.2, duration: 0.6}}
                    >Receive
                    </motion.button>
                </div>


                {/* --- Card Content --- */}
                <div className="bg-surface/50 border border-border rounded-xl p-6 backdrop-blur-sm">
                    {activeTab === 'upload' ? (
                        <FileUpload/>
                    ) : (
                        <FileDownload initialPin={joinPin || undefined} onCancel={cancelJoin}/>
                    )}
                </div>


                {/* --- Minimal Footer --- */}
                <div className="flex justify-center gap-6 text-xs text-secondary">
                    <span>End-to-End Encrypted</span>
                    <span>•</span>
                    <span>No Server Storage</span>
                    <span>•</span>
                    {/*<span>Unlimited Size</span>*/}
                    <span>No Login</span>
                </div>
            </div>
        </main>
    );
}
