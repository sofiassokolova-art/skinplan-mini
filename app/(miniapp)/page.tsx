// app/(miniapp)/page.tsx
// Простой редирект: новый пользователь → /quiz, пользователь с планом → /home

'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { clientLogger } from '@/lib/client-logger';
import { REDIRECT_TIMEOUTS } from '@/lib/config/timeouts';

export default function RootPage() {
  const router = useRouter();
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  // ФИКС: Ref для предотвращения множественных редиректов
  const redirectInProgressRef = useRef(false);
  // РЕФАКТОРИНГ: Ref для хранения таймера очистки
  const cleanupTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // ФИКС: Защита от множественных редиректов
    if (redirectInProgressRef.current) {
      return; // Редирект уже в процессе
    }
    
    // КРИТИЧНО: Проверяем флаг quiz_just_submitted ПЕРЕД ВСЕМ
    const justSubmitted = typeof window !== 'undefined' ? sessionStorage.getItem('quiz_just_submitted') === 'true' : false;
    if (justSubmitted) {
      redirectInProgressRef.current = true;
      clientLogger.log('✅ Флаг quiz_just_submitted установлен на главной - редиректим на /plan?state=generating');
      
      (async () => {
        try {
          const { setHasPlanProgress } = await import('@/lib/user-preferences');
          await setHasPlanProgress(true);
        } catch (error) {
          clientLogger.warn('⚠️ Ошибка при установке hasPlanProgress (некритично):', error);
        }
        if (typeof window !== 'undefined') {
          sessionStorage.removeItem('quiz_just_submitted');
          window.location.replace('/plan?state=generating');
          // РЕФАКТОРИНГ: Используем ref для cleanup
          cleanupTimerRef.current = setTimeout(() => {
            redirectInProgressRef.current = false;
          }, REDIRECT_TIMEOUTS.RESET_FLAG);
        }
      })();
      return;
    }

    // ИСПРАВЛЕНО: Для нового пользователя - СРАЗУ редирект на /quiz БЕЗ показа контента
    // Проверяем hasPlanProgress ПЕРВЫМ делом, до любых других проверок
    // Это гарантирует, что новый пользователь не увидит лоадер, ошибки или навигацию
    if (typeof window === 'undefined' || !window.Telegram?.WebApp?.initData) {
      // Если Telegram не доступен, все равно редиректим на /quiz
      clientLogger.log('Telegram WebApp не доступен, перенаправляем на анкету');
      setIsRedirecting(true);
      if (typeof window !== 'undefined') {
        window.location.replace('/quiz');
      }
      return;
    }
    
    // ИСПРАВЛЕНО: Проверяем авторизацию перед проверкой hasPlanProgress
    const checkAndRedirect = async () => {
      setIsLoading(true); // Показываем лоадер во время проверки
      try {
        // ИСПРАВЛЕНО: Проверяем наличие window.Telegram перед использованием
        if (typeof window !== 'undefined' && window.Telegram?.WebApp?.initData) {
          await api.authTelegram(window.Telegram.WebApp.initData);
          clientLogger.log('✅ Authorization successful');
        }
      } catch (authError: any) {
        // Не блокируем приложение при ошибке авторизации
        clientLogger.warn('⚠️ Authorization failed, but continuing (non-blocking):', authError?.message);
      }
      
      // КРИТИЧНО: Проверяем hasPlanProgress СРАЗУ, без установки loading = true
      // Если пользователь новый - редиректим на /quiz БЕЗ показа контента
      // ИСПРАВЛЕНО: Используем sessionStorage для проверки hasPlanProgress БЕЗ API вызова
      // Это предотвращает запрос к /api/user/preferences на главной странице
      let hasPlanProgress = false;
      try {
        if (typeof window !== 'undefined') {
          const cached = sessionStorage.getItem('user_preferences_cache');
          if (cached) {
            try {
              const parsed = JSON.parse(cached);
              hasPlanProgress = parsed?.data?.hasPlanProgress ?? false;
              clientLogger.log('ℹ️ Using cached hasPlanProgress from sessionStorage:', hasPlanProgress);
            } catch {
              // Если кэш поврежден, игнорируем
            }
          }
        }
        
        // Если в кэше нет - делаем API запрос, но только если мы не редиректим на /quiz
        // ИСПРАВЛЕНО: Проверяем pathname перед вызовом getHasPlanProgress, чтобы не делать запрос на /quiz
        // ИСПРАВЛЕНО: Если hasPlanProgress === false (новый пользователь), не делаем API запрос - сразу редиректим
        if (!hasPlanProgress) {
          const currentPath = typeof window !== 'undefined' ? window.location.pathname : '';
          const isOnQuizPage = currentPath === '/quiz' || currentPath.startsWith('/quiz/');
          
          // ИСПРАВЛЕНО: Не делаем API запрос, если мы на главной странице и собираемся редиректить на /quiz
          // Это предотвращает вызов /api/user/preferences на главной странице перед редиректом
          // Если hasPlanProgress === false из кэша, значит пользователь новый, и мы все равно редиректим на /quiz
          // Поэтому нет смысла делать API запрос
          // ИСПРАВЛЕНО: Убрано условие currentPath !== '/' - теперь API запрос выполняется на всех страницах, кроме /quiz
          // Это включает корневую страницу '/', чтобы правильно определить, есть ли у пользователя план
          if (!isOnQuizPage) {
            const { getHasPlanProgress } = await import('@/lib/user-preferences');
            hasPlanProgress = await getHasPlanProgress();
          }
        }
      } catch (error) {
        // При ошибке считаем, что пользователь новый
        clientLogger.warn('⚠️ Error checking hasPlanProgress, assuming new user:', error);
        hasPlanProgress = false;
      }
      
      // ФИКС: Проверяем, не идет ли уже редирект
      if (redirectInProgressRef.current) {
        return; // Редирект уже в процессе
      }
      
      if (!hasPlanProgress) {
        // Нет plan_progress - новый пользователь → /quiz
        redirectInProgressRef.current = true;
        clientLogger.log('ℹ️ No plan_progress - redirecting to /quiz');
        setIsRedirecting(true);
        setIsLoading(false);
        if (typeof window !== 'undefined') {
          window.location.replace('/quiz');
          cleanupTimerRef.current = setTimeout(() => {
            redirectInProgressRef.current = false;
          }, REDIRECT_TIMEOUTS.RESET_FLAG);
        }
        return;
      }

      // plan_progress есть → /home
      redirectInProgressRef.current = true;
      clientLogger.log('ℹ️ Has plan_progress - redirecting to /home');
      setIsRedirecting(true);
      setIsLoading(false);
      if (typeof window !== 'undefined') {
        window.location.replace('/home');
        cleanupTimerRef.current = setTimeout(() => {
          redirectInProgressRef.current = false;
        }, REDIRECT_TIMEOUTS.RESET_FLAG);
      }
    };

    checkAndRedirect();
    
    // РЕФАКТОРИНГ: Cleanup function для очистки таймеров при размонтировании
    return () => {
      if (cleanupTimerRef.current) {
        clearTimeout(cleanupTimerRef.current);
        cleanupTimerRef.current = null;
      }
    };
  }, [router]);

  // Во время загрузки/редиректа не показываем контент
  if (isLoading || isRedirecting) {
    return null;
  }

  return null;
}