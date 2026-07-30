import { useMutation, useQueryClient } from '@tanstack/react-query';
import { emitToast } from '../lib/toastBridge';

export interface UploadParams {
    file: File;
    docname: string;
    abstract: string;
    date_taken?: string | null;
    apiURL: string;
    onProgress?: (progress: number) => void;
}

interface UploadResponse {
    success: boolean;
    docnumber?: number;
    error?: string;
}

const MAX_RETRIES = 2;
const UPLOAD_TIMEOUT_MS = 600000; // 600 seconds (10 minutes)
const MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024 * 1024; // 2GB limit

async function uploadWithRetry(params: UploadParams): Promise<UploadResponse> {
    const { file, docname, abstract, date_taken, apiURL, onProgress } = params;

    if (file.size > MAX_FILE_SIZE_BYTES) {
        throw new Error('File size exceeds the maximum allowed limit of 2GB.');
    }

    let lastError: Error | undefined;

    // Generate a unique key for this specific upload attempt
    const idempotencyKey = typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        try {
            return await new Promise<UploadResponse>((resolve, reject) => {
                const formData = new FormData();
                formData.append('file', file);
                formData.append('docname', docname);
                formData.append('abstract', abstract);

                if (date_taken) {
                    formData.append('date_taken', date_taken);
                }

                const xhr = new XMLHttpRequest();
                xhr.open('POST', `${apiURL}/upload_document`, true);
                xhr.withCredentials = true;
                xhr.timeout = UPLOAD_TIMEOUT_MS;

                // Add idempotency key to prevent duplicate uploads on retry
                xhr.setRequestHeader('Idempotency-Key', idempotencyKey);

                xhr.upload.onprogress = (event) => {
                    if (event.lengthComputable && onProgress) {
                        const percentComplete = Math.round((event.loaded / event.total) * 100);
                        onProgress(percentComplete);
                    }
                };

                xhr.onload = () => {
                    if (xhr.status >= 200 && xhr.status < 300) {
                        try {
                            const response = JSON.parse(xhr.responseText);
                            resolve(response);
                        } catch (e) {
                            reject(new Error('Failed to parse server response.'));
                        }
                    } else {
                        const isRetryable = [408, 429, 500, 502, 503, 504].includes(xhr.status);

                        let errorMsg = `Server error: ${xhr.status}`;
                        try {
                            const response = JSON.parse(xhr.responseText);
                            errorMsg = response.error || response.detail || errorMsg;
                        } catch (e) {
                            // Use default error message
                        }

                        const error = new Error(errorMsg) as any;
                        error.isRetryable = isRetryable;
                        reject(error);
                    }
                };

                xhr.onerror = () => {
                    const error = new Error('Network error during upload.') as any;
                    error.isRetryable = true;
                    reject(error);
                };

                xhr.ontimeout = () => {
                    const error = new Error('Upload timed out.') as any;
                    error.isRetryable = true;
                    reject(error);
                };

                xhr.send(formData);
            });
        } catch (error: any) {
            lastError = error;

            if (!error.isRetryable || attempt >= MAX_RETRIES) {
                throw error;
            }

            // Emit toast to let the user know we are retrying
            emitToast(`Upload failed, retrying... (attempt ${attempt + 1}/${MAX_RETRIES})`, 'warning');

            // Reset progress
            if (onProgress) {
                onProgress(0);
            }

            // Exponential backoff delay
            const delay = 1000 * Math.pow(2, attempt);
            await new Promise(res => setTimeout(res, delay));
        }
    }

    throw lastError;
}

export function useUpload() {
    const queryClient = useQueryClient();

    const uploadMutation = useMutation({
        mutationFn: uploadWithRetry,
        onSuccess: () => {
            // Invalidate relevant queries after successful upload
            queryClient.invalidateQueries({ queryKey: ['folders'] });
            queryClient.invalidateQueries({ queryKey: ['documents'] });
            queryClient.invalidateQueries({ queryKey: ['quota'] });
            queryClient.invalidateQueries({ queryKey: ['user'] });
        },
    });

    return {
        upload: uploadMutation.mutate,
        uploadAsync: uploadMutation.mutateAsync,
        isUploading: uploadMutation.isPending,
        uploadError: uploadMutation.error,
        reset: uploadMutation.reset,
    };
}
