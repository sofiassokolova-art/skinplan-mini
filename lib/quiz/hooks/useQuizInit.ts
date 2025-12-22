// lib/quiz/hooks/useQuizInit.ts
// Хук для объединения логики инициализации анкеты
// Вынесен из quiz/page.tsx для разделения ответственности

import { useEffect, useRef } from 'react';
import { api } from '@/lib/api';
import { clientLogger } from '@/lib/client-logger';

interface UseQuizInitOptions {
  initCompletedRef: React.MutableRefObject<boolean>;
  setLoading: (loading: boolean) => void;
  pendingInfoScreen: any;
  currentQuestionIndex: number;
  allQuestions: any[];
  initInProgressRef: React.MutableRefObject<boolean>;
  initStartTimeRef: React.MutableRefObject<number | null>;
}

export function useQuizInit(options: UseQuizInitOptions) {
  const {
    initCompletedRef,
    setLoading,
    pendingInfoScreen,
    currentQuestionIndex,
    allQuestions,
    initInProgressRef,
    initStartTimeRef,
  } = options;

  // Очистка залипшего флага quiz_just_submitted при входе на /quiz
  useEffect(() => {
    try {
      if (typeof window !== 'undefined') {
        const justSubmitted = sessionStorage.getItem('quiz_just_submitted');
        if (justSubmitted === 'true') {
          clientLogger.log('🧹 Очищаем залипший флаг quiz_just_submitted при входе на /quiz');
          sessionStorage.removeItem('quiz_just_submitted');
        }
      }
    } catch (error) {
      // Игнорируем ошибки sessionStorage (например, в приватном режиме)
    }
  }, []);

  // Проверка флага quiz_just_submitted и редирект на /plan
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const justSubmitted = sessionStorage.getItem('quiz_just_submitted') === 'true';
      if (justSubmitted) {
        clientLogger.log('✅ Анкета только что отправлена, редиректим на /plan?state=generating (ранняя проверка)');
        sessionStorage.removeItem('quiz_just_submitted');
        initCompletedRef.current = true;
        setLoading(false);
        window.location.replace('/plan?state=generating');
        return;
      }

      const urlParams = new URLSearchParams(window.location.search);
      const isResuming = urlParams.get('resume') === 'true';
      if (isResuming || pendingInfoScreen) {
        clientLogger.log('ℹ️ Пользователь на инфо-экране или resume экране, пропускаем раннюю проверку профиля');
      }
    }
  }, [pendingInfoScreen, initCompletedRef, setLoading]);

  // Проверка профиля и редирект, если анкета завершена
  const checkProfileAndRedirect = async () => {
    const justSubmittedCheck = typeof window !== 'undefined' 
      ? sessionStorage.getItem('quiz_just_submitted') === 'true' 
      : false;
    
    if (justSubmittedCheck) {
      clientLogger.log('✅ Флаг quiz_just_submitted обнаружен во время проверки профиля - прерываем проверку');
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem('quiz_just_submitted');
        window.location.replace('/plan');
      }
      return;
    }

    if (pendingInfoScreen || currentQuestionIndex >= allQuestions.length) {
      clientLogger.log('⏸️ Пропускаем проверку профиля: пользователь на инфо-экране или анкета завершена');
      return;
    }

    try {
      const profile = await api.getCurrentProfile();
      if (profile && (profile as any).id) {
        // Профиль существует - проверяем, завершена ли анкета
        // Если да, редиректим на /plan
        clientLogger.log('✅ Профиль найден, редиректим на /plan');
        initCompletedRef.current = true;
        setLoading(false);
        if (typeof window !== 'undefined') {
          window.location.replace('/plan');
        }
      }
    } catch (err: any) {
      const isNotFound = err?.status === 404 || 
                        err?.message?.includes('404') || 
                        err?.message?.includes('No profile') ||
                        err?.message?.includes('Profile not found');
      
      if (!isNotFound) {
        clientLogger.warn('⚠️ Ошибка при проверке профиля:', err?.message);
      }
    }
  };

  // Проверка флагов перепрохождения
  const checkRetakeFlags = async () => {
    try {
      const { getIsRetakingQuiz, getFullRetakeFromHome, setIsRetakingQuiz, setFullRetakeFromHome } = 
        await import('@/lib/user-preferences');
      const isRetakingFromStorage = await getIsRetakingQuiz();
      const fullRetakeFromHome = await getFullRetakeFromHome();

      if (isRetakingFromStorage || fullRetakeFromHome) {
        try {
          const profile = await api.getCurrentProfile();
          if (!profile || !profile.id) {
            clientLogger.log('⚠️ Флаги перепрохождения установлены, но профиля нет - очищаем флаги');
            await setIsRetakingQuiz(false);
            await setFullRetakeFromHome(false);
            return;
          }
        } catch (profileErr: any) {
          const isNotFound = profileErr?.status === 404 || 
                            profileErr?.message?.includes('404') || 
                            profileErr?.message?.includes('No profile') ||
                            profileErr?.message?.includes('Profile not found');
          if (isNotFound) {
            clientLogger.log('⚠️ Профиля нет, но флаги перепрохождения установлены - очищаем флаги');
            try {
              await setIsRetakingQuiz(false);
              await setFullRetakeFromHome(false);
            } catch (clearError) {
              // ignore
            }
          }
        }
      }
    } catch (err: any) {
      clientLogger.warn('⚠️ Ошибка при проверке флагов перепрохождения:', err?.message);
    }
  };

  return {
    checkProfileAndRedirect,
    checkRetakeFlags,
  };
}

