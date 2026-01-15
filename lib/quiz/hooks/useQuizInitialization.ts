// lib/quiz/hooks/useQuizInitialization.ts
// Хук для начальной инициализации анкеты (проверка флагов, редиректы)

import { useEffect } from 'react';
import { clientLogger } from '@/lib/client-logger';
import { QUIZ_CONFIG } from '@/lib/quiz/config/quizConfig';
import * as userPreferences from '@/lib/user-preferences';
import { api } from '@/lib/api';

interface UseQuizInitializationParams {
  initCompletedRef: React.MutableRefObject<boolean>;
  userPreferencesData: {
    hasPlanProgress?: boolean;
    isRetakingQuiz?: boolean;
    fullRetakeFromHome?: boolean;
  } | null;
  setInitCompleted: (completed: boolean) => void;
  setLoading: (loading: boolean) => void;
}

/**
 * Хук для начальной инициализации анкеты
 * Проверяет флаги перепрохождения, делает редирект если нужно
 */
export function useQuizInitialization({
  initCompletedRef,
  userPreferencesData,
  setInitCompleted,
  setLoading,
}: UseQuizInitializationParams) {
  useEffect(() => {
    // Проверяем флаг justSubmitted и редиректим на план, если нужно
    const justSubmitted = typeof window !== 'undefined' 
      ? sessionStorage.getItem(QUIZ_CONFIG.STORAGE_KEYS.JUST_SUBMITTED) === 'true' 
      : false;
      
    if (justSubmitted) {
      clientLogger.log('✅ Флаг quiz_just_submitted установлен - пропускаем проверку профиля и редиректим на /plan?state=generating');
      // Очищаем флаг
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem(QUIZ_CONFIG.STORAGE_KEYS.JUST_SUBMITTED);
      }
      // Устанавливаем initCompleted, чтобы предотвратить повторную инициализацию
      setInitCompleted(true);
      setLoading(false);
      // ИСПРАВЛЕНО: Удаляем флаг quiz_init_done перед редиректом
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem('quiz_init_done');
        window.location.replace('/plan?state=generating');
      }
      return;
    }
    
    // ИСПРАВЛЕНО: Проверяем флаги перепрохождения для существующих пользователей
    if (typeof window !== 'undefined' && window.Telegram?.WebApp?.initData && !initCompletedRef.current && !justSubmitted) {
      const checkRetakeFlags = async () => {
        try {
          const hasPlanProgress = userPreferencesData?.hasPlanProgress ?? false;
          
          if (!hasPlanProgress) {
            // Новый пользователь - не проверяем флаги перепрохождения
            clientLogger.log('ℹ️ Новый пользователь (нет hasPlanProgress) - пропускаем проверку флагов перепрохождения');
            return;
          }
          
          const isRetakingFromStorage = userPreferencesData?.isRetakingQuiz ?? false;
          const fullRetakeFromHome = userPreferencesData?.fullRetakeFromHome ?? false;
          
          // Если флаги перепрохождения установлены, но профиля нет - очищаем флаги
          if (isRetakingFromStorage || fullRetakeFromHome) {
            try {
              const profile = await api.getCurrentProfile();
              if (!profile || !profile.id) {
                // Профиля нет, но флаги перепрохождения установлены - это ошибка
                clientLogger.log('⚠️ Флаги перепрохождения установлены, но профиля нет - очищаем флаги');
                await userPreferences.setIsRetakingQuiz(false);
                await userPreferences.setFullRetakeFromHome(false);
                return;
              }
              // Профиль есть - это нормальное перепрохождение
            } catch (profileErr: any) {
              // Профиля нет - очищаем флаги
              const isNotFound = profileErr?.status === 404 || 
                                profileErr?.message?.includes('404') || 
                                profileErr?.message?.includes('No profile') ||
                                profileErr?.message?.includes('Profile not found');
              if (isNotFound) {
                clientLogger.log('⚠️ Профиля нет, но флаги перепрохождения установлены - очищаем флаги');
                try {
                  const { setIsRetakingQuiz, setFullRetakeFromHome } = await import('@/lib/user-preferences');
                  await setIsRetakingQuiz(false);
                  await setFullRetakeFromHome(false);
                } catch (clearError) {
                  // ignore
                }
              }
            }
          }
        } catch (err: any) {
          // Ошибка при проверке флагов - логируем, но не блокируем
          clientLogger.warn('⚠️ Ошибка при проверке флагов перепрохождения:', err?.message);
        }
      };
      
      checkRetakeFlags().catch(() => {});
    }
  }, [initCompletedRef, userPreferencesData, setInitCompleted, setLoading]);
}
