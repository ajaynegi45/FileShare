'use client';

import React, {useMemo, useRef} from 'react';
import {motion, useInView, UseInViewOptions} from 'motion/react';

interface ShimmeringTextProps {
    text: string;                                   /** Text to display with shimmer effect */
    duration?: number;                              /** Animation duration in seconds */
    delay?: number;                                 /** Delay before starting animation */
    repeat?: boolean;                               /** Whether to repeat the animation */
    repeatDelay?: number;                           /** Pause duration between repeats in seconds */
    className?: string;                             /** Custom className */
    startOnView?: boolean;                          /** Whether to start animation when component enters viewport */
    once?: boolean;                                 /** Whether to animate only once */
    inViewMargin?: UseInViewOptions['margin'];      /** Margin for in-view detection (rootMargin) */
    spread?: number;                                /** Shimmer spread multiplier */
    color?: string;                                 /** Base text color */
    shimmerColor?: string;                          /** Shimmer gradient color */
}

export function ShimmeringText({ text, duration = 2, delay = 0, repeat = true, repeatDelay = 0, startOnView = true, once = false, inViewMargin, spread = 3, color, shimmerColor,}: ShimmeringTextProps) {
    const ref = useRef<HTMLSpanElement>(null);
    const isInView = useInView(ref, {once, margin: inViewMargin});

    // Calculate dynamic spread based on text length
    const dynamicSpread = useMemo(() => {
        return text.length * spread;
    }, [text, spread]);

    // Determine if we should start animation
    const shouldAnimate = !startOnView || isInView;

    return (
        <motion.span
            ref={ref}
            className={" relative inline-block bg-[length:250%_100%,auto] bg-clip-text text-transparent [--base-color:var(--color-zinc-400)] [--shimmer-color:var(--color-zinc-950)] [background-repeat:no-repeat,padding-box] [--shimmer-bg:linear-gradient(90deg,transparent_calc(50%-var(--spread)),var(--shimmer-color),transparent_calc(50%+var(--spread)))] dark:[--base-color:var(--color-zinc-600)] dark:[--shimmer-color:var(--color-white)]"}
            style={{
                    '--spread': `${dynamicSpread}px`,
                    ...(color && {'--base-color': color}),
                    ...(shimmerColor && {'--shimmer-color': shimmerColor}),
                    backgroundImage: `var(--shimmer-bg), linear-gradient(var(--base-color), var(--base-color))`,
                } as React.CSSProperties }
            initial={{
                backgroundPosition: '100% center',
                opacity: 0,
            }}
            animate={ shouldAnimate ? {
                        backgroundPosition: '0% center',
                        opacity: 1,
                    } : {}
            }
            transition={{
                backgroundPosition: {
                    repeat: repeat ? Infinity : 0,
                    duration,
                    delay,
                    repeatDelay,
                    ease: 'linear',
                },
                opacity: {
                    duration: 0.1,
                    delay,
                },
            }}
        >
            {text}
        </motion.span>
    );
}
