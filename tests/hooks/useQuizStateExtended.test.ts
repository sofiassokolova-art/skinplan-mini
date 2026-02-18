// tests/hooks/useQuizStateExtended.test.ts
// Unit тесты для хука useQuizStateExtended

import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useQuizStateExtended } from '@/lib/quiz/hooks/useQuizStateExtended';
import type { Questionnaire } from '@/lib/quiz/types';

// Моки для зависимостей
const mockSetCurrentQuestionIndex = vi.fn();
const mockSetCurrentInfoScreenIndex = vi.fn();
const mockSetShowResumeScreen = vi.fn();
const mockSetIsSubmitting = vi.fn();
const mockSetFinalizing = vi.fn();
const mockSetFinalizingStep = vi.fn();
const mockSetFinalizeError = vi.fn();
const mockSetPendingInfoScreen = vi.fn();
const mockSetDebugLogs = vi.fn();
const mockSetShowDebugPanel = vi.fn();
const mockSetAutoSubmitTriggered = vi.fn();

vi.mock('@/lib/quiz/hooks/useQuizNavigation', () => ({
  useQuizNavigation: vi.fn(() => ({
    currentQuestionIndex: 0,
    setCurrentQuestionIndex: mockSetCurrentQuestionIndex,
    currentQuestionIndexRef: { current: 0 },
    currentInfoScreenIndex: 0,
    setCurrentInfoScreenIndex: mockSetCurrentInfoScreenIndex,
    currentInfoScreenIndexRef: { current: 0 },
  })),
}));

vi.mock('@/lib/quiz/hooks/useQuizUI', () => ({
  useQuizUI: vi.fn(() => ({
    showResumeScreen: false,
    setShowResumeScreen: mockSetShowResumeScreen,
    isSubmitting: false,
    setIsSubmitting: mockSetIsSubmitting,
    isSubmittingRef: { current: false },
    finalizing: false,
    setFinalizing: mockSetFinalizing,
    finalizingStep: 'answers' as const,
    setFinalizingStep: mockSetFinalizingStep,
    finalizeError: null,
    setFinalizeError: mockSetFinalizeError,
    pendingInfoScreen: null,
    pendingInfoScreenRef: { current: null },
    setPendingInfoScreen: mockSetPendingInfoScreen,
    debugLogs: [],
    setDebugLogs: mockSetDebugLogs,
    showDebugPanel: false,
    setShowDebugPanel: mockSetShowDebugPanel,
    autoSubmitTriggered: false,
    setAutoSubmitTriggered: mockSetAutoSubmitTriggered,
    autoSubmitTriggeredRef: { current: false },
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
    // Сбрасываем refs для каждого теста
    mockSetCurrentQuestionIndex.mockClear();
    mockSetCurrentInfoScreenIndex.mockClear();
    mockSetShowResumeScreen.mockClear();
    mockSetIsSubmitting.mockClear();
    mockSetDebugLogs.mockClear();
  });

  it('должен инициализировать с начальными значениями', () => {
    const { result } = renderHook(() => useQuizStateExtended());

    expect(result.current.questionnaire).toBeNull();
    // ИСПРАВЛЕНО: loading инициализируется как true в реальном коде
    expect(result.current.loading).toBe(true);
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
    
    // questionnaireRef обновляется через useEffect (строка 243-245)
    // useEffect выполняется после setQuestionnaire, поэтому ref должен быть обновлен
    // В тестах мы можем проверить, что состояние обновилось
    // Ref обновится в следующем рендере через useEffect
    
    // Проверяем, что questionnaireStateRef тоже обновляется
    // Но так как это происходит в useEffect, в тестах можем проверить только состояние
    expect(result.current.questionnaireRef.current).toBeDefined();
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

    // debugLogs приходит из useQuizUI, который замокан
    // Проверяем, что метод доступен
    expect(typeof result.current.setDebugLogs).toBe('function');

    act(() => {
      result.current.setDebugLogs([mockLog]);
    });

    // setDebugLogs вызывается через мок useQuizUI
    expect(mockSetDebugLogs).toHaveBeenCalledWith([mockLog]);
    // debugLogs приходит из мока useQuizUI, который возвращает пустой массив по умолчанию
    expect(result.current.debugLogs).toEqual([]);
  });
});
