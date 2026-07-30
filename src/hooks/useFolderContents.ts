import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { apiClient } from '../lib/apiClient';

export interface FolderItem {
    id: string;
    system_id: string
    name: string;
    type: 'folder' | 'item' | 'file';
    node_type?: string;
    media_type?: 'image' | 'video' | 'pdf' | 'text' | 'file' | 'folder' | 'excel' | 'powerpoint' | 'word' | 'zip' | 'audio' | 'cad' | 'code' | 'email' | 'font' | 'database' | 'vector' | 'archive' | 'executable' | 'disc' | 'visio' | 'onenote';
    is_standard?: boolean;
    count?: number;
    size?: number;
    date?: string;
    thumbnail_url?: string;
}

interface FoldersResponse {
    contents: FolderItem[];
    breadcrumbs?: { id: string | null; name: string }[];
}

interface UseFolderContentsParams {
    parentId: string | null;
    searchTerm: string;
    apiURL: string;
    isEnabled?: boolean;
}

export function useFolderContents({
    parentId,
    searchTerm,
    apiURL = '/api',
    isEnabled = true
}: UseFolderContentsParams) {
    return useQuery({
        queryKey: ['folders', parentId, searchTerm],
        queryFn: async (): Promise<FoldersResponse> => {
            const params = new URLSearchParams();
            if (parentId) params.append('parent_id', parentId);

            params.append('scope', 'folders');

            if (parentId === 'images') params.append('media_type', 'image');
            else if (parentId === 'videos') params.append('media_type', 'video');
            else if (parentId === 'files') params.append('media_type', 'pdf');

            if (searchTerm) params.append('search', searchTerm);

            return apiClient.get(`${apiURL}/folders?${params.toString()}`);
        },
        enabled: isEnabled,
        staleTime: 1000 * 60, // 1 minute
        placeholderData: keepPreviousData,
    });
}

