import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../lib/apiClient';

interface QuotaData {
    remaining: number;
    total: number;
}

interface UseQuotaOptions {
    enabled?: boolean;
    refetchInterval?: number | false;
}

export function useQuota(options: UseQuotaOptions = {}) {
    const { enabled = true, refetchInterval = false } = options;

    return useQuery({
        queryKey: ['quota'],
        queryFn: async (): Promise<QuotaData> => {
            const data = await apiClient.get('/api/auth/user');
            return {
                remaining: data.remaining_quota,
                total: data.quota,
            };
        },
        enabled,
        refetchInterval,
        staleTime: 30 * 1000, // Consider quota data stale after 30 seconds
    });
}

