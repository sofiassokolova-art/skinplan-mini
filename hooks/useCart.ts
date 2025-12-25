// hooks/useCart.ts
// React Query хуки для работы с корзиной

import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { usePathname } from 'next/navigation';
import { api } from '@/lib/api';

const CART_QUERY_KEY = 'cart';

/**
 * Хук для получения корзины (с кэшированием)
 */
export function useCart() {
  const pathname = usePathname();
  
  // ИСПРАВЛЕНО: Не загружаем корзину на странице анкеты и на главной странице для новых пользователей
  // Проверяем наличие plan_progress в БД - если его нет, значит пользователь новый
  // ВАЖНО: Также проверяем готовность Telegram WebApp перед вызовом API
  const [isNewUser, setIsNewUser] = React.useState(false);
  const [isTelegramReady, setIsTelegramReady] = React.useState(false);
  
  // ИСПРАВЛЕНО: Проверяем готовность Telegram WebApp перед любыми запросами
  // ВАЖНО: На /quiz НИКОГДА не делаем запросы, даже после таймаута
  React.useEffect(() => {
    // ИСПРАВЛЕНО: На /quiz сразу устанавливаем isTelegramReady = false и не меняем
    if (pathname === '/quiz' || pathname.startsWith('/quiz/')) {
      setIsTelegramReady(false);
      return;
    }
    
    const checkTelegramReady = () => {
      const isReady = Boolean(
        typeof window !== 'undefined' && 
        window.Telegram?.WebApp?.initData && 
        typeof window.Telegram.WebApp.initData === 'string' &&
        window.Telegram.WebApp.initData.length > 0
      );
      setIsTelegramReady(isReady);
    };
    
    // Проверяем сразу
    checkTelegramReady();
    
    // Если Telegram уже готов - не нужно ждать
    if (typeof window !== 'undefined' && 
        window.Telegram?.WebApp?.initData && 
        typeof window.Telegram.WebApp.initData === 'string' &&
        window.Telegram.WebApp.initData.length > 0) {
      return; // Telegram готов, не нужно проверять дальше
    }
    
    // Проверяем периодически (на случай, если Telegram загрузится позже)
    const interval = setInterval(checkTelegramReady, 100);
    const timeout = setTimeout(() => {
      clearInterval(interval);
      // После 5 секунд разрешаем запросы на других страницах (но не на /quiz)
      if (pathname !== '/quiz' && !pathname.startsWith('/quiz/')) {
        setIsTelegramReady(true);
      }
    }, 5000);
    
    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [pathname]);
  
  React.useEffect(() => {
    // ИСПРАВЛЕНО: Проверяем нового пользователя только если Telegram готов И мы не на /quiz
    if (pathname === '/' && isTelegramReady) {
      const checkNewUser = async () => {
        try {
          const { getHasPlanProgress } = await import('@/lib/user-preferences');
          const hasPlanProgress = await getHasPlanProgress();
          setIsNewUser(!hasPlanProgress);
        } catch {
          setIsNewUser(false);
        }
      };
      checkNewUser();
    } else {
      setIsNewUser(false);
    }
  }, [pathname, isTelegramReady]);
  
  // ИСПРАВЛЕНО: Не загружаем корзину если:
  // 1. На странице анкеты
  // 2. Telegram не готов
  // 3. Новый пользователь на главной странице
  const shouldLoad = pathname !== '/quiz' && 
                     !pathname.startsWith('/quiz/') && 
                     isTelegramReady && // Telegram должен быть готов
                     !isNewUser; // Не загружаем для новых пользователей на главной
  
  return useQuery({
    queryKey: [CART_QUERY_KEY],
    queryFn: () => api.getCart() as Promise<any>,
    staleTime: 1 * 60 * 1000, // 1 минута (корзина может часто меняется)
    gcTime: 5 * 60 * 1000, // 5 минут в кэше
    enabled: shouldLoad,
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

