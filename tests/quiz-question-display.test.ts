// tests/quiz-question-display.test.ts
// Автотесты для логики отображения вопросов в quiz page

import { describe, it, expect } from 'vitest';
import { INFO_SCREENS, type InfoScreen } from '@/app/(miniapp)/quiz/info-screens';

// Вынесенная логика для тестирования
interface QuizDisplayState {
  currentInfoScreenIndex: number;
  initialInfoScreens: InfoScreen[];
  isShowingInitialInfoScreen: boolean;
  currentInitialInfoScreen: InfoScreen | null;
  pendingInfoScreen: InfoScreen | null;
  isRetakingQuiz: boolean;
  showResumeScreen: boolean;
  currentQuestionIndex: number;
  allQuestions: any[];
  answers: Record<number, string | string[]>;
}

// Функция для вычисления isShowingInitialInfoScreenCorrected
function calculateIsShowingInitialInfoScreenCorrected(
  isShowingInitialInfoScreen: boolean,
  currentInitialInfoScreen: InfoScreen | null
): boolean {
  if (isShowingInitialInfoScreen && !currentInitialInfoScreen) {
    return false;
  }
  return isShowingInitialInfoScreen;
}

// Функция для вычисления isOnInitialInfoScreen
function calculateIsOnInitialInfoScreen(
  state: QuizDisplayState
): boolean {
  const { initialInfoScreens, currentInfoScreenIndex, isShowingInitialInfoScreenCorrected, currentInitialInfoScreen } = state;
  
  return initialInfoScreens.length > 0 && 
         currentInfoScreenIndex < initialInfoScreens.length && 
         isShowingInitialInfoScreenCorrected && 
         !!currentInitialInfoScreen &&
         !!initialInfoScreens[currentInfoScreenIndex];
}

// Функция для вычисления shouldBlockByInfoScreen
function calculateShouldBlockByInfoScreen(
  state: QuizDisplayState
): boolean {
  const isOnInitialInfoScreen = calculateIsOnInitialInfoScreen(state);
  const { pendingInfoScreen, isRetakingQuiz, showResumeScreen } = state;
  
  return (isOnInitialInfoScreen || (!!pendingInfoScreen && !isRetakingQuiz)) && !showResumeScreen;
}

// Функция для вычисления currentQuestion (упрощенная версия)
function calculateCurrentQuestion(
  state: QuizDisplayState
): { shouldShow: boolean; reason: string } {
  const { initialInfoScreens, pendingInfoScreen, isRetakingQuiz, showResumeScreen, allQuestions, currentQuestionIndex } = state;
  
  // Если нет вопросов, не показываем
  if (allQuestions.length === 0) {
    return { shouldShow: false, reason: 'no_questions' };
  }
  
  // Если initialInfoScreens пустой, показываем вопросы (если нет pendingInfoScreen)
  if (initialInfoScreens.length === 0) {
    if (pendingInfoScreen && !isRetakingQuiz && !showResumeScreen) {
      return { shouldShow: false, reason: 'pending_info_screen' };
    }
    // Продолжаем - показываем вопросы
  }
  
  // Вычисляем блокировку
  const shouldBlock = calculateShouldBlockByInfoScreen(state);
  
  if (shouldBlock) {
    const isOnInitialInfoScreen = calculateIsOnInitialInfoScreen(state);
    const reason = isOnInitialInfoScreen ? 'initial_info_screen' : 'pending_info_screen';
    return { shouldShow: false, reason };
  }
  
  // Проверяем индекс вопроса
  if (currentQuestionIndex < 0 || currentQuestionIndex >= allQuestions.length) {
    return { shouldShow: false, reason: 'invalid_question_index' };
  }
  
  return { shouldShow: true, reason: 'ok' };
}

// Получаем начальные экраны
const initialInfoScreens = INFO_SCREENS.filter(screen => !screen.showAfterQuestionCode);

