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

  // КРИТИЧНО ИСПРАВЛЕНО: Вычисляем стабильные значения ДО useMemo для предотвращения React Error #300
  // Вычисления в массиве зависимостей могут вызывать проблемы, если объекты пересоздаются каждый раз
  const savedProgressAnswersCount = savedProgress ? Object.keys(savedProgress.answers || {}).length : 0;
  const answersKeysCount = Object.keys(answers || {}).length;

  return useMemo(() => {
    // ИСПРАВЛЕНО: Используем questionnaireRef или questionnaireFromStateMachine как fallback
    // Это гарантирует, что инфо-экраны и вопросы показываются, даже если questionnaire в state временно null
    // Вычисляем внутри useMemo, чтобы избежать проблем с зависимостями
    const effectiveQuestionnaire = questionnaire || 
                                    questionnaireRef?.current || 
                                    questionnaireFromStateMachine;
    // 1. Экран продолжения (resume) - КРИТИЧНО: Проверяем ПЕРВЫМ
    // Если showResumeScreen = true, показываем резюм-экран независимо от других условий
    if (showResumeScreen) {
      return { type: 'resume' };
    }

    // 2. Экран выбора тем для перепрохождения (retake)
    if (showRetakeScreen && isRetakingQuiz) {
      return { type: 'retake' };
    }

    // 3. Информационный экран между вопросами (pendingInfoScreen)
    // КРИТИЧНО: Проверяем наличие pendingInfoScreen по ID, чтобы избежать проблем с нестабильными объектами
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
      
      // Не показываем, если показывается resume screen (проверка выше уже сделана)
      // Не показываем, если показывается retake screen
      if (showRetakeScreen && isRetakingQuiz) return false;
      
      // КРИТИЧНО ИСПРАВЛЕНО: Используем предварительно вычисленное значение вместо прямого доступа к объекту
      // Это предотвращает проблемы с зависимостями и stale closures
      // Если >= 2 ответа - должен показаться резюм-экран (проверяется выше)
      // Не показываем инфо-экраны
      if (savedProgressAnswersCount >= 2) {
        return false;
      }
      // Если 1 ответ - это имя, считаем новым пользователем и показываем инфо-экраны
      
      // Не показываем, если пользователь уже возобновил анкету
      if (hasResumed) return false;
      
      // Не показываем при повторном прохождении без экрана выбора тем
      if (isRetakingQuiz && !showRetakeScreen) return false;
      
      // Не показываем, если уже прошли все начальные экраны
      // ФИКС: Используем только currentInfoScreenIndex, так как ref не триггерит рендер
      // и может привести к React error #300
      if (currentInfoScreenIndex >= initialInfoScreens.length) return false;
      
      // КРИТИЧНО ИСПРАВЛЕНО: Используем предварительно вычисленное значение вместо прямого доступа к объекту
      // Это предотвращает проблемы с зависимостями и stale closures
      // Если >= 2 ответа, не показываем инфо-экраны (должен показаться резюм-экран)
      if (answersKeysCount >= 2) {
        return false;
      }
      // Если currentQuestionIndex > 0, уже перешли к вопросам
      if (currentQuestionIndex > 0) {
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
    // КРИТИЧНО: Используем только ID pendingInfoScreen, чтобы избежать проблем с нестабильными объектами
    pendingInfoScreen?.id ?? null, // null вместо undefined для стабильности
    currentInfoScreenIndex,
    // ФИКС: НЕ включаем currentInfoScreenIndexRef в зависимости, так как ref не триггерит рендер
    // Используем currentInfoScreenIndex вместо этого
    currentQuestionIndex,
    currentQuestion?.id ?? null, // ИСПРАВЛЕНО: Используем только ID вместо всего объекта, null для стабильности
    questionnaire?.id ?? null, // ИСПРАВЛЕНО: Используем только ID вместо всего объекта, null для стабильности
    // КРИТИЧНО ИСПРАВЛЕНО: Убрали questionnaireRef?.current?.id из зависимостей
    // ref.current не должен быть в зависимостях, так как изменения ref не триггерят ререндер
    // и это вызывает React Error #300
    questionnaireFromStateMachine?.id ?? null, // ФИКС: Используем только ID вместо всего объекта, null для стабильности
    loading,
    hasResumed,
    // КРИТИЧНО ИСПРАВЛЕНО: Используем предварительно вычисленные стабильные значения
    // вместо вычислений в массиве зависимостей, чтобы предотвратить React Error #300
    savedProgressAnswersCount,
    answersKeysCount,
    allQuestionsLength,
    isDev,
    // КРИТИЧНО: Добавляем initCompleted в зависимости, так как он используется внутри useMemo
    initCompleted,
  ]);
}

