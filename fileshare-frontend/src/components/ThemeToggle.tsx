'use client';

import {useEffect, useState} from 'react';
import {FiMoon, FiSun} from 'react-icons/fi';

export default function ThemeToggle() {
    // Initialize state without accessing window/localStorage during SSR to prevent hydration mismatch
    const [theme, setTheme] = useState<'light' | 'dark'>('light');
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        // Only access localStorage after component mounts (client-side)
        const storedTheme = localStorage.getItem('theme') as 'light' | 'dark' | null;
        const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

        // Determine initial theme:
        // 1. Saved preference
        // 2. System preference
        // 3. Default (light - though based on our CSS variables, system fallback is good)
        const initialTheme = storedTheme || (systemPrefersDark ? 'dark' : 'light');

        setTheme(initialTheme);
        setMounted(true);

        // Apply class immediately
        if (initialTheme === 'dark') {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
    }, []);

    const toggleTheme = () => {
        const newTheme = theme === 'light' ? 'dark' : 'light';
        setTheme(newTheme);
        localStorage.setItem('theme', newTheme);

        if (newTheme === 'dark') {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
    };

    // Prevent hydration mismatch by rendering a placeholder or default until mounted
    if (!mounted) {
        return <div className="w-9 h-9"/>; // Placeholder to avoid layout shift
    }

    return (
        <button
            onClick={toggleTheme}
            className={`
        p-2 rounded-lg transition-all duration-200
        border border-border
        cursor-pointer
        hover:bg-surface-hover hover:text-foreground
        ${theme === 'dark' ? 'text-yellow-400 bg-surface' : 'text-orange-500 bg-surface'}
      `}
            aria-label="Toggle theme"
        >
            {theme === 'dark' ? <FiMoon className="w-5 h-5"/> : <FiSun className="w-5 h-5"/>}
        </button>
    );
}
