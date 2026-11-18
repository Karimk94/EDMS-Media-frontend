import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../lib/apiClient';

export interface DocumentMetadata {
    doc_id: number;
    abstract: string;
    title: string;
    author: string;
    date: string;
    docname: string;
    has_original?: boolean;
    original_docnumber?: number;
    original_docname?: string;
    is_original?: boolean;
    edited_docnumber?: number;
    edited_docname?: string;
}

interface UseDocumentMetadataOptions {
    enabled?: boolean;
}

export function useDocumentMetadata(docId: string | number | undefined, options: UseDocumentMetadataOptions = {}) {
    const { enabled = true } = options;
    const normalizedDocId = docId !== undefined && docId !== null ? String(docId) : undefined;

    return useQuery<DocumentMetadata>({
        queryKey: ['documentMetadata', normalizedDocId],
        queryFn: async () => {
            if (!normalizedDocId) throw new Error("No Doc ID provided");
            return apiClient.get(`/api/document/${normalizedDocId}/metadata`);
        },
        enabled: !!normalizedDocId && enabled,
        staleTime: 1000 * 10, // 10 seconds cache
    });
}
