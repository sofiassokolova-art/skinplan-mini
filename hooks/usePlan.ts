// hooks/usePlan.ts
// React Query хуки для работы с планом

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

const PLAN_QUERY_KEY = 'plan';

/**
 * Хук для получения плана (с кэшированием)
 */
export function usePlan() {
  return useQuery({
    queryKey: [PLAN_QUERY_KEY],
    queryFn: () => api.getPlan() as Promise<any>,
    staleTime: 10 * 60 * 1000, // 10 минут для плана (он редко меняется)
    gcTime: 30 * 60 * 1000, // 30 минут в кэше
  });
}

/**
 * Хук для генерации плана (мутация)
 */
export function useGeneratePlan() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => api.generatePlan() as Promise<any>,
    onSuccess: (data) => {
      // После успешной генерации обновляем кэш
      queryClient.setQueryData([PLAN_QUERY_KEY], data);
      // Инвалидируем связанные запросы
      queryClient.invalidateQueries({ queryKey: [PLAN_QUERY_KEY] });
    },
  });
}

