import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/apiClient';

interface UpdateMetadataParams {
    doc_id: number;
    abstract?: string;
    date_taken?: string | null;
}

interface ToggleFavoriteParams {
    docId: number;
    isFavorite: boolean;
}

export function useDocumentMutations() {
    const queryClient = useQueryClient();

    const updateMetadataMutation = useMutation({
        mutationFn: async (params: UpdateMetadataParams) => {
            return apiClient.put('/api/update_metadata', params);
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ['documents'] });
        },
    });

    const toggleFavoriteMutation = useMutation({
        mutationFn: async ({ docId, isFavorite }: ToggleFavoriteParams) => {
            if (isFavorite) {
                return apiClient.post(`/api/favorites/${docId}`);
            } else {
                return apiClient.delete(`/api/favorites/${docId}`);
            }
        },
        onMutate: async ({ docId, isFavorite }) => {
            // Cancel any outgoing refetches
            await queryClient.cancelQueries({ queryKey: ['documents'] });

            // Snapshot the previous value
            const previousDocuments = queryClient.getQueriesData({ queryKey: ['documents'] });

            // Optimistically update all document queries
            queryClient.setQueriesData({ queryKey: ['documents'] }, (old: any) => {
                if (!old) return old;

                // Handle different response structures
                if (old.documents && Array.isArray(old.documents)) {
                    return {
                        ...old,
                        documents: old.documents.map((doc: any) =>
                            doc.doc_id === docId ? { ...doc, is_favorite: isFavorite } : doc
                        ),
                    };
                }

                return old;
            });

            // Return context with previous data for rollback
            return { previousDocuments };
        },
        onError: (err, variables, context) => {
            // Rollback on error
            if (context?.previousDocuments) {
                context.previousDocuments.forEach(([queryKey, data]) => {
                    queryClient.setQueryData(queryKey, data);
                });
            }
        },
        onSettled: () => {
            // Always refetch after error or success to ensure consistency
            queryClient.invalidateQueries({ queryKey: ['documents'] });
        }
    });

    return {
        updateMetadata: updateMetadataMutation.mutateAsync,
        isUpdatingMetadata: updateMetadataMutation.isPending,
        toggleFavorite: toggleFavoriteMutation.mutateAsync,
        isTogglingFavorite: toggleFavoriteMutation.isPending
    };
}
