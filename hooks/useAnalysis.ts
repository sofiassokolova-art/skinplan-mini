// hooks/useAnalysis.ts
// React Query хуки для работы с анализом кожи

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

const ANALYSIS_QUERY_KEY = 'analysis';

/**
 * Хук для получения анализа кожи (с кэшированием)
 */
export function useAnalysis() {
  return useQuery({
    queryKey: [ANALYSIS_QUERY_KEY],
    queryFn: () => api.getAnalysis() as Promise<any>,
    staleTime: 10 * 60 * 1000, // 10 минут для анализа (редко меняется)
    gcTime: 30 * 60 * 1000, // 30 минут в кэше
  });
}

