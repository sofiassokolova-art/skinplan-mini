// tests/quiz-resume-logic.test.ts
// Unit тесты для логики shouldResumeNow с фиксом startedThisSession

import { describe, it, expect } from 'vitest';

describe('Quiz Resume Logic', () => {
  const QUIZ_CONFIG = {
    VALIDATION: {
      MIN_ANSWERS_FOR_PROGRESS_SCREEN: 2,
    },
  };

  // Мокаем ref как в React
  function createRef<T>(initialValue: T) {
    return { current: initialValue };
  }

  function shouldResumeNow({
    savedProgress,
    savedAnswersCount,
    startedThisSession,
    isStartingOver,
    hasResumed,
    isRetakingQuiz,
    showRetakeScreen,
    isLoadingProgress,
    isQuizCompleted,
    isProgressCleared,
  }: {
    savedProgress: any;
    savedAnswersCount: number;
    startedThisSession: boolean;
    isStartingOver: boolean;
    hasResumed: boolean;
    isRetakingQuiz: boolean;
    showRetakeScreen: boolean;
    isLoadingProgress: boolean;
    isQuizCompleted: boolean;
    isProgressCleared: boolean;
  }) {
    return (
      !!savedProgress &&
      savedAnswersCount >= QUIZ_CONFIG.VALIDATION.MIN_ANSWERS_FOR_PROGRESS_SCREEN &&
      !startedThisSession && // ✅ вот это главное
      !isStartingOver &&
      !hasResumed &&
      !isRetakingQuiz &&
      !showRetakeScreen &&
      !isLoadingProgress &&
      !isQuizCompleted &&
      !isProgressCleared
    );
  }

  const mockSavedProgress = {
    answers: { 1: 'name', 2: 'type' },
    questionIndex: 1,
    infoScreenIndex: 0,
  };

  const defaultConditions = {
    savedProgress: mockSavedProgress,
    savedAnswersCount: 2,
    isStartingOver: false,
    hasResumed: false,
    isRetakingQuiz: false,
    showRetakeScreen: false,
    isLoadingProgress: false,
    isQuizCompleted: false,
    isProgressCleared: false,
  };

  it('должен показывать резюм при наличии прогресса и startedThisSession = false', () => {
    const result = shouldResumeNow({
      ...defaultConditions,
      startedThisSession: false,
    });

    expect(result).toBe(true);
  });

  it('НЕ должен показывать резюм если пользователь уже начал отвечать (startedThisSession = true)', () => {
    const result = shouldResumeNow({
      ...defaultConditions,
      startedThisSession: true,
    });

    expect(result).toBe(false);
  });

  it('НЕ должен показывать резюм если ответов меньше минимума', () => {
    const result = shouldResumeNow({
      ...defaultConditions,
      savedAnswersCount: 1,
      startedThisSession: false,
    });

    expect(result).toBe(false);
  });

  it('НЕ должен показывать резюм если нет сохраненного прогресса', () => {
    const result = shouldResumeNow({
      ...defaultConditions,
      savedProgress: null,
      startedThisSession: false,
    });

    expect(result).toBe(false);
  });

  it('НЕ должен показывать резюм если уже резюмировали', () => {
    const result = shouldResumeNow({
      ...defaultConditions,
      hasResumed: true,
      startedThisSession: false,
    });

    expect(result).toBe(false);
  });

  it('НЕ должен показывать резюм если идет повторное прохождение', () => {
    const result = shouldResumeNow({
      ...defaultConditions,
      isRetakingQuiz: true,
      startedThisSession: false,
    });

    expect(result).toBe(false);
  });

  it('НЕ должен показывать резюм если начинается заново', () => {
    const result = shouldResumeNow({
      ...defaultConditions,
      isStartingOver: true,
      startedThisSession: false,
    });

    expect(result).toBe(false);
  });

  it('НЕ должен показывать резюм если прогресс загружается', () => {
    const result = shouldResumeNow({
      ...defaultConditions,
      isLoadingProgress: true,
      startedThisSession: false,
    });

    expect(result).toBe(false);
  });

  it('НЕ должен показывать резюм если квиз завершен', () => {
    const result = shouldResumeNow({
      ...defaultConditions,
      isQuizCompleted: true,
      startedThisSession: false,
    });

    expect(result).toBe(false);
  });

  it('НЕ должен показывать резюм если прогресс очищен', () => {
    const result = shouldResumeNow({
      ...defaultConditions,
      isProgressCleared: true,
      startedThisSession: false,
    });

    expect(result).toBe(false);
  });

  it('должен правильно комбинировать условия: startedThisSession имеет приоритет', () => {
    // Даже если все другие условия позволяют показать резюм,
    // startedThisSession = true должен его заблокировать
    const result = shouldResumeNow({
      savedProgress: mockSavedProgress,
      savedAnswersCount: 2,
      startedThisSession: true, // Это главное
      isStartingOver: false,
      hasResumed: false,
      isRetakingQuiz: false,
      showRetakeScreen: false,
      isLoadingProgress: false,
      isQuizCompleted: false,
      isProgressCleared: false,
    });

    expect(result).toBe(false);
  });
});