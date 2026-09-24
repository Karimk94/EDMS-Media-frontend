import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { apiClient } from '../lib/apiClient';
import { FolderItem } from './useFolderContents';

/**
 * A document returned by the global /api/documents endpoint, converted into a
 * FolderItem so it can be rendered alongside folder-name search matches.
 */
interface DocumentsResponseItem {
    doc_id: number;
    docnumber?: string;
    title?: string;
    abstract?: string;
    docname?: string;
    date?: string;
    thumbnail_url?: string;
    media_type?: string;
}

interface UseFolderContentSearchParams {
    searchTerm: string;
    apiURL: string;
    page: number;
    pageSize: number;
    /** Media-type filter for the standard folders (images/videos/files). */
    mediaType?: 'image' | 'video' | 'pdf' | null;
    /** UI language — controls Arabic/English tag & person column selection on the backend. */
    lang?: 'en' | 'ar';
    isEnabled?: boolean;
}

interface FolderContentSearchResponse {
    /** Content/embedding-matched files, converted to FolderItem shape. */
    contents: FolderItem[];
    total_pages: number;
    total_documents: number;
}

/**
 * Performs the "global" content + embedding search scoped to the folder
 * hierarchy. This reuses the existing /api/documents endpoint which already
 * combines SQL text search (abstract, docname, tags, persons, dates) with
 * vector/embedding semantic search (ChromaDB) — exactly the same engine that
 * powers the Recents tab search.
 *
 * The results are converted to FolderItem objects so the Folders UI can render
 * them uniformly alongside the folder-name matches from useFolderContents.
 */
export function useFolderContentSearch({
    searchTerm,
    apiURL = '/api',
    page = 1,
    pageSize = 20,
    mediaType = null,
    lang = 'en',
    isEnabled = true,
}: UseFolderContentSearchParams) {
    return useQuery({
        queryKey: ['folder-content-search', searchTerm, page, pageSize, mediaType, lang],
        queryFn: async (): Promise<FolderContentSearchResponse> => {
            if (!searchTerm) {
                return { contents: [], total_pages: 1, total_documents: 0 };
            }

            const params = new URLSearchParams();
            params.append('page', String(page));
            params.append('pageSize', String(pageSize));
            params.append('scope', 'folders');
            params.append('search', searchTerm);
            params.append('lang', lang);

            if (mediaType) params.append('media_type', mediaType);

            const data = await apiClient.get<{
                documents: DocumentsResponseItem[];
                total_pages?: number;
                total_documents?: number;
            }>(`${apiURL}/documents?${params.toString()}`);

            const contents: FolderItem[] = (data.documents || []).map((doc) => ({
                id: doc.doc_id,
                system_id: String(doc.doc_id),
                name: doc.title || doc.docname || `Document ${doc.doc_id}`,
                type: 'file' as const,
                media_type: (doc.media_type as FolderItem['media_type']) || 'file',
                date: doc.date,
                thumbnail_url: doc.thumbnail_url,
                is_standard: false,
            }));

            return {
                contents,
                total_pages: data.total_pages || 1,
                total_documents: data.total_documents || 0,
            };
        },
        enabled: isEnabled && !!searchTerm,
        placeholderData: keepPreviousData,
        staleTime: 1000 * 60, // 1 minute
    });
}