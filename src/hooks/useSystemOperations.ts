import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/apiClient';

interface ProcessingStatusParams {
    docnumbers: number[];
    apiURL: string;
}

interface ProcessingStatusResponse {
    processing: number[];
}

interface ClearCacheParams {
    apiURL: string;
}

interface ProcessDocumentsParams {
    docnumbers: number[];
    apiURL: string;
}

export function useProcessingStatus() {
    return useMutation<ProcessingStatusResponse, Error, ProcessingStatusParams>({
        mutationFn: async ({ docnumbers, apiURL }) => {
            return apiClient.post(`${apiURL}/processing_status`, { docnumbers });
        },
    });
}

export function useClearCache() {
    const queryClient = useQueryClient();

    return useMutation<void, Error, ClearCacheParams>({
        mutationFn: async ({ apiURL }) => {
            await apiClient.post(`${apiURL}/clear_cache`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['documents'] });
        },
    });
}

export function useProcessDocuments() {
    return useMutation<void, Error, ProcessDocumentsParams>({
        mutationFn: async ({ docnumbers, apiURL }) => {
            await apiClient.post(`${apiURL}/process_uploaded_documents`, { docnumbers });
        },
    });
}
