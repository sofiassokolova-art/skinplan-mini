// providers/QueryProvider.tsx
// React Query провайдер для кэширования данных на клиенте

'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Время, в течение которого данные считаются свежими (5 минут)
            staleTime: 5 * 60 * 1000,
            // Время хранения данных в кэше после того, как они перестали использоваться (10 минут)
            gcTime: 10 * 60 * 1000, // ранее называлось cacheTime
            // При возврате на вкладку — refetch (восстановление после Chrome throttle в фоне)
            refetchOnWindowFocus: true,
            // Автоматически обновлять данные при переподключении
            refetchOnReconnect: true,
            // Не повторять запрос при ошибке (можно настроить per-query)
            retry: (failureCount, error: any) => {
              // Не повторять для 401/403/404 ошибок
              if (error?.status === 401 || error?.status === 403 || error?.status === 404) {
                return false;
              }
              // Повторить максимум 2 раза для других ошибок
              return failureCount < 2;
            },
            retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
          },
          mutations: {
            // Повторять мутации при ошибке (только для сетевых ошибок)
            retry: 1,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}

