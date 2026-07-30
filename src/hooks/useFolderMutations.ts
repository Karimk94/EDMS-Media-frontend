import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/apiClient';

interface CreateFolderParams {
    name: string;
    parent_id: string | null;
    description?: string;
    apiURL?: string;
}

interface RenameFolderParams {
    id: string;
    name: string;
    system_id: string;
    apiURL?: string;
}

interface DeleteFolderParams {
    id: string;
    force?: boolean;
    apiURL?: string;
}

interface MoveItemsParams {
    item_ids: string[];
    destination_parent_id: string | null;
    item_names: Record<string, string>;
    apiURL?: string;
}

export function useCreateFolder() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ name, parent_id, description, apiURL = '/api' }: CreateFolderParams) => {
            return apiClient.post(`${apiURL}/folders`, { name, parent_id, description });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['folders'] });
        }
    });
}

export function useRenameFolder() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ id, name, system_id, apiURL = '/api' }: RenameFolderParams) => {
            return apiClient.put(`${apiURL}/folders/${id}`, { name, system_id });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['folders'] });
            queryClient.invalidateQueries({ queryKey: ['documents'] });
        }
    });
}

export function useDeleteFolder() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ id, force = false, apiURL = '/api' }: DeleteFolderParams) => {
            // ApiError already includes .status and .data for 409 handling in Folders.tsx
            await apiClient.delete(`${apiURL}/folders/${id}${force ? '?force=true' : ''}`);
            return true;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['folders'] });
            queryClient.invalidateQueries({ queryKey: ['documents'] });
            queryClient.invalidateQueries({ queryKey: ['quota'] });
            queryClient.invalidateQueries({ queryKey: ['user'] });
        }
    });
}

/**
 * Hook for batch moving items to a destination folder with automatic cache invalidation.
 * Invalidates relevant queries to ensure UI reflects the move operation.
 */
export function useMoveItemsMutation() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ item_ids, destination_parent_id, item_names, apiURL = '/api' }: MoveItemsParams) => {
            return apiClient.post(`${apiURL}/folders/move-items`, {
                item_ids,
                destination_parent_id,
                item_names,
            });
        },
        onSuccess: () => {
            // Invalidate all folder and document queries to ensure fresh data
            queryClient.invalidateQueries({ queryKey: ['folders'] });
            queryClient.invalidateQueries({ queryKey: ['move-modal-folders'] });
            queryClient.invalidateQueries({ queryKey: ['documents'] });
            queryClient.invalidateQueries({ queryKey: ['quota'] });
            queryClient.invalidateQueries({ queryKey: ['user'] });
        }
    });
}
