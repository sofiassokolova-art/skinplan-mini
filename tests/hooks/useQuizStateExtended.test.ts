// tests/hooks/useQuizStateExtended.test.ts
// Unit тесты для хука useQuizStateExtended

import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useQuizStateExtended } from '@/lib/quiz/hooks/useQuizStateExtended';
import type { Questionnaire } from '@/lib/quiz/types';

// Моки для зависимостей
vi.mock('@/lib/quiz/hooks/useQuizNavigation', () => ({
  useQuizNavigation: vi.fn(() => ({
    currentQuestionIndex: 0,
    setCurrentQuestionIndex: vi.fn(),
    currentQuestionIndexRef: { current: 0 },
    currentInfoScreenIndex: 0,
    setCurrentInfoScreenIndex: vi.fn(),
    currentInfoScreenIndexRef: { current: 0 },
  })),
}));

vi.mock('@/lib/quiz/hooks/useQuizUI', () => ({
  useQuizUI: vi.fn(() => ({
    showResumeScreen: false,
    setShowResumeScreen: vi.fn(),
    isSubmitting: false,
    setIsSubmitting: vi.fn(),
    isSubmittingRef: { current: false },
    finalizing: false,
    setFinalizing: vi.fn(),
    finalizingStep: 'answers' as const,
    setFinalizingStep: vi.fn(),
    finalizeError: null,
    setFinalizeError: vi.fn(),
    pendingInfoScreen: null,
    pendingInfoScreenRef: { current: null },
    setPendingInfoScreen: vi.fn(),
  })),
}));

describe('useQuizStateExtended', () => {
  const mockQuestionnaire: Questionnaire = {
    id: 1,
    title: 'Test Questionnaire',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    questions: [],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('должен инициализировать с начальными значениями', () => {
    const { result } = renderHook(() => useQuizStateExtended());

    expect(result.current.questionnaire).toBeNull();
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.currentQuestionIndex).toBe(0);
    expect(result.current.currentInfoScreenIndex).toBe(0);
    expect(result.current.answers).toEqual({});
    expect(result.current.showResumeScreen).toBe(false);
    expect(result.current.isSubmitting).toBe(false);
    expect(result.current.isRetakingQuiz).toBe(false);
    expect(result.current.showRetakeScreen).toBe(false);
  });

  it('должен обновлять questionnaire', () => {
    const { result } = renderHook(() => useQuizStateExtended());

    act(() => {
      result.current.setQuestionnaire(mockQuestionnaire);
    });

    expect(result.current.questionnaire).toEqual(mockQuestionnaire);
    expect(result.current.questionnaireRef.current).toEqual(mockQuestionnaire);
  });

  it('должен обновлять loading', () => {
    const { result } = renderHook(() => useQuizStateExtended());

    act(() => {
      result.current.setLoading(true);
    });

    expect(result.current.loading).toBe(true);

    act(() => {
      result.current.setLoading(false);
    });

    expect(result.current.loading).toBe(false);
  });

  it('должен обновлять error', () => {
    const { result } = renderHook(() => useQuizStateExtended());

    act(() => {
      result.current.setError('Test error');
    });

    expect(result.current.error).toBe('Test error');

    act(() => {
      result.current.setError(null);
    });

    expect(result.current.error).toBeNull();
  });

  it('должен обновлять answers', () => {
    const { result } = renderHook(() => useQuizStateExtended());

    act(() => {
      result.current.setAnswers({ 1: 'answer1', 2: 'answer2' });
    });

    expect(result.current.answers).toEqual({ 1: 'answer1', 2: 'answer2' });
  });

  it('должен обновлять savedProgress', () => {
    const { result } = renderHook(() => useQuizStateExtended());

    const mockProgress = {
      answers: { 1: 'answer1' },
      questionIndex: 2,
      infoScreenIndex: 1,
    };

    act(() => {
      result.current.setSavedProgress(mockProgress);
    });

    expect(result.current.savedProgress).toEqual(mockProgress);
  });

  it('должен обновлять isRetakingQuiz', () => {
    const { result } = renderHook(() => useQuizStateExtended());

    act(() => {
      result.current.setIsRetakingQuiz(true);
    });

    expect(result.current.isRetakingQuiz).toBe(true);
  });

  it('должен обновлять showRetakeScreen', () => {
    const { result } = renderHook(() => useQuizStateExtended());

    act(() => {
      result.current.setShowRetakeScreen(true);
    });

    expect(result.current.showRetakeScreen).toBe(true);
  });

  it('должен обновлять userPreferencesData', () => {
    const { result } = renderHook(() => useQuizStateExtended());

    const mockPreferences = {
      hasPlanProgress: true,
      isRetakingQuiz: false,
      paymentRetakingCompleted: true,
    };

    act(() => {
      result.current.setUserPreferencesData(mockPreferences);
    });

    expect(result.current.userPreferencesData).toEqual(mockPreferences);
  });

  it('должен обновлять debugLogs', () => {
    const { result } = renderHook(() => useQuizStateExtended());

    const mockLog = {
      time: '12:00:00',
      message: 'Test log',
      data: { test: 'data' },
    };

    act(() => {
      result.current.setDebugLogs([mockLog]);
    });

    expect(result.current.debugLogs).toEqual([mockLog]);
  });
});
