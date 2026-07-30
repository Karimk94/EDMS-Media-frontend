"use client";

import React from 'react';
import { QueryErrorResetBoundary } from '@tanstack/react-query';
import { ErrorBoundary, FallbackProps } from 'react-error-boundary';
import Image from 'next/image';

interface QueryErrorBoundaryProps {
    children: React.ReactNode;
}

function ErrorFallback({ error, resetErrorBoundary }: FallbackProps) {
    const err = error as any;
    const isNetworkError = err?.message?.toLowerCase().includes('network') || err?.message?.toLowerCase().includes('fetch');
    const isAuthError = err?.status === 401 || err?.status === 403;

    return (
        <div className="flex flex-col items-center justify-center min-h-[400px] p-6 text-center bg-gray-50 dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 m-4">
            <div className="mb-4 text-red-500">
                <Image src="/icons/alert-circle.svg" alt="Error" width={48} height={48} className="mx-auto dark:invert" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                {isAuthError ? 'Access Denied' : isNetworkError ? 'Connection Error' : 'Something went wrong'}
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6 max-w-md">
                {isAuthError
                    ? "You don't have permission to view this content or your session has expired."
                    : err?.message || "An unexpected error occurred while loading the data."}
            </p>
            
            <div className="flex gap-4">
                {isAuthError ? (
                    <button
                        onClick={() => window.location.href = '/'}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                    >
                        Go to Login
                    </button>
                ) : (
                    <button
                        onClick={resetErrorBoundary}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center gap-2"
                    >
                        <Image src="/icons/refresh-cw.svg" alt="" width={16} height={16} className="invert" />
                        Try Again
                    </button>
                )}
            </div>
        </div>
    );
}

export function QueryErrorBoundary({ children }: QueryErrorBoundaryProps) {
    return (
        <QueryErrorResetBoundary>
            {({ reset }) => (
                <ErrorBoundary
                    onReset={reset}
                    FallbackComponent={ErrorFallback}
                >
                    {children}
                </ErrorBoundary>
            )}
        </QueryErrorResetBoundary>
    );
}
