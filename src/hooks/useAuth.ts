
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { apiClient } from '../lib/apiClient';

interface User {
    username: string;
    full_name?: string;
    security_level: string;
    lang: 'en' | 'ar';
    theme: 'light' | 'dark';
    quota: number;
    remaining_quota: number;
    is_ems_admin_group_member?: boolean;
    view_mode?: 'grid' | 'list';
    tab_permissions?: { tab_key: string; can_read: boolean; can_write: boolean }[];
}

interface LoginCredentials {
    username: string;
    password: string;
}

export function useAuth() {
    const queryClient = useQueryClient();
    const router = useRouter();

    const userQuery = useQuery({
        queryKey: ['user'],
        queryFn: async () => {
            const data = await apiClient.get('/api/auth/user');
            return data.user as User;
        },
        retry: false, // Don't retry if 401
        staleTime: 1000 * 60 * 5, // 5 minutes
    });

    const loginMutation = useMutation({
        mutationFn: async (credentials: LoginCredentials) => {
            return apiClient.post('/api/auth/login', credentials);
        },
        onSuccess: (data) => {
            queryClient.setQueryData(['user'], data.user); // Optimistically update user
            queryClient.invalidateQueries({ queryKey: ['user'] });
        },
    });

    const logoutMutation = useMutation({
        mutationFn: async () => {
            try {
                await apiClient.post('/api/auth/logout');
            } catch (e) {
                console.error("Logout failed", e);
            }
        },
        onSuccess: () => {
            queryClient.setQueryData(['user'], null);
            queryClient.clear(); // Clear all data
            router.push('/login');
        },
    });

    return {
        user: userQuery.data,
        isLoadingUser: userQuery.isLoading,
        isAuthenticated: userQuery.isSuccess && !!userQuery.data,
        login: loginMutation.mutateAsync,
        isLoggingIn: loginMutation.isPending,
        logout: logoutMutation.mutateAsync,
        isLoggingOut: logoutMutation.isPending,
    };
}

