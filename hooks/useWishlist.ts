// hooks/useWishlist.ts
// React Query хуки для работы с избранным

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

const WISHLIST_QUERY_KEY = 'wishlist';

async function refreshWishlistCache(queryClient: ReturnType<typeof useQueryClient>) {
  try {
    await queryClient.fetchQuery({
      queryKey: [WISHLIST_QUERY_KEY],
      queryFn: () => api.getWishlist() as Promise<any>,
      staleTime: 0,
    });
  } catch {
    queryClient.invalidateQueries({ queryKey: [WISHLIST_QUERY_KEY] });
  }
}

/**
 * Хук для получения избранного (с кэшированием)
 */
export function useWishlist() {
  return useQuery({
    queryKey: [WISHLIST_QUERY_KEY],
    queryFn: () => api.getWishlist() as Promise<any>,
    staleTime: 2 * 60 * 1000, // 2 минуты (может часто меняться)
    gcTime: 5 * 60 * 1000, // 5 минут в кэше
  });
}

/**
 * Хук для добавления в избранное
 */
export function useAddToWishlist() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (productId: number) => api.addToWishlist(productId),
    onSuccess: async () => {
      await refreshWishlistCache(queryClient);
    },
  });
}

/**
 * Хук для удаления из избранного
 */
export function useRemoveFromWishlist() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (productId: number) => api.removeFromWishlist(productId),
    onSuccess: async () => {
      await refreshWishlistCache(queryClient);
    },
  });
}
