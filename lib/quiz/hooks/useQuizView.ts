// lib/quiz/hooks/useQuizView.ts
// Хук для определения текущего экрана анкеты
// Упрощает условия рендеринга в quiz/page.tsx

import { useMemo } from 'react';
import { INFO_SCREENS, type InfoScreen } from '@/app/(miniapp)/quiz/info-screens';

export interface UseQuizViewParams {
  // State
  showResumeScreen: boolean;
  showRetakeScreen: boolean;
  isRetakingQuiz: boolean;
  pendingInfoScreen: InfoScreen | null;
  currentInfoScreenIndex: number;
  currentInfoScreenIndexRef: React.MutableRefObject<number>;
  currentQuestionIndex: number;
  currentQuestion: any | null;
  questionnaire: any | null;
  questionnaireRef?: React.MutableRefObject<any | null>; // ИСПРАВЛЕНО: Добавлен questionnaireRef как fallback
  questionnaireFromStateMachine?: any | null; // ИСПРАВЛЕНО: Добавлен questionnaireFromStateMachine как fallback
  loading: boolean;
  hasResumed: boolean;
  savedProgress: {
    answers: Record<number, string | string[]>;
    questionIndex: number;
    infoScreenIndex: number;
  } | null;
  answers: Record<number, string | string[]>;
  allQuestionsLength: number;
  isDev: boolean;
}

export interface QuizView {
  type: 'resume' | 'retake' | 'pendingInfo' | 'initialInfo' | 'question' | 'loading' | 'error';
  screen?: InfoScreen | null;
  question?: any | null;
}

export function useQuizView(params: UseQuizViewParams): QuizView {
  const {
    showResumeScreen,
    showRetakeScreen,
    isRetakingQuiz,
    pendingInfoScreen,
    currentInfoScreenIndex,
    currentInfoScreenIndexRef,
    currentQuestionIndex,
    currentQuestion,
    questionnaire,
    questionnaireRef,
    questionnaireFromStateMachine,
    loading,
    hasResumed,
    savedProgress,
    answers,
    allQuestionsLength,
    isDev,
  } = params;

  return useMemo(() => {
    // ИСПРАВЛЕНО: Используем questionnaireRef или questionnaireFromStateMachine как fallback
    // Это гарантирует, что инфо-экраны и вопросы показываются, даже если questionnaire в state временно null
    // Вычисляем внутри useMemo, чтобы избежать проблем с зависимостями
    const effectiveQuestionnaire = questionnaire || 
                                    questionnaireRef?.current || 
                                    questionnaireFromStateMachine;
    // 1. Экран продолжения (resume)
    if (showResumeScreen) {
      return { type: 'resume' };
    }

    // 2. Экран выбора тем для перепрохождения (retake)
    if (showRetakeScreen && isRetakingQuiz) {
      return { type: 'retake' };
    }

    // 3. Информационный экран между вопросами (pendingInfoScreen)
    if (pendingInfoScreen && !isRetakingQuiz) {
      return { type: 'pendingInfo', screen: pendingInfoScreen };
    }

    // 4. Начальные информационные экраны
    const initialInfoScreens = INFO_SCREENS.filter(
      screen => !screen.showAfterQuestionCode && !screen.showAfterInfoScreenId
    );

    // Проверяем, нужно ли показывать начальные экраны
    const shouldShowInitialInfoScreen = (() => {
      // КРИТИЧНО: Не показываем инфо-экраны, если анкета еще не загружена
      // Это предотвращает показ инфо-экранов до загрузки анкеты
      // Анкета должна загрузиться в init() перед показом первого инфо-экрана
      // ФИКС: НЕ проверяем allQuestionsLength, так как фильтрация происходит динамически после ответов
      // ФИКС: Проверяем не только наличие объекта, но и что он действительно загружен (имеет id)
      if (!effectiveQuestionnaire || !effectiveQuestionnaire.id) {
        return false;
      }
      
      // Не показываем, если показывается resume screen
      if (showResumeScreen) return false;
      
      // Не показываем, если показывается retake screen
      if (showRetakeScreen && isRetakingQuiz) return false;
      
      // Не показываем, если есть сохраненный прогресс с ответами
      if (savedProgress && savedProgress.answers && Object.keys(savedProgress.answers).length > 0) {
        return false;
      }
      
      // Не показываем, если пользователь уже возобновил анкету
      if (hasResumed) return false;
      
      // Не показываем при повторном прохождении без экрана выбора тем
      if (isRetakingQuiz && !showRetakeScreen) return false;
      
      // Не показываем, если уже прошли все начальные экраны
      if (currentInfoScreenIndex >= initialInfoScreens.length) return false;
      if (currentInfoScreenIndexRef.current >= initialInfoScreens.length) return false;
      
      // Не показываем, если пользователь уже начал отвечать
      if (currentQuestionIndex > 0 || Object.keys(answers).length > 0) return false;
      
      // Показываем, если currentInfoScreenIndex < initialInfoScreens.length
      return currentInfoScreenIndex < initialInfoScreens.length;
    })();

    if (shouldShowInitialInfoScreen) {
      const currentInitialInfoScreen = 
        currentInfoScreenIndex >= 0 && 
        currentInfoScreenIndex < initialInfoScreens.length
          ? initialInfoScreens[currentInfoScreenIndex]
          : null;

      // КРИТИЧНО: Показываем инфо-экран только если анкета загружена
      // Это гарантирует, что анкета загрузится до показа первого инфо-экрана
      // ФИКС: НЕ проверяем allQuestionsLength, так как фильтрация происходит динамически после ответов
      // ФИКС: Проверяем не только наличие объекта, но и что он действительно загружен (имеет id)
      if (currentInitialInfoScreen && effectiveQuestionnaire && effectiveQuestionnaire.id && !pendingInfoScreen) {
        return { type: 'initialInfo', screen: currentInitialInfoScreen };
      }
    }

    // 5. Вопрос
    // ИСПРАВЛЕНО: Используем effectiveQuestionnaire вместо questionnaire
    // Это гарантирует, что вопросы показываются, даже если questionnaire в state временно null
    if (currentQuestion && !loading && effectiveQuestionnaire) {
      return { type: 'question', question: currentQuestion };
    }

    // 6. Загрузка
    // ИСПРАВЛЕНО: Используем effectiveQuestionnaire вместо questionnaire
    // Показываем загрузку только если действительно нет questionnaire ни в одном источнике
    if (loading || !effectiveQuestionnaire) {
      return { type: 'loading' };
    }

    // 7. По умолчанию - ошибка или пустое состояние
    return { type: 'error' };
  }, [
    showResumeScreen,
    showRetakeScreen,
    isRetakingQuiz,
    pendingInfoScreen,
    currentInfoScreenIndex,
    currentInfoScreenIndexRef,
    currentQuestionIndex,
    currentQuestion,
    questionnaire,
    questionnaireRef?.current, // ИСПРАВЛЕНО: Добавляем questionnaireRef.current в зависимости
    questionnaireFromStateMachine, // ИСПРАВЛЕНО: Добавляем questionnaireFromStateMachine в зависимости
    loading,
    hasResumed,
    savedProgress,
    answers,
    allQuestionsLength,
    isDev,
  ]);
}

