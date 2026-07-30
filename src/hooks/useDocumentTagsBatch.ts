import { useQuery } from '@tanstack/react-query';
import { TagObject } from '../interfaces/TagObject';
import { apiClient } from '../lib/apiClient';

interface BatchTagsResponse {
    tags: Record<string, TagObject[]>;
}

interface UseDocumentTagsBatchParams {
    docIds: number[];
    lang: 'en' | 'ar';
    enabled?: boolean;
}

export function useDocumentTagsBatch({
    docIds,
    lang,
    enabled = true,
}: UseDocumentTagsBatchParams) {
    const uniqueDocIds = Array.from(new Set(docIds)).filter((id) => Number.isFinite(id));

    return useQuery({
        queryKey: ['documentTagsBatch', lang, uniqueDocIds],
        queryFn: async (): Promise<Record<string, TagObject[]>> => {
            if (uniqueDocIds.length === 0) {
                return {};
            }

            const response = await apiClient.post(`/api/tags/batch?lang=${lang}`, {
                doc_ids: uniqueDocIds,
            }) as BatchTagsResponse;

            return response.tags || {};
        },
        enabled: enabled && uniqueDocIds.length > 0,
        staleTime: 1000 * 60,
    });
}
