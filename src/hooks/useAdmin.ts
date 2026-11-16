
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

export interface AdminAccessResponse {
    has_access: boolean;
    username: string | null;
    is_upper_admin?: boolean;
    admin_level?: 'upper' | 'normal' | null;
}


export interface PerformanceSummary {
    total_uploads: number;
    total_completed: number;
    total_pending: number;
    overall_completion_rate: number;
    active_users_count: number;
    top_uploader?: {
        username: string;
        full_name: string;
        total_uploads: number;
        completed_count: number;
        completion_rate: number;
    } | null;
    date_from?: string | null;
    date_to?: string | null;
}

export interface PerformanceRow {
    username?: string;
    full_name?: string;
    people_system_id?: number;
    period?: string;
    total_uploads: number;
    completed_count: number;
    pending_count: number;
    completion_rate: number;
    active_users_count?: number;
    first_upload?: string;
    last_upload?: string;
    last_login?: string | null;
    is_logged_in?: boolean;
}

export interface PerformanceChartPoint {
    date: string;
    uploads: number;
    completed: number;
    pending: number;
}

export interface PerformanceResponse {
    summary: PerformanceSummary;
    rows: PerformanceRow[];
    pagination: {
        page: number;
        limit: number;
        total_rows: number;
        total_pages: number;
        has_more: boolean;
    };
    chart_data: PerformanceChartPoint[];
}

export interface UploadingUser {
    username: string;
    full_name: string;
    upload_count: number;
}

export interface UserPerformanceDocument {
    docnumber: number;
    docname: string;
    abstract: string;
    creation_date: string;
    doc_date: string;
    is_completed: boolean;
    queue_status: number;
}

export interface LoginLogEntry {
    system_id: number;
    people_system_id: number;
    session_id: string | null;
    username: string;
    full_name: string;
    security_level: string | null;
    login_date: string | null;
    logout_date: string | null;
    last_activity: string | null;
    is_active: boolean;
    app_source: string | null;
    ip_address: string | null;
}

export interface LoginHistoryResponse {
    logs: LoginLogEntry[];
    total: number;
    has_more: boolean;
}

export interface UserPerformanceDetailsResponse {
    user_info: {
        username: string;
        full_name: string;
        total_uploads: number;
        completed_count: number;
        pending_count: number;
        completion_rate: number;
        first_upload?: string;
        last_upload?: string;
        last_login?: string | null;
        is_logged_in?: boolean;
    } | null;
    monthly_trend: {
        month: string;
        total_uploads: number;
        completed_count: number;
        pending_count: number;
        completion_rate: number;
    }[];
    documents: UserPerformanceDocument[];
    recent_logins?: LoginLogEntry[];
    pagination: {
        page: number;
        limit: number;
        total_documents: number;
        total_pages: number;
        has_more: boolean;
    };
}

export interface UserPerformanceParams {
    date_from?: string;
    date_to?: string;
    username?: string;
    group_by?: 'user' | 'month' | 'week' | 'day' | 'user_monthly';
    scope?: 'media' | 'smart-edms' | 'all';
    page?: number;
    limit?: number;
    sort_by?: string;
    sort_order?: 'desc' | 'asc';
    search?: string;
}

