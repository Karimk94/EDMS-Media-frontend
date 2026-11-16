import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/apiClient';

interface CreateFolderParams {
    name: string;
    parent_id: string | null;
    description?: string;
    apiURL?: string;
}

interface RenameFolderParams {
    id: string | number;
    name: string;
    system_id: string;
    apiURL?: string;
}

interface DeleteFolderParams {
    id: string | number;
    force?: boolean;
    apiURL?: string;
}

interface MoveItemsParams {
    item_ids: (string | number)[];
    destination_parent_id: string | number | null;
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
                item_ids: item_ids.map(String),
                destination_parent_id: destination_parent_id !== null ? String(destination_parent_id) : null,
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

interface AddFolderTagParams {
    folderId: string | number;
    tag: string;
    apiURL?: string;
    lang?: 'en' | 'ar';
}

/**
 * Hook for adding a tag to all direct child files in a folder (skipping subfolders).
 * Directly calls the server-side folder tagging endpoint, with graceful fallback to
 * individual file tagging if the server endpoint is not available.
 */
export function useAddFolderTagMutation() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ folderId, tag, apiURL = '/api', lang = 'en' }: AddFolderTagParams) => {
            const cleanTag = tag.trim();
            if (!cleanTag) throw new Error('Tag cannot be empty');

            try {
                return await apiClient.post(`${apiURL}/folders/${folderId}/tags`, { tag: cleanTag });
            } catch (err: any) {
                // If the backend endpoint returned 404, fall back to client-side batching
                if (err?.status === 404) {
                    const contentsData: any = await apiClient.get(`${apiURL}/folders?parent_id=${folderId}&page_size=200`);
                    const files = (contentsData?.contents || []).filter((item: any) => item.type === 'file');

                    if (files.length === 0) {
                        return { status: 'success', message: 'No files to tag', count: 0 };
                    }

                    // Process files in concurrency-limited chunks
                    const chunkSize = 5;
                    let taggedCount = 0;
                    for (let i = 0; i < files.length; i += chunkSize) {
                        const chunk = files.slice(i, i + chunkSize);
                        await Promise.all(
                            chunk.map(async (file: any) => {
                                try {
                                    await apiClient.post(`${apiURL}/tags/${file.id}?lang=${lang}`, { tag: cleanTag });
                                    taggedCount++;
                                } catch (e) {
                                    console.error(`Failed to add tag to file ${file.id}`, e);
                                }
                            })
                        );
                    }

                    return { status: 'success', message: `Tag added to ${taggedCount} file(s)`, count: taggedCount };
                }
                throw err;
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['folders'] });
            queryClient.invalidateQueries({ queryKey: ['documents'] });
            queryClient.invalidateQueries({ queryKey: ['documentTagsBatch'] });
            queryClient.invalidateQueries({ queryKey: ['documentTags'] });
            queryClient.invalidateQueries({ queryKey: ['allTags'] });
        }
    });
}
