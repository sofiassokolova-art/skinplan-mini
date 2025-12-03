// hooks/useRecommendations.ts
// React Query хуки для работы с рекомендациями

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

const RECOMMENDATIONS_QUERY_KEY = 'recommendations';

/**
 * Хук для получения рекомендаций (с кэшированием)
 */
export function useRecommendations() {
  return useQuery({
    queryKey: [RECOMMENDATIONS_QUERY_KEY],
    queryFn: () => api.getRecommendations() as Promise<any>,
    staleTime: 5 * 60 * 1000, // 5 минут для рекомендаций
    gcTime: 15 * 60 * 1000, // 15 минут в кэше
  });
}