export function useAdmin() {
    const queryClient = useQueryClient();

    // Queries
    const useCheckAccess = () => useQuery<AdminAccessResponse>({
        queryKey: ['adminAccess'],
        queryFn: async (): Promise<AdminAccessResponse> => {
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

    const skipQueueJobMutation = useMutation({
        mutationFn: async (docnumber: number) => {
            return apiClient.post('/api/admin/processing-queue/skip', { docnumber });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['processingQueueStatus'] });
        },
    });

    const deleteQueueJobMutation = useMutation({
        mutationFn: async (docnumber: number) => {
            return apiClient.delete(`/api/admin/processing-queue/job/${docnumber}`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['processingQueueStatus'] });
        },
    });

    const deleteFailedQueueMutation = useMutation({
        mutationFn: async () => {
            return apiClient.delete('/api/admin/processing-queue/failed');
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

    const useUserPerformance = (params: UserPerformanceParams, enabled: boolean = true) => useQuery({
        queryKey: ['userPerformance', params],
        queryFn: async (): Promise<PerformanceResponse> => {
            const searchParams = new URLSearchParams();
            if (params.date_from) searchParams.append('date_from', params.date_from);
            if (params.date_to) searchParams.append('date_to', params.date_to);
            if (params.username) searchParams.append('username', params.username);
            if (params.group_by) searchParams.append('group_by', params.group_by);
            if (params.scope) searchParams.append('scope', params.scope);
            if (params.page) searchParams.append('page', String(params.page));
            if (params.limit) searchParams.append('limit', String(params.limit));
            if (params.sort_by) searchParams.append('sort_by', params.sort_by);
            if (params.sort_order) searchParams.append('sort_order', params.sort_order);
            if (params.search) searchParams.append('search', params.search);
            return apiClient.get(`/api/admin/user-performance?${searchParams.toString()}`);
        },
        enabled,
        placeholderData: (prev) => prev,
    });

    const useUploadingUsers = (scope: string = 'media', enabled: boolean = true) => useQuery({
        queryKey: ['uploadingUsers', scope],
        queryFn: async (): Promise<UploadingUser[]> => {
            return apiClient.get(`/api/admin/user-performance/users?scope=${scope}`);
        },
        enabled,
        staleTime: 60 * 1000,
    });

    const useUserPerformanceDetails = (
        targetUser: string | null,
        params: { date_from?: string; date_to?: string; scope?: string; page?: number; limit?: number },
        enabled: boolean = true
    ) => useQuery({
        queryKey: ['userPerformanceDetails', targetUser, params],
        queryFn: async (): Promise<UserPerformanceDetailsResponse> => {
            if (!targetUser) {
                return { user_info: null, monthly_trend: [], documents: [], pagination: { page: 1, limit: 20, total_documents: 0, total_pages: 0, has_more: false } };
            }
            const searchParams = new URLSearchParams();
            if (params.date_from) searchParams.append('date_from', params.date_from);
            if (params.date_to) searchParams.append('date_to', params.date_to);
            if (params.scope) searchParams.append('scope', params.scope);
            if (params.page) searchParams.append('page', String(params.page));
            if (params.limit) searchParams.append('limit', String(params.limit));
            return apiClient.get(`/api/admin/user-performance/user/${encodeURIComponent(targetUser)}/details?${searchParams.toString()}`);
        },
        enabled: enabled && !!targetUser,
    });


    const useLoginHistory = (
        page: number,
        search: string = '',
        filters?: { username?: string; date_from?: string; date_to?: string },
        enabled: boolean = true
    ) => useQuery({
        queryKey: ['loginHistory', page, search, filters],
        queryFn: async (): Promise<LoginHistoryResponse> => {
            const params = new URLSearchParams({
                search,
                page: String(page),
                limit: '20',
            });
            if (filters?.username) params.append('username', filters.username);
            if (filters?.date_from) params.append('date_from', filters.date_from);
            if (filters?.date_to) params.append('date_to', filters.date_to);
            return apiClient.get(`/api/admin/login-history?${params.toString()}`);
        },
        enabled,
        placeholderData: (previousData) => previousData,
    });

    return {
        useCheckAccess,
        useLoginHistory,
        useUsers,
        useSecurityLevels,
        useSearchPeople,
        useProcessingQueueStatus,

        useUserPerformance,

        useUploadingUsers,

        useUserPerformanceDetails,
        useTabPermissions,
        useDocumentHistory,
        useAdminProfiles,
        useProfileGroups,
        useGroupUsers,
        retryFailedQueue: retryFailedQueueMutation.mutateAsync,
        isRetryingFailedQueue: retryFailedQueueMutation.isPending,
        retrySelectedQueue: retrySelectedQueueMutation.mutateAsync,
        isRetryingSelectedQueue: retrySelectedQueueMutation.isPending,
        skipQueueJob: skipQueueJobMutation.mutateAsync,
        isSkippingQueueJob: skipQueueJobMutation.isPending,
        deleteQueueJob: deleteQueueJobMutation.mutateAsync,
        isDeletingQueueJob: deleteQueueJobMutation.isPending,
        deleteFailedQueue: deleteFailedQueueMutation.mutateAsync,
        isDeletingFailedQueue: deleteFailedQueueMutation.isPending,
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