describe('Quiz Question Display Logic', () => {
  describe('calculateIsShowingInitialInfoScreenCorrected', () => {
    it('должен возвращать false, если isShowingInitialInfoScreen=true, но currentInitialInfoScreen=null', () => {
      const result = calculateIsShowingInitialInfoScreenCorrected(true, null);
      expect(result).toBe(false);
    });

    it('должен возвращать true, если isShowingInitialInfoScreen=true и currentInitialInfoScreen существует', () => {
      const screen = initialInfoScreens[0];
      const result = calculateIsShowingInitialInfoScreenCorrected(true, screen);
      expect(result).toBe(true);
    });

    it('должен возвращать false, если isShowingInitialInfoScreen=false', () => {
      const result = calculateIsShowingInitialInfoScreenCorrected(false, null);
      expect(result).toBe(false);
    });
  });

  describe('calculateIsOnInitialInfoScreen', () => {
    it('должен возвращать false, если currentInfoScreenIndex >= initialInfoScreens.length', () => {
      const state: QuizDisplayState = {
        currentInfoScreenIndex: initialInfoScreens.length,
        initialInfoScreens,
        isShowingInitialInfoScreen: true,
        isShowingInitialInfoScreenCorrected: true,
        currentInitialInfoScreen: initialInfoScreens[0],
        pendingInfoScreen: null,
        isRetakingQuiz: false,
        showResumeScreen: false,
        currentQuestionIndex: 0,
        allQuestions: [{ id: 1 }],
        answers: {},
      };
      const result = calculateIsOnInitialInfoScreen(state);
      expect(result).toBe(false);
    });

    it('должен возвращать false, если currentInitialInfoScreen=null', () => {
      const state: QuizDisplayState = {
        currentInfoScreenIndex: 0,
        initialInfoScreens,
        isShowingInitialInfoScreen: true,
        isShowingInitialInfoScreenCorrected: true,
        currentInitialInfoScreen: null,
        pendingInfoScreen: null,
        isRetakingQuiz: false,
        showResumeScreen: false,
        currentQuestionIndex: 0,
        allQuestions: [{ id: 1 }],
        answers: {},
      };
      const result = calculateIsOnInitialInfoScreen(state);
      expect(result).toBe(false);
    });

    it('должен возвращать false, если isShowingInitialInfoScreenCorrected=false', () => {
      const state: QuizDisplayState = {
        currentInfoScreenIndex: 0,
        initialInfoScreens,
        isShowingInitialInfoScreen: true,
        isShowingInitialInfoScreenCorrected: false,
        currentInitialInfoScreen: initialInfoScreens[0],
        pendingInfoScreen: null,
        isRetakingQuiz: false,
        showResumeScreen: false,
        currentQuestionIndex: 0,
        allQuestions: [{ id: 1 }],
        answers: {},
      };
      const result = calculateIsOnInitialInfoScreen(state);
      expect(result).toBe(false);
    });

    it('должен возвращать true, если все условия выполнены', () => {
      const state: QuizDisplayState = {
        currentInfoScreenIndex: 0,
        initialInfoScreens,
        isShowingInitialInfoScreen: true,
        isShowingInitialInfoScreenCorrected: true,
        currentInitialInfoScreen: initialInfoScreens[0],
        pendingInfoScreen: null,
        isRetakingQuiz: false,
        showResumeScreen: false,
        currentQuestionIndex: 0,
        allQuestions: [{ id: 1 }],
        answers: {},
      };
      const result = calculateIsOnInitialInfoScreen(state);
      expect(result).toBe(true);
    });

    it('должен возвращать false, если initialInfoScreens пустой', () => {
      const state: QuizDisplayState = {
        currentInfoScreenIndex: 0,
        initialInfoScreens: [],
        isShowingInitialInfoScreen: true,
        isShowingInitialInfoScreenCorrected: true,
        currentInitialInfoScreen: null,
        pendingInfoScreen: null,
        isRetakingQuiz: false,
        showResumeScreen: false,
        currentQuestionIndex: 0,
        allQuestions: [{ id: 1 }],
        answers: {},
      };
      const result = calculateIsOnInitialInfoScreen(state);
      expect(result).toBe(false);
    });

    it('должен возвращать false, если элемент массива не существует (undefined)', () => {
      // Симулируем ситуацию, когда индекс указывает на несуществующий элемент
      const state: QuizDisplayState = {
        currentInfoScreenIndex: 999, // Индекс вне массива
        initialInfoScreens,
        isShowingInitialInfoScreen: true,
        isShowingInitialInfoScreenCorrected: true,
        currentInitialInfoScreen: null, // null, потому что элемент не существует
        pendingInfoScreen: null,
        isRetakingQuiz: false,
        showResumeScreen: false,
        currentQuestionIndex: 0,
        allQuestions: [{ id: 1 }],
        answers: {},
      };
      const result = calculateIsOnInitialInfoScreen(state);
      expect(result).toBe(false);
    });
  });

  describe('calculateShouldBlockByInfoScreen', () => {
    it('должен возвращать true, если isOnInitialInfoScreen=true', () => {
      const state: QuizDisplayState = {
        currentInfoScreenIndex: 0,
        initialInfoScreens,
        isShowingInitialInfoScreen: true,
        isShowingInitialInfoScreenCorrected: true,
        currentInitialInfoScreen: initialInfoScreens[0],
        pendingInfoScreen: null,
        isRetakingQuiz: false,
        showResumeScreen: false,
        currentQuestionIndex: 0,
        allQuestions: [{ id: 1 }],
        answers: {},
      };
      const result = calculateShouldBlockByInfoScreen(state);
      expect(result).toBe(true);
    });

    it('должен возвращать false, если showResumeScreen=true', () => {
      const state: QuizDisplayState = {
        currentInfoScreenIndex: 0,
        initialInfoScreens,
        isShowingInitialInfoScreen: true,
        isShowingInitialInfoScreenCorrected: true,
        currentInitialInfoScreen: initialInfoScreens[0],
        pendingInfoScreen: null,
        isRetakingQuiz: false,
        showResumeScreen: true, // Ключевое условие
        currentQuestionIndex: 0,
        allQuestions: [{ id: 1 }],
        answers: {},
      };
      const result = calculateShouldBlockByInfoScreen(state);
      expect(result).toBe(false);
    });

    it('должен возвращать true, если pendingInfoScreen существует и не retake', () => {
      const pendingScreen = INFO_SCREENS.find(s => s.showAfterQuestionCode) || null;
      const state: QuizDisplayState = {
        currentInfoScreenIndex: initialInfoScreens.length, // Все начальные экраны пройдены
        initialInfoScreens,
        isShowingInitialInfoScreen: false,
        isShowingInitialInfoScreenCorrected: false,
        currentInitialInfoScreen: null,
        pendingInfoScreen: pendingScreen,
        isRetakingQuiz: false,
        showResumeScreen: false,
        currentQuestionIndex: 0,
        allQuestions: [{ id: 1 }],
        answers: {},
      };
      const result = calculateShouldBlockByInfoScreen(state);
      expect(result).toBe(true);
    });

    it('должен возвращать false, если pendingInfoScreen существует, но isRetakingQuiz=true', () => {
      const pendingScreen = INFO_SCREENS.find(s => s.showAfterQuestionCode) || null;
      const state: QuizDisplayState = {
        currentInfoScreenIndex: initialInfoScreens.length,
        initialInfoScreens,
        isShowingInitialInfoScreen: false,
        isShowingInitialInfoScreenCorrected: false,
        currentInitialInfoScreen: null,
        pendingInfoScreen: pendingScreen,
        isRetakingQuiz: true, // Ключевое условие
        showResumeScreen: false,
        currentQuestionIndex: 0,
        allQuestions: [{ id: 1 }],
        answers: {},
      };
      const result = calculateShouldBlockByInfoScreen(state);
      expect(result).toBe(false);
    });
  });

  describe('calculateCurrentQuestion', () => {
    it('должен показывать вопросы, если все начальные экраны пройдены', () => {
      const state: QuizDisplayState = {
        currentInfoScreenIndex: initialInfoScreens.length, // Все экраны пройдены
        initialInfoScreens,
        isShowingInitialInfoScreen: false,
        isShowingInitialInfoScreenCorrected: false,
        currentInitialInfoScreen: null,
        pendingInfoScreen: null,
        isRetakingQuiz: false,
        showResumeScreen: false,
        currentQuestionIndex: 0,
        allQuestions: [{ id: 1 }, { id: 2 }],
        answers: {},
      };
      const result = calculateCurrentQuestion(state);
      expect(result.shouldShow).toBe(true);
      expect(result.reason).toBe('ok');
    });

    it('НЕ должен показывать вопросы, если isOnInitialInfoScreen=true', () => {
      const state: QuizDisplayState = {
        currentInfoScreenIndex: 0,
        initialInfoScreens,
        isShowingInitialInfoScreen: true,
        isShowingInitialInfoScreenCorrected: true,
        currentInitialInfoScreen: initialInfoScreens[0],
        pendingInfoScreen: null,
        isRetakingQuiz: false,
        showResumeScreen: false,
        currentQuestionIndex: 0,
        allQuestions: [{ id: 1 }, { id: 2 }],
        answers: {},
      };
      const result = calculateCurrentQuestion(state);
      expect(result.shouldShow).toBe(false);
      expect(result.reason).toBe('initial_info_screen');
    });

    it('должен показывать вопросы, если currentInfoScreenIndex >= initialInfoScreens.length, даже если isShowingInitialInfoScreen=true', () => {
      // КРИТИЧЕСКИЙ ТЕСТ: Симулируем ситуацию, когда isShowingInitialInfoScreen=true,
      // но currentInfoScreenIndex уже прошел все экраны
      const state: QuizDisplayState = {
        currentInfoScreenIndex: initialInfoScreens.length, // Все экраны пройдены
        initialInfoScreens,
        isShowingInitialInfoScreen: true, // Может быть true из-за задержки обновления состояния
        isShowingInitialInfoScreenCorrected: false, // Но corrected должен быть false
        currentInitialInfoScreen: null,
        pendingInfoScreen: null,
        isRetakingQuiz: false,
        showResumeScreen: false,
        currentQuestionIndex: 0,
        allQuestions: [{ id: 1 }, { id: 2 }],
        answers: {},
      };
      const result = calculateCurrentQuestion(state);
      expect(result.shouldShow).toBe(true);
      expect(result.reason).toBe('ok');
    });

    it('должен показывать вопросы, если currentInitialInfoScreen=null, даже если isShowingInitialInfoScreen=true', () => {
      // КРИТИЧЕСКИЙ ТЕСТ: Симулируем ситуацию несоответствия
      const state: QuizDisplayState = {
        currentInfoScreenIndex: 0,
        initialInfoScreens,
        isShowingInitialInfoScreen: true,
        isShowingInitialInfoScreenCorrected: false, // Исправлено на false
        currentInitialInfoScreen: null, // null из-за несоответствия
        pendingInfoScreen: null,
        isRetakingQuiz: false,
        showResumeScreen: false,
        currentQuestionIndex: 0,
        allQuestions: [{ id: 1 }, { id: 2 }],
        answers: {},
      };
      const result = calculateCurrentQuestion(state);
      expect(result.shouldShow).toBe(true);
      expect(result.reason).toBe('ok');
    });

    it('должен показывать вопросы, если initialInfoScreens пустой', () => {
      const state: QuizDisplayState = {
        currentInfoScreenIndex: 0,
        initialInfoScreens: [],
        isShowingInitialInfoScreen: false,
        isShowingInitialInfoScreenCorrected: false,
        currentInitialInfoScreen: null,
        pendingInfoScreen: null,
        isRetakingQuiz: false,
        showResumeScreen: false,
        currentQuestionIndex: 0,
        allQuestions: [{ id: 1 }, { id: 2 }],
        answers: {},
      };
      const result = calculateCurrentQuestion(state);
      expect(result.shouldShow).toBe(true);
      expect(result.reason).toBe('ok');
    });

    it('НЕ должен показывать вопросы, если pendingInfoScreen существует', () => {
      const pendingScreen = INFO_SCREENS.find(s => s.showAfterQuestionCode) || null;
      const state: QuizDisplayState = {
        currentInfoScreenIndex: initialInfoScreens.length,
        initialInfoScreens,
        isShowingInitialInfoScreen: false,
        isShowingInitialInfoScreenCorrected: false,
        currentInitialInfoScreen: null,
        pendingInfoScreen: pendingScreen,
        isRetakingQuiz: false,
        showResumeScreen: false,
        currentQuestionIndex: 0,
        allQuestions: [{ id: 1 }, { id: 2 }],
        answers: {},
      };
      const result = calculateCurrentQuestion(state);
      expect(result.shouldShow).toBe(false);
      expect(result.reason).toBe('pending_info_screen');
    });

    it('должен показывать вопросы, если showResumeScreen=true', () => {
      const state: QuizDisplayState = {
        currentInfoScreenIndex: 0,
        initialInfoScreens,
        isShowingInitialInfoScreen: true,
        isShowingInitialInfoScreenCorrected: true,
        currentInitialInfoScreen: initialInfoScreens[0],
        pendingInfoScreen: null,
        isRetakingQuiz: false,
        showResumeScreen: true, // Ключевое условие
        currentQuestionIndex: 0,
        allQuestions: [{ id: 1 }, { id: 2 }],
        answers: {},
      };
      const result = calculateCurrentQuestion(state);
      expect(result.shouldShow).toBe(true);
      expect(result.reason).toBe('ok');
    });
  });

  describe('Критические сценарии из логов', () => {
    it('Сценарий 1: currentInfoScreenIndex < initialInfoScreens.length, но currentInitialInfoScreen=null', () => {
      // Симулируем ситуацию, когда индекс указывает на несуществующий элемент
      const state: QuizDisplayState = {
        currentInfoScreenIndex: 0,
        initialInfoScreens: [initialInfoScreens[0]!, initialInfoScreens[1]!], // Только 2 элемента
        isShowingInitialInfoScreen: true,
        isShowingInitialInfoScreenCorrected: false, // Исправлено, потому что currentInitialInfoScreen=null
        currentInitialInfoScreen: null, // null, потому что элемент undefined
        pendingInfoScreen: null,
        isRetakingQuiz: false,
        showResumeScreen: false,
        currentQuestionIndex: 0,
        allQuestions: [{ id: 1 }, { id: 2 }],
        answers: {},
      };
      const result = calculateCurrentQuestion(state);
      // Вопросы ДОЛЖНЫ показываться, потому что currentInitialInfoScreen=null
      expect(result.shouldShow).toBe(true);
      expect(result.reason).toBe('ok');
    });

    it('Сценарий 2: currentInfoScreenIndex >= initialInfoScreens.length, но isShowingInitialInfoScreen=true', () => {
      // Симулируем ситуацию задержки обновления состояния
      const state: QuizDisplayState = {
        currentInfoScreenIndex: initialInfoScreens.length, // Все экраны пройдены
        initialInfoScreens,
        isShowingInitialInfoScreen: true, // Задержка обновления
        isShowingInitialInfoScreenCorrected: false, // Но corrected должен быть false
        currentInitialInfoScreen: null,
        pendingInfoScreen: null,
        isRetakingQuiz: false,
        showResumeScreen: false,
        currentQuestionIndex: 0,
        allQuestions: [{ id: 1 }, { id: 2 }],
        answers: {},
      };
      const result = calculateCurrentQuestion(state);
      // Вопросы ДОЛЖНЫ показываться, потому что currentInfoScreenIndex >= initialInfoScreens.length
      expect(result.shouldShow).toBe(true);
      expect(result.reason).toBe('ok');
    });

    it('Сценарий 3: isShowingInitialInfoScreen=true, isShowingInitialInfoScreenCorrected=true, но currentInitialInfoScreen=null', () => {
      // Симулируем ситуацию несоответствия (не должно происходить, но проверяем)
      const state: QuizDisplayState = {
        currentInfoScreenIndex: 0,
        initialInfoScreens,
        isShowingInitialInfoScreen: true,
        isShowingInitialInfoScreenCorrected: true, // Не должно быть true, если currentInitialInfoScreen=null
        currentInitialInfoScreen: null,
        pendingInfoScreen: null,
        isRetakingQuiz: false,
        showResumeScreen: false,
        currentQuestionIndex: 0,
        allQuestions: [{ id: 1 }, { id: 2 }],
        answers: {},
      };
      // В этом случае isOnInitialInfoScreen должен быть false, потому что currentInitialInfoScreen=null
      const isOnInitial = calculateIsOnInitialInfoScreen(state);
      expect(isOnInitial).toBe(false);
      
      const result = calculateCurrentQuestion(state);
      // Вопросы ДОЛЖНЫ показываться, потому что isOnInitialInfoScreen=false
      expect(result.shouldShow).toBe(true);
      expect(result.reason).toBe('ok');
    });
  });
});

