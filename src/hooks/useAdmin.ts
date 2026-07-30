
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/apiClient';

export interface EdmsUser {
    username: string;
    full_name: string;
    people_system_id: number;
    edms_user_id: number;
    user_ref_id: number;
    security_level: string;
    security_level_id: number;
    lang: string;
    theme: string;
    remaining_quota: number;
    quota: number;
    allow_large_downloads: boolean;
}

export interface SecurityLevel {
    id: number;
    name: string;
}

export interface AdminProfile {
    system_id: number;
    form_name: string;
    form_title: string;
}

export interface AdminGroup {
    group_id: string;
    group_name: string;
    system_id: number;
}

export interface AdminGroupUser {
    user_id: string;
    full_name: string;
    system_id: number;
}

export interface PersonResult {
    system_id: number;
    user_id: string;
    name: string;
}

interface UsersResponse {
    users: EdmsUser[];
    total: number;
    has_more: boolean;
}

interface QueueSummary {
    queued: number;
    in_progress: number;
    completed: number;
    failed: number;
    total: number;
}

interface QueueFailure {
    docnumber: number;
    attempts: number;
    error: string;
    updated_at: string;
    status?: 'queued' | 'in_progress' | 'completed' | 'failed';
}

interface ProcessingQueueStatusResponse {
    summary: QueueSummary;
    recent_failures: QueueFailure[];
    recent_in_progress?: QueueFailure[];
    recent_queued?: QueueFailure[];
    oracle_queued_count?: number;
    source_counts?: {
        local_failed: number;
        local_in_progress: number;
        oracle_queued: number;
    };
    worker_paused?: boolean;
    worker_mode?: 'running' | 'draining' | 'paused';
    last_mode_change?: {
        previous_mode?: string;
        new_mode?: string;
        actor?: string;
        reason?: string;
        changed_at?: string;
    };
}

export interface TabPermission {
    id: number;
    tab_key: string;
    can_read: boolean;
    can_write: boolean;
    disabled?: boolean;
}

export interface HistoryEntry {
    activity_description: string;
    docnumber: number;
    typist: string;
    docname: string;
    author: string;
    start_date: string;
    form_name: string;
}

interface AddUserParams {
    user_system_id: number;
    security_level_id: number;
    lang: string;
    theme: string;
    allow_large_downloads?: boolean;
}

interface UpdateUserParams {
    edms_user_id: number;
    security_level_id: number;
    lang: string;
    theme: string;
    remaining_quota: number | null;
    quota: number | null;
    allow_large_downloads?: boolean;
}

