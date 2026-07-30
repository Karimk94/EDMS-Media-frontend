'use client';

import { QueryClient, QueryClientProvider, QueryCache } from '@tanstack/react-query';
import { useState } from 'react';
import { ApiError } from '../lib/apiClient';
import { emitToast } from '../lib/toastBridge';
import { QueryErrorBoundary } from './components/QueryErrorBoundary';

export default function Providers({ children }: { children: React.ReactNode }) {
    const [queryClient] = useState(
        () =>
            new QueryClient({
                queryCache: new QueryCache({
                    onError: (error, query) => {
                        // Global error logging for queries with structured context
                        console.error(`[Query Error] ${query.queryKey.join(' -> ')}:`, {
                            message: error.message,
                            error,
                            queryKey: query.queryKey,
                        });
                    },
                }),
                defaultOptions: {
                    queries: {
                        staleTime: 60 * 1000, // 1 minute
                        gcTime: 5 * 60 * 1000, // 5 minutes
                        retry: (failureCount, error) => {
                            if (failureCount >= 2) return false;
                            if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
                                return false;
                            }
                            return true;
                        },
                        retryDelay: (attemptIndex) => Math.min(1000 * Math.pow(2, attemptIndex), 10000),
                        refetchOnWindowFocus: false, 
                    },
                    mutations: {
                        retry: 0,
                        onError: (error) => {
                            const message =
                                error instanceof ApiError
                                    ? error.data?.detail || error.data?.error || error.message
                                    : error.message || 'An unexpected error occurred';
                            emitToast(message, 'error');
                        },
                    },
                },
            })
    );

    return (
        <QueryClientProvider client={queryClient}>
            <QueryErrorBoundary>
                {children}
            </QueryErrorBoundary>
        </QueryClientProvider>
    );
}
