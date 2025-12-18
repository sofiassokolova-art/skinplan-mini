// lib/quiz/hooks/useQuizRetake.ts
// ИСПРАВЛЕНО: Хук для управления логикой перепрохождения анкеты
// Вынесен из quiz/page.tsx для разделения логики

import { useState, useEffect, useRef } from 'react';
import { api } from '@/lib/api';
import { clientLogger } from '@/lib/client-logger';

export function useQuizRetake() {
  const [isRetakingQuiz, setIsRetakingQuiz] = useState(false);
  const [showRetakeScreen, setShowRetakeScreen] = useState(false);
  const [isStartingOver, setIsStartingOver] = useState(false);
  const isStartingOverRef = useRef(false);
  const profileCheckInProgressRef = useRef(false);

  useEffect(() => {
    isStartingOverRef.current = isStartingOver;
  }, [isStartingOver]);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.Telegram?.WebApp?.initData) {
      if (profileCheckInProgressRef.current) return;
      profileCheckInProgressRef.current = true;

      const isRetakingFromStorage = localStorage.getItem('is_retaking_quiz') === 'true';
      const fullRetakeFromHome = localStorage.getItem('full_retake_from_home') === 'true';
      
      if (isRetakingFromStorage || fullRetakeFromHome) {
        const checkProfileAndShowRetake = async () => {
          try {
            const profile = await api.getCurrentProfile();
            if (profile && profile.id) {
              setIsRetakingQuiz(true);
              
              if (fullRetakeFromHome) {
                localStorage.removeItem('full_retake_from_home');
                clientLogger.log('✅ Полное перепрохождение с главной страницы');
              }
              
              setShowRetakeScreen(true);
              clientLogger.log('✅ Флаг перепрохождения найден и профиль существует');
            } else {
              clientLogger.log('⚠️ Флаги перепрохождения установлены, но профиля нет - очищаем флаги');
              localStorage.removeItem('is_retaking_quiz');
              localStorage.removeItem('full_retake_from_home');
            }
          } catch (err: any) {
            const isNotFound = err?.status === 404 || 
                              err?.message?.includes('404') || 
                              err?.message?.includes('No profile') ||
                              err?.message?.includes('Profile not found');
            if (isNotFound) {
              clientLogger.log('⚠️ Профиля нет, но флаги перепрохождения установлены - очищаем флаги');
              localStorage.removeItem('is_retaking_quiz');
              localStorage.removeItem('full_retake_from_home');
            } else {
              clientLogger.warn('⚠️ Ошибка при проверке профиля для перепрохождения:', err);
            }
          } finally {
            profileCheckInProgressRef.current = false;
          }
        };
        
        checkProfileAndShowRetake().catch(() => {
          profileCheckInProgressRef.current = false;
        });
      } else {
        profileCheckInProgressRef.current = false;
      }
    }
  }, []);

  return {
    isRetakingQuiz,
    setIsRetakingQuiz,
    showRetakeScreen,
    setShowRetakeScreen,
    isStartingOver,
    setIsStartingOver,
    isStartingOverRef,
  };
}