export function useAdmin() {
    const queryClient = useQueryClient();

    // Queries
    const useCheckAccess = () => useQuery({
        queryKey: ['adminAccess'],
        queryFn: async () => {
            return apiClient.get('/api/admin/check-access');
        },
        retry: false,
    });

    const useUsers = (page: number, search: string, enabled: boolean = true) => useQuery({
        queryKey: ['users', page, search],
        queryFn: async (): Promise<UsersResponse> => {
            const params = new URLSearchParams({
                search,
                page: String(page),
                limit: '20'
            });
            return apiClient.get(`/api/admin/users?${params}`);
        },
        enabled,
        placeholderData: (previousData) => previousData, // Keep previous data while fetching new page
    });

    const useSecurityLevels = (enabled: boolean = true) => useQuery({
        queryKey: ['securityLevels'],
        queryFn: async (): Promise<SecurityLevel[]> => {
            return apiClient.get('/api/admin/security-levels');
        },
        enabled,
        staleTime: 5 * 60 * 1000, // 5 minutes (rarely changes)
    });

    const useSearchPeople = (query: string, enabled: boolean = false) => useQuery({
        queryKey: ['peopleSearch', query],
        queryFn: async (): Promise<PersonResult[]> => {
            if (query.length < 2) return [];
            return apiClient.get(`/api/admin/search-people?search=${encodeURIComponent(query)}`);
        },
        enabled: enabled && query.length >= 2,
        staleTime: 60 * 1000, // 1 minute
    });

    const useProcessingQueueStatus = (enabled: boolean = true) => useQuery({
        queryKey: ['processingQueueStatus'],
        queryFn: async (): Promise<ProcessingQueueStatusResponse> => {
            return apiClient.get('/api/admin/processing-queue/status');
        },
        enabled,
        refetchInterval: 8000,
        staleTime: 5000,
    });

    const retryFailedQueueMutation = useMutation({
        mutationFn: async (limit: number = 100) => {
            return apiClient.post(`/api/admin/processing-queue/retry-failed?limit=${limit}`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['processingQueueStatus'] });
        },
    });

    const retrySelectedQueueMutation = useMutation({
        mutationFn: async (docnumbers: number[]) => {
            return apiClient.post('/api/admin/processing-queue/retry-selected', { docnumbers });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['processingQueueStatus'] });
        },
    });

    const clearCompletedQueueMutation = useMutation({
        mutationFn: async (olderThanHours: number = 24) => {
            return apiClient.delete(`/api/admin/processing-queue/completed?older_than_hours=${olderThanHours}`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['processingQueueStatus'] });
        },
    });

    const pauseQueueWorkerMutation = useMutation({
        mutationFn: async () => {
            return apiClient.post('/api/admin/processing-queue/worker/pause');
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['processingQueueStatus'] });
        },
    });

    const resumeQueueWorkerMutation = useMutation({
        mutationFn: async () => {
            return apiClient.post('/api/admin/processing-queue/worker/resume');
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['processingQueueStatus'] });
        },
    });

    const drainQueueWorkerMutation = useMutation({
        mutationFn: async () => {
            return apiClient.post('/api/admin/processing-queue/worker/drain');
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['processingQueueStatus'] });
        },
    });

    // Mutations
    const addUserMutation = useMutation({
        mutationFn: async (params: AddUserParams) => {
            return apiClient.post('/api/admin/users', params);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['users'] });
        },
    });

    const updateUserMutation = useMutation({
        mutationFn: async (params: UpdateUserParams) => {
            const { edms_user_id, ...body } = params;
            return apiClient.put(`/api/admin/users/${edms_user_id}`, body);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['users'] });
        },
    });

    const deleteUserMutation = useMutation({
        mutationFn: async (userId: number) => {
            return apiClient.delete(`/api/admin/users/${userId}`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['users'] });
        },
    });

    // Tab Permissions (per-user)
    const useTabPermissions = (userId: number | null, enabled: boolean = true) => useQuery({
        queryKey: ['tabPermissions', userId],
        queryFn: async (): Promise<TabPermission[]> => {
            if (!userId) return [];
            const data = await apiClient.get(`/api/admin/tab-permissions/${userId}`);
            return data.permissions;
        },
        enabled: enabled && !!userId,
        staleTime: 60 * 1000,
    });

    const upsertTabPermissionMutation = useMutation({
        mutationFn: async (params: { user_id: number; tab_key: string; can_read: boolean; can_write: boolean }) => {
            return apiClient.put('/api/admin/tab-permissions', params);
        },
        onMutate: async (variables) => {
            // Cancel outgoing refetches so they don't overwrite our optimistic update
            await queryClient.cancelQueries({ queryKey: ['tabPermissions', variables.user_id] });
            // Snapshot current value for rollback
            const previous = queryClient.getQueryData<TabPermission[]>(['tabPermissions', variables.user_id]);
            // Optimistically update the cache immediately
            queryClient.setQueryData<TabPermission[]>(['tabPermissions', variables.user_id], (old) => {
                if (!old) return old;
                return old.map((p) =>
                    p.tab_key === variables.tab_key
                        ? { ...p, can_read: variables.can_read, can_write: variables.can_write }
                        : p
                );
            });
            return { previous };
        },
        onError: (_err, variables, context) => {
            // Rollback to previous state on error
            if (context?.previous) {
                queryClient.setQueryData(['tabPermissions', variables.user_id], context.previous);
            }
        },
        onSettled: (_data, _error, variables) => {
            // Always refetch after mutation to ensure server consistency
            queryClient.invalidateQueries({ queryKey: ['tabPermissions', variables.user_id] });
        },
    });

    const initTabPermissionsMutation = useMutation({
        mutationFn: async (userId: number) => {
            return apiClient.post(`/api/admin/tab-permissions/init/${userId}`);
        },
    });

    const useDocumentHistory = (docnumber: number | null, enabled: boolean = true) => useQuery({
        queryKey: ['documentHistory', docnumber],
        queryFn: async (): Promise<HistoryEntry[]> => {
            if (!docnumber) return [];
            const data = await apiClient.get(`/api/admin/history/${docnumber}`);
            return data.history;
        },
        enabled: enabled && !!docnumber,
        staleTime: 60 * 1000,
    });

    const useAdminProfiles = (search: string = '', enabled: boolean = true) => useQuery({
        queryKey: ['adminProfiles', search],
        queryFn: async (): Promise<AdminProfile[]> => {
            const params = search.trim() ? `?search=${encodeURIComponent(search)}` : '';
            const data = await apiClient.get(`/api/admin/profiles${params}`);
            return data.profiles;
        },
        enabled,
        staleTime: 5 * 60 * 1000, // 5 minutes
    });

    const useProfileGroups = (profileId: number | null, search: string = '', enabled: boolean = true) => useQuery({
        queryKey: ['profileGroups', profileId, search],
        queryFn: async (): Promise<AdminGroup[]> => {
            if (!profileId) return [];
            const params = search.trim() ? `?search=${encodeURIComponent(search)}` : '';
            const data = await apiClient.get(`/api/admin/profiles/${profileId}/groups${params}`);
            return data.groups;
        },
        enabled: enabled && !!profileId,
        staleTime: 60 * 1000, // 1 minute
    });

    const useGroupUsers = (groupId: number | null, search: string = '', enabled: boolean = true) => useQuery({
        queryKey: ['groupUsers', groupId, search],
        queryFn: async (): Promise<AdminGroupUser[]> => {
            if (!groupId) return [];
            const params = search.trim() ? `?search=${encodeURIComponent(search)}` : '';
            const data = await apiClient.get(`/api/admin/groups/${groupId}/users${params}`);
            return data.users;
        },
        enabled: enabled && !!groupId,
        staleTime: 60 * 1000, // 1 minute
    });

    return {
        useCheckAccess,
        useUsers,
        useSecurityLevels,
        useSearchPeople,
        useProcessingQueueStatus,
        useTabPermissions,
        useDocumentHistory,
        useAdminProfiles,
        useProfileGroups,
        useGroupUsers,
        retryFailedQueue: retryFailedQueueMutation.mutateAsync,
        isRetryingFailedQueue: retryFailedQueueMutation.isPending,
        retrySelectedQueue: retrySelectedQueueMutation.mutateAsync,
        isRetryingSelectedQueue: retrySelectedQueueMutation.isPending,
        clearCompletedQueue: clearCompletedQueueMutation.mutateAsync,
        isClearingCompletedQueue: clearCompletedQueueMutation.isPending,
        pauseQueueWorker: pauseQueueWorkerMutation.mutateAsync,
        isPausingQueueWorker: pauseQueueWorkerMutation.isPending,
        resumeQueueWorker: resumeQueueWorkerMutation.mutateAsync,
        isResumingQueueWorker: resumeQueueWorkerMutation.isPending,
        drainQueueWorker: drainQueueWorkerMutation.mutateAsync,
        isDrainingQueueWorker: drainQueueWorkerMutation.isPending,
        addUser: addUserMutation.mutateAsync,
        isAddingUser: addUserMutation.isPending,
        updateUser: updateUserMutation.mutateAsync,
        isUpdatingUser: updateUserMutation.isPending,
        deleteUser: deleteUserMutation.mutateAsync,
        isDeletingUser: deleteUserMutation.isPending,
        upsertTabPermission: upsertTabPermissionMutation.mutateAsync,
        isUpsertingTabPermission: upsertTabPermissionMutation.isPending,
        initTabPermissions: initTabPermissionsMutation.mutateAsync,
    };
}
