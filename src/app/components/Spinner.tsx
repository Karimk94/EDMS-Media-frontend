"use client";

import Image from 'next/image';

interface SpinnerProps {
    /** Size variant: 'xs' (16px), 'sm' (24px), 'md' (40px), 'lg' (56px) */
    size?: 'xs' | 'sm' | 'md' | 'lg';
    /** Optional label shown below the spinner */
    label?: string;
    /** Whether to center the spinner in its container */
    center?: boolean;
}

const sizeMap = {
    xs: { ring: 'w-4 h-4 border-2', logo: 8 },
    sm: { ring: 'w-6 h-6 border-2', logo: 12 },
    md: { ring: 'w-10 h-10 border-4', logo: 20 },
    lg: { ring: 'w-14 h-14 border-4', logo: 28 },
};

/**
 * Unified loading spinner with Smart EDMS branding.
 * Blue ring animation with the app logo centered.
 *
 * Usage:
 *   <Spinner />                       — medium, inline
 *   <Spinner size="lg" center />      — large, centered (full section)
 *   <Spinner label="Loading..." />    — with text below
 */
export function Spinner({ size = 'md', label, center = false }: SpinnerProps) {
    const { ring, logo } = sizeMap[size];

    const spinner = (
        <div className="inline-flex flex-col items-center gap-2">
            <div className="relative inline-flex items-center justify-center">
                {/* Spinning ring */}
                <div
                    className={`${ring} border-blue-200 dark:border-blue-900 border-t-blue-600 dark:border-t-blue-400 rounded-full animate-spin`}
                />
                {/* Centered logo */}
                <div className="absolute inset-0 flex items-center justify-center">
                    <Image
                        src="/logo.png"
                        alt=""
                        width={logo}
                        height={logo}
                        className="text-blue-600 dark:text-blue-400 opacity-70"
                        priority
                    />
                </div>
            </div>
            {label && (
                <span className="text-sm text-gray-500 dark:text-gray-400">{label}</span>
            )}
        </div>
    );

    if (center) {
        return (
            <div className="flex items-center justify-center w-full h-full min-h-[120px]">
                {spinner}
            </div>
        );
    }

    return spinner;
}

/**
 * Full-page spinner overlay — used for route-level loading states.
 */
export function PageSpinner({ label }: { label?: string }) {
    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-[#1f1f1f]">
            <Spinner size="lg" label={label} />
        </div>
    );
}
