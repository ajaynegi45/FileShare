import React, {useState} from 'react';
import {motion} from 'framer-motion';

const TABS = [
    {
        id: 'emails',
        label: 'Share a file',
        icon: (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" className="w-4 h-4 fill-current">
                <path
                    d="M104,152a8,8,0,0,1-8,8H56a8,8,0,0,1,0-16H96A8,8,0,0,1,104,152ZM168,32h24a8,8,0,0,0,0-16H160a8,8,0,0,0-8,8V56h16Zm72,84v60a16,16,0,0,1-16,16H136v32a8,8,0,0,1-16,0V192H32a16,16,0,0,1-16-16V116A60.07,60.07,0,0,1,76,56h76v88a8,8,0,0,0,16,0V56h12A60.07,60.07,0,0,1,240,116Zm-120,0a44,44,0,0,0-88,0v60h88Z"/>
            </svg>
        ),
    },
    {
        id: 'attachments',
        label: 'Receive a file',
        icon: (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" className="w-4 h-4 fill-current">
                <path
                    d="M209.66,122.34a8,8,0,0,1,0,11.32l-82.05,82a56,56,0,0,1-79.2-79.21L147.67,35.73a40,40,0,1,1,56.61,56.55L105,193A24,24,0,1,1,71,159L154.3,74.38A8,8,0,1,1,165.7,85.6L82.39,170.31a8,8,0,1,0,11.27,11.36L192.93,81A24,24,0,1,0,159,47L59.76,147.68a40,40,0,1,0,56.53,56.62l82.06-82A8,8,0,0,1,209.66,122.34Z"/>
            </svg>
        ),
    },
];

export default function FileTab() {
    const [activeTab, setActiveTab] = useState(TABS[0].id);

    return (
        <>
            <div className="grid grid-cols-2 p-1 bg-surface rounded-lg border border-border relative overflow-hidden ">
                {TABS.map((tab) => {
                    const isActive = activeTab === tab.id;
                    return (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className="relative flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors duration-300 focus:outline-none"
                            style={{
                                color: isActive ? '#fff' : 'rgba(237, 237, 237, 0.5)',
                            }}
                        >
                            {/* Background Shadow/Glow (Visible when active) */}
                            {isActive && (
                                <motion.div
                                    layoutId="active-pill"
                                    className="absolute inset-0 z-0 bg-linear-to-b from-[#151515] to-[#1f1f1f] rounded-lg shadow-[inset_0_1px_0_0_rgba(255,255,255,0.1)]"
                                    transition={{type: 'spring', bounce: 0.2, duration: 0.6}}
                                />
                            )}

                            {/* Bottom Highlight Line (The "Framer" look) */}
                            {isActive && (
                                <motion.div
                                    layoutId="active-line"
                                    className="absolute -bottom-px left-2 right-2 h-px bg-white z-10"
                                    initial={{opacity: 0}}
                                    animate={{opacity: 0.4}}
                                    transition={{duration: 0.3}}
                                >
                                    <div className="absolute inset-0 bg-white blur-xs"/>
                                </motion.div>
                            )}

                            {/* Content */}
                            <span className="relative z-10 flex items-center gap-2">
                  <span className={isActive ? 'text-white' : 'text-zinc-500'}>
                    {tab.icon}
                  </span>
                                {tab.label}
                </span>

                            {/* Subtle outer glow effect on active */}
                            {isActive && (
                                <motion.div
                                    layoutId="glow"
                                    className="absolute -bottom-4 left-1/2 -translate-x-1/2 w-12 h-8 bg-white/10 blur-xl rounded-full z-0"
                                    transition={{type: 'spring', bounce: 0.2, duration: 0.6}}
                                />
                            )}
                        </button>
                    );
                })}
            </div>

            {/* Bottom decorative line from the snippet */}
            {/*// <div className="mt-8 w-full h-px bg-[#050505] shadow-[0_1px_0_0_rgba(66,66,66,0.4)]"/>*/}

        </>
    );
}