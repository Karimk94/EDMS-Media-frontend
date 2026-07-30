"use client";

import { useEffect, useState, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/apiClient';

interface UseProcessingStatusOptions {
    user: any;
    activeSection: string;
    activeFolder: string | null;
    apiURL: string;
}

/**
 * Manages the list of documents currently being AI-processed,
 * persists to localStorage, and polls the backend for completion status.
 */
export function useProcessingStatus({ user, activeSection, activeFolder, apiURL }: UseProcessingStatusOptions) {
    const queryClient = useQueryClient();
    const [processingDocs, setProcessingDocs] = useState<number[]>([]);
    const username = user?.username;

    // Load from localStorage on mount
    useEffect(() => {
        if (username) {
            const stored = localStorage.getItem('processingDocs');
            if (stored) {
                try {
                    const parsed = JSON.parse(stored);
                    if (Array.isArray(parsed) && parsed.length > 0) {
                        setProcessingDocs(parsed);
                    } else {
                        localStorage.removeItem('processingDocs');
                    }
                } catch {
                    localStorage.removeItem('processingDocs');
                }
            }
        }
    }, [username]);

    // Adaptive polling interval based on load
    const getPollingInterval = () => {
        if (processingDocs.length === 0) return false; // stop polling
        if (processingDocs.length <= 3) return 3000;   // fast polling for few items
        if (processingDocs.length <= 20) return 7000;  // normal polling
        return 15000;                                  // relaxed polling for bulk uploads
    };

    const { data: stillProcessing } = useQuery({
        queryKey: ['processing_status', processingDocs.join(',')],
        queryFn: async () => {
            const data = await apiClient.post(`${apiURL}/processing_status`, { docnumbers: processingDocs });
            return (data.processing || []) as number[];
        },
        enabled: !!username && processingDocs.length > 0,
        refetchInterval: getPollingInterval(),
        retry: 3,
        retryDelay: attempt => Math.min(2000 * Math.pow(2, attempt), 10000), // exponential backoff on errors
    });

    // Handle updates when polling returns new data
    useEffect(() => {
        if (!stillProcessing) return;

        const oldSorted = [...processingDocs].sort().join(',');
        const newSorted = [...stillProcessing].sort().join(',');

        if (oldSorted !== newSorted) {
            setProcessingDocs(stillProcessing);

            if (stillProcessing.length === 0) {
                localStorage.removeItem('processingDocs');

                // Smart cache invalidation only for the current view
                if (activeSection === 'recent' || (activeSection === 'folders' && activeFolder)) {
                    queryClient.invalidateQueries({ queryKey: ['documents'] });
                }
                if (activeSection === 'folders' && !activeFolder) {
                    queryClient.invalidateQueries({ queryKey: ['folders'] });
                }
            } else {
                localStorage.setItem('processingDocs', JSON.stringify(stillProcessing));
            }
        }
    }, [stillProcessing, processingDocs, activeSection, activeFolder, queryClient]);

    const addProcessingDocs = useCallback((docnumbers: number[]) => {
        setProcessingDocs(prev => {
            const next = Array.from(new Set([...prev, ...docnumbers]));
            if (next.length > 0) localStorage.setItem('processingDocs', JSON.stringify(next));
            return next;
        });
    }, []);

    const removeProcessingDocs = useCallback((docnumbers: number[]) => {
        setProcessingDocs(prev => {
            const next = prev.filter(d => !docnumbers.includes(d));
            if (next.length === 0) localStorage.removeItem('processingDocs');
            else localStorage.setItem('processingDocs', JSON.stringify(next));
            return next;
        });
    }, []);

    return {
        processingDocs,
        setProcessingDocs,
        addProcessingDocs,
        removeProcessingDocs,
        isProcessing: processingDocs.length > 0,
    };
}
