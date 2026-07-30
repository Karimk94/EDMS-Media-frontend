import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from './useAuth';
import { apiClient } from '../lib/apiClient';

export function useUserPreferences() {
    const queryClient = useQueryClient();
    const { user } = useAuth();

    const updateLanguageMutation = useMutation({
        mutationFn: async (lang: 'en' | 'ar') => {
            await apiClient.put('/api/user/language', { lang });
            return lang;
        },
        onMutate: async (newLang) => {
            await queryClient.cancelQueries({ queryKey: ['user'] });
            const previousUser = queryClient.getQueryData(['user']);
            
            // Persist to localStorage for instant restore on refresh
            localStorage.setItem('lang', newLang);
            
            // Optimistically update user query
            queryClient.setQueryData(['user'], (oldUser: any) => {
                if (!oldUser) return oldUser;
                return { ...oldUser, lang: newLang };
            });
            
            return { previousUser };
        },
        onError: (err, newLang, context) => {
            if (context?.previousUser) {
                queryClient.setQueryData(['user'], context.previousUser);
                const prevLang = (context.previousUser as any).lang;
                if (prevLang) localStorage.setItem('lang', prevLang);
            }
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ['user'] });
        }
    });

    const updateThemeMutation = useMutation({
        mutationFn: async (theme: 'light' | 'dark') => {
            await apiClient.put('/api/user/theme', { theme });
            return theme;
        },
        onMutate: async (newTheme) => {
            await queryClient.cancelQueries({ queryKey: ['user'] });
            const previousUser = queryClient.getQueryData(['user']);
            
            localStorage.setItem('theme', newTheme);
            
            queryClient.setQueryData(['user'], (oldUser: any) => {
                if (!oldUser) return oldUser;
                return { ...oldUser, theme: newTheme };
            });
            
            return { previousUser };
        },
        onError: (err, newTheme, context) => {
            if (context?.previousUser) {
                queryClient.setQueryData(['user'], context.previousUser);
                const prevTheme = (context.previousUser as any).theme;
                if (prevTheme) localStorage.setItem('theme', prevTheme);
            }
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ['user'] });
        }
    });

    const updateViewModeMutation = useMutation({
        mutationFn: async (view_mode: 'grid' | 'list') => {
            await apiClient.put('/api/user/view-mode', { view_mode });
            return view_mode;
        },
        onMutate: async (newViewMode) => {
            await queryClient.cancelQueries({ queryKey: ['user'] });
            const previousUser = queryClient.getQueryData(['user']);
            
            localStorage.setItem('view_mode', newViewMode);
            
            queryClient.setQueryData(['user'], (oldUser: any) => {
                if (!oldUser) return oldUser;
                return { ...oldUser, view_mode: newViewMode };
            });
            
            return { previousUser };
        },
        onError: (err, newViewMode, context) => {
            if (context?.previousUser) {
                queryClient.setQueryData(['user'], context.previousUser);
                const prevViewMode = (context.previousUser as any).view_mode;
                if (prevViewMode) localStorage.setItem('view_mode', prevViewMode);
            }
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ['user'] });
        }
    });

    return {
        updateLanguage: updateLanguageMutation.mutateAsync,
        isUpdatingLanguage: updateLanguageMutation.isPending,
        updateTheme: updateThemeMutation.mutateAsync,
        updateViewMode: updateViewModeMutation.mutateAsync,
        isUpdatingViewMode: updateViewModeMutation.isPending,
    };
}
