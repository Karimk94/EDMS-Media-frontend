
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Trustee } from '../interfaces/PropsInterfaces';
import { apiClient } from '../lib/apiClient';

interface UpdateSecurityParams {
    docId: number;
    library: string;
    trustees: Trustee[];
    security_enabled: string;
}

interface GenerateShareLinkParams {
    itemType: 'file' | 'folder';
    documentId?: string | number;
    folderId?: string | number;
    documentName: string;
    expiryDate: string | null;
    shareMode: 'open' | 'restricted';
    targetEmail?: string;
    targetEmails?: string[]; // Multiple emails
    note?: string; // Optional note/message attached to the share link
}

interface GenerateShareLinkResponse {
    token: string;
    links?: Array<{ email: string, link: string, token: string }>;
}

export function useTrustees(docId: number) {
    return useQuery({
        queryKey: ['trustees', docId],
        queryFn: async (): Promise<Trustee[]> => {
            return apiClient.get(`/api/document/${docId}/trustees`);
        },
        enabled: !!docId,
        initialData: [],
    });
}

export function useSecurityMutation() {
    const queryClient = useQueryClient();

    const updateSecurity = useMutation({
        mutationFn: async ({ docId, library, trustees, security_enabled }: UpdateSecurityParams) => {
            return apiClient.post(`/api/document/${docId}/security`, { library, trustees, security_enabled });
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ['trustees', variables.docId] });
        }
    });

    const generateShareLink = useMutation({
        mutationFn: async ({ itemType, documentId, folderId, documentName, expiryDate, shareMode, targetEmail, targetEmails, note }: GenerateShareLinkParams) => {
            const payload: any = {
                expiry_date: expiryDate ? new Date(expiryDate).toISOString() : null,
                share_type: itemType,
                item_name: documentName
            };

            if (itemType === 'folder') {
                payload.folder_id = folderId;
            } else {
                payload.document_id = documentId ? parseInt(String(documentId), 10) : 0;
            }

            if (shareMode === 'restricted') {
                // Support legacy single email
                if (targetEmail) {
                    payload.target_email = targetEmail.trim().toLowerCase();
                }
                // Support multiple emails
                if (targetEmails && targetEmails.length > 0) {
                    payload.target_emails = targetEmails.map(e => e.trim().toLowerCase());
                }
            }

            // Optional note/message attached to the share link
            if (note && note.trim()) {
                payload.note = note.trim();
            }

            return apiClient.post('/api/share/generate', payload) as Promise<GenerateShareLinkResponse>;
        }
    });

    return {
        updateSecurity: updateSecurity.mutateAsync,
        isUpdatingSecurity: updateSecurity.isPending,
        generateShareLink: generateShareLink.mutateAsync,
        isGeneratingLink: generateShareLink.isPending
    };
}
