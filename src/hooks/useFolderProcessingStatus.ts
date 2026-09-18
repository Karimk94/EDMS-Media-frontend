"use client";

import { useEffect, useMemo, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/apiClient';

interface UseFolderProcessingStatusOptions {
    /** All file (non-folder) doc IDs visible in the current folder. */
    docIds: (string | number)[];
    /** The folder currently open — used to scope the query-cache invalidation. */
    currentFolderId: string | number | null;
    /** The global set of doc IDs being tracked for AI processing (from useProcessingStatus). */
    processingDocs: number[];
    apiURL: string;
}

/**
 * Watches AI-processing status for files in the currently open folder.
 *
 * Strategy (opt-in):
 *  - Only activates when at least one `docId` from this folder already
 *    appears in the global `processingDocs` list.  That list is populated
 *    by `useProcessingStatus` whenever `onUploadSuccess` fires after an upload.
 *  - Polls `/api/processing_status` at an adaptive interval.
 *  - When any doc finishes (drops out of the "still processing" set),
 *    it invalidates `['folders', currentFolderId]` to trigger a silent
 *    re-fetch of the folder grid — the user sees the new AI label appear.
 */
export function useFolderProcessingStatus({
    docIds,
    currentFolderId,
    processingDocs,
    apiURL,
}: UseFolderProcessingStatusOptions) {
    const queryClient = useQueryClient();

    // Numeric set of doc IDs in this folder that are globally tracked as processing
    const trackedInFolder = useMemo<number[]>(() => {
        if (!processingDocs.length || !docIds.length) return [];
        const processingSet = new Set(processingDocs);
        return docIds
            .map(id => Number(id))
            .filter(id => !isNaN(id) && processingSet.has(id));
    }, [docIds, processingDocs]);

    const isActive = trackedInFolder.length > 0;

    const getPollingInterval = (): number | false => {
        if (!isActive) return false;
        if (trackedInFolder.length <= 3) return 3000;
        if (trackedInFolder.length <= 20) return 7000;
        return 15000;
    };

    // Keep a stable ref so the effect below can compare previous vs current
    const prevStillProcessingRef = useRef<number[]>([]);

    const { data: stillProcessingInFolder } = useQuery({
        queryKey: ['folder_processing_status', currentFolderId, trackedInFolder.join(',')],
        queryFn: async () => {
            const data = await apiClient.post(`${apiURL}/processing_status`, {
                docnumbers: trackedInFolder,
            });
            return (data.processing || []) as number[];
        },
        enabled: isActive,
        refetchInterval: getPollingInterval(),
        retry: 3,
        retryDelay: attempt => Math.min(2000 * Math.pow(2, attempt), 10000),
    });

    useEffect(() => {
        if (!stillProcessingInFolder) return;

        const prev = prevStillProcessingRef.current;
        const prevSorted = [...prev].sort().join(',');
        const newSorted = [...stillProcessingInFolder].sort().join(',');

        if (prevSorted !== newSorted) {
            prevStillProcessingRef.current = stillProcessingInFolder;

            // At least one doc finished — refresh the folder grid
            const someCompleted = prev.some(id => !stillProcessingInFolder.includes(id));
            if (someCompleted) {
                queryClient.invalidateQueries({ queryKey: ['folders', currentFolderId] });
            }
        }
    }, [stillProcessingInFolder, currentFolderId, queryClient]);
}
