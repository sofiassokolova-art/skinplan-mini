// app/(miniapp)/page.tsx
// Простой редирект: новый пользователь → /quiz, пользователь с планом → /home

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { clientLogger } from '@/lib/client-logger';

export default function RootPage() {
  const router = useRouter();
  const [isRedirecting, setIsRedirecting] = useState(false);

  useEffect(() => {
    // КРИТИЧНО: Проверяем флаг quiz_just_submitted ПЕРЕД ВСЕМ
    // Это предотвращает редирект на /quiz сразу после отправки анкеты
    const justSubmitted = typeof window !== 'undefined' ? sessionStorage.getItem('quiz_just_submitted') === 'true' : false;
    if (justSubmitted) {
      clientLogger.log('✅ Флаг quiz_just_submitted установлен на главной - редиректим на /plan?state=generating');
      // ИСПРАВЛЕНО: Оборачиваем async операции в отдельную функцию, так как useEffect не может быть async
      (async () => {
        try {
          const { setHasPlanProgress } = await import('@/lib/user-preferences');
          await setHasPlanProgress(true);
        } catch (error) {
          clientLogger.warn('⚠️ Ошибка при установке hasPlanProgress (некритично):', error);
        }
      })();
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem('quiz_just_submitted');
        window.location.replace('/plan?state=generating');
      }
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
      try {
        await api.authTelegram(window.Telegram.WebApp.initData);
        clientLogger.log('✅ Authorization successful');
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
        if (!hasPlanProgress) {
          const currentPath = typeof window !== 'undefined' ? window.location.pathname : '';
          const isOnQuizPage = currentPath === '/quiz' || currentPath.startsWith('/quiz/');
          
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
      
      if (!hasPlanProgress) {
        // Нет plan_progress - значит пользователь новый
        // ИСПРАВЛЕНО: Сразу редиректим на /quiz БЕЗ показа контента, лоадера или ошибок
        clientLogger.log('ℹ️ No plan_progress - redirecting to /quiz (new user, no content shown)');
        setIsRedirecting(true);
        if (typeof window !== 'undefined') {
          window.location.replace('/quiz');
        }
        return;
      }

      // plan_progress есть - пользователь не новый, редиректим на /home
      clientLogger.log('ℹ️ Has plan_progress - redirecting to /home');
      setIsRedirecting(true);
      if (typeof window !== 'undefined') {
        window.location.replace('/home');
      }
    };

    checkAndRedirect();
  }, [router]);

  // ИСПРАВЛЕНО: Для нового пользователя не показываем никакого контента
  // Просто возвращаем null во время редиректа
  if (isRedirecting) {
    return null;
  }

  // Во время проверки также не показываем контент
  return null;
}
