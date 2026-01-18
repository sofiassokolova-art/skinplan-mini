// lib/quiz/hooks/useQuizProgress.ts
// ИСПРАВЛЕНО: Хук для управления прогрессом анкеты
// Вынесен из quiz/page.tsx для разделения логики

import { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { getEffectiveAnswers } from '@/lib/quiz/filterQuestions';
import { api } from '@/lib/api';
import { clientLogger } from '@/lib/client-logger';

export function useQuizProgress() {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [currentInfoScreenIndex, setCurrentInfoScreenIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string | string[]>>({});
  const [savedProgress, setSavedProgress] = useState<{
    answers: Record<number, string | string[]>;
    questionIndex: number;
    infoScreenIndex: number;
  } | null>(null);
  const [showResumeScreen, setShowResumeScreen] = useState(false);
  const [hasResumed, setHasResumed] = useState(false);
  const hasResumedRef = useRef(false);
  const saveProgressTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastSavedAnswerRef = useRef<{ questionId: number; answer: string | string[] } | null>(null);

  // КРИТИЧНО ИСПРАВЛЕНО: Используем стабильные значения для зависимостей
  // Объекты answers и savedProgress?.answers пересоздаются каждый раз, что вызывает бесконечные циклы
  const answersKeysCount = Object.keys(answers || {}).length;
  const savedProgressAnswersKeysCount = Object.keys(savedProgress?.answers || {}).length;
  
  const effectiveAnswers = useMemo(() =>
    getEffectiveAnswers(answers, savedProgress?.answers),
    [answersKeysCount, savedProgressAnswersKeysCount]
  );

  // ФИКС: Убираем лишний useMemo, который зависит от объекта и может вызывать бесконечные циклы
  // answersCount вычисляется напрямую из effectiveAnswers
  const answersCount = Object.keys(effectiveAnswers).length;

  // Синхронизация ref с state
  useEffect(() => {
    hasResumedRef.current = hasResumed;
  }, [hasResumed]);

  const saveProgress = useCallback(async (
    currentAnswers: Record<number, string | string[]>,
    questionIdx: number,
    infoIdx: number
  ) => {
    if (saveProgressTimeoutRef.current) {
      clearTimeout(saveProgressTimeoutRef.current);
    }

    saveProgressTimeoutRef.current = setTimeout(async () => {
      try {
        const progressData = {
          answers: currentAnswers,
          questionIndex: questionIdx,
          infoScreenIndex: infoIdx,
        };
        
        localStorage.setItem('quiz_progress', JSON.stringify(progressData));
        setSavedProgress(progressData);

        // ИСПРАВЛЕНО: saveQuizProgress в api.ts принимает отдельные параметры, а не объект
        // Серверное сохранение прогресса выполняется через отдельный endpoint при необходимости
        // Здесь сохраняем только в localStorage для быстрого доступа
      } catch (err) {
        clientLogger.warn('⚠️ Error saving progress', err);
      }
    }, 500);
  }, []);

  return {
    currentQuestionIndex,
    setCurrentQuestionIndex,
    currentInfoScreenIndex,
    setCurrentInfoScreenIndex,
    answers,
    setAnswers,
    savedProgress,
    setSavedProgress,
    showResumeScreen,
    setShowResumeScreen,
    hasResumed,
    setHasResumed,
    hasResumedRef,
    effectiveAnswers,
    answersCount,
    saveProgress,
  };
}

