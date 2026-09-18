import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/apiClient';

interface ReviewStatusesResponse {
    statuses: Record<string, 'pending' | 'ready_for_review' | 'verified'>;
}

export function useReviewStatus(docIds: (string | number)[], apiURL: string, isEditor: boolean) {
    const queryClient = useQueryClient();

    // Only fetch if we are an editor and have document IDs
    const query = useQuery({
        queryKey: ['review_statuses', docIds.join(',')],
        queryFn: async (): Promise<Record<string, 'pending' | 'ready_for_review' | 'verified'>> => {
            if (docIds.length === 0) return {};
            const data = await apiClient.get<ReviewStatusesResponse>(`${apiURL}/documents/review-status?doc_ids=${docIds.join(',')}`);
            return data.statuses || {};
        },
        enabled: isEditor && docIds.length > 0,
        staleTime: 60 * 1000, // 1 minute
    });

    const setDocStatusMutation = useMutation({
        mutationFn: async ({ docId, status }: { docId: number | string; status: 'verified' | 'pending' }) => {
            return apiClient.put(`${apiURL}/documents/${docId}/review-status`, { status });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['review_statuses'] });
        },
    });

    const setFolderStatusMutation = useMutation({
        mutationFn: async ({ folderId, status }: { folderId: string; status: 'verified' | 'pending' }) => {
            return apiClient.put(`${apiURL}/folders/${folderId}/review-status`, { status });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['review_statuses'] });
        },
    });

    return {
        statuses: query.data || {},
        isLoading: query.isLoading,
        setDocumentStatus: setDocStatusMutation.mutateAsync,
        setFolderStatus: setFolderStatusMutation.mutateAsync,
        isUpdating: setDocStatusMutation.isPending || setFolderStatusMutation.isPending,
    };
}
