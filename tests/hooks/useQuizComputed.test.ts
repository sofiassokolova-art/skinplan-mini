// tests/hooks/useQuizComputed.test.ts
// Unit тесты для хука useQuizComputed

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useQuizComputed } from '@/lib/quiz/hooks/useQuizComputed';
import type { Questionnaire, Question } from '@/lib/quiz/types';

// Моки для зависимостей
vi.mock('@/lib/quiz/filterQuestions', () => ({
  filterQuestions: vi.fn(() => []),
  getEffectiveAnswers: vi.fn(() => ({})),
}));

vi.mock('@/lib/quiz/extractQuestions', () => ({
  extractQuestionsFromQuestionnaire: vi.fn(() => []),
}));

const { extractQuestionsFromQuestionnaire } = await import('@/lib/quiz/extractQuestions');

vi.mock('@/lib/quiz/config/quizConfig', () => ({
  QUIZ_CONFIG: {
    VALIDATION: {
      MIN_ANSWERS_FOR_PROGRESS_SCREEN: 2,
    },
  },
}));

vi.mock('@/app/(miniapp)/quiz/info-screens', () => ({
  getInitialInfoScreens: vi.fn(() => []),
  getInfoScreenAfterQuestion: vi.fn(() => null),
}));

// Импортируем мокированные модули
const { filterQuestions, getEffectiveAnswers } = await import('@/lib/quiz/filterQuestions');
const { getInitialInfoScreens } = await import('@/app/(miniapp)/quiz/info-screens');

