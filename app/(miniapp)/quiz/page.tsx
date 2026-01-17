// app/(miniapp)/quiz/page.tsx
// Страница анкеты - базовая структура для миграции

'use client';

import { useEffect, useLayoutEffect, useState, useMemo, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useTelegram } from '@/lib/telegram-client';
import { api } from '@/lib/api';
import { INFO_SCREENS, getInitialInfoScreens, getInfoScreenAfterQuestion, getNextInfoScreenAfterScreen, type InfoScreen } from './info-screens';
import { getAllTopics } from '@/lib/quiz-topics';
import type { QuizTopic } from '@/lib/quiz-topics';
import { PaymentGate } from '@/components/PaymentGate';
import { clientLogger } from '@/lib/client-logger';
import { filterQuestions, getEffectiveAnswers } from '@/lib/quiz/filterQuestions';
import * as userPreferences from '@/lib/user-preferences';
import { loadQuestionnaire as loadQuestionnaireFn, type LoadQuestionnaireParams } from '@/lib/quiz/loadQuestionnaire';
import { handleNext as handleNextFn, type HandleNextParams } from '@/lib/quiz/handlers/handleNext';
import { handleAnswer as handleAnswerFn } from '@/lib/quiz/handlers/handleAnswer';
import { handleBack as handleBackFn } from '@/lib/quiz/handlers/handleBack';
import { submitAnswers as submitAnswersFn, type SubmitAnswersParams } from '@/lib/quiz/handlers/submitAnswers';
import { resumeQuiz as resumeQuizFn, type ResumeQuizParams } from '@/lib/quiz/handlers/resumeQuiz';
import { startOver as startOverFn, type StartOverParams } from '@/lib/quiz/handlers/startOver';
import { createSaveProgress } from '@/lib/quiz/handlers/saveProgress';
import { createClearProgress } from '@/lib/quiz/handlers/clearProgress';
import { loadSavedProgressFromServer as loadSavedProgressFromServerFn } from '@/lib/quiz/handlers/loadSavedProgress';
import { extractQuestionsFromQuestionnaire } from '@/lib/quiz/extractQuestions';
import { useQuizView } from '@/lib/quiz/hooks/useQuizView';
import { useQuizStateMachine } from '@/lib/quiz/hooks/useQuizStateMachine';
import { useQuizStateExtended } from '@/lib/quiz/hooks/useQuizStateExtended';
import { useQuizEffects } from '@/lib/quiz/hooks/useQuizEffects';
import { useQuizComputed } from '@/lib/quiz/hooks/useQuizComputed';
import { useQuizInit } from '@/lib/quiz/hooks/useQuizInit';
import { useQuizRestorePipeline } from '@/lib/quiz/hooks/useQuizRestorePipeline';
import { useQuestionnaireSync } from '@/lib/quiz/hooks/useQuestionnaireSync';
import { useQuizRenderDebug } from '@/lib/quiz/hooks/useQuizRenderDebug';
import { useResumeScreenLogic } from '@/lib/quiz/hooks/useResumeScreenLogic';
import { useQuizInitialization } from '@/lib/quiz/hooks/useQuizInitialization';
import { useRetakeAnswersLoader } from '@/lib/quiz/hooks/useRetakeAnswersLoader';
import { useQuizUrlSync } from '@/lib/quiz/hooks/useQuizUrlSync';
import { shouldShowInitialLoader, getQuizBackgroundColor, isQuestionScreen as isQuestionScreenUtil } from '@/lib/quiz/utils/quizRenderHelpers';
import { handleFullRetake } from '@/lib/quiz/handlers/handleFullRetake';
// ОТКЛЮЧЕНО: useQuizSync вызывает бесконечные циклы React Error #310
// import { useQuizSync } from '@/lib/quiz/utils/quizSync';
import { useQuestionnaire, useQuizProgress, useSaveQuizProgress, useClearQuizProgress } from '@/hooks/useQuiz';
import { QUIZ_CONFIG } from '@/lib/quiz/config/quizConfig';
import { WelcomeScreen, HowItWorksScreen, PersonalAnalysisScreen } from '@/components/quiz/screens';
import { FixedContinueButton, BackButton, TinderButtons } from '@/components/quiz/buttons';
import { TestimonialsCarousel, ProductsGrid } from '@/components/quiz/content';
import { handleGetPlan } from '@/lib/quiz/handlers/handleGetPlan';
import type { Question, Questionnaire, SavedProgress } from '@/lib/quiz/types';
import { QuizQuestion } from './components/QuizQuestion';
import { QuizInfoScreen } from './components/QuizInfoScreen';
import { QuizErrorDisplay } from './components/QuizErrorDisplay';
import { QuizFinalizingLoader } from './components/QuizFinalizingLoader';
import { QuizResumeScreen } from './components/QuizResumeScreen';
import { QuizRetakeScreen } from './components/QuizRetakeScreen';
import { QuizDebugPanel } from './components/QuizDebugPanel';
import { QuizQuestionState } from './components/QuizQuestionState';
import { QuizInitialLoader } from './components/QuizInitialLoader';
import { QuizErrorScreen } from './components/QuizErrorScreen';
import { checkQuizErrors } from './components/QuizErrorChecker';
import { QuizPageContent } from './components/QuizPageContent';

