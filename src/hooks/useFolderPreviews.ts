import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../lib/apiClient';

interface PreviewsResponse {
    thumbnails: string[];
}

export function useFolderPreviews(folderId: string | number, apiURL: string, isStandard: boolean = false) {
    return useQuery({
        queryKey: ['folder_previews', folderId],
        queryFn: async (): Promise<string[]> => {
            if (isStandard) {
                return [];
            }
            const data = await apiClient.get<PreviewsResponse>(`${apiURL}/folders/${folderId}/preview-thumbnails`);
            return data.thumbnails || [];
        },
        // Only fetch for actual folders, not standard virtual folders like 'images', 'videos', 'files'
        enabled: !!folderId && !isStandard,
        // Cache the previews for a reasonable amount of time (5 minutes)
        staleTime: 5 * 60 * 1000,
    });
}
