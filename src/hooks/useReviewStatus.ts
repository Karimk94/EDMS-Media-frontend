import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/apiClient';

interface ReviewStatusesResponse {
    statuses: Record<string, 'pending' | 'ready_for_review' | 'verified'>;
}

export function useReviewStatus(docIds: (string | number)[], apiURL: string, isEditor: boolean) {
    const queryClient = useQueryClient();

    // Fetch review statuses whenever we have document IDs.
    // Editors use the statuses to display badges AND mutate them; viewers use
    // them read-only (e.g. to filter the document grid to completed items only).
    const query = useQuery({
        queryKey: ['review_statuses', docIds.join(',')],
        queryFn: async (): Promise<Record<string, 'pending' | 'ready_for_review' | 'verified'>> => {
            if (docIds.length === 0) return {};
            const data = await apiClient.get<ReviewStatusesResponse>(`${apiURL}/documents/review-status?doc_ids=${docIds.join(',')}`);
            return data.statuses || {};
        },
        enabled: docIds.length > 0,
        staleTime: 60 * 1000, // 1 minute
    });

    const setDocStatusMutation = useMutation({
        mutationFn: async ({ docId, status }: { docId: number | string; status: 'verified' | 'pending' }) => {
            return apiClient.put(`${apiURL}/documents/${docId}/review-status`, { status });
        },
        // Optimistically write the new status into every cached review_statuses
        // query so the badge/logo flips on screen immediately — for BOTH
        // 'verified' (completed) and 'pending' (not analysed). Without this,
        // marking a document "Not Analysed" relied solely on a background
        // refetch which did not always land in time, so the logo stayed stale
        // while "Completed" appeared instantly (its visible effect on the grid
        // masked the same delay). This makes both directions feel instant.
        onMutate: async ({ docId, status }) => {
            await queryClient.cancelQueries({ queryKey: ['review_statuses'] });
            queryClient.setQueriesData<Record<string, 'pending' | 'ready_for_review' | 'verified'>>(
                { queryKey: ['review_statuses'] },
                (prev) => prev ? { ...prev, [docId]: status } : prev,
            );
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['review_statuses'] });
        },
    });

    const setFolderStatusMutation = useMutation({
        mutationFn: async ({ folderId, status }: { folderId: string; status: 'verified' | 'pending' }) => {
            return apiClient.put(`${apiURL}/folders/${folderId}/review-status`, { status });
        },
        onMutate: async ({ folderId, status }) => {
            await queryClient.cancelQueries({ queryKey: ['review_statuses'] });
            queryClient.setQueriesData<Record<string, 'pending' | 'ready_for_review' | 'verified'>>(
                { queryKey: ['review_statuses'] },
                (prev) => prev ? { ...prev, [folderId]: status } : prev,
            );
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['review_statuses'] });
        },
    });

    return {
        statuses: query.data || {},
        isLoading: query.isLoading,
        isError: query.isError,
        setDocumentStatus: setDocStatusMutation.mutateAsync,
        setFolderStatus: setFolderStatusMutation.mutateAsync,
        isUpdating: setDocStatusMutation.isPending || setFolderStatusMutation.isPending,
    };
}
