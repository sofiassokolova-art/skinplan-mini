// app/(miniapp)/page.tsx
// Простой редирект: новый пользователь → /quiz, пользователь с планом → /home

'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { clientLogger } from '@/lib/client-logger';

export default function RootPage() {
  const router = useRouter();
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  // ФИКС: Ref для предотвращения множественных редиректов
  const redirectInProgressRef = useRef(false);

  useEffect(() => {
    // ФИКС: Защита от множественных редиректов
    if (redirectInProgressRef.current) {
      return; // Редирект уже в процессе
    }
    
    // КРИТИЧНО: Проверяем флаг quiz_just_submitted ПЕРЕД ВСЕМ
    // Это предотвращает редирект на /quiz сразу после отправки анкеты
    const justSubmitted = typeof window !== 'undefined' ? sessionStorage.getItem('quiz_just_submitted') === 'true' : false;
    if (justSubmitted) {
      redirectInProgressRef.current = true; // Помечаем, что редирект начат
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
        // ФИКС: Сбрасываем redirectInProgressRef через задержку после редиректа
        setTimeout(() => {
          redirectInProgressRef.current = false;
        }, 1000);
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
        
        // ИСПРАВЛЕНО: Если в кэше нет данных, делаем API запрос для проверки hasPlanProgress
        // КРИТИЧНО: На корневой странице (currentPath === '/') также нужно делать API запрос,
        // иначе пользователи с существующими планами будут редиректиться на /quiz вместо /home
        if (!hasPlanProgress) {
          const currentPath = typeof window !== 'undefined' ? window.location.pathname : '';
          const isOnQuizPage = currentPath === '/quiz' || currentPath.startsWith('/quiz/');
          
          // ИСПРАВЛЕНО: Делаем API запрос везде, кроме страницы /quiz
          // Это включает корневую страницу '/', чтобы правильно определить, есть ли у пользователя план
          if (!isOnQuizPage) {
            const { getHasPlanProgress } = await import('@/lib/user-preferences');
            hasPlanProgress = await getHasPlanProgress();
            clientLogger.log('ℹ️ Fetched hasPlanProgress from API:', hasPlanProgress);
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
        // Нет plan_progress - значит пользователь новый
        // ИСПРАВЛЕНО: Сразу редиректим на /quiz БЕЗ показа контента, лоадера или ошибок
        redirectInProgressRef.current = true; // Помечаем, что редирект начат
        clientLogger.log('ℹ️ No plan_progress - redirecting to /quiz (new user, no content shown)');
        setIsRedirecting(true);
        setIsLoading(false);
        if (typeof window !== 'undefined') {
          window.location.replace('/quiz');
          // ФИКС: Сбрасываем redirectInProgressRef через задержку после редиректа
          setTimeout(() => {
            redirectInProgressRef.current = false;
          }, 1000);
        }
        return;
      }

      // plan_progress есть - пользователь не новый, редиректим на /home
      redirectInProgressRef.current = true; // Помечаем, что редирект начат
      clientLogger.log('ℹ️ Has plan_progress - redirecting to /home');
      setIsRedirecting(true);
      setIsLoading(false);
      if (typeof window !== 'undefined') {
        window.location.replace('/home');
        // ФИКС: Сбрасываем redirectInProgressRef через задержку после редиректа
        setTimeout(() => {
          redirectInProgressRef.current = false;
        }, 1000);
      }
    };

    checkAndRedirect();
  }, [router]);

  // ИСПРАВЛЕНО: Лоадер убран - главная страница только редиректит, не показывает контент
  // Если идет загрузка или редирект - возвращаем null
  if (isLoading || isRedirecting) {
    return null;
  }

  // Во время редиректа не показываем контент
  if (isRedirecting) {
    return null;
  }

  return null;
}