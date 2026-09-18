import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../lib/apiClient';

export interface DocumentMetadata {
    doc_id: number;
    abstract: string;
    title: string;
    author: string;
    date: string;
    docname: string;
}

interface UseDocumentMetadataOptions {
    enabled?: boolean;
}

export function useDocumentMetadata(docId: string | number | undefined, options: UseDocumentMetadataOptions = {}) {
    const { enabled = true } = options;

    return useQuery<DocumentMetadata>({
        queryKey: ['documentMetadata', docId],
        queryFn: async () => {
            if (!docId) throw new Error("No Doc ID provided");
            return apiClient.get(`/api/document/${docId}/metadata`);
        },
        enabled: !!docId && enabled,
        staleTime: 1000 * 10, // 10 seconds cache
    });
}
