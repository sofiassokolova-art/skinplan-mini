// lib/quiz/services/QuizNavigationService.ts
// Чистые функции для навигации по анкете
// Легко тестировать (unit tests)

import type { Question } from '@/lib/quiz/types';
import { INFO_SCREENS, getInfoScreenAfterQuestion, getNextInfoScreenAfterScreen, type InfoScreen } from '@/app/(miniapp)/quiz/info-screens';

/**
 * Параметры для вычисления следующего шага
 */
export interface NextStepParams {
  currentQuestionIndex: number;
  currentInfoScreenIndex: number;
  allQuestions: Question[];
  initialInfoScreens: InfoScreen[];
  answers: Record<number, string | string[]>;
  pendingInfoScreen: InfoScreen | null;
}

/**
 * Результат вычисления следующего шага
 */
export interface NextStepResult {
  type: 'question' | 'info_screen' | 'complete';
  questionIndex?: number;
  infoScreenIndex?: number;
  infoScreen?: InfoScreen | null;
}

/**
 * Вычисляет следующий шаг навигации
 */
export function calculateNextStep(params: NextStepParams): NextStepResult {
  const {
    currentQuestionIndex,
    currentInfoScreenIndex,
    allQuestions,
    initialInfoScreens,
    answers,
    pendingInfoScreen,
  } = params;

  // Если есть pending info screen, показываем его
  if (pendingInfoScreen) {
    return {
      type: 'info_screen',
      infoScreen: pendingInfoScreen,
      infoScreenIndex: currentInfoScreenIndex,
    };
  }

  // Если мы на начальных инфо-экранах, переходим к следующему
  if (currentInfoScreenIndex < initialInfoScreens.length) {
    const nextInfoScreenIndex = currentInfoScreenIndex + 1;
    
    // Если прошли все начальные экраны, переходим к первому вопросу
    if (nextInfoScreenIndex >= initialInfoScreens.length) {
      return {
        type: 'question',
        questionIndex: 0,
        infoScreenIndex: initialInfoScreens.length,
      };
    }
    
    return {
      type: 'info_screen',
      infoScreenIndex: nextInfoScreenIndex,
    };
  }

  // Если мы на вопросах
  const currentQuestion = allQuestions[currentQuestionIndex];
  
  if (!currentQuestion) {
    // Вопросов больше нет - анкета завершена
    return {
      type: 'complete',
    };
  }

  // Проверяем, есть ли инфо-экран после текущего вопроса
  const infoScreenAfterQuestion = getInfoScreenAfterQuestion(currentQuestion.code, answers);
  
  if (infoScreenAfterQuestion) {
    return {
      type: 'info_screen',
      infoScreen: infoScreenAfterQuestion,
      infoScreenIndex: currentInfoScreenIndex,
    };
  }

  // Переходим к следующему вопросу
  const nextQuestionIndex = currentQuestionIndex + 1;
  
  if (nextQuestionIndex >= allQuestions.length) {
    // Вопросов больше нет - анкета завершена
    return {
      type: 'complete',
    };
  }

  return {
    type: 'question',
    questionIndex: nextQuestionIndex,
    infoScreenIndex: currentInfoScreenIndex,
  };
}

/**
 * Вычисляет предыдущий шаг навигации
 */
export function calculatePreviousStep(params: NextStepParams): NextStepResult | null {
  const {
    currentQuestionIndex,
    currentInfoScreenIndex,
    allQuestions,
    initialInfoScreens,
    pendingInfoScreen,
  } = params;

  // Если есть pending info screen, возвращаемся к текущему вопросу
  if (pendingInfoScreen) {
    return {
      type: 'question',
      questionIndex: currentQuestionIndex,
      infoScreenIndex: currentInfoScreenIndex,
    };
  }

  // Если мы на вопросах
  if (currentInfoScreenIndex >= initialInfoScreens.length) {
    // Если это первый вопрос, возвращаемся к последнему начальному экрану
    if (currentQuestionIndex === 0) {
      const lastInitialScreenIndex = initialInfoScreens.length - 1;
      return {
        type: 'info_screen',
        infoScreenIndex: lastInitialScreenIndex,
      };
    }

    // Возвращаемся к предыдущему вопросу
    return {
      type: 'question',
      questionIndex: currentQuestionIndex - 1,
      infoScreenIndex: currentInfoScreenIndex,
    };
  }

  // Если мы на начальных инфо-экранах
  if (currentInfoScreenIndex > 0) {
    return {
      type: 'info_screen',
      infoScreenIndex: currentInfoScreenIndex - 1,
    };
  }

  // Мы на первом экране - нельзя идти назад
  return null;
}

/**
 * Проверяет, можно ли перейти к следующему шагу
 */
export function canGoNext(params: NextStepParams): boolean {
  const { currentQuestionIndex, currentInfoScreenIndex, allQuestions, initialInfoScreens } = params;

  // Если мы на начальных инфо-экранах
  if (currentInfoScreenIndex < initialInfoScreens.length) {
    return true; // Всегда можно перейти к следующему начальному экрану
  }

  // Если мы на вопросах
  if (currentQuestionIndex < allQuestions.length - 1) {
    return true; // Есть еще вопросы
  }

  // Это последний вопрос
  return false;
}

/**
 * Проверяет, можно ли перейти к предыдущему шагу
 */
export function canGoBack(params: NextStepParams): boolean {
  const { currentQuestionIndex, currentInfoScreenIndex, initialInfoScreens } = params;

  // Если мы на первом начальном экране
  if (currentInfoScreenIndex === 0) {
    return false;
  }

  // Если мы на первом вопросе и на последнем начальном экране
  if (currentQuestionIndex === 0 && currentInfoScreenIndex === initialInfoScreens.length) {
    return true; // Можно вернуться к начальным экранам
  }

  return true;
}

/**
 * Получает текущий вопрос
 */
export function getCurrentQuestion(
  currentQuestionIndex: number,
  allQuestions: Question[]
): Question | null {
  if (currentQuestionIndex < 0 || currentQuestionIndex >= allQuestions.length) {
    return null;
  }
  return allQuestions[currentQuestionIndex];
}

/**
 * Получает текущий начальный инфо-экран
 */
export function getCurrentInitialInfoScreen(
  currentInfoScreenIndex: number,
  initialInfoScreens: InfoScreen[]
): InfoScreen | null {
  if (currentInfoScreenIndex < 0 || currentInfoScreenIndex >= initialInfoScreens.length) {
    return null;
  }
  return initialInfoScreens[currentInfoScreenIndex];
}

