import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { apiClient } from '../lib/apiClient';
import { FolderItem } from './useFolderContents';

interface UseMoveModalFoldersParams {
    parentId: string | null;
    apiURL: string;
    isEnabled?: boolean;
}

interface MoveFoldersResponse {
    contents: FolderItem[];
}

/**
 * Custom hook for fetching folders in the move modal with react-query caching.
 * Provides instant navigation between previously visited folders and shows cached data while loading.
 */
export function useMoveModalFolders({
    parentId,
    apiURL = '/api',
    isEnabled = true
}: UseMoveModalFoldersParams) {
    return useQuery({
        queryKey: ['move-modal-folders', parentId],
        queryFn: async (): Promise<FolderItem[]> => {
            const params = new URLSearchParams();
            if (parentId) params.append('parent_id', parentId);
            params.append('scope', 'folders');

            const response = await apiClient.get(`${apiURL}/folders?${params.toString()}`);
            const allItems: FolderItem[] = response?.contents || [];
            // Filter only folders, excluding standard folders
            return allItems.filter((item) => item.type === 'folder' && !item.is_standard);
        },
        enabled: isEnabled,
        staleTime: 1000 * 60 * 5, // 5 minutes - cache move modal folders longer
        placeholderData: keepPreviousData, // Shows cached data while loading new folder contents
        gcTime: 1000 * 60 * 10, // Keep in cache for 10 minutes
    });
}
