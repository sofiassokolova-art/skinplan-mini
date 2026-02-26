// lib/quiz/hooks/useQuizRetake.ts
// ПЕРЕПРОХОЖДЕНИЕ С ГЛАВНОЙ: retakeFromHome=1 в URL
// Поток: главная → "Перепройти" → /quiz?retakeFromHome=1 → экран выбора тем → payment → вопросы без инфо → план
// Отдельно от перепрохождения с резюм-экрана (startOver — "Начать заново" → первый инфо-экран → полная анкета)

import { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '@/lib/api';
import { clientLogger } from '@/lib/client-logger';

function getRetakeFromUrl(): boolean {
  if (typeof window === 'undefined') return false;
  const params = new URLSearchParams(window.location.search);
  const val = params.get('retakeFromHome');
  return val === '1';
}

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
  // Инициализация false — иначе hydration mismatch (на сервере window недоступен)
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

  // useEffect — читаем URL после гидрации, не useLayoutEffect (иначе hydration mismatch)
  useEffect(() => {
    const retakeFromHome = getRetakeFromUrl();
    clientLogger.log('🔍 useQuizRetake: проверка retakeFromHome', {
      retakeFromHome,
      search: typeof window !== 'undefined' ? window.location.search : 'ssr',
      href: typeof window !== 'undefined' ? window.location.href : 'ssr',
    });
    if (retakeFromHome) {
      // КРИТИЧНО: Показываем экран выбора тем СРАЗУ — не ждём проверку профиля
      // Иначе пользователь видит первый инфо-экран до завершения async
      setIsRetakingQuiz(true);
      setShowRetakeScreen(true);
      clientLogger.log('✅ retakeFromHome в URL — показываем экран выбора тем сразу');

      if (!window.Telegram?.WebApp?.initData) {
        clientLogger.log('⚠️ retakeFromHome: initData отсутствует (не в Telegram?)');
        return;
      }

      if (profileCheckInProgressRef.current) return;
      profileCheckInProgressRef.current = true;

      const checkProfileAndShowRetake = async () => {
        try {
          const profile = await api.getCurrentProfile();
          if (!profile || !profile.id) {
            clientLogger.log('⚠️ retakeFromHome: профиля нет — убираем экран выбора тем');
            setIsRetakingQuiz(false);
            setShowRetakeScreen(false);
          } else {
            clientLogger.log('✅ retakeFromHome: профиль подтверждён');
          }
        } catch (err: any) {
          const isNotFound = err?.status === 404 || 
                            err?.message?.includes('404') || 
                            err?.message?.includes('No profile') ||
                            err?.message?.includes('Profile not found');
          if (isNotFound) {
            clientLogger.log('⚠️ retakeFromHome: профиль не найден — убираем экран выбора тем');
            setIsRetakingQuiz(false);
            setShowRetakeScreen(false);
          } else {
            clientLogger.warn('⚠️ Ошибка при проверке профиля для retakeFromHome:', err);
          }
        } finally {
          profileCheckInProgressRef.current = false;
        }
      };

      checkProfileAndShowRetake().catch(() => {
        profileCheckInProgressRef.current = false;
      });
    }
  }, []);

  // Fallback: на localhost URL иногда обновляется с задержкой — перепроверяем через 100 и 300ms
  useEffect(() => {
    const checkDelayed = () => {
      const retakeFromHome = getRetakeFromUrl();
      if (retakeFromHome) {
        clientLogger.log('🔍 useQuizRetake fallback: retakeFromHome найден при повторной проверке URL');
        setIsRetakingQuiz(true);
        setShowRetakeScreen(true);
      }
    };
    const t1 = setTimeout(checkDelayed, 100);
    const t2 = setTimeout(checkDelayed, 300);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
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

