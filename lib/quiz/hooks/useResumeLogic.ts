// lib/quiz/hooks/useResumeLogic.ts
// Хук для логики экрана "Продолжить анкету"
// Вынесен из quiz/page.tsx для разделения ответственности

import { useState, useRef, useCallback } from 'react';
import { api } from '@/lib/api';
import { clientLogger } from '@/lib/client-logger';

interface SavedProgress {
  answers: Record<number, string | string[]>;
  questionIndex: number;
  infoScreenIndex: number;
}

interface UseResumeLogicOptions {
  setAnswers: (answers: Record<number, string | string[]>) => void;
  setCurrentQuestionIndex: (index: number) => void;
  setCurrentInfoScreenIndex: (index: number) => void;
  setShowResumeScreen: (show: boolean) => void;
  setLoading: (loading: boolean) => void;
  setHasResumed: (resumed: boolean) => void;
  hasResumedRef: React.MutableRefObject<boolean>;
  isStartingOverRef: React.MutableRefObject<boolean>;
  isStartingOver: boolean;
}

export function useResumeLogic(options: UseResumeLogicOptions) {
  const {
    setAnswers,
    setCurrentQuestionIndex,
    setCurrentInfoScreenIndex,
    setShowResumeScreen,
    setLoading,
    setHasResumed,
    hasResumedRef,
    isStartingOverRef,
    isStartingOver,
  } = options;

  const [savedProgress, setSavedProgress] = useState<SavedProgress | null>(null);
  const loadProgressInProgressRef = useRef(false);
  const progressLoadInProgressRef = useRef(false);

  // Загрузка прогресса с сервера
  const loadSavedProgressFromServer = useCallback(async () => {
    clientLogger.log('🔄 loadSavedProgressFromServer: вызов', {
      loadProgressInProgress: loadProgressInProgressRef.current,
      progressLoadInProgress: progressLoadInProgressRef.current,
      hasResumedRef: hasResumedRef.current,
      isStartingOver: isStartingOverRef.current,
    });

    if (loadProgressInProgressRef.current) {
      clientLogger.log('⏸️ loadSavedProgressFromServer: уже выполняется, пропускаем');
      return;
    }

    if (hasResumedRef.current) {
      clientLogger.log('⏸️ loadSavedProgressFromServer: hasResumed = true, пропускаем');
      return;
    }

    if (progressLoadInProgressRef.current) {
      clientLogger.log('⏸️ loadSavedProgressFromServer: progressLoadInProgressRef = true, пропускаем');
      return;
    }

    loadProgressInProgressRef.current = true;

    try {
      if (isStartingOverRef.current || isStartingOver) {
        return;
      }

      if (hasResumedRef.current) {
        clientLogger.log('⏸️ loadSavedProgressFromServer: hasResumed = true перед API вызовом, пропускаем');
        return;
      }

      if (typeof window === 'undefined' || !window.Telegram?.WebApp?.initData) {
        return;
      }
      
      // КРИТИЧНО: Перепрохождение с главной (retakeFromHome в URL) — не показываем "Вы не завершили анкету"
      if (new URLSearchParams(window.location.search).get('retakeFromHome') === '1') {
        clientLogger.log('✅ retakeFromHome в URL — не показываем showResumeScreen');
        return;
      }
      
      const response = await api.getQuizProgress() as {
        progress?: SavedProgress & { timestamp: number } | null;
      };

      // ИСПРАВЛЕНО: Проверка профиля теперь происходит на бэкенде
      // Если прогресс есть, значит пользователь не новый (независимо от наличия профиля)
      // hasProfile больше не нужен для определения показа экрана "Продолжить"
      const hasProfile = false; // Не используется, оставлено для совместимости

      const answersCount = response?.progress?.answers 
        ? Object.keys(response.progress.answers).length 
        : 0;
      const questionIndex = response?.progress?.questionIndex ?? -1;
      const shouldShowProgressScreen = answersCount >= 5 || questionIndex >= 5;

      if (response?.progress && response.progress.answers && answersCount > 0 && shouldShowProgressScreen) {
        if (hasResumedRef.current) {
          clientLogger.log('⏸️ loadSavedProgressFromServer: пропущено после получения ответа, так как hasResumed = true');
          return;
        }

        if (hasResumedRef.current) {
          clientLogger.log('⏸️ loadSavedProgressFromServer: пропущено перед установкой состояний, так как hasResumed = true');
          return;
        }

        clientLogger.log('✅ Прогресс найден на сервере, показываем экран продолжения:', {
          answersCount: Object.keys(response.progress.answers).length,
          questionIndex: response.progress.questionIndex,
          infoScreenIndex: response.progress.infoScreenIndex,
          hasProfile,
        });

        setSavedProgress(response.progress);
        setShowResumeScreen(true);
        setLoading(false);
      } else {
        clientLogger.log('ℹ️ Прогресс на сервере не найден или пуст');
        setSavedProgress(null);
        setShowResumeScreen(false);
        
        // КРИТИЧНО: Если прогресса на сервере нет, очищаем sessionStorage
        // Это гарантирует, что пользователь увидит начальные инфо-экраны
        if (typeof window !== 'undefined') {
          try {
            sessionStorage.removeItem('quiz_currentInfoScreenIndex');
            sessionStorage.removeItem('quiz_currentQuestionIndex');
            sessionStorage.removeItem('quiz_answers_backup');
            clientLogger.log('🧹 SessionStorage очищен (прогресс на сервере не найден)');
          } catch (storageErr) {
            clientLogger.warn('⚠️ Не удалось очистить sessionStorage:', storageErr);
          }
        }
      }
    } catch (err: any) {
      if (err?.message?.includes('401') || err?.message?.includes('Unauthorized')) {
        setSavedProgress(null);
        setShowResumeScreen(false);
        return;
      }
      clientLogger.warn('Ошибка загрузки прогресса с сервера:', err);
      setSavedProgress(null);
      setShowResumeScreen(false);
    } finally {
      if (!hasResumedRef.current) {
        loadProgressInProgressRef.current = false;
      } else {
        clientLogger.log('🔒 loadSavedProgressFromServer: оставляем флаги установленными, так как hasResumed = true');
      }

      if (hasResumedRef.current) {
        clientLogger.log('⏸️ loadSavedProgressFromServer: hasResumed = true после загрузки, очищаем состояния');
        setSavedProgress(null);
        setShowResumeScreen(false);
      }
    }
  }, [
    hasResumedRef,
    isStartingOverRef,
    isStartingOver,
    setAnswers,
    setCurrentQuestionIndex,
    setCurrentInfoScreenIndex,
    setShowResumeScreen,
    setLoading,
  ]);

  // Продолжение анкеты
  const resumeQuiz = useCallback(() => {
    if (!savedProgress) {
      clientLogger.warn('⚠️ resumeQuiz вызвана без savedProgress');
      return;
    }

    clientLogger.log('✅ Продолжение анкеты с сохраненного прогресса', {
      questionIndex: savedProgress.questionIndex,
      answersCount: Object.keys(savedProgress.answers).length,
    });

    setHasResumed(true);
    hasResumedRef.current = true;
    setShowResumeScreen(false);
    setLoading(false);

    // Восстанавливаем ответы
    setAnswers(savedProgress.answers);
    setCurrentQuestionIndex(savedProgress.questionIndex);
    setCurrentInfoScreenIndex(savedProgress.infoScreenIndex);

    // Очищаем сохраненный прогресс после восстановления
    setSavedProgress(null);
  }, [
    savedProgress,
    setHasResumed,
    hasResumedRef,
    setShowResumeScreen,
    setLoading,
    setAnswers,
    setCurrentQuestionIndex,
    setCurrentInfoScreenIndex,
  ]);

  return {
    savedProgress,
    setSavedProgress,
    loadSavedProgressFromServer,
    resumeQuiz,
    loadProgressInProgressRef,
    progressLoadInProgressRef,
  };
}

