// lib/quiz/hooks/useQuizRetake.ts
// ИСПРАВЛЕНО: Хук для управления логикой перепрохождения анкеты
// Вынесен из quiz/page.tsx для разделения логики

import { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '@/lib/api';
import { clientLogger } from '@/lib/client-logger';

export type RetakeStatus =
  | 'idle'
  | 'saving_answers'
  | 'updating_profile'
  | 'invalidating_plan'
  | 'rebuilding_plan'
  | 'completed'
  | 'error';

export interface RetakeResult {
  success: boolean;
  planInvalidated?: boolean;
  error?: string;
}

export function useQuizRetake() {
  const [isRetakingQuiz, setIsRetakingQuiz] = useState(false);
  const [showRetakeScreen, setShowRetakeScreen] = useState(false);
  const [isStartingOver, setIsStartingOver] = useState(false);
  const [retakeStatus, setRetakeStatus] = useState<RetakeStatus>('idle');
  const [planNeedsRebuild, setPlanNeedsRebuild] = useState(false);
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

  // ИСПРАВЛЕНО: Функция для обработки ответа от update-partial и пересборки плана
  const handleRetakeResponse = useCallback(async (
    response: { success: boolean; planInvalidated?: boolean; error?: string }
  ): Promise<RetakeResult> => {
    try {
      setRetakeStatus('updating_profile');
      
      if (!response.success) {
        setRetakeStatus('error');
        return {
          success: false,
          error: response.error || 'Failed to update profile',
        };
      }

      // ИСПРАВЛЕНО: Если план инвалидирован, нужно пересобрать
      if (response.planInvalidated) {
        setPlanNeedsRebuild(true);
        setRetakeStatus('rebuilding_plan');
        
        clientLogger.log('🔄 Plan invalidated, rebuilding...');
        
        try {
          // Вызываем генерацию плана
          const planResponse = await fetch('/api/plan/generate', {
            method: 'GET',
            headers: {
              'X-Telegram-Init-Data': window.Telegram?.WebApp?.initData || '',
            },
          });

          if (!planResponse.ok) {
            const errorData = await planResponse.json().catch(() => ({}));
            throw new Error(errorData.error || `Plan generation failed: ${planResponse.status}`);
          }

          const planData = await planResponse.json();
          
          if (planData.success) {
            clientLogger.log('✅ Plan successfully rebuilt');
            setRetakeStatus('completed');
            setPlanNeedsRebuild(false);
            return {
              success: true,
              planInvalidated: true,
            };
          } else {
            throw new Error(planData.error || 'Plan generation returned unsuccessful');
          }
        } catch (planError: any) {
          clientLogger.warn('⚠️ Failed to rebuild plan', planError);
          setRetakeStatus('error');
          return {
            success: false,
            error: `Plan rebuild failed: ${planError.message || 'Unknown error'}`,
            planInvalidated: true,
          };
        }
      } else {
        // План не нужно пересобирать
        setRetakeStatus('completed');
        return {
          success: true,
          planInvalidated: false,
        };
      }
    } catch (error: any) {
      clientLogger.error('❌ Error handling retake response', error);
      setRetakeStatus('error');
      return {
        success: false,
        error: error.message || 'Unknown error',
      };
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
    retakeStatus, // ИСПРАВЛЕНО: Добавлено состояние retake
    planNeedsRebuild, // ИСПРАВЛЕНО: Добавлен флаг необходимости пересборки плана
    handleRetakeResponse, // ИСПРАВЛЕНО: Добавлена функция для обработки ответа
  };
}

