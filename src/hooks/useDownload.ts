import { useMutation } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { apiClient } from '../lib/apiClient';

interface DownloadParams {
    docId: number | string;
    docname: string;
    apiURL: string;
    mediaType?: string;
}

const WATERMARKED_MEDIA_TYPES = new Set(['image', 'pdf', 'video']);
const WATERMARKED_EXTENSIONS = new Set([
    'jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg',
    'pdf',
    'mp4', 'mov', 'avi', 'mkv', 'webm'
]);

function shouldUseWatermarkedDownload(docname: string, mediaType?: string) {
    const normalizedMediaType = mediaType?.toLowerCase();
    if (normalizedMediaType && normalizedMediaType !== 'file' && normalizedMediaType !== 'folder') {
        return WATERMARKED_MEDIA_TYPES.has(normalizedMediaType);
    }

    const extension = docname.split('.').pop()?.toLowerCase();
    return extension ? WATERMARKED_EXTENSIONS.has(extension) : false;
}

function triggerBrowserDownload(url: string, filename?: string) {
    const link = document.createElement('a');
    link.href = url;
    if (filename) {
        link.setAttribute('download', filename);
    }
    document.body.appendChild(link);
    link.click();
    link.remove();
}

export function useDownload() {
    const activeBlobUrls = useRef<Set<string>>(new Set());

    useEffect(() => {
        const currentActiveUrls = activeBlobUrls.current;
        // Cleanup all blob URLs when the component unmounts to prevent memory leaks
        return () => {
            currentActiveUrls.forEach(url => {
                window.URL.revokeObjectURL(url);
            });
            currentActiveUrls.clear();
        };
    }, []);

    const downloadMutation = useMutation({
        mutationFn: async ({ docId, docname, apiURL, mediaType }: DownloadParams) => {
            const shouldWatermark = shouldUseWatermarkedDownload(docname, mediaType);
            const endpoint = shouldWatermark
                ? `${apiURL}/download_watermarked/${docId}`
                : `${apiURL}/document/${docId}`;

            if (!shouldWatermark) {
                return { directUrl: endpoint, filename: docname, useNativeDownload: true };
            }

            // Note: apiClient.raw handles retry on transient failures automatically
            const response = await apiClient.raw(endpoint);
            const contentDisposition = response.headers.get('Content-Disposition');
            let filename = docname;
            if (contentDisposition) {
                const filenameMatch = contentDisposition.match(/filename="?([^"]+)"?/);
                if (filenameMatch && filenameMatch[1]) {
                    filename = filenameMatch[1];
                }
            }

            const blob = await response.blob();
            return { blob, filename };
        },
        onSuccess: ({ blob, filename, directUrl, useNativeDownload }) => {
            if (useNativeDownload && directUrl) {
                triggerBrowserDownload(directUrl, filename);
                return;
            }

            // Create download link
            if (!blob) return;
            const url = window.URL.createObjectURL(blob);
            activeBlobUrls.current.add(url);

            triggerBrowserDownload(url, filename || 'download');

            // Optionally clean up immediately after a delay, but we rely on unmount cleanup
            setTimeout(() => {
                window.URL.revokeObjectURL(url);
                activeBlobUrls.current.delete(url);
            }, 60000); // Clean up after 1 minute just in case component stays mounted
        },
    });

    return {
        download: downloadMutation.mutate,
        downloadAsync: downloadMutation.mutateAsync,
        isDownloading: downloadMutation.isPending,
        downloadError: downloadMutation.error,
    };
}


