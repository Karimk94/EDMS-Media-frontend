"use client";

import { useEffect, useMemo, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/apiClient';

export interface FolderProcessingSummary {
    folder_id: string;
    total: number;
    processing: number;
    done: number;
    is_complete: boolean;
    processing_doc_ids: string[];
}

interface BatchResponse {
    folders: Record<string, FolderProcessingSummary>;
}

interface UseFolderProcessingSummaryOptions {
    /** Folder IDs visible in the grid (the event folders / user folders tiles). */
    folderIds: (string | number)[];
    /** The folder currently open — used to scope invalidation to the right view. */
    currentFolderId: string | number | null;
    apiURL: string;
    /** Callback fired when a folder completes processing (bump thumbnail key). */
    onFolderComplete?: () => void;
}

/**
 * Polls the batch processing-status endpoint for all visible folder tiles.
 *
 * Strategy:
 *  - Only polls when there are folder IDs to check.
 *  - Polls every 5 seconds while any folder is still processing; stops when
 *    all folders are idle (no documents in the processing queue).
 *  - When a folder transitions from "processing" to "complete", it:
 *      1. Invalidates `['folders', currentFolderId]` (the grid).
 *      2. Invalidates `['folder_previews']`, `['review_statuses']`,
 *         `['folder_processing_status']`, `['processing_status']`.
 *      3. Calls the optional `onFolderComplete` callback (used to bump the
 *         thumbnailRefreshKey so cached thumbnails are re-requested).
 *  - Also triggers a mid-progress refresh every ~50 docs that complete,
 *    so the user sees incremental progress (thumbnails appearing) on bulk
 *    uploads rather than waiting for the entire folder to finish.
 */
export function useFolderProcessingSummary({
    folderIds,
    currentFolderId,
    apiURL,
    onFolderComplete,
}: UseFolderProcessingSummaryOptions) {
    const queryClient = useQueryClient();

    const folderIdList = useMemo(
        () => folderIds.map(id => String(id)).filter(Boolean),
        [folderIds]
    );

    const prevSummariesRef = useRef<Record<string, FolderProcessingSummary>>({});
    const cumulativeDoneRef = useRef<number>(0);
    const hasFolders = folderIdList.length > 0;

    // Keep onFolderComplete in a ref so the query doesn't restart when it changes
    const onFolderCompleteRef = useRef(onFolderComplete);
    useEffect(() => {
        onFolderCompleteRef.current = onFolderComplete;
    }, [onFolderComplete]);

    const { data: summaries } = useQuery<BatchResponse>({
        queryKey: ['folder_processing_summary', folderIdList.join(',')],
        queryFn: async () => {
            if (folderIdList.length === 0) return { folders: {} };
            const data = await apiClient.get<BatchResponse>(
                `${apiURL}/folders/processing-status?folder_ids=${folderIdList.join(',')}`
            );
            return data;
        },
        enabled: hasFolders,
        refetchInterval: (query) => {
            const data = query.state.data as BatchResponse | undefined;
            if (!data?.folders) return 5000;
            const anyProcessing = Object.values(data.folders).some(
                s => s.processing > 0
            );
            return anyProcessing ? 5000 : false;
        },
        retry: 2,
        retryDelay: attempt => Math.min(2000 * Math.pow(2, attempt), 10000),
        staleTime: 2000,
    });

    useEffect(() => {
        if (!summaries?.folders) return;

        const prev = prevSummariesRef.current;
        const current = summaries.folders;

        let anyJustCompleted = false;
        let currentCumulativeDone = 0;
        let anyHasProcessing = false;

        for (const [fid, summary] of Object.entries(current)) {
            currentCumulativeDone += summary.done;
            if (summary.processing > 0) anyHasProcessing = true;

            const prevSummary = prev[fid];
            if (
                summary.is_complete &&
                prevSummary &&
                !prevSummary.is_complete &&
                prevSummary.processing > 0
            ) {
                anyJustCompleted = true;
            }
        }

        const doneDelta = currentCumulativeDone - cumulativeDoneRef.current;
        const shouldIncrementalRefresh = doneDelta >= 50;

        if (anyJustCompleted || shouldIncrementalRefresh) {
            queryClient.invalidateQueries({ queryKey: ['folders', currentFolderId] });
            queryClient.invalidateQueries({ queryKey: ['folder_previews'] });
            queryClient.invalidateQueries({ queryKey: ['review_statuses'] });
            queryClient.invalidateQueries({ queryKey: ['folder_processing_status'] });
            queryClient.invalidateQueries({ queryKey: ['processing_status'] });
            cumulativeDoneRef.current = currentCumulativeDone;
            if (anyJustCompleted && onFolderCompleteRef.current) {
                onFolderCompleteRef.current();
            }
        }

        prevSummariesRef.current = current;
        if (!anyHasProcessing) cumulativeDoneRef.current = 0;
    }, [summaries, currentFolderId, queryClient]);

    return { summaries: summaries?.folders || {} };
}
