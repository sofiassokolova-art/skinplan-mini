// hooks/useCart.ts
// React Query хуки для работы с корзиной

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { usePathname } from 'next/navigation';
import { api } from '@/lib/api';

const CART_QUERY_KEY = 'cart';

/**
 * Хук для получения корзины (с кэшированием)
 */
export function useCart() {
  const pathname = usePathname();
  
  return useQuery({
    queryKey: [CART_QUERY_KEY],
    queryFn: () => api.getCart() as Promise<any>,
    staleTime: 1 * 60 * 1000, // 1 минута (корзина может часто меняться)
    gcTime: 5 * 60 * 1000, // 5 минут в кэше
    enabled: pathname !== '/quiz' && !pathname.startsWith('/quiz/'), // Не загружаем корзину на странице анкеты
  });
}

/**
 * Хук для добавления в корзину
 */
export function useAddToCart() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ productId, quantity = 1 }: { productId: number; quantity?: number }) =>
      api.addToCart(productId, quantity),
    onSuccess: () => {
      // Инвалидируем кэш корзины после добавления
      queryClient.invalidateQueries({ queryKey: [CART_QUERY_KEY] });
    },
  });
}

/**
 * Хук для удаления из корзины
 */
export function useRemoveFromCart() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (productId: number) => api.removeFromCart(productId),
    onSuccess: () => {
      // Инвалидируем кэш корзины после удаления
      queryClient.invalidateQueries({ queryKey: [CART_QUERY_KEY] });
    },
  });
}