export default function QuizPage() {
  const isDev = process.env.NODE_ENV === 'development';
  const router = useRouter();
  
  // Инициализация useTelegram (хук сам обрабатывает ошибки внутри)
  // ВАЖНО: хуки должны вызываться всегда в одном порядке, нельзя оборачивать в try-catch
  const { initialize, initData } = useTelegram();
  
  // РЕФАКТОРИНГ: State Machine для управления UI состояниями
  // КРИТИЧНО: Используем useCallback для стабильности колбэков, чтобы избежать бесконечных циклов
  const onStateChangeCallback = useCallback((newState: any, previousState: any) => {
    if (isDev) {
      clientLogger.log('🔄 State Machine transition', { 
        from: previousState, 
        to: newState 
      });
    }
  }, [isDev]);
  
  const onTransitionErrorCallback = useCallback((event: any, from: any) => {
    if (isDev) {
      clientLogger.warn('⚠️ Invalid State Machine transition', { 
        event, 
        from 
      });
    }
  }, [isDev]);
  
  const quizStateMachine = useQuizStateMachine({
    initialState: 'LOADING',
    onStateChange: onStateChangeCallback,
    onTransitionError: onTransitionErrorCallback,
  });
  
  // ИСПРАВЛЕНО: Используем questionnaire из State Machine для защиты от случайного сброса
  // State Machine гарантирует, что questionnaire не станет null после загрузки
  const questionnaireFromStateMachine = quizStateMachine.questionnaire;
  const setQuestionnaireInStateMachine = quizStateMachine.setQuestionnaire;
  
  // ФИКС: Используем React Query для загрузки анкеты (автоматическое кэширование)
  // Это заменяет ручное управление loading/error состояниями
  const { 
    data: questionnaireFromQuery, 
    isLoading: isLoadingQuestionnaire, 
    error: questionnaireError 
  } = useQuestionnaire();
  
  // ФИКС: Используем React Query для сохранения прогресса (автоматическая инвалидация кэша)
  const saveQuizProgressMutation = useSaveQuizProgress();
  
  // ФИКС: Используем React Query для очистки прогресса (автоматическая инвалидация кэша)
  const clearQuizProgressMutation = useClearQuizProgress();
  
  // ФИКС: Используем React Query для загрузки прогресса (автоматическое кэширование)
  const { 
    data: quizProgressFromQuery, 
    isLoading: isLoadingProgress,
    error: progressError 
  } = useQuizProgress();
  
  // РЕФАКТОРИНГ: Используем расширенный хук для управления всеми состояниями
  const quizState = useQuizStateExtended();
  
  // ИСПРАВЛЕНО: Оставляем локальный state для обратной совместимости, но синхронизируем с State Machine
  // Это позволяет постепенно мигрировать код на использование State Machine
  // ФИКС: Используем данные из React Query, если они доступны
  const { questionnaire, setQuestionnaire, questionnaireRef } = quizState;

  // ФИКС A: Фиксируем scope один раз через ref после первого определения questionnaireId
  // Это предотвращает "прыгание" ключей sessionStorage между разными scope
  const scopeRef = useRef<string | null>(null);
  const currentQuestionnaireId = questionnaireRef.current?.id || questionnaire?.id || quizStateMachine.questionnaire?.id;


  // Используем зафиксированный scope или 'global' как fallback
  const scope = scopeRef.current ?? 'global';
  
  // ФИКС D: useMemo для scopedStorageKeys по scope (предотвращает лишние срабатывания эффектов)
  const scopedStorageKeys = useMemo(() => ({
    CURRENT_INFO_SCREEN: QUIZ_CONFIG.getScopedKey(QUIZ_CONFIG.STORAGE_KEYS.CURRENT_INFO_SCREEN, scope),
    CURRENT_QUESTION: QUIZ_CONFIG.getScopedKey(QUIZ_CONFIG.STORAGE_KEYS.CURRENT_QUESTION, scope),
    CURRENT_QUESTION_CODE: QUIZ_CONFIG.getScopedKey(QUIZ_CONFIG.STORAGE_KEYS.CURRENT_QUESTION_CODE, scope),
    INIT_CALLED: QUIZ_CONFIG.getScopedKey(QUIZ_CONFIG.STORAGE_KEYS.INIT_CALLED, scope),
    JUST_SUBMITTED: QUIZ_CONFIG.getScopedKey(QUIZ_CONFIG.STORAGE_KEYS.JUST_SUBMITTED, scope),
    QUIZ_COMPLETED: QUIZ_CONFIG.getScopedKey(QUIZ_CONFIG.STORAGE_KEYS.QUIZ_COMPLETED, scope),
  }), [scope]);

  // ФИКС B: Выбираем один source of truth для questionnaire (React Query + ref как кэш)
  // Приоритет: questionnaireFromQuery (React Query) > questionnaireRef (кэш) > questionnaire (state)
  // State Machine используется только для UI-стейтов, не для данных questionnaire
  const effectiveQuestionnaire = questionnaireFromQuery || questionnaireRef.current || questionnaire;

  // РЕФАКТОРИНГ: Используем хук для синхронизации questionnaire
  const { loading, setLoading, error, setError } = quizState;
  
  const { setQuestionnaireWithStateMachine } = useQuestionnaireSync({
    questionnaireFromQuery,
    questionnaire,
    questionnaireRef,
    setQuestionnaire,
    quizStateMachine,
    isLoadingQuestionnaire,
    questionnaireError,
    setLoading,
    setError,
  });
  // ФИКС: Версионирование ответов для отслеживания изменений значений
  const [answersVersion, setAnswersVersion] = useState(0);
  const [savedProgressVersion, setSavedProgressVersion] = useState(0);
  
  // ФИКС: Защита от зацикливания - не восстанавливаем currentInfoScreenIndex после перехода к вопросам
  const infoIndexRestoredRef = useRef(false);

  // ФИКС: Ref для отслеживания процесса самовосстановления вопроса
  const questionHealInProgressRef = useRef(false);

  // РЕФАКТОРИНГ: Все состояния и refs теперь в useQuizStateExtended
  const {
    currentInfoScreenIndex,
    setCurrentInfoScreenIndex,
    currentInfoScreenIndexRef,
    currentQuestionIndex,
    setCurrentQuestionIndex,
    currentQuestionIndexRef,
    answers,
    setAnswers,
    showResumeScreen,
    setShowResumeScreen,
    isSubmitting,
    setIsSubmitting,
    isSubmittingRef,
    finalizing,
    setFinalizing,
    finalizingStep,
    setFinalizingStep,
    finalizeError,
    setFinalizeError,
    pendingInfoScreen,
    setPendingInfoScreen,
    savedProgress,
    setSavedProgress,
    lastSyncedQuestionnaireIdRef,
    lastSyncedQuestionnaireRef,
    isSyncingRef,
    lastLoadingResetIdRef,
    questionnaireStateRef,
    loadingStateRef,
    stateMachineQuestionnaireRef,
    stateMachineQuestionnaireIdRef,
  } = quizState;

  // ФИКС: Синхронизируем currentInfoScreenIndex в sessionStorage для layout.tsx
  useEffect(() => {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('currentInfoScreenIndex', currentInfoScreenIndex.toString());
    }
  }, [currentInfoScreenIndex]);

  // ФИКС: Используем ref для отслеживания questionnaire из State Machine, чтобы избежать зависимости от объекта
  useEffect(() => {
    stateMachineQuestionnaireRef.current = quizStateMachine.questionnaire;
    stateMachineQuestionnaireIdRef.current = quizStateMachine.questionnaire?.id || null;
  }, [quizStateMachine.questionnaire?.id, stateMachineQuestionnaireRef]);

  // РЕФАКТОРИНГ: Refs для useQuizComputed (объявляем ДО использования)
  // ИСПРАВЛЕНО: Используем ref для хранения предыдущего значения allQuestionsRaw
  // Это предотвращает потерю вопросов, когда questionnaire временно становится null в state
  const allQuestionsRawPrevRef = useRef<Question[]>([]);
  // КРИТИЧНО: Используем ref для хранения предыдущего значения allQuestions
  // Это предотвращает сброс allQuestions, если allQuestionsRaw временно пустой
  const allQuestionsPrevRef = useRef<Question[]>([]);

  // РЕФАКТОРИНГ: Все состояния и refs теперь в useQuizStateExtended
  const {
    isRetakingQuiz,
    setIsRetakingQuiz,
    showRetakeScreen,
    setShowRetakeScreen,
    hasRetakingPayment,
    setHasRetakingPayment,
    hasFullRetakePayment,
    setHasFullRetakePayment,
    hasResumed,
    setHasResumed,
    hasResumedRef,
    userPreferencesData,
    setUserPreferencesData,
    isStartingOver,
    setIsStartingOver,
    isStartingOverRef,
    daysSincePlanGeneration,
    setDaysSincePlanGeneration,
    initCompletedRef,
    initCompleted,
    setInitCompleted,
    debugLogs,
    setDebugLogs,
    showDebugPanel,
    setShowDebugPanel,
    autoSubmitTriggered,
    setAutoSubmitTriggered,
    autoSubmitTriggeredRef,
    isMountedRef,
    redirectTimeoutRef,
    submitAnswersRef,
    saveProgressTimeoutRef,
    lastSavedAnswerRef,
    pendingProgressRef,
    progressLoadedRef,
    loadingRefForTimeout,
    loadingStartTimeRef,
  } = quizState;
  
  // РЕФАКТОРИНГ: Вычисляем состояния из State Machine для обратной совместимости
  // Постепенно заменим прямые проверки на quizStateMachine.state
  // ПРИМЕЧАНИЕ: Эти значения можно использовать для постепенной миграции
  const loadingFromStateMachine = quizStateMachine.isState('LOADING');
  const showResumeScreenFromStateMachine = quizStateMachine.isState('RESUME');
  const isSubmittingFromStateMachine = quizStateMachine.isState('SUBMITTING');
  const isRetakingQuizFromStateMachine = quizStateMachine.isState('RETAKE_SELECT');
  const showRetakeScreenFromStateMachine = quizStateMachine.isState('RETAKE_SELECT');
  const isQuestionsFromStateMachine = quizStateMachine.isState('QUESTIONS');
  const isIntroFromStateMachine = quizStateMachine.isState('INTRO');
  
  // РЕФАКТОРИНГ: Используем хук для логики резюм-экрана
  useResumeScreenLogic({
    loading,
    isLoadingProgress,
    isStartingOver,
    hasResumed,
    currentQuestionIndex,
    answers,
    savedProgress,
    showResumeScreen,
    setShowResumeScreen,
  });
  
  // РЕФАКТОРИНГ: Используем хук useQuizComputed для всех вычисляемых значений
  // Вынесены: effectiveAnswers, answersCount, allQuestionsRaw, allQuestions, 
  // savedProgressAnswersCount, initialInfoScreens, isShowingInitialInfoScreen, 
  // currentInitialInfoScreen, currentQuestion
  const {
    effectiveAnswers,
    answersCount,
    allQuestionsRaw,
    allQuestions,
    savedProgressAnswersCount,
    initialInfoScreens,
    isShowingInitialInfoScreen,
    currentInitialInfoScreen,
    currentQuestion,
    viewMode, // ФИКС: Единый режим экрана
  } = useQuizComputed({
    questionnaire,
    answers,
    answersVersion, // ФИКС: Версия ответов для отслеживания изменений значений
    savedProgress,
    savedProgressVersion, // ФИКС: Версия savedProgress
    currentInfoScreenIndex,
    currentQuestionIndex,
    isRetakingQuiz,
    showRetakeScreen,
    showResumeScreen,
    hasResumed,
    isStartingOver, // КРИТИЧНО: Передаем isStartingOver для блокировки начальных инфо-экранов
    pendingInfoScreen,
    isLoadingProgress, // КРИТИЧНО: Передаем isLoadingProgress для блокировки вычисления currentQuestion при загрузке прогресса
    questionnaireRef,
    currentInfoScreenIndexRef,
    allQuestionsRawPrevRef,
    allQuestionsPrevRef,
    pendingInfoScreenRef: quizState.pendingInfoScreenRef, // ИСПРАВЛЕНО: Передаем ref для проверки актуального состояния
    quizStateMachine,
    isDev,
  });
  
  // ФИКС C: Refs для restore pipeline (объявляем ДО использования в useQuizRestorePipeline)
  const lastRestoredAnswersIdRef = useRef<string | null>(null);
  const answersRef = useRef<Record<number, string | string[]>>({});
  const answersCountRef = useRef<number>(0);
  
  // Синхронизация answersRef с answers state
  useEffect(() => {
    answersRef.current = answers;
    answersCountRef.current = Object.keys(answers).length;
  }, [answers]);
  
  // ФИКС C: Используем restore pipeline для управления восстановлением в правильном порядке
  // Порядок: scope → questionnaire → progress → allQuestions → индексы → авто-сабмит
  useQuizRestorePipeline({
    scope,
    scopedStorageKeys,
    questionnaire: effectiveQuestionnaire,
    questionnaireRef,
    questionnaireFromQuery,
    quizProgressFromQuery,
    isLoadingProgress,
    allQuestions,
    allQuestionsPrevRef,
    answers,
    setAnswers,
    savedProgress,
    setSavedProgress,
    currentInfoScreenIndex,
    setCurrentInfoScreenIndex,
    currentQuestionIndex,
    setCurrentQuestionIndex,
    answersRef,
    answersCountRef,
    currentInfoScreenIndexRef,
    currentQuestionIndexRef,
    lastRestoredAnswersIdRef,
    isStartingOver,
    isStartingOverRef,
    hasResumed,
    hasResumedRef,
    isDev,
  });
  
  // ФИКС: Рендерим резюм строго по showResumeScreen, а shouldShowResume используем только для логики
  // Это устраняет два источника правды и непредсказуемость

  // ФИКС: Проверяем флаг завершения анкеты - если завершена, никогда не показываем резюм
  const completedKey = QUIZ_CONFIG.getScopedKey(QUIZ_CONFIG.STORAGE_KEYS.QUIZ_COMPLETED, scope);
  const isQuizCompleted = typeof window !== 'undefined' && sessionStorage.getItem(completedKey) === 'true';

  // ФИКС: Проверяем флаг очистки прогресса - если прогресс очищен, никогда не показываем резюм
  const progressClearedKey = QUIZ_CONFIG.getScopedKey('quiz_progress_cleared', scope);
  const [isProgressCleared, setIsProgressCleared] = useState(() =>
    typeof window !== 'undefined' && sessionStorage.getItem(progressClearedKey) === 'true'
  );

  // ФИКС: Обновляем isProgressCleared когда sessionStorage изменяется
  useEffect(() => {
    const checkProgressCleared = () => {
      const cleared = typeof window !== 'undefined' && sessionStorage.getItem(progressClearedKey) === 'true';
      setIsProgressCleared(cleared);
    };

    // Проверяем сразу
    checkProgressCleared();

    // Слушаем изменения в sessionStorage (для случаев когда другие вкладки меняют его)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === progressClearedKey) {
        checkProgressCleared();
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [progressClearedKey]);

  const savedAnswersCount = savedProgress?.answers ? Object.keys(savedProgress.answers).length : 0;
  const shouldShowResume = !!savedProgress &&
                           savedAnswersCount >= QUIZ_CONFIG.VALIDATION.MIN_ANSWERS_FOR_PROGRESS_SCREEN &&
                           !isStartingOver &&
                           !isStartingOverRef.current &&
                           !hasResumedRef.current &&
                           !isRetakingQuiz &&
                           !showRetakeScreen &&
                           !isLoadingProgress &&
                           !isQuizCompleted && // ФИКС: Не показывать резюм, если анкета завершена
                           !isProgressCleared; // ✅ КЛЮЧЕВОЕ: Не показывать резюм, если прогресс очищен

  // ФИКС: Синхронизируем showResumeScreen с shouldShowResume однократно
  useEffect(() => {
    if (shouldShowResume && !showResumeScreen) {
      setShowResumeScreen(true);
    } else if (!shouldShowResume && showResumeScreen) {
      setShowResumeScreen(false);
    }
  }, [shouldShowResume, showResumeScreen]);
  
  // ФИКС: Увеличиваем версию ответов при реальных изменениях (не при каждом рендере)
  // Используем легкий хеш на основе (id,value) пар вместо JSON.stringify
  const answersVersionRef = useRef(0);
  const lastAnswersHashRef = useRef<string>('');
  useEffect(() => {
    // Вычисляем легкий хеш: сортируем ключи и создаем строку "id:value,id:value"
    const sortedKeys = Object.keys(answers).sort((a, b) => Number(a) - Number(b));
    const answersHash = sortedKeys.map(key => `${key}:${answers[Number(key)]}`).join(',');
    if (answersHash !== lastAnswersHashRef.current) {
      lastAnswersHashRef.current = answersHash;
      answersVersionRef.current += 1;
      setAnswersVersion(answersVersionRef.current);
    }
  }, [answers]);
  
  // ФИКС: Увеличиваем версию savedProgress при реальных изменениях
  // Используем хэш вместо количества ключей для точного отслеживания изменений
  const savedProgressVersionRef = useRef(0);
  const lastSavedProgressHashRef = useRef<string>('');
  useEffect(() => {
    if (savedProgress?.answers) {
      const sortedKeys = Object.keys(savedProgress.answers).sort((a, b) => Number(a) - Number(b));
      const savedProgressHash = sortedKeys.map(key => `${key}:${savedProgress.answers[Number(key)]}`).join(',');
      if (savedProgressHash !== lastSavedProgressHashRef.current) {
        lastSavedProgressHashRef.current = savedProgressHash;
        savedProgressVersionRef.current += 1;
        setSavedProgressVersion(savedProgressVersionRef.current);
      }
    }
  }, [savedProgress]); // ФИКС: Зависимость от savedProgress целиком для точности
  
  // ИСПРАВЛЕНО: Cleanup для saveProgressTimeoutRef при размонтировании компонента
  // Это предотвращает утечки памяти и выполнение сохранения после размонтирования
  useEffect(() => {
    return () => {
      if (saveProgressTimeoutRef.current) {
        clearTimeout(saveProgressTimeoutRef.current);
        saveProgressTimeoutRef.current = null;
      }
    };
  }, []);
  
  // ИСПРАВЛЕНО: Абсолютный таймаут для loading - если loading остается true больше 15 секунд, сбрасываем его
  // ИСПРАВЛЕНО: Один-единственный "сторож" лоадера (absolute timeout)
  // Это гарантирует, что UI не зависнет даже при подвисшем await
  useEffect(() => {
    if (!loading) return;

    const id = window.setTimeout(() => {
      clientLogger.warn('⏱️ Absolute loading timeout hit → forcing loading=false');
      setLoading(false);
      setInitCompleted(true);
      initInProgressRef.current = false;
    }, 15000);

    return () => clearTimeout(id);
  }, [loading]);
  
  // ИСПРАВЛЕНО: Храним значения из localStorage в state после mount, чтобы избежать hydration mismatch
  const [paidTopics, setPaidTopics] = useState<Set<string>>(new Set());
  
  // ИСПРАВЛЕНО: Загружаем значения из localStorage после mount
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    // Загружаем флаги оплаты из БД
    // ИСПРАВЛЕНО: Используем preferences из метаданных анкеты вместо отдельных вызовов API
    const loadPaymentFlags = async () => {
      try {
        // Используем preferences из state, если они уже загружены
        // ИСПРАВЛЕНО: Используем preferences из метаданных анкеты
        // Если preferences еще не загружены, просто используем false (не делаем API вызов)
        // Preferences будут загружены вместе с анкетой в loadQuestionnaire
        const hasRetaking = userPreferencesData?.paymentRetakingCompleted ?? false;
        const hasFullRetake = userPreferencesData?.paymentFullRetakeCompleted ?? false;
        
        const paidSet = new Set<string>();
        if (hasRetaking) {
          paidSet.add('payment_retaking_completed');
          if (!hasRetakingPayment) {
            setHasRetakingPayment(true);
          }
        }
        if (hasFullRetake) {
          paidSet.add('payment_full_retake_completed');
          if (!hasFullRetakePayment) {
            setHasFullRetakePayment(true);
          }
        }
        setPaidTopics(paidSet);
      } catch (error) {
        clientLogger.warn('Failed to load payment flags:', error);
      }
    };
    loadPaymentFlags();
  }, []);
  
  // ВАЖНО: Все хуки должны быть объявлены ПЕРЕД ранними return'ами
  // ИСПРАВЛЕНО: Флаги перепрохождения теперь загружаются из метаданных анкеты
  // Это убирает необходимость в отдельных вызовах /api/user/preferences
  // Флаги устанавливаются в loadQuestionnaire после получения метаданных
  
  // Функция для добавления логов (только в development)
  // ВАЖНО: оборачиваем в useCallback, чтобы функция не менялась между рендерами
  // и не вызывала лишние пересчеты в useMemo
  const addDebugLog = useCallback((message: string, data?: any) => {
    const time = new Date().toLocaleTimeString();
    // Также логируем в консоль для тех, кто может ее открыть
    clientLogger.log(`[${time}] ${message}`, data || '');
    
    if (process.env.NODE_ENV === 'development' || process.env.NEXT_PUBLIC_DEBUG === 'true') {
      const log = {
        time,
        message,
        data: data ? JSON.stringify(data, null, 2) : undefined,
      };
      setDebugLogs(prev => [...prev.slice(-19), log]); // Храним последние 20 логов
    }
  }, []);

  // Флаг для предотвращения множественных вызовов init
  const initInProgressRef = useRef(false);
  // ИСПРАВЛЕНО: Ref для отслеживания, был ли уже вызван init() при монтировании
  // Это предотвращает множественные вызовы даже при пересоздании функции init
  const initCalledRef = useRef(false);
  // Время начала инициализации для проверки зависания
  const initStartTimeRef = useRef<number | null>(null);
  // Флаг для предотвращения повторных проверок профиля
  const profileCheckInProgressRef = useRef(false);
  // Флаг для предотвращения повторных загрузок прогресса
  const progressLoadInProgressRef = useRef(false);
  // ИСПРАВЛЕНО: Флаг для предотвращения множественных вызовов loadQuestionnaire
  const loadQuestionnaireInProgressRef = useRef(false);
  const loadQuestionnaireAttemptedRef = useRef(false);
  // РЕФАКТОРИНГ: questionnaireRef теперь в useQuizStateExtended
  // ИСПРАВЛЕНО: Ref для хранения функции loadQuestionnaire, чтобы использовать её в init до объявления
  // УДАЛЕНО: loadQuestionnaireRef больше не нужен
  // ИСПРАВЛЕНО: Ref для отслеживания времени завершения init() для показа второго лоадера
  const initCompletedTimeRef = useRef<number | null>(null);
  // Ref для отслеживания попыток принудительного сброса loading в рендере
  const loadingResetAttemptedRef = useRef(false);

  // ОТКЛЮЧЕНО: useQuizSync вызывает бесконечные циклы React Error #310
  // Синхронизация questionnaire уже происходит в других местах:
  // 1. useEffect для синхронизации из React Query (строка 88)
  // 2. setQuestionnaireWithStateMachine (строка 119)
  // 3. useEffect для синхронизации questionnaireRef с state (строка 1508)
  // useQuizSync({
  //   stateMachineQuestionnaire: quizStateMachine.questionnaire,
  //   setQuestionnaire,
  //   questionnaireRef,
  //   isSyncingRef,
  // });

  // ИСПРАВЛЕНО: Очищаем quiz_just_submitted и isSubmitting при входе на /quiz
  // Это предотвращает показ планового лоадера для нового пользователя из-за "залипшего" флага
  // ВАЖНО: Очищаем ВСЕГДА при монтировании, так как если анкета действительно отправляется,
  // флаг будет установлен заново в submitAnswers
  useEffect(() => {
    try {
      // Если мы просто открыли /quiz (особенно новый пользователь),
      // эти флаги должны быть сняты, иначе увидим лоадер плана
      if (typeof window !== 'undefined') {
        const justSubmitted = sessionStorage.getItem(scopedStorageKeys.JUST_SUBMITTED);
        if (justSubmitted === 'true') {
          clientLogger.log('🧹 Очищаем залипший флаг quiz_just_submitted при входе на /quiz');
          sessionStorage.removeItem(scopedStorageKeys.JUST_SUBMITTED);
        }
        
        // ИСПРАВЛЕНО: ВСЕГДА сбрасываем isSubmitting при монтировании для нового пользователя
        // Это предотвращает показ планового лоадера, если isSubmitting остался true из предыдущей сессии
        // ВАЖНО: Сбрасываем БЕЗ проверки, так как для нового пользователя isSubmitting должен быть false
        // УБРАНО: Логирование вызывает бесконечные циклы в продакшене
        // if (isDev) {
        //   clientLogger.log('🧹 Сбрасываем isSubmitting при входе на /quiz (защита от залипшего состояния)');
        // }
        setIsSubmitting(false);
        isSubmittingRef.current = false;
        
        // ИСПРАВЛЕНО: НЕ сбрасываем initCompletedRef при монтировании, если init() уже был вызван
        // Это предотвращает повторные вызовы init() при перемонтировании компонента
        // initCompletedRef сбрасывается только при startOver() или при явной необходимости
        // ИСПРАВЛЕНО: Сбрасываем только initInProgressRef для безопасности, но не initCompletedRef
        // если init() уже был вызван и завершен
        if (!initCalledRef.current) {
          // Только для нового монтирования (первый раз) сбрасываем флаги
          initCompletedRef.current = false;
          initInProgressRef.current = false;
          initStartTimeRef.current = null;
        } else {
          // Если init() уже был вызван, только сбрасываем inProgress для безопасности
          initInProgressRef.current = false;
        }
        // initCalledRef НЕ сбрасываем - он должен оставаться true после первого вызова
      }
    } catch (error) {
      // Игнорируем ошибки sessionStorage (например, в приватном режиме)
    }
  }, []); // Выполняется только при монтировании

  // ИСПРАВЛЕНО: Refs для предотвращения множественных редиректов
  // РЕФАКТОРИНГ: historyUpdateInProgressRef и lastHistoryUpdateTimeRef перенесены в useQuizUrlSync
  const redirectInProgressRef = useRef(false);
  // ФИКС: Ref для предотвращения повторных сбросов на первый экран
  const firstScreenResetRef = useRef(false);
  // ФИКС: Ref для отслеживания завершения resumeQuiz
  const resumeCompletedRef = useRef(false);
  // ФИКС: Ref для предотвращения множественных кликов по кнопке "Продолжить"
  const handleNextInProgressRef = useRef(false);
  // ФИКС: State для визуального обновления кнопки "Продолжить"
  const [isHandlingNext, setIsHandlingNext] = useState(false);
  
  useEffect(() => {
    // ФИКС: Проверка JUST_SUBMITTED вынесена в отдельный useEffect ниже (строки 1943-1992)
    // Это предотвращает двойной редирект и гонки состояний
    // Здесь остаются только проверки профиля и другие проверки
    
    // ИСПРАВЛЕНО: Проверяем, есть ли уже профиль (анкета завершена)
    // Если профиль есть и анкета завершена, не показываем начало анкеты, а редиректим на /plan
    // ВАЖНО: Проверяем синхронно, чтобы предотвратить показ первого экрана
    // ФИКС: Проверка JUST_SUBMITTED вынесена в отдельный useEffect ниже
    // ИСПРАВЛЕНО: Для нового пользователя (нет hasPlanProgress) не проверяем флаги перепрохождения
    // Это оптимизирует загрузку и предотвращает избыточные запросы к /api/user/preferences
    if (typeof window !== 'undefined' && window.Telegram?.WebApp?.initData && !initCompletedRef.current) {
      // ИСПРАВЛЕНО: Проверяем флаги перепрохождения ПЕРЕД проверкой профиля
      const checkRetakeFlags = async () => {
        try {
          // ИСПРАВЛЕНО: Используем hasPlanProgress из метаданных анкеты
          // Если preferences еще не загружены (анкета еще не загружена), просто используем false
          // Это предотвращает лишние вызовы API - preferences будут загружены вместе с анкетой
          const hasPlanProgress = userPreferencesData?.hasPlanProgress ?? false;
          
          if (!hasPlanProgress) {
            // Новый пользователь - не проверяем флаги перепрохождения
            clientLogger.log('ℹ️ Новый пользователь (нет hasPlanProgress) - пропускаем проверку флагов перепрохождения');
            return;
          }
          
          // ИСПРАВЛЕНО: Используем preferences из метаданных анкеты
          // Если preferences еще не загружены, просто используем false (не делаем API вызов)
          // Preferences будут загружены вместе с анкетой в loadQuestionnaire
          const isRetakingFromStorage = userPreferencesData?.isRetakingQuiz ?? false;
          const fullRetakeFromHome = userPreferencesData?.fullRetakeFromHome ?? false;
          
          // Если флаги перепрохождения установлены, но профиля нет - очищаем флаги
          // Это может быть остаточный флаг от предыдущей сессии
          if (isRetakingFromStorage || fullRetakeFromHome) {
            try {
              const profile = await api.getCurrentProfile();
              if (!profile || !profile.id) {
                // Профиля нет, но флаги перепрохождения установлены - это ошибка
                clientLogger.log('⚠️ Флаги перепрохождения установлены, но профиля нет - очищаем флаги');
                await userPreferences.setIsRetakingQuiz(false);
                await userPreferences.setFullRetakeFromHome(false);
                // Продолжаем как новый пользователь
                return;
              }
              // Профиль есть - это нормальное перепрохождение
            } catch (profileErr: any) {
              // Профиля нет - очищаем флаги
              const isNotFound = profileErr?.status === 404 || 
                                profileErr?.message?.includes('404') || 
                                profileErr?.message?.includes('No profile') ||
                                profileErr?.message?.includes('Profile not found');
              if (isNotFound) {
                clientLogger.log('⚠️ Профиля нет, но флаги перепрохождения установлены - очищаем флаги');
                try {
                  const { setIsRetakingQuiz, setFullRetakeFromHome } = await import('@/lib/user-preferences');
                  await setIsRetakingQuiz(false);
                  await setFullRetakeFromHome(false);
                } catch (clearError) {
                  // ignore
                }
              }
            }
          }
        } catch (err: any) {
          // Ошибка при проверке флагов - логируем, но не блокируем
          clientLogger.warn('⚠️ Ошибка при проверке флагов перепрохождения:', err?.message);
        }
      };
      
      checkRetakeFlags().catch(() => {});
      
      // ИСПРАВЛЕНО: Проверка профиля и плана теперь происходит на бэкенде в /api/questionnaire/active
      // На фронте только показываем лоадер и загружаем анкету
    }
  }, []);
  
  // ИСПРАВЛЕНО: useEffect для init - делаем "однократным"
  // init запускается ровно тогда, когда поменялся сам init (по сути — при первом маунте и когда questionnaire-логика реально изменилась)
  // ПЕРЕМЕЩЕНО НИЖЕ после определения init
  
  // РЕФАКТОРИНГ: Загрузка предыдущих ответов и синхронизация URL вынесены в отдельные хуки

  // Корректируем currentQuestionIndex после восстановления прогресса
  // Это важно, потому что после фильтрации вопросов индекс может стать невалидным
  // ПЕРЕМЕЩЕНО НИЖЕ после объявления allQuestions

  // Загружаем сохранённый прогресс из localStorage (fallback)

  // Загружаем предыдущие ответы для повторного прохождения анкеты

  // Загружаем прогресс с сервера (синхронизация между устройствами)
  const loadProgressInProgressRef = useRef(false);

  // РЕФАКТОРИНГ: init теперь в useQuizInit
  // УДАЛЕНО: Весь блок кода для init удален, так как он дублирует логику из useQuizInit
  // ПЕРЕМЕЩЕНО: useQuizInit объявлен после loadSavedProgressFromServer (строка 1148)

  // ИСПРАВЛЕНО: useEffect для init - делаем "однократным"
  // КРИТИЧНО: Используем пустой массив зависимостей, чтобы вызывать init() только один раз при монтировании
  // Не зависим от функции init, чтобы избежать множественных вызовов при пересоздании функции
  useEffect(() => {
    isMountedRef.current = true;
    
    // ИСПРАВЛЕНО: Проверяем, не был ли уже вызван init() при монтировании
    // Это предотвращает множественные вызовы даже при перерендере компонента
    // КРИТИЧНО: Проверяем ПЕРЕД установкой флага, чтобы избежать race condition
    // ВАЖНО: Не вызываем init() после resumeQuiz, чтобы не сбросить состояние
    if (resumeCompletedRef.current) {
      clientLogger.log('⛔ useEffect: init() skipped: resumeQuiz already completed, not resetting state');
      return;
    }
    
    if (initCalledRef.current || initInProgressRef.current) {
      clientLogger.log('⛔ useEffect: init() already called or in progress, skipping', {
        initCalled: initCalledRef.current,
        initInProgress: initInProgressRef.current,
        initCompleted: initCompletedRef.current,
      });
      return;
    }
    
    if (initCompletedRef.current && !isStartingOverRef.current && questionnaireRef.current) {
      clientLogger.log('⛔ useEffect: init() already completed with questionnaire, skipping', {
        questionnaireId: questionnaireRef.current?.id,
      });
      return;
    }
    
    // ИСПРАВЛЕНО: Устанавливаем флаг, что init() был вызван ДО вызова функции
    // Это предотвращает race condition, если компонент перерендерится во время выполнения init()
    // КРИТИЧНО: Устанавливаем initCalledRef ПЕРЕД вызовом init(), чтобы другие useEffect не вызвали init() повторно
    // НЕ устанавливаем initInProgressRef здесь - это делает сам init() для правильной логики
    initCalledRef.current = true;
    
    // ✅ Persist init across remounts (ErrorBoundary)
    // ИСПРАВЛЕНО: Используем sessionStorage для предотвращения повторного вызова init() после ремоунта
    // Это критично, так как ErrorBoundary может размонтировать и заново смонтировать компонент
    if (typeof window !== 'undefined') {
      // ФИКС: quiz_init_done НЕ должен быть scoped, иначе ломается логика при смене scope
      // Проверяем также старый scoped ключ для миграции
      const initDoneKeyForCheck = QUIZ_CONFIG.getScopedKey('quiz_init_done', scope);
      const alreadyInit = sessionStorage.getItem('quiz_init_done') === 'true' || 
                         sessionStorage.getItem(initDoneKeyForCheck) === 'true';
      if (alreadyInit) {
        // УБРАНО: Логирование вызывает бесконечные циклы в продакшене
        // if (isDev) {
        //   clientLogger.log('⛔ useEffect: init() skipped: quiz_init_done in sessionStorage');
        // }
        
        // ИСПРАВЛЕНО: Восстанавливаем состояние после ремоунта
        // РЕФАКТОРИНГ: init теперь в useQuizInit, используем его из хука
        // Это критично, так как после ремоунта из-за ErrorBoundary состояние теряется
        try {
          // ИСПРАВЛЕНО: Восстанавливаем questionnaire из ref/State Machine после ремоунта
          // Это предотвращает потерю allQuestions, когда questionnaire временно становится null
          if (!questionnaire && (questionnaireRef.current || quizStateMachine.questionnaire)) {
            const restoredQuestionnaire = questionnaireRef.current || quizStateMachine.questionnaire;
            if (restoredQuestionnaire) {
              clientLogger.log('🔄 Восстанавливаем questionnaire из ref/State Machine после ремоунта', {
                questionnaireId: restoredQuestionnaire.id,
                fromRef: !!questionnaireRef.current,
                fromStateMachine: !!quizStateMachine.questionnaire,
              });
              setQuestionnaire(restoredQuestionnaire);
              // Также обновляем State Machine, если questionnaire был только в ref
              if (!quizStateMachine.questionnaire && questionnaireRef.current) {
                setQuestionnaireInStateMachine(questionnaireRef.current);
              }
            }
          }
          
          // Восстанавливаем currentQuestionIndex из sessionStorage
          // ИСПРАВЛЕНО: Проверяем, что индекс не выходит за границы allQuestions
          // КРИТИЧНО: НЕ восстанавливаем индекс, если прогресс еще загружается или есть сохраненный прогресс с >= 2 ответами
          // Это предотвращает восстановление индекса до загрузки savedProgress из React Query,
          // что может скрыть резюм-экран
          const hasSavedProgress = savedProgress && savedProgress.answers && Object.keys(savedProgress.answers).length >= QUIZ_CONFIG.VALIDATION.MIN_ANSWERS_FOR_PROGRESS_SCREEN;
          // ИСПРАВЛЕНО: Восстанавливаем по коду вопроса вместо индекса для стабильности
          // ФИКС: Используем scoped ключ вместо не-scoped
          const savedQuestionCode = sessionStorage.getItem(scopedStorageKeys.CURRENT_QUESTION_CODE);
          if (savedQuestionCode && !isLoadingProgress && !hasSavedProgress) {
            // Ищем вопрос по коду
            const currentAllQuestions = allQuestionsPrevRef.current.length > 0 ? allQuestionsPrevRef.current : allQuestions;
            const questionIndex = currentAllQuestions.findIndex(q => q.code === savedQuestionCode);

            if (questionIndex >= 0) {

              // ИСПРАВЛЕНО: Устанавливаем индекс сразу, если allQuestions уже загружен
              // Иначе используем setTimeout для проверки после пересчета
              if (currentAllQuestions.length > 0) {
                setCurrentQuestionIndex(questionIndex);
                clientLogger.log('🔄 Восстанавливаем currentQuestionIndex из sessionStorage (синхронно)', {
                  questionIndex: questionIndex,
                  allQuestionsLength: currentAllQuestions.length,
                  isLoadingProgress,
                  hasSavedProgress,
                });
              } else {
                // КРИТИЧНО: Если allQuestions еще не загружен, НЕ устанавливаем индекс в 0
                // Вместо этого ждем, пока вопросы загрузятся, и восстанавливаем индекс в useEffect в useQuizEffects
                // Это исправляет проблему, когда после перезагрузки индекс сбрасывается на 0
                // до того, как вопросы загружены
                clientLogger.log('⏸️ Пропускаем восстановление currentQuestionIndex: вопросы еще не загружены', {
                  savedIndex: questionIndex,
                  allQuestionsLength: currentAllQuestions.length,
                });
              }
            }
          }
          
          // Восстанавливаем currentInfoScreenIndex из sessionStorage
          // КРИТИЧНО: НЕ восстанавливаем, если пользователь активно проходит анкету
          // Это предотвращает сброс индекса во время активного прохождения
          const savedInfoScreenIndex = sessionStorage.getItem(scopedStorageKeys.CURRENT_INFO_SCREEN);
          if (savedInfoScreenIndex !== null) {
            const infoScreenIndex = parseInt(savedInfoScreenIndex, 10);
            if (!isNaN(infoScreenIndex) && infoScreenIndex >= 0) {
              // КРИТИЧНО: НЕ восстанавливаем, если текущий индекс больше сохраненного
              // Это означает, что пользователь уже продвинулся дальше
              // Также не восстанавливаем, если пользователь активно проходит анкету
              const initialInfoScreens = getInitialInfoScreens();
              const isActivelyOnInfoScreens = currentInfoScreenIndex > 0 && currentInfoScreenIndex < initialInfoScreens.length;
              const isOnQuestions = currentInfoScreenIndex >= initialInfoScreens.length;
              
              // Восстанавливаем только если:
              // 1. Текущий индекс равен 0 (начало) ИЛИ
              // 2. Сохраненный индекс больше текущего (пользователь вернулся назад) ИЛИ
              // 3. Пользователь не активно проходит анкету
              const shouldRestore = currentInfoScreenIndex === 0 || 
                                   infoScreenIndex > currentInfoScreenIndex || 
                                   (!isActivelyOnInfoScreens && !isOnQuestions);
              
              if (shouldRestore) {
                clientLogger.log('🔄 Восстанавливаем currentInfoScreenIndex из sessionStorage', { 
                  savedIndex: infoScreenIndex,
                  currentIndex: currentInfoScreenIndex,
                  isActivelyOnInfoScreens,
                  isOnQuestions,
                });
                setCurrentInfoScreenIndex(infoScreenIndex);
                currentInfoScreenIndexRef.current = infoScreenIndex;
              } else {
                clientLogger.log('⏸️ Пропускаем восстановление currentInfoScreenIndex - пользователь активно проходит анкету', {
                  savedIndex: infoScreenIndex,
                  currentIndex: currentInfoScreenIndex,
                  isActivelyOnInfoScreens,
                  isOnQuestions,
                });
              }
            }
          }
          
          // ФИКС C: Восстановление answers из React Query кэша (часть restore pipeline)
          // TODO: Вынести весь restore pipeline в отдельный хук с четким порядком:
          // 1. Определить scope
          // 2. Загрузить questionnaire
          // 3. Загрузить progress
          // 4. Вычислить allQuestions
          // 5. Выставить индексы
          // 6. Только потом разрешать авто-сабмит
          // Это предотвратит гонки между восстановлением answers, коррекцией индексов и авто-сабмитом
          // ИСПРАВЛЕНО: Загружаем ответы из API после ремоунта
          // Это критично, так как после ремоунта состояние теряется, но данные остаются на сервере
          // ВАЖНО: Сначала проверяем React Query кэш (синхронно), затем загружаем через API если нужно
          if (typeof window !== 'undefined' && window.Telegram?.WebApp?.initData) {
            // ФИКС: Если прогресс очищен, не восстанавливаем его из кэша
            if (isProgressCleared) {
              clientLogger.log('🚫 Восстановление прогресса заблокировано - прогресс был очищен');
              return;
            }

            // ИСПРАВЛЕНО: Сначала проверяем React Query кэш (это синхронно, если кэш уже загружен)
            if (quizProgressFromQuery?.progress?.answers && Object.keys(quizProgressFromQuery.progress.answers).length > 0) {
              const progressAnswers = quizProgressFromQuery.progress.answers;
              clientLogger.log('🔄 Восстанавливаем ответы из React Query кэша после ремоунта', {
                answersCount: Object.keys(progressAnswers).length,
              });
              setAnswers(progressAnswers);
              setSavedProgress({
                answers: progressAnswers,
                questionIndex: quizProgressFromQuery.progress.questionIndex || 0,
                infoScreenIndex: quizProgressFromQuery.progress.infoScreenIndex || 0,
              });
            } else if (!isLoadingProgress) {
              // Если React Query не загружает и данных нет, используем прямой API вызов
              // ИСПРАВЛЕНО: Загружаем асинхронно, но это нормально - allQuestions использует savedProgress?.answers
              (async () => {
                try {
                  const response = await api.getQuizProgress() as {
                    progress?: {
                      answers: Record<number, string | string[]>;
                      questionIndex: number;
                      infoScreenIndex: number;
                    } | null;
                  };
                  if (response?.progress?.answers && Object.keys(response.progress.answers).length > 0) {
                    clientLogger.log('🔄 Восстанавливаем ответы из API после ремоунта (fallback)', {
                      answersCount: Object.keys(response.progress.answers).length,
                    });
                    setAnswers(response.progress.answers);
                    setSavedProgress({
                      answers: response.progress.answers,
                      questionIndex: response.progress.questionIndex || 0,
                      infoScreenIndex: response.progress.infoScreenIndex || 0,
                    });
                  }
                } catch (err) {
                  clientLogger.warn('⚠️ Ошибка при загрузке прогресса из API после ремоунта:', err);
                }
              })();
            }
          }
        } catch (restoreError) {
          clientLogger.warn('⚠️ Ошибка при восстановлении состояния из sessionStorage:', restoreError);
        }
        
        return;
      }
      // УБРАНО: quiz_init_done теперь устанавливается внутри init() после успешной загрузки анкеты
      // Это предотвращает установку флага до реальной загрузки данных
    }
    
    clientLogger.log('🚀 useEffect: calling init()', {
      initCalled: initCalledRef.current,
      initInProgress: initInProgressRef.current,
      initCompleted: initCompletedRef.current,
    });
    
    // ИСПРАВЛЕНО: Вызываем init() напрямую, не через зависимость
    // Это гарантирует, что init() будет вызван только один раз при монтировании
    init(); // РЕФАКТОРИНГ: init теперь в useQuizInit, используется из хука

    return () => {
      isMountedRef.current = false;
      // ИСПРАВЛЕНО: НЕ сбрасываем initCalledRef и initInProgressRef при размонтировании
      // Это предотвращает повторные вызовы init() при перемонтировании компонента
      // Если компонент размонтировался и монтируется снова, init() не должен вызываться повторно
      // если он уже был вызван и завершен
    };
  }, []); // ИСПРАВЛЕНО: Пустой массив зависимостей - вызываем только один раз при монтировании

  // ИСПРАВЛЕНО: Синхронизация questionnaireRef с state для предотвращения рассинхронизации
  // Это гарантирует, что ref всегда содержит актуальное значение state
  useEffect(() => {
    if (questionnaire) {
      // Обновляем ref только если state изменился и отличается от ref
      if (questionnaireRef.current?.id !== questionnaire.id) {
        questionnaireRef.current = questionnaire;
        clientLogger.log('🔄 questionnaireRef synchronized with state', {
          questionnaireId: questionnaire.id,
        });
      }
      // ИСПРАВЛЕНО: Сбрасываем таймер когда анкета загружена
      if (initCompletedTimeRef.current) {
        clientLogger.log('✅ Questionnaire loaded, clearing fallback loader timer');
        initCompletedTimeRef.current = null;
      }
    }
  }, [questionnaire?.id]);

  // ФИКС C: Восстановление теперь управляется через useQuizRestorePipeline
  // Старая логика восстановления удалена - все восстановление происходит в правильном порядке в хуке

  // ИСПРАВЛЕНО: Проверка профиля и определение isRetakingQuiz/showRetakeScreen
  // Вынесено в отдельный useEffect после завершения init
  // УБРАНО ДУБЛИРОВАНИЕ: проверка профиля уже есть в init(), поэтому здесь только устанавливаем флаги на основе уже загруженных данных
  useEffect(() => {
    if (!questionnaire || loading) return;
    if (isStartingOverRef.current) return;
    if (typeof window === 'undefined' || !window.Telegram?.WebApp?.initData) return;
    if (profileCheckInProgressRef.current) return;
    // ИСПРАВЛЕНО: Не проверяем профиль здесь, так как это уже сделано в init()
    // Просто устанавливаем флаги на основе сохраненных данных
    if (savedProgress && savedProgress.answers && Object.keys(savedProgress.answers).length > 0) {
      // Есть сохраненный прогресс - это не новый пользователь
      // Флаги isRetakingQuiz и showRetakeScreen уже установлены в init() или в других useEffect
      return;
    }
    // Для нового пользователя без сохраненного прогресса флаги уже установлены в init()
    // Не нужно делать дополнительные проверки
  }, [questionnaire?.id, loading, savedProgress?.answers ? Object.keys(savedProgress.answers).length : 0]);

  // УДАЛЕНО: Загрузка анкеты теперь происходит в init(), этот useEffect больше не нужен

  // РЕФАКТОРИНГ: Функция вынесена в lib/quiz/handlers/loadSavedProgress.ts
  const loadSavedProgressFromServer = async () => {
    return loadSavedProgressFromServerFn({
      currentInfoScreenIndexRef,
      currentQuestionIndexRef,
      hasResumedRef,
      isStartingOverRef,
      progressLoadedRef,
      loadProgressInProgressRef,
      progressLoadInProgressRef,
      currentInfoScreenIndex,
      currentQuestionIndex,
      hasResumed,
      isStartingOver,
      allQuestions,
      savedProgress,
      showResumeScreen,
      setCurrentInfoScreenIndex,
      setCurrentQuestionIndex,
      setSavedProgress,
      setShowResumeScreen,
      setLoading,
      quizProgressFromQuery,
      isLoadingProgress,
    });
  };

  // РЕФАКТОРИНГ: Функции инициализации теперь в useQuizInit
  // ИСПРАВЛЕНО: Обернуто в useCallback для предотвращения пересоздания функции
  // Это критично, чтобы предотвратить множественные вызовы из разных мест
  // РЕФАКТОРИНГ: Функция вынесена в lib/quiz/loadQuestionnaire.ts
  const loadQuestionnaire = useCallback(async () => {
    return loadQuestionnaireFn({
      // ИСПРАВЛЕНО: Используем setQuestionnaireWithStateMachine для защиты от случайного сброса
      setQuestionnaire: setQuestionnaireWithStateMachine,
      questionnaireRef,
      loadQuestionnaireInProgressRef,
      loadQuestionnaireAttemptedRef,
      redirectInProgressRef,
      initCompletedRef,
      setInitCompleted,
      questionnaire,
      loading,
      error,
        isRetakingQuiz,
        showRetakeScreen,
      savedProgress,
          currentQuestionIndex,
          hasResumed,
      setLoading,
      setError,
      setCurrentQuestionIndex,
      setUserPreferencesData,
      setIsRetakingQuiz,
      setShowRetakeScreen,
      setHasRetakingPayment,
      setHasFullRetakePayment,
      isDev,
      userPreferences,
      addDebugLog,
    });
  }, [isDev, isRetakingQuiz, showRetakeScreen, questionnaire?.id, loading, error, savedProgress?.answers ? Object.keys(savedProgress.answers).length : 0, currentQuestionIndex, hasResumed]);
  
  // РЕФАКТОРИНГ: Старая реализация удалена (вынесена в lib/quiz/handlers/loadSavedProgress.ts)

  // РЕФАКТОРИНГ: Функции вынесены в lib/quiz/handlers/saveProgress.ts и lib/quiz/handlers/clearProgress.ts
  // Создаем функции saveProgress и clearProgress используя фабрики
  const saveProgress = useMemo(() => createSaveProgress({
    questionnaire,
    currentQuestionIndexRef,
    currentInfoScreenIndexRef,
    saveQuizProgressMutation,
    pendingProgressRef,
    saveProgressTimeoutRef,
    isDev,
  }), [questionnaire, currentQuestionIndexRef, currentInfoScreenIndexRef, saveQuizProgressMutation, pendingProgressRef, saveProgressTimeoutRef, isDev]);

  const clearProgress = useMemo(() => createClearProgress({
    setSavedProgress,
    setShowResumeScreen,
    hasResumedRef,
    setHasResumed,
    lastSavedAnswerRef,
  }), [setSavedProgress, setShowResumeScreen, hasResumedRef, setHasResumed, lastSavedAnswerRef]);

  
  // УДАЛЕНО: loadQuestionnaireRef больше не нужен, функция передается напрямую

  // РЕФАКТОРИНГ: Функция вынесена в lib/quiz/handlers/handleAnswer.ts
  const handleAnswer = async (questionId: number, value: string | string[]) => {
    // ФИКС: При первом ответе снимаем флаг блокировки восстановления прогресса
    // Это позволяет нормально работать с прогрессом после "Начать заново"
    if (typeof window !== 'undefined') {
      const progressClearedKey = QUIZ_CONFIG.getScopedKey('quiz_progress_cleared', scope);
      if (sessionStorage.getItem(progressClearedKey) === 'true') {
        sessionStorage.removeItem(progressClearedKey);
        clientLogger.log('🔓 Снят флаг блокировки восстановления прогресса - пользователь начал новую анкету');
      }
    }

    // ФИКС: Синхронно обновляем answersRef перед вызовом handleAnswerFn
    // Это предотвращает залипание на вопросе после изменения ответа (возраст/пол)
    answersRef.current = { ...answersRef.current, [questionId]: value };
    answersCountRef.current = Object.keys(answersRef.current).length;

    return handleAnswerFn({
      questionId,
      value,
      currentQuestion,
      answers,
      allQuestions,
      questionnaire,
      setAnswers,
      saveProgress,
      currentQuestionIndex,
      currentInfoScreenIndex,
      saveQuizProgressMutation,
      lastSavedAnswerRef,
      answersRef, // ИСПРАВЛЕНО: Передаем ref для синхронного обновления
      addDebugLog,
      // ФИКС: Параметры для нормализации индекса после изменения фильтрующих вопросов
      setCurrentQuestionIndex,
      currentQuestionIndexRef,
      scopedStorageKeys,
      scope,
    });
  };

  // РЕФАКТОРИНГ: Функция вынесена в lib/quiz/handlers/handleNext.ts
  const handleNext = async () => {
    return handleNextFn({
      handleNextInProgressRef,
      currentInfoScreenIndexRef,
      currentQuestionIndexRef,
      questionnaireRef,
      initCompletedRef,
      answersRef, // ИСПРАВЛЕНО: Передаем ref для проверки актуального ответа
      questionnaire,
        loading,
        currentInfoScreenIndex,
        currentQuestionIndex,
      allQuestions,
        isRetakingQuiz,
        showRetakeScreen,
        hasResumed,
      pendingInfoScreen,
      pendingInfoScreenRef: quizState.pendingInfoScreenRef,
      answers,
      setIsHandlingNext,
      setCurrentInfoScreenIndex,
      setCurrentQuestionIndex,
      setPendingInfoScreen,
      setError,
      saveProgress,
      loadQuestionnaire,
      initInProgressRef,
      setLoading,
      isDev,
    });
  };

  // РЕФАКТОРИНГ: Функция вынесена в lib/quiz/handlers/handleBack.ts
  const handleBack = () => {
    return handleBackFn({
      currentInfoScreenIndex,
      currentQuestionIndex,
      questionnaire,
      questionnaireRef,
      pendingInfoScreen,
      currentInfoScreenIndexRef,
      allQuestions, // ИСПРАВЛЕНО: Передаем allQuestions для поиска вопроса по коду
      setCurrentInfoScreenIndex,
      setCurrentQuestionIndex,
      setPendingInfoScreen,
      saveProgress,
      answers,
      setAnswers, // ИСПРАВЛЕНО: Передаем setAnswers для сброса ответа при переходе назад
    });
  };

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      // Очищаем таймаут редиректа при размонтировании компонента
      if (redirectTimeoutRef.current) {
        clearTimeout(redirectTimeoutRef.current);
        redirectTimeoutRef.current = null;
      }
    };
  }, []);

  // РЕФАКТОРИНГ: getInitData теперь в useQuizInit
  // УДАЛЕНО: Весь блок кода для getInitData удален, так как он дублирует логику из useQuizInit


  // ФИКС: Полностью переводим submitAnswers на refs для избежания устаревших значений
  // Это критично, так как submitAnswers может вызываться асинхронно после изменения state
  // ФИКС: Добавляем ref для isRetakingQuiz, чтобы избежать stale closure
  const isRetakingQuizRef = useRef(false);
  useEffect(() => {
    isRetakingQuizRef.current = isRetakingQuiz;
  }, [isRetakingQuiz]);

  // ФИКС: Сбрасываем scope при start over для корректного восстановления
  useEffect(() => {
    if (isStartingOver) {
      scopeRef.current = null; // Позволяем пересчитать scope заново
    }
  }, [isStartingOver]);

  const submitAnswers = useCallback(async () => {
    // Получаем актуальные значения ТОЛЬКО из refs
    const currentQuestionnaire = questionnaireRef.current;
    const currentAnswers = answersRef.current || {};
    const currentIsSubmitting = isSubmittingRef.current;
    const currentInitData = initData || null;
    const currentIsRetakingQuiz = isRetakingQuizRef.current; // ФИКС: Используем ref вместо замыкания
    
    await submitAnswersFn({
      questionnaire: currentQuestionnaire,
      answers: currentAnswers,
      isSubmitting: currentIsSubmitting,
      isSubmittingRef,
      isMountedRef,
      isDev,
      initData: currentInitData,
      setAnswers,
      setIsSubmitting,
      setLoading,
      setError,
      setFinalizing,
      setFinalizingStep,
      setFinalizeError,
      redirectInProgressRef,
      submitAnswersRef,
      isRetakingQuiz: currentIsRetakingQuiz,
      getInitData: () => Promise.resolve(currentInitData),
    });
  }, []); // Пустые зависимости - все через refs для стабильности

  // Продолжить с сохранённого места
  const resumeQuiz = () => {
    resumeQuizFn({
      savedProgress,
      questionnaire,
      allQuestions, // ИСПРАВЛЕНО: Передаем allQuestions для определения следующего вопроса
      redirectInProgressRef,
      initCompletedRef,
      setInitCompleted,
      setLoading,
      hasResumed,
      currentInfoScreenIndex,
      currentQuestionIndex,
      hasResumedRef,
      setHasResumed,
      setShowResumeScreen,
      setSavedProgress,
      loadProgressInProgressRef,
      progressLoadInProgressRef,
      setAnswers,
      setCurrentQuestionIndex,
      setCurrentInfoScreenIndex,
      setPendingInfoScreen, // ИСПРАВЛЕНО: Добавлено для очистки pendingInfoScreen при resume
      pendingInfoScreenRef: quizState.pendingInfoScreenRef, // ИСПРАВЛЕНО: Добавлено для синхронной очистки ref
      resumeCompletedRef,
    });
  };

  // Начать заново
  const startOver = async () => {
    await startOverFn({
      scope,
      isStartingOverRef,
      setIsStartingOver,
      initCompletedRef,
      setInitCompleted,
      initCalledRef,
      clearProgress,
      setAnswers,
      answersRef,
      answersCountRef,
      lastRestoredAnswersIdRef,
      setCurrentQuestionIndex,
      setCurrentInfoScreenIndex,
      currentInfoScreenIndexRef,
      setShowResumeScreen,
      hasResumedRef,
      setHasResumed,
      setSavedProgress,
      setPendingInfoScreen,
      setIsRetakingQuiz,
      setShowRetakeScreen,
      firstScreenResetRef,
      setLoading,
      setError,
      setIsProgressCleared,
      questionnaire,
    });
  };


  // ИСПРАВЛЕНО: Убран дублирующий лоадер при isSubmitting
  // Редирект на /plan обрабатывается выше (строка 3967), поэтому этот лоадер не нужен
  // Если isSubmitting === true, мы уже редиректим на /plan, где будет показан правильный лоадер

  // УДАЛЕНО: Дублирующие объявления refs (уже объявлены выше на строках 290, 293)
  // РЕФАКТОРИНГ: Все вычисляемые значения теперь в useQuizComputed
  // УДАЛЕНО: Старые useMemo для allQuestionsRaw, allQuestions, savedProgressAnswersCount, 
  // initialInfoScreens, isShowingInitialInfoScreen, currentQuestion
  // Они теперь вычисляются в useQuizComputed выше
  
  // РЕФАКТОРИНГ: Используем единую функцию из lib/quiz/extractQuestions.ts
  // Локальная функция extractQuestionsFromQuestionnaire удалена, используется импортированная
  
  // УДАЛЕНО: allQuestions useMemo теперь в useQuizComputed
  // Весь блок кода удален, так как он дублирует логику из useQuizComputed
  
  // КРИТИЧНО: Синхронизируем allQuestionsPrevRef с allQuestions после каждого вычисления
  // Это гарантирует, что ref всегда содержит актуальное значение для fallback
  useEffect(() => {
    if (allQuestions.length > 0) {
      allQuestionsPrevRef.current = allQuestions;
      clientLogger.log('💾 allQuestionsPrevRef synced with allQuestions', {
        length: allQuestions.length,
        questionIds: allQuestions.map((q: Question) => q?.id).slice(0, 10),
      });
    }
  }, [allQuestions]);
  
  // УБРАНО: Логирующие useEffect вызывают бесконечные циклы в продакшене
  // useEffect(() => {
  //   if (!isDev) return; // Только в dev режиме
  //   clientLogger.log('📊 allQuestions state updated', {...});
  // }, [allQuestions.length, allQuestionsRaw.length, questionnaire?.id]);

  // useEffect(() => {
  //   if (!isDev) return; // Только в dev режиме
  //   clientLogger.log('📊 allQuestions state', {...});
  // }, [allQuestions.length, allQuestionsRaw.length, isRetakingQuiz, showRetakeScreen, answersCount, savedProgressAnswersCount]);

  // РЕФАКТОРИНГ: Реальная инициализация вместо заглушек
  const init = useCallback(async () => {
    if (initInProgressRef.current) return;
    initInProgressRef.current = true;

    try {
      setLoading(true);

      // 1) Загрузить анкету
      const q = await loadQuestionnaire();
      if (!q) {
        throw new Error('Questionnaire not loaded');
      }

      // 2) Загрузить прогресс (для показа resume screen если нужно)
      await loadSavedProgressFromServer();

      // 3) Пометить инициализацию как завершенную
      initCompletedRef.current = true;
      setInitCompleted(true);

      // 4) Сохранить флаг в sessionStorage ТОЛЬКО после успешной загрузки
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('quiz_init_done', 'true');
      }

      clientLogger.log('✅ init() completed successfully', {
        questionnaireId: q.id,
        questionsCount: q.questions?.length || 0,
      });

    } catch (e: any) {
      setError(e?.message || 'Init failed');
      clientLogger.error('❌ init() failed', e);
    } finally {
      setLoading(false);
      initInProgressRef.current = false;
    }
  }, [loadQuestionnaire, loadSavedProgressFromServer, setLoading, setError, setInitCompleted]);
  
  // РЕФАКТОРИНГ: Используем хук useQuizEffects для группировки всех useEffect
  // Вынесены основные группы эффектов, остальные остаются в компоненте для постепенного рефакторинга
  useQuizEffects({
    questionnaire,
    setQuestionnaire,
    loading,
    setLoading,
    error,
    setError,
    currentInfoScreenIndex,
    setCurrentInfoScreenIndex,
    currentQuestionIndex,
    setCurrentQuestionIndex,
    answers,
    setAnswers,
    showResumeScreen,
    isSubmitting,
    setIsSubmitting,
    savedProgress,
    setSavedProgress,
    isRetakingQuiz,
    showRetakeScreen,
    setHasRetakingPayment,
    setHasFullRetakePayment,
    setPendingInfoScreen,
    userPreferencesData,
    allQuestions,
    allQuestionsRaw,
    pendingInfoScreen,
    autoSubmitTriggered,
    setAutoSubmitTriggered,
    autoSubmitTriggeredRef,
    submitAnswers,
    questionnaireRef,
    currentInfoScreenIndexRef,
    currentQuestionIndexRef,
    hasResumedRef,
    isSubmittingRef,
    isStartingOverRef,
    initCompletedRef,
    setInitCompleted,
    initCalledRef,
    initInProgressRef,
    isMountedRef,
    progressLoadedRef,
    loadProgressInProgressRef,
    progressLoadInProgressRef,
    loadQuestionnaireInProgressRef,
    loadQuestionnaireAttemptedRef,
    redirectInProgressRef,
    profileCheckInProgressRef,
    resumeCompletedRef,
    initCompletedTimeRef,
    allQuestionsPrevRef,
    answersRef,
    answersCountRef,
    lastRestoredAnswersIdRef,
    saveProgressTimeoutRef,
    submitAnswersRef,
    firstScreenResetRef,
    questionnaireFromQuery,
    isLoadingQuestionnaire,
    questionnaireError,
    quizProgressFromQuery,
    isLoadingProgress,
    quizStateMachine,
    setQuestionnaireInStateMachine,
    init,
    loadQuestionnaire,
    loadSavedProgressFromServer,
    isDev,
    hasResumed,
    isStartingOver,
    answersCount,
    scope,
  });

  // ИСПРАВЛЕНО: Обработка edge case - когда allQuestions.length === 0
  // Показываем явное сообщение вместо поломанного UI
  // ФИКС: Не блокируем обработку, если мы на начальных инфо-экранах (анкета может быть пустой)
  useEffect(() => {
    if (loading) return;
    
    // ИСПРАВЛЕНО: На начальных инфо-экранах пустая анкета - это нормально
    // Используем getInitialInfoScreens() напрямую, так как initialInfoScreens объявлен позже
    const initialInfoScreensForCheck = getInitialInfoScreens();
    const isOnInitialInfoScreens = currentInfoScreenIndex < initialInfoScreensForCheck.length;
    if (isOnInitialInfoScreens) {
      return; // На начальных инфо-экранах не проверяем анкету
    }
    
    if (!questionnaire) return;
    
    // ИСПРАВЛЕНО: Если после фильтрации не осталось вопросов, но есть ответы - это проблема
    if (allQuestions.length === 0 && Object.keys(answers).length > 0) {
      clientLogger.error('⚠️ Edge case: allQuestions.length === 0 but answers exist', {
        answersCount: Object.keys(answers).length,
        questionnaireId: questionnaire.id,
        allQuestionsRawLength: questionnaire.groups?.flatMap(g => g.questions || []).length + (questionnaire.questions || []).length,
        isRetakingQuiz,
        showRetakeScreen,
      });
      // Не показываем ошибку пользователю, просто логируем - возможно это временная ситуация
    }
    
    if (allQuestions.length === 0) {
      clientLogger.warn('⚠️ allQuestions.length === 0 после фильтрации', {
        questionnaireId: questionnaire.id,
        allQuestionsRawLength: allQuestionsRaw.length,
        answersCount: Object.keys(answers).length,
        savedProgressAnswersCount: Object.keys(savedProgress?.answers || {}).length,
        isRetakingQuiz,
        showRetakeScreen,
      });
      return;
    }
    
    // ИСПРАВЛЕНО: Проверяем и корректируем currentQuestionIndex, если он выходит за пределы
    // Это может произойти при неправильно сохраненном прогрессе, после фильтрации вопросов или при первой загрузке
    const answersCount = Object.keys(answers).length;
    const isQuizCompleted = allQuestions.length > 0 && answersCount >= allQuestions.length;
    
    // ВАЖНО: currentQuestionIndex === allQuestions.length — это валидное состояние
    // (все вопросы отвечены, автоотправка проверяет `>= allQuestions.length`).
    const isOutOfBounds =
      currentQuestionIndex > allQuestions.length ||
      (currentQuestionIndex === allQuestions.length && !isQuizCompleted) ||
      currentQuestionIndex < 0;
    
    // ИСПРАВЛЕНО: Упрощенная логика восстановления по коду вопроса вместо индекса
    // Это делает восстановление стабильным независимо от порядка вопросов
    if (typeof window !== 'undefined') {
      try {
        const savedQuestionCode = sessionStorage.getItem(scopedStorageKeys.CURRENT_QUESTION_CODE);
        if (savedQuestionCode && !isLoadingProgress) {
          const currentAllQuestions = allQuestionsPrevRef.current.length > 0 ? allQuestionsPrevRef.current : allQuestions;
          const foundIndex = currentAllQuestions.findIndex(q => q.code === savedQuestionCode);

          if (foundIndex >= 0 && foundIndex !== currentQuestionIndex) {
            // Проверяем, что это не активная сессия (чтобы не перебивать текущий прогресс)
            const hasAnswers = Object.keys(answers).length > 0;
            const hasSavedProgress = savedProgress && savedProgress.answers && Object.keys(savedProgress.answers).length >= QUIZ_CONFIG.VALIDATION.MIN_ANSWERS_FOR_PROGRESS_SCREEN;

            if (!hasAnswers && !hasSavedProgress) {
              clientLogger.log('🔄 Восстанавливаем currentQuestionIndex по коду вопроса', {
                savedQuestionCode,
                foundIndex,
                currentQuestionIndex,
              });
              setCurrentQuestionIndex(foundIndex);
              return;
            }
          }
        }
      } catch (err) {
        // Игнорируем ошибки sessionStorage
      }
    }
    
    // ИСПРАВЛЕНО: Корректируем индекс СРАЗУ, если он невалидный
    // КРИТИЧНО: НЕ сбрасываем индекс на 0, если пользователь уже прошел начальные инфо-экраны
    // Это предотвращает сброс индекса после перехода к следующему вопросу
    // ФИКС: НЕ корректируем индексы если hasResumed/isStartingOver/resumeCompleted
    if (isOutOfBounds && !isSubmitting && !shouldShowResume && !hasResumedRef.current && !isStartingOverRef.current && !resumeCompletedRef.current) { // ФИКС: Используем shouldShowResume вместо showResumeScreen
      // Если анкета завершена — держим индекс на allQuestions.length для автоотправки.
      // Иначе корректируем на последний валидный вопрос или на 0 для нового пользователя.
      const hasNoSavedProgress = !savedProgress || !savedProgress.answers || Object.keys(savedProgress.answers).length === 0;
      const hasPassedInitialScreensForCorrection = currentInfoScreenIndex >= initialInfoScreens.length;
      const correctedIndex = isQuizCompleted
        ? allQuestions.length
        : (hasNoSavedProgress && answersCount === 0 && !hasPassedInitialScreensForCorrection ? 0 : Math.max(0, Math.min(currentQuestionIndex, allQuestions.length - 1)));
      
      clientLogger.warn('⚠️ currentQuestionIndex выходит за пределы, корректируем', {
        currentQuestionIndex,
        allQuestionsLength: allQuestions.length,
        correctedIndex,
        answersCount,
        isQuizCompleted,
        isSubmitting,
        hasResumed,
        showResumeScreen,
        isRetakingQuiz,
        showRetakeScreen,
        hasQuestionnaire: !!questionnaire,
        hasNoSavedProgress,
        hasPassedInitialScreensForCorrection,
        currentInfoScreenIndex,
        allQuestionsRawLength: allQuestionsRaw.length,
      });
      
      // КРИТИЧНО: Используем setTimeout, чтобы избежать обновления state во время рендера
      // Но только если индекс действительно нужно изменить
      if (correctedIndex !== currentQuestionIndex) {
        setTimeout(() => {
          setCurrentQuestionIndex(correctedIndex);
        }, 0);
      }
      return;
    }
  }, [questionnaire?.id, allQuestions.length, currentQuestionIndex, isSubmitting, loading, hasResumed, showResumeScreen, Object.keys(answers).length, savedProgress?.answers ? Object.keys(savedProgress.answers).length : 0, isRetakingQuiz, showRetakeScreen, allQuestionsRaw.length]);

  // Корректируем currentQuestionIndex после восстановления прогресса
  // Это важно, потому что после фильтрации вопросов индекс может стать невалидным
  // ФИКС: Не блокируем обработку, если мы на начальных инфо-экранах
  useEffect(() => {
    // ИСПРАВЛЕНО: На начальных инфо-экранах не проверяем анкету
    // Используем getInitialInfoScreens() напрямую, так как initialInfoScreens объявлен позже
    const initialInfoScreensForCheck = getInitialInfoScreens();
    const isOnInitialInfoScreens = currentInfoScreenIndex < initialInfoScreensForCheck.length;
    if (isOnInitialInfoScreens) {
      return; // На начальных инфо-экранах не корректируем currentQuestionIndex
    }
    
    if (!questionnaire || allQuestions.length === 0) return;
    
    // ИСПРАВЛЕНО: Проверяем, что currentQuestionIndex валиден для текущего allQuestions
    // Это важно после изменения фильтрации (например, после ответа на вопрос про бюджет)
    // Проверяем независимо от hasResumed, так как фильтрация может измениться в любой момент
    const answersCount = Object.keys(answers).length;
    const isQuizCompleted = allQuestions.length > 0 && answersCount >= allQuestions.length;
    
    const isOutOfBounds =
      currentQuestionIndex > allQuestions.length ||
      (currentQuestionIndex === allQuestions.length && !isQuizCompleted);
    
    // ФИКС: НЕ корректируем индексы если hasResumed/isStartingOver/resumeCompleted
    if (isOutOfBounds && !isSubmitting && !shouldShowResume && !hasResumedRef.current && !isStartingOverRef.current && !resumeCompletedRef.current) { // ФИКС: Используем shouldShowResume вместо showResumeScreen
      const correctedIndex = isQuizCompleted
        ? allQuestions.length
        : (allQuestions.length > 0 ? Math.max(0, allQuestions.length - 1) : 0);
      
      clientLogger.warn('⚠️ currentQuestionIndex выходит за пределы после фильтрации, корректируем', {
        currentQuestionIndex,
        allQuestionsLength: allQuestions.length,
        correctedIndex,
        answersCount,
        isQuizCompleted,
        hasResumed,
        isRetakingQuiz,
        showRetakeScreen,
        questionIds: allQuestions.map((q: Question) => q.id),
      });
      setCurrentQuestionIndex(correctedIndex);
      return;
    }
    
    // ИСПРАВЛЕНО: Проверяем, что текущий вопрос существует в allQuestions
    // Если вопрос был отфильтрован, корректируем индекс
    // ФИКС: НЕ корректируем индексы если hasResumed/isStartingOver/resumeCompleted
    const currentQuestionInAllQuestions = allQuestions[currentQuestionIndex];
    if (!currentQuestionInAllQuestions && allQuestions.length > 0 && !hasResumedRef.current && !isStartingOverRef.current && !resumeCompletedRef.current) {
      clientLogger.warn('⚠️ Текущий вопрос не найден в allQuestions, корректируем индекс', {
        currentQuestionIndex,
        allQuestionsLength: allQuestions.length,
        allQuestionIds: allQuestions.map((q: Question) => q.id),
      });
      
      // Корректируем на последний валидный индекс
      const correctedIndex = Math.max(0, allQuestions.length - 1);
      setCurrentQuestionIndex(correctedIndex);
      return;
    }
    
    // Также убеждаемся, что мы не на начальных экранах после восстановления
    // ФИКС: Начальные экраны - это только те, которые не имеют showAfterQuestionCode И не имеют showAfterInfoScreenId
              const initialInfoScreens = getInitialInfoScreens();
    if (hasResumed && currentInfoScreenIndex < initialInfoScreens.length && currentQuestionIndex > 0) {
      clientLogger.log('✅ Корректируем infoScreenIndex после восстановления');
      setCurrentInfoScreenIndex(initialInfoScreens.length);
    }
  }, [hasResumed, allQuestions.length, currentQuestionIndex, questionnaire?.id]); // ИСПРАВЛЕНО: Стабильные примитивные зависимости

  // При повторном прохождении сразу переходим к вопросам
  // ВАЖНО: Эта логика должна выполняться только один раз при инициализации, а не при каждом рендере
  // Также не должна выполняться, если пользователь продолжает анкету (showResumeScreen был показан)
  // ВАЖНО: Этот useEffect должен быть ВСЕГДА вызван, даже если есть ранние return'ы, чтобы соблюдать порядок хуков
  useEffect(() => {
    // ИСПРАВЛЕНО: Используем единую функцию для получения начальных инфо-экранов
    const initialInfoScreens = getInitialInfoScreens();
    
    // Пропускаем, если пользователь продолжает анкету (не повторное прохождение)
    // savedProgress или hasResumed означает, что пользователь нажал "Продолжить" и мы не должны сбрасывать состояние
    if (showResumeScreen || savedProgress || hasResumed) {
      return;
    }
    
    // Пропускаем, если уже на вопросах или если нет анкеты
    if (!isRetakingQuiz || !questionnaire || currentInfoScreenIndex >= initialInfoScreens.length) {
      return;
    }
    
    // Пропускаем, если уже не на первом вопросе (пользователь уже начал отвечать)
    // Или если есть сохраненные ответы (пользователь уже отвечал)
    if (currentQuestionIndex > 0 || Object.keys(answers).length > 0) {
      return;
    }
    
    // Получаем все вопросы с фильтрацией
    // ИСПРАВЛЕНО: Добавляем проверку на существование groups и questions
    const groups = questionnaire.groups || [];
    const questions = questionnaire.questions || [];
    const allQuestionsRaw = [
      ...groups.flatMap((g) => g.questions || []),
      ...questions,
    ];
    
    // ИСПРАВЛЕНО: Используем единую функцию filterQuestions вместо дублирующей логики
    // В этом контексте savedProgress уже проверен выше (если он есть, мы return), поэтому он null здесь
    const allQuestions = filterQuestions({
      questions: allQuestionsRaw,
      answers,
      savedProgressAnswers: undefined, // В этом контексте savedProgress всегда null (проверено выше)
      isRetakingQuiz,
      showRetakeScreen,
      logger: clientLogger, // Передаем clientLogger для логирования
    });
    
    // ВАЖНО: При полном перепрохождении (isRetakingQuiz && !showRetakeScreen) пропускаем все инфо-экраны
    // Это включает как начальные инфо-экраны, так и инфо-экраны между вопросами
    if (allQuestions.length > 0 && isRetakingQuiz && !showRetakeScreen) {
      // Переходим сразу к первому вопросу, пропуская все начальные инфо-экраны
      // ФИКС: Начальные экраны - это только те, которые не имеют showAfterQuestionCode И не имеют showAfterInfoScreenId
      const initialInfoScreensCount = getInitialInfoScreens().length;
      // ВАЖНО: Всегда устанавливаем currentInfoScreenIndex в initialInfoScreensCount при перепрохождении
      // Это гарантирует, что начальные инфо-экраны не будут показаны
      // ИСПРАВЛЕНО: Используем функциональное обновление, чтобы избежать stale closure
      setCurrentInfoScreenIndex((prev) => {
        if (prev < initialInfoScreensCount) {
          clientLogger.log('✅ Full retake: Setting currentInfoScreenIndex to skip all initial info screens');
          return initialInfoScreensCount;
        }
        return prev;
      });
      // Если currentQuestionIndex = 0 и нет ответов, это начало перепрохождения
      if (currentQuestionIndex === 0 && Object.keys(answers).length === 0) {
        setCurrentQuestionIndex(0);
        setPendingInfoScreen(null); // Очищаем pending info screen
        clientLogger.log('✅ Full retake: Starting from first question, skipping all info screens');
      }
    }
  }, [isRetakingQuiz, questionnaire?.id, currentQuestionIndex, showResumeScreen, savedProgress?.answers ? Object.keys(savedProgress.answers).length : 0, hasResumed, Object.keys(answers).length, showRetakeScreen]); // ИСПРАВЛЕНО: Стабильные зависимости

  // РЕФАКТОРИНГ: initialInfoScreens теперь в useQuizComputed

  // ФИКС: Принудительная проверка после завершения всех начальных экранов
  // Это предотвращает застревание на info screens
  // ВАЖНО: Не выполняем, если hasResumed = true, чтобы не сбрасывать состояние после resumeQuiz
  useEffect(() => {
    if (currentInfoScreenIndex >= initialInfoScreens.length && !isRetakingQuiz && !showResumeScreen && !hasResumed && !resumeCompletedRef.current && !infoIndexRestoredRef.current) {
      // ИСПРАВЛЕНО: Очищаем pendingInfoScreen только если currentQuestionIndex = 0 (еще не начали отвечать на вопросы)
      // Это предотвращает очистку pendingInfoScreen, который показывается между вопросами
      // pendingInfoScreen между вопросами должен очищаться только в handleNext при переходе к следующему вопросу
      if (pendingInfoScreen && currentQuestionIndex === 0) {
        if (isDev) {
          clientLogger.warn('🔧 ФИКС: Очищаем pendingInfoScreen после завершения всех начальных экранов (еще не начали отвечать)', {
            currentInfoScreenIndex,
            initialInfoScreensLength: initialInfoScreens.length,
            pendingInfoScreenId: pendingInfoScreen.id,
            currentQuestionIndex,
          });
        }
        setPendingInfoScreen(null);
      }
      // Если currentQuestionIndex не установлен, но есть вопросы - устанавливаем на 0
      if (currentQuestionIndex === 0 && allQuestions.length > 0 && Object.keys(answers).length === 0) {
        if (isDev) {
          clientLogger.log('🔧 ФИКС: Убеждаемся, что currentQuestionIndex = 0 для нового пользователя', {
            currentQuestionIndex,
            allQuestionsLength: allQuestions.length,
          });
        }
        setCurrentQuestionIndex(0);
      }
    }
    
    // ФИКС: Если savedProgress не загрузился (null), но currentQuestionIndex > 0 - сбрасываем на 0
    // Это предотвращает застревание, когда прогресс не загрузился из-за KV ошибки
    // ВАЖНО: Не выполняем, если resumeQuiz уже выполнен, чтобы не сбрасывать состояние после resumeQuiz
    if (!savedProgress && !hasResumed && !showResumeScreen && !isRetakingQuiz && !loading && questionnaire && !resumeCompletedRef.current && !infoIndexRestoredRef.current) {
      if (currentQuestionIndex > 0 && currentQuestionIndex >= allQuestions.length && allQuestions.length > 0) {
        if (isDev) {
          clientLogger.warn('🔧 ФИКС: savedProgress = null, но currentQuestionIndex выходит за пределы - сбрасываем на 0', {
            currentQuestionIndex,
            allQuestionsLength: allQuestions.length,
            savedProgress: null,
          });
        }
        setCurrentQuestionIndex(0);
        // Если мы на начальных экранах, но индекс уже прошел их - пропускаем начальные экраны
        if (currentInfoScreenIndex < initialInfoScreens.length) {
          setCurrentInfoScreenIndex(initialInfoScreens.length);
        }
      }
    }
    
    // ИСПРАВЛЕНО: Убрана логика автоматического пропуска начальных инфо-экранов для нового пользователя
    // Теперь начальные инфо-экраны всегда показываются для нового пользователя
    // Пользователь должен пройти все начальные инфо-экраны, нажимая "Продолжить"
    // Это обеспечивает правильный UX - пользователь видит все начальные экраны перед началом вопросов
  }, [currentInfoScreenIndex, initialInfoScreens.length, pendingInfoScreen?.id, isRetakingQuiz, showResumeScreen, hasResumed, currentQuestionIndex, allQuestions.length, Object.keys(answers).length, isDev, savedProgress?.answers ? Object.keys(savedProgress.answers).length : 0, loading, questionnaire?.id, infoIndexRestoredRef.current]); // ИСПРАВЛЕНО: Убрали функции из зависимостей

  // РЕФАКТОРИНГ: isShowingInitialInfoScreen, currentInitialInfoScreen, currentQuestion теперь в useQuizComputed
  // УДАЛЕНО: Весь блок кода для isShowingInitialInfoScreen, currentInitialInfoScreen и currentQuestion
  // удален, так как он дублирует логику из useQuizComputed
  
  // ВАЖНО: Обновляем ref для submitAnswers, чтобы она была доступна в setTimeout

  // ВАЖНО: Обновляем ref для submitAnswers, чтобы она была доступна в setTimeout
  useEffect(() => {
    submitAnswersRef.current = submitAnswers;
  }, [submitAnswers]);
  
  // ИСПРАВЛЕНО: Проверяем entitlements через API вместо localStorage
  // Это более надежно и работает после перезагрузки страницы
  // ВАЖНО: Этот useEffect должен быть ВСЕГДА вызван ДО ранних return'ов, чтобы соблюдать порядок хуков
  useEffect(() => {
    if (showRetakeScreen && isRetakingQuiz) {
      const checkEntitlements = async () => {
        try {
          const entitlements = await api.getEntitlements();
          const hasRetakeTopic = entitlements?.entitlements?.some(
            (e: any) => e.code === 'retake_topic_access' && e.active === true
          ) || false;
          const hasRetakeFull = entitlements?.entitlements?.some(
            (e: any) => e.code === 'retake_full_access' && e.active === true
          ) || false;
          setHasRetakingPayment(hasRetakeTopic);
          setHasFullRetakePayment(hasRetakeFull);
          clientLogger.log('✅ Entitlements checked for retake screen', {
            hasRetakeTopic,
            hasRetakeFull,
          });
        } catch (err) {
          clientLogger.warn('⚠️ Failed to check entitlements for retake screen', err);
          // Fallback на preferences из state (не делаем API вызов)
          // Preferences будут загружены вместе с анкетой в loadQuestionnaire
          const hasRetaking = userPreferencesData?.paymentRetakingCompleted ?? false;
          const hasFullRetake = userPreferencesData?.paymentFullRetakeCompleted ?? false;
          setHasRetakingPayment(hasRetaking);
          setHasFullRetakePayment(hasFullRetake);
        }
      };
      checkEntitlements();
    }
  }, [showRetakeScreen, isRetakingQuiz]);
  
  // ВАЖНО: Автоматически отправляем ответы когда все вопросы отвечены
  // Этот useEffect должен быть ВСЕГДА вызван, даже если есть ранние return'ы, чтобы соблюдать порядок хуков
  // ВАЖНО: Используем submitAnswersRef вместо submitAnswers в зависимостях, чтобы избежать проблем с порядком хуков
  // ИСПРАВЛЕНО: Убрали проверку !hasResumed, так как она может блокировать отправку после завершения анкеты
  useEffect(() => {
    // ИСПРАВЛЕНО: Не запускаем автоотправку до завершения init()
    // Это предотвращает показ планового лоадера для нового пользователя
    if (!initCompletedRef.current) {
      return;
    }
    
    // Автоматически отправляем ответы, если все вопросы отвечены и ответы есть
    // ИСПРАВЛЕНО: Убрали !hasResumed из условий, чтобы автоотправка работала даже после восстановления прогресса
    if (!autoSubmitTriggeredRef.current && 
        questionnaire && 
        allQuestions.length > 0 && 
        currentQuestionIndex >= allQuestions.length &&
        Object.keys(answers).length > 0 &&
        !isSubmitting &&
        !showResumeScreen &&
        !error &&
        !pendingInfoScreen) { // ИСПРАВЛЕНО: Не запускаем автоотправку, если показывается info screen (кнопка "Получить план" будет вызвать submitAnswers вручную)
      
      clientLogger.log('✅ Все вопросы отвечены, автоматически отправляем ответы через 5 секунд...', {
        currentQuestionIndex,
        allQuestionsLength: allQuestions.length,
        answersCount: Object.keys(answers).length,
        hasPendingInfoScreen: !!pendingInfoScreen,
      });
      autoSubmitTriggeredRef.current = true;
      setAutoSubmitTriggered(true);
      
      // ИСПРАВЛЕНО: НЕ устанавливаем isSubmitting = true до завершения init()
      // Это предотвращает показ планового лоадера для нового пользователя
      // isSubmitting будет установлен в true только когда submitAnswers действительно будет вызвана
      // setIsSubmitting(true);
      
      // Используем setTimeout, чтобы submitAnswers была доступна к моменту выполнения
      // ВАЖНО: Сохраняем ID таймера для очистки при размонтировании
      // ВАЖНО: Используем ref для submitAnswers, чтобы избежать проблем с зависимостями useEffect
      const timeoutId = setTimeout(() => {
        // ИСПРАВЛЕНО: Проверяем, что компонент еще смонтирован, questionnaire существует, и нет активной отправки
        // ИСПРАВЛЕНО: Также проверяем, что init() завершен, чтобы не показывать плановый лоадер для нового пользователя
        if (isMountedRef.current && submitAnswersRef.current && questionnaire && !isSubmittingRef.current && initCompletedRef.current) {
          // ИСПРАВЛЕНО: Устанавливаем флаг перед вызовом, чтобы предотвратить двойную отправку
          isSubmittingRef.current = true;
          // ИСПРАВЛЕНО: Устанавливаем isSubmitting = true только когда submitAnswers действительно будет вызвана
          setIsSubmitting(true);
          // ВАЖНО: Не обновляем состояние после вызова submitAnswers, чтобы избежать React Error #300
          submitAnswersRef.current().catch((err) => {
            console.error('❌ Ошибка при автоматической отправке ответов:', err);
            // ВАЖНО: Не обновляем состояние, если компонент размонтирован
            if (isMountedRef.current) {
              try {
                autoSubmitTriggeredRef.current = false; // Разрешаем повторную попытку
                setAutoSubmitTriggered(false);
                // ИСПРАВЛЕНО: Устанавливаем state, ref синхронизируется автоматически через useEffect
                setIsSubmitting(false);
                setError(err?.message || 'Ошибка отправки ответов');
              } catch (stateError) {
                // Игнорируем ошибки обновления состояния после размонтирования
                clientLogger.warn('⚠️ Не удалось обновить состояние (компонент размонтирован):', stateError);
              }
            }
          });
        } else {
          clientLogger.warn('⚠️ Пропускаем автоматическую отправку: компонент размонтирован или questionnaire отсутствует');
        }
      }, 5000); // 5 секунд лоадера
      
      // Очищаем таймер при размонтировании компонента
      return () => {
        clearTimeout(timeoutId);
      };
    }
  }, [currentQuestionIndex, allQuestions.length, answersCount, questionnaire?.id, isSubmitting, showResumeScreen, autoSubmitTriggered, error, pendingInfoScreen?.id, initCompletedRef]);

  // ВАЖНО: ранние return'ы должны быть ПОСЛЕ всех хуков
  // Проверяем состояние загрузки, ошибку и наличие анкеты после вызова всех хуков

  // ФИКС: Выносим side-effects из рендера в useEffect
  // Это предотвращает проблемы с повторными рендерами и гонками состояний
  const [shouldRedirectToPlan, setShouldRedirectToPlan] = useState(false);
  
  // ФИКС: Обработка isSubmitting и редиректов в useEffect
  useEffect(() => {
    // Если isSubmitting = true, но init() еще не завершен - сбрасываем isSubmitting
  if (isSubmitting && !initCompletedRef.current) {
    clientLogger.log('🧹 Сбрасываем isSubmitting, так как init() еще не завершен');
    setIsSubmitting(false);
    isSubmittingRef.current = false;
      return;
    }
    
    // Проверяем isSubmitting для редиректа
  if (isSubmitting && initCompletedRef.current && questionnaire) {
    if (typeof window !== 'undefined') {
      const justSubmitted = sessionStorage.getItem(scopedStorageKeys.JUST_SUBMITTED) === 'true';
      if (!justSubmitted) {
          // ФИКС: Используем scoped ключ
        try {
            sessionStorage.setItem(scopedStorageKeys.JUST_SUBMITTED, 'true');
        } catch (error) {
          // Игнорируем ошибки sessionStorage
        }
      }
        if (!redirectInProgressRef.current) {
      redirectInProgressRef.current = true;
          setShouldRedirectToPlan(true);
        }
      }
      return;
    }
    
    // Проверяем quiz_just_submitted для редиректа
  if (typeof window !== 'undefined') {
    const justSubmitted = sessionStorage.getItem(scopedStorageKeys.JUST_SUBMITTED) === 'true';
      if (justSubmitted && !redirectInProgressRef.current) {
      sessionStorage.removeItem(scopedStorageKeys.JUST_SUBMITTED);
      redirectInProgressRef.current = true;
      setInitCompleted(true);
        setShouldRedirectToPlan(true);
      }
    }
  }, [isSubmitting, questionnaire?.id, scopedStorageKeys.JUST_SUBMITTED, setInitCompleted, setIsSubmitting]);
  
  // ФИКС: Выполняем редирект в отдельном useEffect
  useEffect(() => {
    if (shouldRedirectToPlan && typeof window !== 'undefined') {
      // ФИКС: quiz_init_done НЕ должен быть scoped, иначе ломается логика при смене scope
      sessionStorage.removeItem('quiz_init_done');
      window.location.replace('/plan?state=generating');
    }
  }, [shouldRedirectToPlan]);
  
  // Показываем лоадер во время редиректа
  if (shouldRedirectToPlan) {
      return (
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
          flexDirection: 'column',
          gap: '16px',
          background: 'linear-gradient(135deg, #F5FFFC 0%, #E8FBF7 100%)',
        }}>
          <div style={{
            width: '48px',
            height: '48px',
            border: '4px solid rgba(10, 95, 89, 0.2)',
            borderTop: '4px solid #0A5F59',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
          }} />
          <div style={{ color: '#0A5F59', fontSize: '16px' }}>Перенаправление...</div>
          <style>{`
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `}</style>
        </div>
      );
  }

  // ФИКС: Переносим логирование из рендера в useEffect для предотвращения проблем с таймингами
  useEffect(() => {
  if (isDev) {
      clientLogger.log('🔍 Quiz page state check', {
        loading,
        initCompleted: initCompletedRef.current,
        hasQuestionnaire: !!questionnaire,
        questionnaireId: questionnaire?.id,
    questionnaireRefId: questionnaireRef.current?.id,
    initInProgress: initInProgressRef.current,
    error: error || null,
    showResumeScreen,
    showRetakeScreen,
    isRetakingQuiz,
    isSubmitting,
    isStartingOver: isStartingOverRef.current,
    hasResumed: hasResumedRef.current,
    currentQuestionIndex,
    currentInfoScreenIndex,
    isShowingInitialInfoScreen: isShowingInitialInfoScreen,
    savedProgressExists: !!savedProgress,
    savedAnswersCount: savedProgress?.answers ? Object.keys(savedProgress.answers).length : 0,
    });
  }
  }, [
    isDev,
    loading,
    questionnaire?.id,
    error,
    showResumeScreen,
    showRetakeScreen,
    isRetakingQuiz,
    isSubmitting,
    currentQuestionIndex,
    currentInfoScreenIndex,
    isShowingInitialInfoScreen,
    savedProgress?.answers ? Object.keys(savedProgress.answers).length : 0,
  ]);
  
  // ИСПРАВЛЕНО: Показываем лоадер только если анкета действительно не загружена
  // КРИТИЧНО: Проверяем и questionnaire (state), и questionnaireRef.current, чтобы не блокировать отображение
  // если анкета загружена в ref, но state еще не обновился
  // КРИТИЧНО: НЕ показываем лоадер, если анкета загружена в ref или state - это блокирует рендеринг анкеты
  const hasQuestionnaireAnywhereBasic = !!questionnaire || !!questionnaireRef.current;
  
  // УПРОЩЕНО: Показываем лоадер только если loading=true И анкета не загружена
  // КРИТИЧНО: Если анкета загружена (в ref или state), НЕ показываем лоадер
  // useEffect выше уже обрабатывает принудительный сброс loading, если анкета загружена
  const hasQuestionnaireAnywhereBasicAfterUpdate = !!questionnaire || !!questionnaireRef.current;
  
  // ИСПРАВЛЕНО: Лоадер анкеты убран - его не должно быть на /quiz
  // Лоадер показывается только на главной странице (/)
  // Если анкета не загружена, просто продолжаем рендер (покажем ошибку ниже, если она есть)

  // ИСПРАВЛЕНО: Не показываем ошибку при перепрохождении анкеты
  // При перепрохождении анкета может загружаться в фоне, и ошибка не должна блокировать пользователя
  if (error && !questionnaire && !isRetakingQuiz && !showRetakeScreen) {
    return (
      <div style={{
        padding: '20px',
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        background: 'linear-gradient(135deg, #F5FFFC 0%, #E8FBF7 100%)'
      }}>
        <div style={{
          backgroundColor: 'rgba(255, 255, 255, 0.56)',
          backdropFilter: 'blur(28px)',
          borderRadius: '24px',
          padding: '24px',
          maxWidth: '400px',
          textAlign: 'center',
        }}>
          <h1 style={{ color: '#0A5F59', marginBottom: '16px' }}>Ошибка</h1>
          <p style={{ color: '#475467', marginBottom: '24px' }}>
            {error || 'Произошла неизвестная ошибка'}
          </p>
          <button
            onClick={() => {
              setError(null);
              setLoading(true);
              window.location.reload();
            }}
            style={{
              padding: '12px 24px',
              borderRadius: '12px',
              backgroundColor: '#0A5F59',
              color: 'white',
              border: 'none',
              cursor: 'pointer',
              fontSize: '16px',
              fontWeight: 'bold',
            }}
          >
            Обновить страницу
          </button>
        </div>
      </div>
    );
  }
  
  // УПРОЩЕНО: Убран fallback лоадер - он не нужен
  // Пользователь должен видеть только главный лоадер, а затем сразу анкету
  // Если анкета не загрузилась - это ошибка, показываем экран ошибки
  // Fallback лоадер убран, так как он создает путаницу и задерживает отображение анкеты

  // РЕФАКТОРИНГ: Экран выбора тем при повторном прохождении анкеты
  if (showRetakeScreen && isRetakingQuiz) {
    clientLogger.log('🔄 Retake screen check:', {
      showRetakeScreen,
      isRetakingQuiz,
      hasRetakingPayment,
      paymentKey: 'stored in DB',
    });

    // РЕФАКТОРИНГ: Используем функцию из handlers
    const handleFullRetakeCallback = async () => {
      await handleFullRetake({
        hasFullRetakePayment,
        setShowRetakeScreen,
        setIsRetakingQuiz,
        setIsStartingOver,
        isStartingOverRef,
        setAnswers,
        setSavedProgress,
        setShowResumeScreen,
        setHasResumed,
        hasResumedRef,
        autoSubmitTriggeredRef,
        setAutoSubmitTriggered,
        setError,
        questionnaire,
        setCurrentInfoScreenIndex,
        setCurrentQuestionIndex,
        setPendingInfoScreen,
      });
    };

    return (
      <QuizRetakeScreen
        questionnaire={questionnaire}
        hasFullRetakePayment={hasFullRetakePayment}
        setShowRetakeScreen={setShowRetakeScreen}
        setIsRetakingQuiz={setIsRetakingQuiz}
        setIsStartingOver={setIsStartingOver}
        isStartingOverRef={isStartingOverRef}
        setAnswers={setAnswers}
        setSavedProgress={setSavedProgress}
        setShowResumeScreen={setShowResumeScreen}
        setHasResumed={setHasResumed}
        hasResumedRef={hasResumedRef}
        setAutoSubmitTriggered={setAutoSubmitTriggered}
        autoSubmitTriggeredRef={autoSubmitTriggeredRef}
        setError={setError}
        setCurrentInfoScreenIndex={setCurrentInfoScreenIndex}
        setCurrentQuestionIndex={setCurrentQuestionIndex}
        setPendingInfoScreen={setPendingInfoScreen}
        setHasFullRetakePayment={setHasFullRetakePayment}
        onFullRetake={handleFullRetakeCallback}
      />
    );
  }

  // КРИТИЧНО: Проверка резюм-экрана перемещена ПОСЛЕ вызова useQuizView (ниже)
  // Используем quizView.type === 'resume' для определения необходимости показа резюм-экрана

  // ИСПРАВЛЕНО: Добавляем диагностическое логирование для понимания состояния рендера
  useEffect(() => {
    if (!loading && questionnaire) {
      clientLogger.log('🔍 Состояние рендера анкеты', {
        loading,
        hasQuestionnaire: !!questionnaire,
        questionnaireId: questionnaire?.id,
        allQuestionsLength: allQuestions.length,
        allQuestionsRawLength: allQuestionsRaw.length,
        currentQuestionIndex,
        hasCurrentQuestion: !!currentQuestion,
        currentQuestionId: currentQuestion?.id,
        isShowingInitialInfoScreen,
        pendingInfoScreen: !!pendingInfoScreen,
        showResumeScreen,
        hasResumed,
        isRetakingQuiz,
        showRetakeScreen,
        answersCount: Object.keys(answers).length,
        savedProgressAnswersCount: Object.keys(savedProgress?.answers || {}).length,
        currentInfoScreenIndex,
        error: error || null,
      });
    }
  }, [loading, questionnaire?.id, allQuestions.length, currentQuestionIndex, currentQuestion?.id, isShowingInitialInfoScreen, pendingInfoScreen?.id, showResumeScreen, hasResumed, isRetakingQuiz, showRetakeScreen, Object.keys(answers).length, savedProgress?.answers ? Object.keys(savedProgress.answers).length : 0, currentInfoScreenIndex, error, allQuestionsRaw.length, infoIndexRestoredRef.current]); // Уже исправлено


  // ИСПРАВЛЕНО: КРИТИЧЕСКАЯ ЗАЩИТА - НЕ сбрасываем currentInfoScreenIndex, если пользователь уже перешел к вопросам
  // Это предотвращает редирект на первый экран после 4-го инфо-экрана
  // КРИТИЧНО: useEffect должен быть вызван ДО любых ранних return (правило хуков React)
  useEffect(() => {
    // ИСПРАВЛЕНО: КРИТИЧЕСКАЯ ЗАЩИТА - НЕ сбрасываем currentInfoScreenIndex, если пользователь уже перешел к вопросам
    // Это предотвращает редирект на первый экран после 4-го инфо-экрана
    if (currentInfoScreenIndexRef.current >= initialInfoScreens.length) {
      // Пользователь уже на вопросах - НИКОГДА не сбрасываем обратно на начальные экраны
      // ФИКС: Помечаем, что индекс больше не нужно восстанавливать
      infoIndexRestoredRef.current = true;
      return;
    }

    // ФИКС: Восстанавливаем currentInfoScreenIndex только один раз при cold start
    if (!infoIndexRestoredRef.current && !isLoadingProgress && !savedProgress && !loading) {
      // Восстановление из sessionStorage только при первой загрузке
      if (typeof window !== 'undefined') {
        try {
          const savedInfoScreenIndex = sessionStorage.getItem(scopedStorageKeys.CURRENT_INFO_SCREEN);
          if (savedInfoScreenIndex !== null) {
            const infoScreenIndex = parseInt(savedInfoScreenIndex, 10);
            if (!isNaN(infoScreenIndex) && infoScreenIndex >= 0 && infoScreenIndex < initialInfoScreens.length) {
              setCurrentInfoScreenIndex(infoScreenIndex);
              currentInfoScreenIndexRef.current = infoScreenIndex;
              infoIndexRestoredRef.current = true;
              clientLogger.log('🔄 Восстановлен currentInfoScreenIndex из sessionStorage (однократно)', { infoScreenIndex });
            }
          }
        } catch (err) {
          clientLogger.warn('⚠️ Ошибка при восстановлении currentInfoScreenIndex:', err);
        }
      }
    }
    
    // ВАЖНО: Не выполняем, если resumeQuiz уже выполнен, чтобы не сбрасывать состояние после resumeQuiz
    if (isShowingInitialInfoScreen && !currentInitialInfoScreen && !isRetakingQuiz && !showResumeScreen && !loading && !resumeCompletedRef.current && !infoIndexRestoredRef.current) {
      // УБРАНО: Логирование вызывает бесконечные циклы в продакшене
      // if (isDev) {
      //   clientLogger.warn('⚠️ isShowingInitialInfoScreen = true, но currentInitialInfoScreen = null - исправляем несоответствие и пропускаем начальные экраны', {
      //     currentInfoScreenIndex,
      //     initialInfoScreensLength: initialInfoScreens.length,
      //     hasCurrentScreen: !!initialInfoScreens[currentInfoScreenIndex],
      //     isShowingInitialInfoScreen,
      //     hasResumed,
      //     loading,
      //   });
      // }
      // Пропускаем начальные экраны и переходим к вопросам
      // Устанавливаем currentInfoScreenIndex в initialInfoScreens.length, чтобы пропустить все начальные экраны
      if (currentInfoScreenIndex < initialInfoScreens.length) {
        setCurrentInfoScreenIndex(initialInfoScreens.length);
      }
    }
  }, [isShowingInitialInfoScreen, currentInitialInfoScreen, currentInfoScreenIndex, initialInfoScreens.length, isRetakingQuiz, showResumeScreen, loading, hasResumed, infoIndexRestoredRef.current]);

  // РЕФАКТОРИНГ: Используем хук useQuizView для определения текущего экрана
  // Это упрощает условия рендеринга и делает код более читаемым
  // КРИТИЧНО: Хук должен быть вызван ДО любых ранних return
  const quizView = useQuizView({
    showResumeScreen,
    showRetakeScreen,
    isRetakingQuiz,
    pendingInfoScreen,
    currentInfoScreenIndex,
    currentInfoScreenIndexRef,
    currentQuestionIndex,
    currentQuestion,
    questionnaire,
    questionnaireRef, // ИСПРАВЛЕНО: Передаем questionnaireRef как fallback
    questionnaireFromStateMachine: quizStateMachine.questionnaire, // ИСПРАВЛЕНО: Передаем questionnaireFromStateMachine как fallback
    loading,
    hasResumed,
    initCompleted, // ФИКС: Передаем флаг завершения инициализации (реактивный state вместо ref)
    savedProgress,
    answers,
    allQuestionsLength: allQuestions.length,
    isDev,
  });
  
  // РЕФАКТОРИНГ: Экран продолжения анкеты
  // ФИКС: shouldShowResume уже вычислен выше (около строки 320), используем его
  if (shouldShowResume) {
    // Обработчик "Начать анкету заново"
    const handleStartFromBeginning = async () => {
      clientLogger.log('🔄 Пользователь нажал "Начать анкету заново"');

      try {
        // ФИКС: Правильный порядок очистки для безопасного "старта заново"
        // 1. Сначала ставим защитные флаги, чтобы блокировать восстановление прогресса
        isStartingOverRef.current = true;
        setIsStartingOver(true);
        autoSubmitTriggeredRef.current = false;
        setAutoSubmitTriggered(false);
        resumeCompletedRef.current = false;
        hasResumedRef.current = false;
        setHasResumed(false);

        // 2. Полностью стираем sessionStorage ключи (все критичные ключи)
        if (typeof window !== 'undefined') {
          try {
            sessionStorage.removeItem(scopedStorageKeys.CURRENT_INFO_SCREEN);
            sessionStorage.removeItem(scopedStorageKeys.CURRENT_QUESTION);
            sessionStorage.removeItem(scopedStorageKeys.CURRENT_QUESTION_CODE);
            sessionStorage.removeItem(scopedStorageKeys.INIT_CALLED);
            sessionStorage.removeItem(scopedStorageKeys.JUST_SUBMITTED);

            // ФИКС: Очищаем флаг завершения анкеты при новом старте
            const quizCompletedKey = QUIZ_CONFIG.getScopedKey('quiz_completed', scope);
            sessionStorage.removeItem(quizCompletedKey);

            // ФИКС: Используем scoped ключ для answers_backup
            const answersBackupKey = QUIZ_CONFIG.getScopedKey('quiz_answers_backup', scope);
            sessionStorage.removeItem(answersBackupKey);

            // ФИКС: Ставим флаг блокировки восстановления прогресса
            const progressClearedKey = QUIZ_CONFIG.getScopedKey('quiz_progress_cleared', scope);
            sessionStorage.setItem(progressClearedKey, 'true');
            setIsProgressCleared(true);

            clientLogger.log('✅ sessionStorage полностью очищен');
          } catch (err) {
            clientLogger.warn('⚠️ Ошибка при очистке sessionStorage:', err);
          }
        }

        // 3. Стираем локальные стейты/рефы
        setAnswers({});
        answersRef.current = {};
        answersCountRef.current = 0;
        setSavedProgress(null);
        setShowResumeScreen(false);
        setPendingInfoScreen(null);

        // ФИКС: Блокируем восстановление прогресса в refs
        progressLoadedRef.current = false;
        lastRestoredAnswersIdRef.current = null;

        // 4. Удаляем серверный прогресс (с инвалидацией кэша React Query)
        try {
          await clearQuizProgressMutation.mutateAsync(undefined);
          clientLogger.log('✅ Ответы удалены на сервере при "Начать заново", кэш инвалидирован');
        } catch (err) {
          clientLogger.warn('⚠️ Ошибка при удалении ответов на сервере:', err);
        }

        // 5. Также вызываем clearProgress для дополнительной очистки локального состояния
        await clearProgress();

        // 6. Сбрасываем индексы на старт
        setCurrentInfoScreenIndex(0);
        currentInfoScreenIndexRef.current = 0;
        setCurrentQuestionIndex(0);

        // ФИКС: Важно! Также сбрасываем initCompletedRef чтобы компонент мог переинициализироваться
        initCompletedRef.current = false;
        setInitCompleted(false);
        initCalledRef.current = false;

        // 7. ФИКС: Снимаем isStartingOver НЕМЕДЛЕННО, а не через setTimeout
        // setTimeout может вызвать проблемы с синхронизацией состояния
        isStartingOverRef.current = false;
        setIsStartingOver(false);

        // ФИКС: Принудительно обновляем версию ответов чтобы триггерить перерасчет
        setAnswersVersion(prev => prev + 1);

        clientLogger.log('✅ Состояние полностью сброшено, переход на первый инфо экран');
      } catch (error) {
        clientLogger.error('❌ Ошибка при сбросе анкеты:', error);
        // ФИКС: В случае ошибки все равно снимаем флаги
        isStartingOverRef.current = false;
        setIsStartingOver(false);
        setError('Ошибка при сбросе анкеты. Попробуйте обновить страницу.');
      }
    };

    // ИСПРАВЛЕНО: Блокируем кнопки во время загрузки/инициализации
    // Это предотвращает клики, когда quiz state еще не стабилен
    const isBusy = loading || isLoadingProgress;
    
    return (
      <QuizResumeScreen
        savedProgress={savedProgress}
        questionnaire={questionnaire}
        answers={answers}
        isRetakingQuiz={isRetakingQuiz}
        showRetakeScreen={showRetakeScreen}
        onResume={resumeQuiz}
        onStartOver={handleStartFromBeginning}
        isBusy={isBusy}
      />
    );
  }

  // Если показывается информационный экран между вопросами
  // При повторном прохождении пропускаем все info screens
  // ИСПРАВЛЕНО: Не блокируем, если показывается resume screen
  // РЕФАКТОРИНГ: Используем компонент QuizInfoScreen
    if (pendingInfoScreen && !isRetakingQuiz && !showResumeScreen) { // ФИКС: Рендерим строго по showResumeScreen
    // ИСПРАВЛЕНО: Логирование для диагностики рендеринга инфо-экрана
    clientLogger.warn('📺 РЕНДЕРИНГ ИНФО-ЭКРАНА: pendingInfoScreen рендерится', {
      pendingInfoScreenId: pendingInfoScreen.id,
      pendingInfoScreenTitle: pendingInfoScreen.title,
      currentQuestionIndex,
      currentInfoScreenIndex,
      isRetakingQuiz,
      showResumeScreen,
      hasResumed,
      isShowingInitialInfoScreen,
      currentQuestion: currentQuestion ? { id: currentQuestion.id, code: currentQuestion.code } : null,
    });
    
    return (
      <QuizInfoScreen
        screen={pendingInfoScreen}
        currentInfoScreenIndex={currentInfoScreenIndex}
        questionnaire={effectiveQuestionnaire}
        questionnaireRef={questionnaireRef}
        error={error}
        isSubmitting={isSubmitting}
        isHandlingNext={isHandlingNext}
        isDev={isDev}
        handleNextInProgressRef={handleNextInProgressRef}
        isSubmittingRef={isSubmittingRef}
        setCurrentInfoScreenIndex={setCurrentInfoScreenIndex}
        setIsSubmitting={setIsSubmitting}
        setError={setError}
        setLoading={setLoading}
        handleNext={handleNext}
        submitAnswers={submitAnswers}
        pendingInfoScreenRef={quizState.pendingInfoScreenRef}
        handleBack={handleBack}
      />
    );
  }

  // Если мы на начальном информационном экране
  // При повторном прохождении пропускаем все info screens
  // ИСПРАВЛЕНО: Добавлена дополнительная проверка showResumeScreen для предотвращения мигания
  // КРИТИЧНО: Показываем начальный экран ТОЛЬКО если currentInitialInfoScreen существует
  // Если isShowingInitialInfoScreen = true, но currentInitialInfoScreen = null,
  // это означает несоответствие условий - пропускаем начальные экраны и переходим к вопросам
  // ИСПРАВЛЕНО: Не блокируем, если показывается resume screen или pendingInfoScreen
  // ИСПРАВЛЕНО: Используем isShowingInitialInfoScreen вместо isShowingInitialInfoScreen
  // КРИТИЧНО: Также проверяем, что currentInfoScreenIndex < initialInfoScreens.length
  // Если currentInfoScreenIndex >= initialInfoScreens.length, значит все начальные экраны пройдены
  // КРИТИЧНО: Показываем первый экран ТОЛЬКО если анкета загружена
  // ИСПРАВЛЕНО: Используем effectiveQuestionnaire (ref или state или State Machine) вместо только questionnaire
  // Это гарантирует, что инфо-экраны показываются, даже если questionnaire в state временно null
  // ИСПРАВЛЕНО: Ослабляем условие для инфо-экранов - показываем их даже если effectiveQuestionnaire временно null
  // Это предотвращает блокировку инфо-экранов из-за временных состояний questionnaire
  // КРИТИЧНО: Инфо-экраны должны показываться на первом рендере, даже если анкета еще загружается
  // Проверка !loading убрана, так как она может блокировать показ вопросов после перехода к ним
  // КРИТИЧНО: НЕ показываем инфо-экраны во время загрузки прогресса
  // Это предотвращает показ инфо-экранов при повторном заходе до загрузки savedProgress
  // Кнопка на первом экране уже имеет проверку загрузки анкеты
  // ИСПРАВЛЕНО: Также проверяем savedProgress - если есть >= 2 ответов, не показываем начальные экраны
  // КРИТИЧНО: Не показываем начальные экраны, если пользователь начал заново (isStartingOver)
  // Это предотвращает двойной рендеринг вопроса после "Начать анкету заново"
  const hasEnoughSavedAnswers = savedProgress?.answers && Object.keys(savedProgress.answers).length >= 2;
  // ИСПРАВЛЕНО: Добавляем проверку isLoadingProgress для предотвращения показа первого экрана перед резюм-экраном
  if (isShowingInitialInfoScreen && 
      currentInitialInfoScreen && 
      currentInfoScreenIndex < initialInfoScreens.length &&
      !isRetakingQuiz && 
      !shouldShowResume && // ФИКС: Используем shouldShowResume вместо showResumeScreen
      !pendingInfoScreen &&
      !isLoadingProgress && // ИСПРАВЛЕНО: Не показываем начальные экраны во время загрузки прогресса
      !hasEnoughSavedAnswers) { // ИСПРАВЛЕНО: isStartingOver не блокирует начальные экраны - они должны показываться после "Начать заново"
    // УБРАНО: Логирование вызывает бесконечные циклы в продакшене
    // if (isDev) {
    //   clientLogger.log('📺 Рендерим начальный инфо-экран', {
    //     currentInfoScreenIndex,
    //     initialInfoScreensLength: initialInfoScreens.length,
    //     currentInitialInfoScreenId: currentInitialInfoScreen?.id,
    //     isShowingInitialInfoScreen,
    //     hasEffectiveQuestionnaire: !!effectiveQuestionnaire,
    //     hasQuestionnaireState: !!questionnaire,
    //     hasQuestionnaireRef: !!questionnaireRef.current,
    //     hasQuestionnaireStateMachine: !!quizStateMachine.questionnaire,
    //     loading,
    //   });
    // }
    // РЕФАКТОРИНГ: Используем компонент QuizInfoScreen
    return (
      <QuizInfoScreen
        screen={currentInitialInfoScreen}
        currentInfoScreenIndex={currentInfoScreenIndex}
        questionnaire={effectiveQuestionnaire}
        questionnaireRef={questionnaireRef}
        error={error}
        isSubmitting={isSubmitting}
        isHandlingNext={isHandlingNext}
        isDev={isDev}
        handleNextInProgressRef={handleNextInProgressRef}
        isSubmittingRef={isSubmittingRef}
        setCurrentInfoScreenIndex={setCurrentInfoScreenIndex}
        setIsSubmitting={setIsSubmitting}
        setError={setError}
        setLoading={setLoading}
        handleNext={handleNext}
        submitAnswers={submitAnswers}
        handleBack={handleBack}
      />
    );
  }
  
  // УБРАНО: Логирование вызывает бесконечные циклы в продакшене
  // if (isDev && isShowingInitialInfoScreen && currentInfoScreenIndex < initialInfoScreens.length) {
  //   clientLogger.warn('⚠️ Инфо-экраны должны показываться, но не показываются', {
  //     currentInfoScreenIndex,
  //     initialInfoScreensLength: initialInfoScreens.length,
  //     currentInitialInfoScreen: !!currentInitialInfoScreen,
  //     isRetakingQuiz,
  //     showResumeScreen,
  //     pendingInfoScreen: !!pendingInfoScreen,
  //     hasEffectiveQuestionnaire: !!effectiveQuestionnaire,
  //     hasQuestionnaireState: !!questionnaire,
  //     hasQuestionnaireRef: !!questionnaireRef.current,
  //     hasQuestionnaireStateMachine: !!quizStateMachine.questionnaire,
  //     loading,
  //   });
  // }
  
  // КРИТИЧНО: Если isShowingInitialInfoScreen = true, но currentInitialInfoScreen = null,
  // или currentInfoScreenIndex >= initialInfoScreens.length, значит начальные экраны не должны показываться
  // В этом случае пропускаем их и переходим к вопросам
  if (isShowingInitialInfoScreen && 
      (!currentInitialInfoScreen || currentInfoScreenIndex >= initialInfoScreens.length) &&
      !isRetakingQuiz && 
      !showResumeScreen && 
      !pendingInfoScreen) {
    // Логируем для диагностики
    if (isDev) {
      clientLogger.warn('⚠️ Пропускаем начальные экраны и переходим к вопросам', {
        currentInfoScreenIndex,
        initialInfoScreensLength: initialInfoScreens.length,
        hasCurrentInitialInfoScreen: !!currentInitialInfoScreen,
        isShowingInitialInfoScreen,
        currentQuestionIndex,
        hasCurrentQuestion: !!currentQuestion,
      });
    }
    // Продолжаем выполнение, чтобы показать вопросы
  }
  
  // КРИТИЧНО: Все хуки должны вызываться ПЕРЕД любыми условными return
  // РЕФАКТОРИНГ: Используем хук для логирования состояния рендеринга
  // КРИТИЧНО: Хук должен вызываться всегда, но внутри проверяет isDev
  // УБРАНО: Условный вызов хука вызывает React Error #300
  // ВРЕМЕННО ОТКЛЮЧЕНО: useQuizRenderDebug может вызывать React Error #300
  // TODO: Восстановить после исправления проблемы с порядком хуков
  // useQuizRenderDebug({
  //   isDev,
  //   questionnaire,
  //   questionnaireRef,
  //   quizStateMachineQuestionnaire: quizStateMachine.questionnaire,
  //   questionnaireFromQuery,
  //   loading,
  //   error,
  //   currentQuestion,
  //   currentQuestionIndex,
  //   allQuestionsLength: allQuestions.length,
  //   allQuestionsRawLength: allQuestionsRaw.length,
  //   showResumeScreen,
  //   showRetakeScreen,
  //   isShowingInitialInfoScreen,
  //   pendingInfoScreen,
  //   isRetakingQuiz,
  //   hasResumed,
  //   initCompletedRef,
  //   initInProgressRef: initInProgressRef,
  // });

  // ИСПРАВЛЕНО: useEffect для исправления currentInfoScreenIndex уже перемещен выше (перед useQuizView)
  // Это гарантирует, что все хуки вызываются до любых ранних return

  // ИСПРАВЛЕНО: Не блокируем отображение вопросов, если они должны показываться
  // Проверяем только критические ошибки, которые действительно требуют вмешательства
  // Если currentQuestion null, но анкета загружена и есть вопросы - это временное состояние,
  // которое исправится в следующем рендере (useEffect корректирует индекс)
  // КРИТИЧНО: Также проверяем, что currentInfoScreenIndex >= initialInfoScreens.length
  // Это означает, что пользователь уже прошел все начальные экраны и должен видеть вопросы
  // ФИКС: Используем viewMode для определения режима экрана
  // Все сложные проверки теперь в useQuizComputed, здесь просто используем результат
  
  // ФИКС: Показываем "Question not found" только если:
  // 1. viewMode === 'QUESTION' (режим вопросов)
  // 2. Все условия стабильности выполнены (initCompleted, questionnaire загружен, нет загрузки)
  // 3. Индекс валиден (в пределах массива)
  // 4. currentQuestion === null (вопрос действительно не найден)
  // Это убирает ситуацию "currentQuestion null → page думает, что вопрос не найден" для других режимов
  const stableForQuestions =
    initCompletedRef.current &&
    !!(questionnaireRef.current || questionnaire) &&
    !isLoadingProgress &&
    !loading;
  
  // ФИКС: КРИТИЧНО - не показываем "Question not found" если должен показываться резюм-экран
  // Это предотвращает мигание "Question not found" перед резюм-экраном
  const inQuestionsStage =
    viewMode === 'QUESTION' &&
    !shouldShowResume && // ФИКС: Приоритет резюм-экрана над "Question not found"
    currentInfoScreenIndex >= initialInfoScreens.length &&
    !pendingInfoScreen &&
    stableForQuestions;
  
  const isIndexValid = currentQuestionIndex >= 0 && currentQuestionIndex < allQuestions.length;
  
  // УДАЛЕНО: Весь блок HEAL удален, восстановление происходит в useQuizComputed



    // ИСПРАВЛЕНО: Убрали плановый лоадер "Создаем ваш план ухода..." из /quiz
    // Если isSubmitting === true, мы уже редиректим на /plan выше (строка 3967)
    // Поэтому этот лоадер больше не нужен - он никогда не должен показываться
    // Оставляем закомментированным для истории
    /*
    if (!pendingInfoScreen && ((isSubmitting && !loading && questionnaire !== null) || looksLikeCompletion)) {
      return (
        <div style={{ 
          padding: '20px',
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          background: 'linear-gradient(135deg, #F5FFFC 0%, #E8FBF7 100%)'
        }}>
          <div style={{
            backgroundColor: 'rgba(255, 255, 255, 0.56)',
            backdropFilter: 'blur(28px)',
            borderRadius: '24px',
            padding: '48px',
            maxWidth: '400px',
            textAlign: 'center',
          }}>
            <div style={{
              width: '64px',
              height: '64px',
              border: '4px solid #0A5F59',
              borderTop: '4px solid transparent',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              margin: '0 auto 24px',
            }} />
            <h2 style={{ color: '#0A5F59', marginBottom: '12px', fontSize: '20px', fontWeight: 'bold' }}>
              Создаем ваш план ухода...
            </h2>
            <p style={{ color: '#475467', fontSize: '16px', lineHeight: '1.5' }}>
              Это займет несколько секунд
            </p>
          </div>
        </div>
      );
    }
    */
    
    // ИСПРАВЛЕНО: Показываем ошибку если loading = false и error установлен
    // Это включает ошибки Telegram initData, ошибки загрузки анкеты и ошибки отправки ответов
    if (error && !loading) {
      return (
        <div style={{ 
          padding: '20px',
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          background: 'linear-gradient(135deg, #F5FFFC 0%, #E8FBF7 100%)'
        }}>
          <div style={{
            backgroundColor: 'rgba(255, 255, 255, 0.56)',
            backdropFilter: 'blur(28px)',
            borderRadius: '24px',
            padding: '24px',
            maxWidth: '400px',
            textAlign: 'center',
          }}>
            <h1 style={{ color: '#DC2626', marginBottom: '16px', fontSize: '24px' }}>😔 Что-то пошло не так</h1>
            <p style={{ color: '#475467', marginBottom: '24px', fontSize: '16px', lineHeight: '1.5' }}>
              {String(error || 'Произошла неожиданная ошибка. Попробуйте обновить страницу.')}
            </p>
            <p style={{ color: '#6B7280', marginBottom: '24px', fontSize: '14px' }}>
              Ошибка сохранена в системе. Техподдержка уже получила уведомление.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <button
                onClick={() => {
                  setError(null);
                  submitAnswers().catch((err) => {
                    console.error('Error submitting answers:', err);
                    const errorMessage = String(err?.message || 'Ошибка отправки ответов');
                    setError(errorMessage);
                  });
                }}
                style={{
                  padding: '12px 24px',
                  borderRadius: '12px',
                  backgroundColor: '#0A5F59',
                  color: 'white',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '16px',
                  fontWeight: 'bold',
                }}
              >
                Попробовать снова
              </button>
              <button
                onClick={() => {
                  if (typeof window !== 'undefined') {
                    window.location.reload();
                  }
                }}
                style={{
                  padding: '12px 24px',
                  borderRadius: '12px',
                  backgroundColor: 'transparent',
                  color: '#0A5F59',
                  border: '1px solid #0A5F59',
                  cursor: 'pointer',
                  fontSize: '16px',
                  fontWeight: 'bold',
                }}
              >
                Обновить страницу
              </button>
            </div>
          </div>
        </div>
      );
    }

    // ИСПРАВЛЕНО: Убрали плановый лоадер "Создаем ваш план ухода..." из /quiz
    // Если isSubmitting === true, мы уже редиректим на /plan выше (строка 3967)
    // Если анкета завершена, но isSubmitting === false, автоматическая отправка обрабатывается в useQuizAutoSubmit
    // Этот лоадер больше не нужен - он никогда не должен показываться на /quiz
    // Оставляем закомментированным для истории
    /*
    if (isSubmitting || (questionnaire && allQuestions.length > 0 && currentQuestionIndex >= allQuestions.length && answersCount > 0)) {
      return (
        <div style={{ 
          padding: '20px',
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          background: 'linear-gradient(135deg, #F5FFFC 0%, #E8FBF7 100%)'
        }}>
          <div style={{
            backgroundColor: 'rgba(255, 255, 255, 0.56)',
            backdropFilter: 'blur(28px)',
            borderRadius: '24px',
            padding: '48px',
            maxWidth: '400px',
            textAlign: 'center',
          }}>
            <style>{`
              @keyframes spin {
                from { transform: rotate(0deg); }
                to { transform: rotate(360deg); }
              }
            `}</style>
            <div style={{
              width: '64px',
              height: '64px',
              border: '4px solid #0A5F59',
              borderTop: '4px solid transparent',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              margin: '0 auto 24px',
            }} />
            <h2 style={{ color: '#0A5F59', marginBottom: '12px', fontSize: '20px', fontWeight: 'bold' }}>
              Создаем ваш план ухода...
            </h2>
            <p style={{ color: '#475467', fontSize: '16px', lineHeight: '1.5' }}>
              Это займет несколько секунд
            </p>
          </div>
        </div>
      );
    }
    */

    // ИСПРАВЛЕНО: Показываем ошибку загрузки анкеты только если:
    // 1. Анкета не загружена
    // 2. Есть ошибка загрузки анкеты
    // 3. НЕ показываем экран выбора тем (showRetakeScreen) - там анкета не нужна сразу
    // 4. НЕ идет перепрохождение (isRetakingQuiz) - при перепрохождении анкета загружается в фоне
    if (!questionnaire && error && 
        (error.includes('загрузить анкету') || error.includes('Invalid questionnaire') || error.includes('Questionnaire has no questions')) &&
        !showRetakeScreen && !isRetakingQuiz) {
      // Показываем ошибку только если она есть и мы не на экране перепрохождения
      return (
        <div style={{ 
          padding: '20px',
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          background: 'linear-gradient(135deg, #F5FFFC 0%, #E8FBF7 100%)'
        }}>
          <div style={{
            backgroundColor: 'rgba(255, 255, 255, 0.56)',
            backdropFilter: 'blur(28px)',
            borderRadius: '24px',
            padding: '48px',
            maxWidth: '400px',
            textAlign: 'center',
          }}>
            <h2 style={{ color: '#D32F2F', marginBottom: '12px', fontSize: '20px', fontWeight: 'bold' }}>
              Ошибка загрузки анкеты
            </h2>
            <p style={{ color: '#475467', fontSize: '16px', lineHeight: '1.5', marginBottom: '24px' }}>
              {typeof error === 'string' ? error : ((error as any)?.message || 'Произошла ошибка загрузки анкеты')}
            </p>
            <button
              onClick={() => {
                if (typeof window !== 'undefined') {
                  window.location.reload();
                }
              }}
              style={{
                padding: '12px 20px',
                borderRadius: '12px',
                backgroundColor: '#0A5F59',
                color: 'white',
                border: 'none',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: 'bold',
              }}
            >
              Обновить страницу
            </button>
          </div>
        </div>
      );
    }
    
    // ИСПРАВЛЕНО: Убрали вызов loadQuestionnaire() из render - это плохая практика
    // Загрузка анкеты при перепрохождении теперь происходит в useEffect ниже

    // ИСПРАВЛЕНО: Убрали лоадер "Загружаем вопросы..."
    // Если анкета загружена и есть вопросы, но вопрос еще не найден - это временное состояние
    // Вместо лоадера просто показываем пустой экран или первый вопрос
    // (вопрос должен найтись сразу после загрузки анкеты)

  // РЕФАКТОРИНГ: Используем утилиту для проверки ошибок анкеты
  const errorScreen = checkQuizErrors({
    questionnaire,
    questionnaireRef,
    allQuestionsRaw,
    allQuestions,
    answers,
    loading,
    error,
    isRetakingQuiz,
    showRetakeScreen,
    currentQuestion,
    showResumeScreen,
    isShowingInitialInfoScreen,
    pendingInfoScreen,
    hasResumed,
  });
  
  if (errorScreen) {
    return errorScreen;
  }

  // РЕФАКТОРИНГ: Используем утилиту для определения необходимости показа лоадера
  const shouldShowLoader = shouldShowInitialLoader({
    pendingInfoScreen,
    currentInfoScreenIndex,
    loading,
    initCompletedRef,
    questionnaireRef,
    questionnaire,
    quizStateMachineQuestionnaire: quizStateMachine.questionnaire,
    questionnaireFromQuery,
  });
  
  // ФИКС: Ранний return для лоадера (после всех хуков)
  if (shouldShowLoader && !showResumeScreen && !showRetakeScreen) {
    return <QuizInitialLoader />;
  }

  // РЕФАКТОРИНГ: Используем утилиту для определения типа экрана
  const isQuestionScreen = isQuestionScreenUtil(
    currentQuestion,
    pendingInfoScreen,
    showResumeScreen,
    showRetakeScreen
  );

  // Определяем, это ли вопрос о целях (для специального стиля)
  const isGoalsQuestion = currentQuestion?.code === 'skin_goals' &&
    currentQuestion?.type === 'multi_choice';

  // РЕФАКТОРИНГ: Используем утилиту для определения цвета фона
  const backgroundColor = getQuizBackgroundColor(isQuestionScreen);

  // РЕФАКТОРИНГ: Используем компонент для основного контента
  return (
    <QuizPageContent
      backgroundColor={backgroundColor}
      isDev={isDev}
      showDebugPanel={showDebugPanel}
      debugLogs={debugLogs}
      setShowDebugPanel={setShowDebugPanel}
      currentQuestion={currentQuestion}
      currentQuestionIndex={currentQuestionIndex}
      currentInfoScreenIndex={currentInfoScreenIndex}
      currentInfoScreenIndexRef={currentInfoScreenIndexRef}
      isPastInitialScreens={currentInfoScreenIndex >= initialInfoScreens.length}
      allQuestionsLength={allQuestions.length}
      initialInfoScreensLength={initialInfoScreens.length}
      isShowingInitialInfoScreen={isShowingInitialInfoScreen}
      loading={loading}
      questionnaire={questionnaire}
      questionnaireRef={questionnaireRef}
      quizStateMachineQuestionnaire={quizStateMachine.questionnaire}
      pendingInfoScreen={pendingInfoScreen}
      showResumeScreen={showResumeScreen}
      hasResumed={hasResumed}
      answers={answers}
      isRetakingQuiz={isRetakingQuiz}
      isSubmitting={isSubmitting}
      onAnswer={handleAnswer}
      onNext={handleNext}
      onSubmit={submitAnswers}
      onBack={handleBack}
      finalizing={finalizing}
      finalizingStep={finalizingStep}
      finalizeError={finalizeError}
    />
  );
}