"use client";

import React, {useState} from "react";
import {motion, type Transition, useMotionValueEvent, useReducedMotion, useScroll} from "framer-motion";
import {span} from "motion/react-client";

export default function Navbar() {
    const {scrollY} = useScroll();
    const [scrolled, setScrolled] = useState(false);
    const reduceMotion = useReducedMotion();

    useMotionValueEvent(scrollY, "change", (y) => {
        setScrolled(y > 4);
    });

    const transition: Transition = reduceMotion
        ? {duration: 0}
        : {
            duration: 0.9,
            ease: [0.16, 1, 0.3, 1],
        };

    return (

        <>
            <div className="fixed top-0 left-0 right-0 z-50 flex justify-center pointer-events-none">
                <motion.nav
                    initial={false}
                    animate={scrolled ? "floating" : "top"}
                    variants={{
                        top: {
                            width: "100%",
                            marginTop: 0,
                            borderRadius: "0px",
                            backdropFilter: "blur(0px)",
                            boxShadow: "0 0 0 rgba(0,0,0,0)",
                            border: "none",
                            transition,
                        },
                        floating: {
                            width: "500px",
                            marginTop: 16,
                            borderRadius: "50px",
                            backdropFilter: "blur(14px)",
                            boxShadow: "0 12px 40px rgba(0,0,0,0.18)",
                            border: "solid 0.8px #808080",
                            transition,
                        },
                    }}
                    className="
          pointer-events-auto
          h-14 px-6
          flex items-center justify-between
          text-(--foreground)
          w-full
          backdrop-saturate-150
        "
                >
                    <div className="flex items-center gap-2 font-medium">
                        <div
                            className="h-8 w-8 rounded-md bg-(--accent) text-(--accent-foreground) flex items-center justify-center">
                            FS
                        </div>
                        <span className="hidden sm:inline">FileShare</span>
                    </div>

                    <div className="flex gap-6 text-sm text-(--secondary)">
                        <a className="hover:text-(--foreground) cursor-pointer">Contact</a>
                        <a className="hover:text-(--foreground) cursor-pointer">About Us</a>

                    </div>

                    {/*<button className="rounded-md px-3 py-1.5 text-sm bg-(--accent) text-(--accent-foreground)">*/}
                    {/*    Upload*/}
                    {/*</button>*/}
                </motion.nav>
            </div>
            <div className={"p-2 w-2 h-15"}></div>
        </>
    );
}