describe('useQuizComputed', () => {
  const mockQuestionnaire: Questionnaire = {
    id: 1,
    name: 'Test Questionnaire',
    version: 1,
    groups: [],
    questions: [],
    _meta: {
      shouldRedirectToPlan: false,
      isCompleted: false,
      hasProfile: false,
      preferences: {
        hasPlanProgress: false,
        isRetakingQuiz: false,
        fullRetakeFromHome: false,
        paymentRetakingCompleted: false,
        paymentFullRetakeCompleted: false,
      },
    },
  };

  const mockQuestion: Question = {
    id: 1,
    code: 'test_question',
    text: 'Test question?',
    type: 'single_choice',
    position: 1,
    isRequired: true,
    description: 'Test description',
    options: [
      {
        id: 1,
        value: 'option1',
        label: 'Option 1',
        position: 1,
      },
    ],
  };

  const defaultParams = {
    questionnaire: mockQuestionnaire,
    answers: {},
    savedProgress: null,
    currentInfoScreenIndex: 0,
    currentQuestionIndex: 0,
    isRetakingQuiz: false,
    showRetakeScreen: false,
    showResumeScreen: false,
    hasResumed: false,
    isStartingOver: false,
    pendingInfoScreen: null,
    isLoadingProgress: false,
    questionnaireRef: { current: mockQuestionnaire },
    currentInfoScreenIndexRef: { current: 0 },
    allQuestionsRawPrevRef: { current: [] },
    allQuestionsPrevRef: { current: [] },
    pendingInfoScreenRef: { current: null },
    quizStateMachine: { questionnaire: mockQuestionnaire },
    isDev: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('должен возвращать корректные вычисляемые значения', () => {
    const { result } = renderHook(() => useQuizComputed(defaultParams));

    expect(result.current).toHaveProperty('effectiveAnswers');
    expect(result.current).toHaveProperty('answersCount');
    expect(result.current).toHaveProperty('allQuestionsRaw');
    expect(result.current).toHaveProperty('allQuestions');
    expect(result.current).toHaveProperty('savedProgressAnswersCount');
    expect(result.current).toHaveProperty('initialInfoScreens');
    expect(result.current).toHaveProperty('isShowingInitialInfoScreen');
    expect(result.current).toHaveProperty('currentInitialInfoScreen');
    expect(result.current).toHaveProperty('currentQuestion');
    expect(result.current).toHaveProperty('viewMode');
  });

  it('должен корректно вычислять effectiveAnswers', () => {
    const params = {
      ...defaultParams,
      answers: { 1: 'answer1' },
      savedProgress: { answers: { 2: 'answer2' }, questionIndex: 0, infoScreenIndex: 0 },
    };

    renderHook(() => useQuizComputed(params));

    // getEffectiveAnswers должен быть вызван с правильными аргументами
    expect(getEffectiveAnswers).toHaveBeenCalledWith(
      params.answers,
      params.savedProgress?.answers
    );
  });

  it('должен корректно вычислять answersCount', () => {
    // Мокаем getEffectiveAnswers чтобы вернуть объект с 2 ключами
    getEffectiveAnswers.mockReturnValue({ 1: 'answer1', 2: 'answer2' });

    const params = {
      ...defaultParams,
      answers: { 1: 'answer1', 2: 'answer2' },
    };

    const { result } = renderHook(() => useQuizComputed(params));

    expect(result.current.answersCount).toBe(2);
  });

  it('должен корректно определять viewMode для LOADING_PROGRESS', () => {
    const params = {
      ...defaultParams,
      isLoadingProgress: true,
    };

    const { result } = renderHook(() => useQuizComputed(params));

    expect(result.current.viewMode).toBe('LOADING_PROGRESS');
  });

  it('должен корректно определять viewMode для RESUME', () => {
    const params = {
      ...defaultParams,
      savedProgress: {
        answers: { 1: 'a', 2: 'b', 3: 'c' },
        questionIndex: 1,
        infoScreenIndex: 0,
      },
      isStartingOver: false,
      hasResumed: false,
    };

    const { result } = renderHook(() => useQuizComputed(params));

    expect(result.current.viewMode).toBe('RESUME');
  });

  it('должен корректно определять viewMode для RETAKE_SELECT', () => {
    const params = {
      ...defaultParams,
      isRetakingQuiz: true,
      showRetakeScreen: true,
    };

    const { result } = renderHook(() => useQuizComputed(params));

    expect(result.current.viewMode).toBe('RETAKE_SELECT');
  });

  it('должен корректно определять viewMode для INITIAL_INFO', () => {
    // Мокаем getInitialInfoScreens чтобы вернуть один экран
    getInitialInfoScreens.mockReturnValue([{ id: 'screen1' }]);

    const params = {
      ...defaultParams,
      currentInfoScreenIndex: 0,
    };

    const { result } = renderHook(() => useQuizComputed(params));

    expect(result.current.viewMode).toBe('INITIAL_INFO');
  });

  it('должен корректно определять viewMode для QUESTION', () => {
    // Мокаем функции чтобы вернуть вопрос
    extractQuestionsFromQuestionnaire.mockReturnValue([mockQuestion]);
    filterQuestions.mockReturnValue([mockQuestion]);

    const params = {
      ...defaultParams,
      currentInfoScreenIndex: 1, // После начальных экранов
    };

    const { result } = renderHook(() => useQuizComputed(params));

    expect(result.current.viewMode).toBe('QUESTION');
  });

  it('должен корректно определять viewMode для ERROR', () => {
    // Мокаем чтобы не было вопросов (условие для ERROR)
    extractQuestionsFromQuestionnaire.mockReturnValue([]);
    filterQuestions.mockReturnValue([]);

    const params = {
      ...defaultParams,
      currentInfoScreenIndex: 1, // После начальных экранов
    };

    const { result } = renderHook(() => useQuizComputed(params));

    expect(result.current.viewMode).toBe('ERROR');
  });

  it('должен возвращать currentQuestion когда viewMode === QUESTION', () => {
    // Мокаем функции чтобы вернуть вопрос
    extractQuestionsFromQuestionnaire.mockReturnValue([mockQuestion]);
    filterQuestions.mockReturnValue([mockQuestion]);

    const params = {
      ...defaultParams,
      currentInfoScreenIndex: 1, // После начальных экранов
      currentQuestionIndex: 0,
    };

    const { result } = renderHook(() => useQuizComputed(params));

    expect(result.current.currentQuestion).toEqual(mockQuestion);
  });

  it('должен возвращать null для currentQuestion когда viewMode !== QUESTION', () => {
    const params = {
      ...defaultParams,
      isLoadingProgress: true, // viewMode будет LOADING_PROGRESS
    };

    const { result } = renderHook(() => useQuizComputed(params));

    expect(result.current.currentQuestion).toBeNull();
  });

  it('должен корректно вычислять isShowingInitialInfoScreen', () => {
    // Мокаем getInitialInfoScreens чтобы вернуть один экран
    getInitialInfoScreens.mockReturnValue([{ id: 'screen1' }]);

    const params = {
      ...defaultParams,
      currentInfoScreenIndex: 0,
    };

    const { result } = renderHook(() => useQuizComputed(params));

    expect(result.current.isShowingInitialInfoScreen).toBe(true);
  });

  it('должен возвращать currentInitialInfoScreen для валидного индекса', () => {
    const mockScreen = { id: 'screen1', title: 'Test Screen' };
    getInitialInfoScreens.mockReturnValue([mockScreen]);

    const params = {
      ...defaultParams,
      currentInfoScreenIndex: 0,
    };

    const { result } = renderHook(() => useQuizComputed(params));

    expect(result.current.currentInitialInfoScreen).toEqual(mockScreen);
  });

  it('должен возвращать null для currentInitialInfoScreen при невалидном индексе', () => {
    const mockScreen = { id: 'screen1', title: 'Test Screen' };
    getInitialInfoScreens.mockReturnValue([mockScreen]);

    const params = {
      ...defaultParams,
      currentInfoScreenIndex: 5, // Индекс вне диапазона
    };

    const { result } = renderHook(() => useQuizComputed(params));

    expect(result.current.currentInitialInfoScreen).toBeNull();
  });
});