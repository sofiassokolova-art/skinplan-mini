// lib/quiz/hooks/useQuizView.ts
// Хук для определения текущего экрана анкеты
// Упрощает условия рендеринга в quiz/page.tsx

import { useMemo } from 'react';
import { INFO_SCREENS, getInitialInfoScreens, type InfoScreen } from '@/app/(miniapp)/quiz/info-screens';

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
  initCompleted?: boolean; // ФИКС: Добавлен флаг завершения инициализации
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
    initCompleted = true, // По умолчанию true для обратной совместимости
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
    // ИСПРАВЛЕНО: Используем единую функцию для получения начальных инфо-экранов
    const initialInfoScreens = getInitialInfoScreens();

    // Проверяем, нужно ли показывать начальные экраны
    const shouldShowInitialInfoScreen = (() => {
      // КРИТИЧНО: Не показываем инфо-экраны, если init() еще не завершен
      // Это предотвращает показ инфо-экранов до завершения инициализации
      // ФИКС: Проверяем initCompleted ПЕРВЫМ, чтобы не показывать экраны до завершения инициализации
      if (!initCompleted) {
        return false;
      }
      
      // ИСПРАВЛЕНО: Разрешаем показ начальных инфо-экранов даже без анкеты
      // Анкета должна загружаться в фоне, пока пользователь просматривает начальные инфо-экраны
      // Проверка анкеты нужна только при переходе к вопросам, а не для начальных инфо-экранов
      // ФИКС: НЕ проверяем allQuestionsLength, так как фильтрация происходит динамически после ответов
      
      // Не показываем, если показывается resume screen
      if (showResumeScreen) return false;
      
      // Не показываем, если показывается retake screen
      if (showRetakeScreen && isRetakingQuiz) return false;
      
      // Не показываем, если есть сохраненный прогресс с ответами (> 1 ответа)
      // ИСПРАВЛЕНО: Если только 1 ответ (имя), это новый пользователь - показываем инфо-экраны
      if (savedProgress && savedProgress.answers) {
        const savedAnswersCount = Object.keys(savedProgress.answers).length;
        // Если больше 1 ответа - это не новый пользователь, не показываем инфо-экраны
        if (savedAnswersCount > 1) {
          return false;
        }
        // Если 1 ответ - это имя, считаем новым пользователем и показываем инфо-экраны
        // Но только если currentInfoScreenIndex < длины начальных экранов
      }
      
      // Не показываем, если пользователь уже возобновил анкету
      if (hasResumed) return false;
      
      // Не показываем при повторном прохождении без экрана выбора тем
      if (isRetakingQuiz && !showRetakeScreen) return false;
      
      // Не показываем, если уже прошли все начальные экраны
      // ФИКС: Используем только currentInfoScreenIndex, так как ref не триггерит рендер
      // и может привести к React error #300
      if (currentInfoScreenIndex >= initialInfoScreens.length) return false;
      
      // ИСПРАВЛЕНО: Не показываем инфо-экраны, если пользователь уже начал отвечать на вопросы
      // (currentQuestionIndex > 0 означает, что уже был переход к вопросам)
      // Но если есть только 1 ответ (имя) и currentQuestionIndex = 0, это новый пользователь
      const answersCount = Object.keys(answers).length;
      if (currentQuestionIndex > 0 || (answersCount > 1)) {
        return false;
      }
      
      // Показываем, если currentInfoScreenIndex < initialInfoScreens.length
      return currentInfoScreenIndex < initialInfoScreens.length;
    })();

    if (shouldShowInitialInfoScreen) {
      const currentInitialInfoScreen = 
        currentInfoScreenIndex >= 0 && 
        currentInfoScreenIndex < initialInfoScreens.length
          ? initialInfoScreens[currentInfoScreenIndex]
          : null;

      // ИСПРАВЛЕНО: Разрешаем показ начальных инфо-экранов даже без анкеты
      // Анкета должна загружаться в фоне, пока пользователь просматривает начальные инфо-экраны
      // Проверка анкеты нужна только при переходе к вопросам, а не для начальных инфо-экранов
      if (currentInitialInfoScreen && !pendingInfoScreen) {
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
    // ФИКС: НЕ включаем currentInfoScreenIndexRef в зависимости, так как ref не триггерит рендер
    // Используем currentInfoScreenIndex вместо этого
    currentQuestionIndex,
    currentQuestion?.id, // ИСПРАВЛЕНО: Используем только ID вместо всего объекта
    questionnaire?.id, // ИСПРАВЛЕНО: Используем только ID вместо всего объекта
    // ФИКС: Используем questionnaireRef?.current?.id вместо всего объекта, чтобы избежать лишних пересчетов
    // Это предотвращает React error #300 и #310
    questionnaireRef?.current?.id,
    questionnaireFromStateMachine?.id, // ФИКС: Используем только ID вместо всего объекта
    loading,
    hasResumed,
    // ИСПРАВЛЕНО: Используем только количество ответов вместо всего объекта
    savedProgress ? Object.keys(savedProgress.answers || {}).length : 0,
    Object.keys(answers || {}).length, // ИСПРАВЛЕНО: Используем только количество вместо всего объекта
    allQuestionsLength,
    isDev,
  ]);
}

