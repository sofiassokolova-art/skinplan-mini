// hooks/useProfile.ts
// React Query хуки для работы с профилем

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

const PROFILE_QUERY_KEY = 'profile';

/**
 * Хук для получения профиля пользователя (с кэшированием)
 */
export function useProfile() {
  return useQuery({
    queryKey: [PROFILE_QUERY_KEY],
    queryFn: () => api.getCurrentProfile() as Promise<any>,
    staleTime: 5 * 60 * 1000, // 5 минут для профиля
    gcTime: 15 * 60 * 1000, // 15 минут в кэше
  });
}

