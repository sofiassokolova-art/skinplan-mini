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
  const [isLoading, setIsLoading] = useState(true);

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
          if (!isOnQuizPage && currentPath !== '/') {
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
        setIsLoading(false);
        if (typeof window !== 'undefined') {
          window.location.replace('/quiz');
        }
        return;
      }

      // plan_progress есть - пользователь не новый, редиректим на /home
      clientLogger.log('ℹ️ Has plan_progress - redirecting to /home');
      setIsRedirecting(true);
      setIsLoading(false);
      if (typeof window !== 'undefined') {
        window.location.replace('/home');
      }
    };

    checkAndRedirect();
  }, [router]);

  // ИСПРАВЛЕНО: Показываем лоадер во время проверки hasPlanProgress
  // Лоадер показывается только на главной странице (/)
  if (isLoading && !isRedirecting) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        flexDirection: 'column',
        gap: '24px',
        background: 'linear-gradient(135deg, #F5FFFC 0%, #E8FBF7 100%)'
      }}>
        <div style={{
          position: 'relative',
          width: '160px',
          height: '100px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <div className="loader-shapes">
            <div className="loader-shape loader-shape-1"></div>
            <div className="loader-shape loader-shape-2"></div>
          </div>
        </div>
        <style>{`
          .loader-shapes {
            position: relative;
            width: 160px;
            height: 100px;
          }
          
          .loader-shape {
            position: absolute;
            top: 50%;
            transform: translateY(-50%);
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            will-change: transform, width, height, border-radius, opacity;
          }
          
          .loader-shape-1 {
            background: #D5FE61;
            box-shadow: 0 4px 16px rgba(213, 254, 97, 0.4), 
                        0 2px 8px rgba(213, 254, 97, 0.3),
                        inset 0 1px 0 rgba(255, 255, 255, 0.2);
            animation: morph-left 4s cubic-bezier(0.4, 0, 0.2, 1) infinite;
          }
          
          .loader-shape-2 {
            background: #0A5F59;
            box-shadow: 0 4px 16px rgba(10, 95, 89, 0.3), 
                        0 2px 8px rgba(10, 95, 89, 0.2),
                        inset 0 1px 0 rgba(255, 255, 255, 0.1);
            animation: morph-right 4s cubic-bezier(0.4, 0, 0.2, 1) infinite;
          }
          
          @keyframes morph-left {
            0%, 100% {
              border-radius: 50%;
              width: 20px;
              height: 20px;
              left: 0;
              transform: translateY(-50%) scale(1);
              opacity: 1;
            }
            30% {
              border-radius: 45%;
              width: 50px;
              height: 38px;
              left: 8px;
              transform: translateY(-50%) scale(1);
              opacity: 1;
            }
            40% {
              border-radius: 30px;
              width: 96px;
              height: 38px;
              left: 12px;
              transform: translateY(-50%) scale(1);
              opacity: 1;
            }
            60% {
              border-radius: 25px;
              width: 60px;
              height: 38px;
              left: 0;
              transform: translateY(-50%) scale(1);
              opacity: 1;
            }
            80% {
              border-radius: 50%;
              width: 48px;
              height: 48px;
              left: 0;
              transform: translateY(-50%) scale(1.05);
              opacity: 1;
            }
          }
          
          @keyframes morph-right {
            0%, 100% {
              border-radius: 50%;
              width: 48px;
              height: 48px;
              right: 0;
              transform: translateY(-50%) scale(1.05);
              opacity: 1;
            }
            40% {
              border-radius: 30px;
              width: 0;
              height: 38px;
              right: 12px;
              transform: translateY(-50%) scale(0);
              opacity: 0;
            }
            60% {
              border-radius: 50%;
              width: 20px;
              height: 20px;
              right: 0;
              transform: translateY(-50%) scale(1.15);
              opacity: 1;
            }
          }
        `}</style>
      </div>
    );
  }

  // Во время редиректа не показываем контент
  if (isRedirecting) {
    return null;
  }

  return null;
}
