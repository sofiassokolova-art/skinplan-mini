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
// ОТКЛЮЧЕНО: useQuizSync вызывает бесконечные циклы React Error #310
// import { useQuizSync } from '@/lib/quiz/utils/quizSync';
import { useQuestionnaire, useQuizProgress, useSaveQuizProgress } from '@/hooks/useQuiz';
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

export default function QuizPage() {
  const isDev = process.env.NODE_ENV === 'development';
  const router = useRouter();
  
  // Инициализация useTelegram (хук сам обрабатывает ошибки внутри)
  // ВАЖНО: хуки должны вызываться всегда в одном порядке, нельзя оборачивать в try-catch
  const { initialize, initData } = useTelegram();
  
  // РЕФАКТОРИНГ: State Machine для управления UI состояниями
  const quizStateMachine = useQuizStateMachine({
    initialState: 'LOADING',
    onStateChange: (newState, previousState) => {
      clientLogger.log('🔄 State Machine transition', { 
        from: previousState, 
        to: newState 
      });
    },
    onTransitionError: (event, from) => {
      clientLogger.warn('⚠️ Invalid State Machine transition', { 
        event, 
        from 
      });
    },
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
  
  // ФИКС: Синхронизируем questionnaire из React Query с локальным state
  // ИСПРАВЛЕНО: Добавляем guard для предотвращения бесконечных циклов
  const { lastSyncedFromQueryIdRef, setQuestionnaireInStateMachineRef } = quizState;
  // ИСПРАВЛЕНО: Используем ref для setQuestionnaireInStateMachine, чтобы избежать зависимости от функции
  useEffect(() => {
    setQuestionnaireInStateMachineRef.current = setQuestionnaireInStateMachine;
  }, [setQuestionnaireInStateMachine, setQuestionnaireInStateMachineRef]);
  
  useEffect(() => {
    // ИСПРАВЛЕНО: Проверяем ID вместо объекта, чтобы избежать лишних обновлений
    const queryId = questionnaireFromQuery?.id;
    const currentId = questionnaire?.id;
    
    if (questionnaireFromQuery && queryId && queryId !== currentId && queryId !== lastSyncedFromQueryIdRef.current) {
      lastSyncedFromQueryIdRef.current = queryId;
      clientLogger.log('🔄 Syncing questionnaire from React Query', {
        questionnaireId: questionnaireFromQuery.id,
        currentQuestionnaireId: questionnaire?.id,
      });
      setQuestionnaire(questionnaireFromQuery);
      // ИСПРАВЛЕНО: Также обновляем questionnaireRef.current для проверки в shouldShowInitialLoader
      questionnaireRef.current = questionnaireFromQuery;
      // Также обновляем State Machine (используем ref для стабильности)
      if (setQuestionnaireInStateMachineRef.current) {
        setQuestionnaireInStateMachineRef.current(questionnaireFromQuery);
      }
      // ИСПРАВЛЕНО: НЕ вызываем setLoading здесь - это делает отдельный useEffect (строка 203)
      // Это предотвращает бесконечные циклы между useEffect
    }
  }, [questionnaireFromQuery?.id, questionnaire?.id]); // ИСПРАВЛЕНО: Убрали setQuestionnaireInStateMachine из зависимостей
  
  // УДАЛЕНО: Избыточный useEffect для синхронизации с State Machine
  // Вся синхронизация теперь выполняется в едином useEffect ниже (строки 212-251)
  
  // ИСПРАВЛЕНО: Обертка для setQuestionnaire, которая также обновляет State Machine
  // КРИТИЧНО: Используем ref для questionnaire вместо state в зависимостях, чтобы избежать пересоздания функции
  const { questionnaireForCallbackRef } = quizState;
  
  const setQuestionnaireWithStateMachine = useCallback((newQuestionnaireOrUpdater: Questionnaire | null | ((prev: Questionnaire | null) => Questionnaire | null)) => {
    // ИСПРАВЛЕНО: Поддерживаем функциональную форму setState((prev) => ...)
    let newQuestionnaire: Questionnaire | null;
    if (typeof newQuestionnaireOrUpdater === 'function') {
      // Функциональная форма - вызываем функцию с текущим значением
      const currentQuestionnaire = questionnaireForCallbackRef.current;
      clientLogger.log('🔄 setQuestionnaireWithStateMachine: calling function updater', {
        currentQuestionnaireId: currentQuestionnaire?.id || null,
        hasCurrentQuestionnaire: !!currentQuestionnaire,
      });
      newQuestionnaire = newQuestionnaireOrUpdater(currentQuestionnaire);
      clientLogger.log('🔄 setQuestionnaireWithStateMachine: function updater returned', {
        returnedQuestionnaireId: newQuestionnaire?.id || null,
        hasReturnedQuestionnaire: !!newQuestionnaire,
        returnedType: typeof newQuestionnaire,
      });
    } else {
      // Обычная форма - используем значение напрямую
      newQuestionnaire = newQuestionnaireOrUpdater;
    }
    
    // КРИТИЧНО: Обновляем State Machine ПЕРВЫМ, чтобы защита от null сработала
    // ИСПРАВЛЕНО: Всегда вызываем setQuestionnaireInStateMachine, даже если newQuestionnaire null
    // State Machine сам решит, разрешить ли установку null
    clientLogger.log('🔄 setQuestionnaireWithStateMachine called', {
      newQuestionnaireId: newQuestionnaire?.id || null,
      currentStateMachineQuestionnaireId: quizStateMachine.questionnaire?.id || null,
      currentLocalQuestionnaireId: questionnaireForCallbackRef.current?.id || null,
      currentRefQuestionnaireId: questionnaireRef.current?.id || null,
      isFunctionalForm: typeof newQuestionnaireOrUpdater === 'function',
    });
    
    // КРИТИЧНО: Сохраняем текущее значение из State Machine перед обновлением
    const previousStateMachineQuestionnaire = quizStateMachine.questionnaire;
    
    // Обновляем State Machine
    setQuestionnaireInStateMachine(newQuestionnaire);
    
    // ИСПРАВЛЕНО: Сразу после обновления State Machine проверяем результат
    // Если State Machine отклонил установку null (защита сработала),
    // используем предыдущее значение вместо null
    // ИСПРАВЛЕНО: Используем getQuestionnaire для получения актуального значения
    const questionnaireFromStateMachine = quizStateMachine.getQuestionnaire();
    
    // КРИТИЧНО: Если State Machine отклонил установку null, используем предыдущее значение
    const questionnaireToSet = questionnaireFromStateMachine || previousStateMachineQuestionnaire;
    
    // КРИТИЧНО: Если newQuestionnaire null, но State Machine сохранил предыдущее значение,
    // это означает, что защита сработала - используем сохраненное значение
    if (newQuestionnaire === null && questionnaireFromStateMachine === null && previousStateMachineQuestionnaire !== null) {
      clientLogger.warn('🛡️ [State Machine] Protection triggered: prevented setting questionnaire to null', {
        previousQuestionnaireId: previousStateMachineQuestionnaire.id,
      });
      // Используем предыдущее значение
      setQuestionnaire(previousStateMachineQuestionnaire);
      questionnaireRef.current = previousStateMachineQuestionnaire;
      return;
    }
    
    // Обновляем локальный state и ref
    const currentQuestionnaire = questionnaireForCallbackRef.current;
    if (questionnaireToSet !== currentQuestionnaire) {
      clientLogger.log('🔄 Updating local questionnaire state from State Machine', {
        stateMachineQuestionnaireId: questionnaireFromStateMachine?.id || null,
        previousStateMachineQuestionnaireId: previousStateMachineQuestionnaire?.id || null,
        questionnaireToSetId: questionnaireToSet?.id || null,
        localQuestionnaireId: currentQuestionnaire?.id || null,
      });
      
      setQuestionnaire(questionnaireToSet);
      questionnaireRef.current = questionnaireToSet;
    } else if (questionnaireToSet) {
      // ИСПРАВЛЕНО: Даже если state не изменился, обновляем ref для гарантии
      questionnaireRef.current = questionnaireToSet;
    }
  }, [setQuestionnaireInStateMachine, quizStateMachine.questionnaire?.id]); // ИСПРАВЛЕНО: Зависем только от ID, а не от всего объекта
  // ФИКС: Начинаем с loading = true, чтобы показать лоадер при первой загрузке
  // ФИКС: Используем loading из React Query, если анкета загружается через React Query
  // Иначе используем локальный state для обратной совместимости
  const { loading, setLoading, error, setError } = quizState;
  
  // ФИКС: Синхронизируем loading из React Query
  // ИСПРАВЛЕНО: Не устанавливаем loading=true при рефетче, если анкета уже загружена
  // ИСПРАВЛЕНО: Оптимизирован useEffect для управления loading
  // Зависим только от ID, чтобы избежать бесконечных циклов
  useEffect(() => {
    // Если анкета уже загружена (в state, ref или State Machine), не показываем лоадер при рефетче
    const hasQuestionnaireAlready = !!questionnaire || !!questionnaireRef.current || !!quizStateMachine.questionnaire;
    
    if (isLoadingQuestionnaire && !hasQuestionnaireAlready) {
      // Только устанавливаем loading=true при первой загрузке
      setLoading(true);
    } else if (questionnaireFromQuery?.id) {
      // ИСПРАВЛЕНО: Если React Query загрузил анкету, сбрасываем loading
      // Не ждем синхронизации с локальным state, так как она происходит в другом useEffect
      setLoading(false);
    }
  }, [isLoadingQuestionnaire, questionnaireFromQuery?.id, questionnaire?.id, quizStateMachine.questionnaire?.id]);
  
  // ФИКС: Синхронизируем error из React Query
  useEffect(() => {
    if (questionnaireError) {
      setError('Ошибка загрузки анкеты. Пожалуйста, обновите страницу.');
    }
  }, [questionnaireError]);
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
  
  // ФИКС: Используем ref для отслеживания questionnaire из State Machine, чтобы избежать зависимости от объекта
  useEffect(() => {
    stateMachineQuestionnaireRef.current = quizStateMachine.questionnaire;
    stateMachineQuestionnaireIdRef.current = quizStateMachine.questionnaire?.id || null;
  }, [quizStateMachine.questionnaire, stateMachineQuestionnaireRef]);
  
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
  } = useQuizComputed({
    questionnaire,
    answers,
    savedProgress,
    currentInfoScreenIndex,
    currentQuestionIndex,
    isRetakingQuiz,
    showRetakeScreen,
    showResumeScreen,
    hasResumed,
    pendingInfoScreen,
    questionnaireRef,
    currentInfoScreenIndexRef,
    allQuestionsRawPrevRef,
    allQuestionsPrevRef,
    quizStateMachine,
    isDev,
  });

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
      initCompletedRef.current = true;
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
  const loadQuestionnaireRef = useRef<(() => Promise<any>) | null>(null);
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
        const justSubmitted = sessionStorage.getItem(QUIZ_CONFIG.STORAGE_KEYS.JUST_SUBMITTED);
        if (justSubmitted === 'true') {
          clientLogger.log('🧹 Очищаем залипший флаг quiz_just_submitted при входе на /quiz');
          sessionStorage.removeItem(QUIZ_CONFIG.STORAGE_KEYS.JUST_SUBMITTED);
        }
        
        // ИСПРАВЛЕНО: ВСЕГДА сбрасываем isSubmitting при монтировании для нового пользователя
        // Это предотвращает показ планового лоадера, если isSubmitting остался true из предыдущей сессии
        // ВАЖНО: Сбрасываем БЕЗ проверки, так как для нового пользователя isSubmitting должен быть false
        clientLogger.log('🧹 Сбрасываем isSubmitting при входе на /quiz (защита от залипшего состояния)');
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

  // ИСПРАВЛЕНО: Refs для предотвращения множественных редиректов и history updates
  // Это предотвращает SecurityError "Attempt to use history.replaceState() more than 100 times per 10 seconds"
  const redirectInProgressRef = useRef(false);
  const historyUpdateInProgressRef = useRef(false);
  const lastHistoryUpdateTimeRef = useRef<number>(0);
  // ФИКС: Ref для предотвращения повторных сбросов на первый экран
  const firstScreenResetRef = useRef(false);
  // ФИКС: Ref для отслеживания завершения resumeQuiz
  const resumeCompletedRef = useRef(false);
  // ФИКС: Ref для предотвращения множественных кликов по кнопке "Продолжить"
  const handleNextInProgressRef = useRef(false);
  // ФИКС: State для визуального обновления кнопки "Продолжить"
  const [isHandlingNext, setIsHandlingNext] = useState(false);
  
  useEffect(() => {
    // ИСПРАВЛЕНО: Проверяем, не была ли анкета только что отправлена
    // КРИТИЧНО: Проверяем флаг quiz_just_submitted САМЫМ ПЕРВЫМ, до любых других проверок
    // Это предотвращает редирект на первый экран после отправки ответов
    // ВАЖНО: Добавлен guard против множественных редиректов
    if (redirectInProgressRef.current) {
      return; // Уже выполняется редирект
    }
    
    if (typeof window !== 'undefined') {
      const justSubmitted = sessionStorage.getItem(QUIZ_CONFIG.STORAGE_KEYS.JUST_SUBMITTED) === 'true';
      if (justSubmitted) {
        redirectInProgressRef.current = true; // Помечаем, что редирект начат
        clientLogger.log('✅ Анкета только что отправлена, редиректим на /plan?state=generating (ранняя проверка)');
        // Очищаем флаг
        sessionStorage.removeItem(QUIZ_CONFIG.STORAGE_KEYS.JUST_SUBMITTED);
        // ИСПРАВЛЕНО: Удаляем флаг quiz_init_done перед редиректом, чтобы init() мог запуститься при возврате на /quiz
        sessionStorage.removeItem('quiz_init_done');
        // Устанавливаем initCompletedRef, чтобы предотвратить повторную инициализацию
        initCompletedRef.current = true;
        setLoading(false);
        // Редиректим на /plan?state=generating СРАЗУ, без задержек
        window.location.replace('/plan?state=generating');
        // ФИКС: Сбрасываем redirectInProgressRef через небольшую задержку после редиректа
        // Это предотвращает застревание флага, если компонент перерендерится
        setTimeout(() => {
          redirectInProgressRef.current = false;
        }, 1000);
        return;
      }
      
      // ИСПРАВЛЕНО: Также проверяем, не находится ли пользователь на инфо-экране после последнего вопроса
      // Если да, не выполняем проверку профиля, которая может вызвать редирект
      const urlParams = new URLSearchParams(window.location.search);
      const isResuming = urlParams.get('resume') === 'true';
      if (isResuming || pendingInfoScreen) {
        clientLogger.log('ℹ️ Пользователь на инфо-экране или resume экране, пропускаем раннюю проверку профиля');
        // Продолжаем нормальную инициализацию без раннего редиректа
      }
    }
    
    // ИСПРАВЛЕНО: Проверяем флаг quiz_just_submitted ПЕРЕД проверкой профиля
    // Это критично, чтобы предотвратить редирект на первый экран после отправки ответов
    const justSubmitted = typeof window !== 'undefined' ? sessionStorage.getItem(QUIZ_CONFIG.STORAGE_KEYS.JUST_SUBMITTED) === 'true' : false;
    if (justSubmitted) {
      clientLogger.log('✅ Флаг quiz_just_submitted установлен - пропускаем проверку профиля и редиректим на /plan?state=generating');
      // Очищаем флаг
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem(QUIZ_CONFIG.STORAGE_KEYS.JUST_SUBMITTED);
      }
      // Устанавливаем initCompletedRef, чтобы предотвратить повторную инициализацию
      initCompletedRef.current = true;
      setLoading(false);
      // ИСПРАВЛЕНО: Удаляем флаг quiz_init_done перед редиректом
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem('quiz_init_done');
        window.location.replace('/plan?state=generating');
      }
      return;
    }
    
    // ИСПРАВЛЕНО: Проверяем, есть ли уже профиль (анкета завершена)
    // Если профиль есть и анкета завершена, не показываем начало анкеты, а редиректим на /plan
    // ВАЖНО: Проверяем синхронно, чтобы предотвратить показ первого экрана
    // ВАЖНО: НЕ проверяем профиль, если флаг quiz_just_submitted установлен (уже обработано выше)
    // ИСПРАВЛЕНО: Для нового пользователя (нет hasPlanProgress) не проверяем флаги перепрохождения
    // Это оптимизирует загрузку и предотвращает избыточные запросы к /api/user/preferences
    if (typeof window !== 'undefined' && window.Telegram?.WebApp?.initData && !initCompletedRef.current && !justSubmitted) {
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
  
  // ИСПРАВЛЕНО: Start over / Retake / Resume - отдельными эффектами
  // TODO: Вынести логику профиля/retake в отдельные эффекты
  // Загружаем предыдущие ответы для повторного прохождения анкеты
  useEffect(() => {
    if (
      isRetakingQuiz &&
      questionnaire &&
      typeof window !== 'undefined' &&
      window.Telegram?.WebApp?.initData
    ) {
      clientLogger.log('🔄 Загружаем предыдущие ответы для повторного прохождения...');
      // Вызываем функцию напрямую, не добавляя в зависимости, чтобы избежать проблем
      (async () => {
        const quiz = questionnaire;
        if (!quiz) {
          clientLogger.warn('⚠️ Cannot load previous answers: questionnaire not loaded');
          return;
        }
        
        try {
          const response = await fetch(`/api/questionnaire/progress?retaking=true`, {
            headers: {
              'X-Telegram-Init-Data': typeof window !== 'undefined' && window.Telegram?.WebApp?.initData
                ? window.Telegram.WebApp.initData
                : '',
            },
          });

          if (response.ok) {
            const data = await response.json() as {
              progress?: {
                answers: Record<number, string | string[]>;
                questionIndex: number;
                infoScreenIndex: number;
              } | null;
            };
            
            if (data?.progress?.answers && Object.keys(data.progress.answers).length > 0) {
              clientLogger.log('✅ Загружены предыдущие ответы для повторного прохождения:', Object.keys(data.progress.answers).length, 'ответов');
              setAnswers(data.progress.answers);
              if (data.progress.questionIndex !== undefined && data.progress.questionIndex >= 0) {
                setCurrentQuestionIndex(data.progress.questionIndex);
              }
            }
          }
        } catch (err: any) {
        clientLogger.warn('⚠️ Ошибка загрузки предыдущих ответов:', err);
        }
      })();
    }
  }, [isRetakingQuiz, questionnaire]);

  // Устанавливаем query параметр для скрытия навигации в layout (вынесено на верхний уровень)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    // ИСПРАВЛЕНО: Guard против множественных вызовов history.replaceState
    // Это предотвращает SecurityError "Attempt to use history.replaceState() more than 100 times per 10 seconds"
    if (typeof window === 'undefined') return;
    
    // ИСПРАВЛЕНО: Throttle history updates - не чаще раза в секунду
    const now = Date.now();
    if (historyUpdateInProgressRef.current || (now - lastHistoryUpdateTimeRef.current < 1000)) {
      return; // Пропускаем, если обновление уже в процессе или было недавно
    }
    
    // Проверяем текущее значение параметра resume в URL
    const urlParams = new URLSearchParams(window.location.search);
    const currentResume = urlParams.get('resume') === 'true';
    
    // Обновляем URL только если значение изменилось
    if (showResumeScreen && !currentResume) {
      historyUpdateInProgressRef.current = true;
      lastHistoryUpdateTimeRef.current = now;
      try {
        const url = new URL(window.location.href);
        url.searchParams.set('resume', 'true');
        window.history.replaceState({}, '', url.toString());
      } catch (e) {
        // Игнорируем SecurityError
        console.warn('Failed to update URL with resume param:', e);
      } finally {
        historyUpdateInProgressRef.current = false;
      }
    } else if (!showResumeScreen && currentResume) {
      historyUpdateInProgressRef.current = true;
      lastHistoryUpdateTimeRef.current = now;
      try {
        const url = new URL(window.location.href);
        url.searchParams.delete('resume');
        window.history.replaceState({}, '', url.toString());
      } catch (e) {
        // Игнорируем SecurityError
        console.warn('Failed to remove resume param from URL:', e);
      } finally {
        historyUpdateInProgressRef.current = false;
      }
    }
  }, [showResumeScreen]);

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
      const alreadyInit = sessionStorage.getItem('quiz_init_done') === 'true';
      if (alreadyInit) {
        clientLogger.log('⛔ useEffect: init() skipped: quiz_init_done in sessionStorage');
        
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
          const savedQuestionIndex = sessionStorage.getItem(QUIZ_CONFIG.STORAGE_KEYS.CURRENT_QUESTION);
          if (savedQuestionIndex !== null) {
            const questionIndex = parseInt(savedQuestionIndex, 10);
            if (!isNaN(questionIndex) && questionIndex >= 0) {
              // ИСПРАВЛЕНО: Используем ref для получения актуальной длины allQuestions
              // Это более надежно, чем setTimeout, так как ref обновляется синхронно
              const currentAllQuestionsLength = allQuestionsPrevRef.current.length || allQuestions.length;
              const validIndex = currentAllQuestionsLength > 0 
                ? (questionIndex < currentAllQuestionsLength ? questionIndex : Math.max(0, currentAllQuestionsLength - 1))
                : 0;
              
              if (validIndex !== questionIndex && currentAllQuestionsLength > 0) {
                clientLogger.warn('⚠️ Исправляем currentQuestionIndex после восстановления - индекс вне границ', {
                  savedIndex: questionIndex,
                  correctedIndex: validIndex,
                  allQuestionsLength: currentAllQuestionsLength,
                });
              }
              
              // ИСПРАВЛЕНО: Устанавливаем индекс сразу, если allQuestions уже загружен
              // Иначе используем setTimeout для проверки после пересчета
              if (currentAllQuestionsLength > 0) {
                setCurrentQuestionIndex(validIndex);
                clientLogger.log('🔄 Восстанавливаем currentQuestionIndex из sessionStorage (синхронно)', { 
                  questionIndex: validIndex,
                  allQuestionsLength: currentAllQuestionsLength,
                });
              } else {
                // Если allQuestions еще не загружен, используем setTimeout
                setTimeout(() => {
                  const finalLength = allQuestions.length || allQuestionsPrevRef.current.length;
                  const finalValidIndex = finalLength > 0 
                    ? (questionIndex < finalLength ? questionIndex : Math.max(0, finalLength - 1))
                    : 0;
                  setCurrentQuestionIndex(finalValidIndex);
                  clientLogger.log('🔄 Восстанавливаем currentQuestionIndex из sessionStorage (асинхронно)', { 
                    questionIndex: finalValidIndex,
                    allQuestionsLength: finalLength,
                  });
                }, 100);
              }
            }
          }
          
          // Восстанавливаем currentInfoScreenIndex из sessionStorage
          const savedInfoScreenIndex = sessionStorage.getItem(QUIZ_CONFIG.STORAGE_KEYS.CURRENT_INFO_SCREEN);
          if (savedInfoScreenIndex !== null) {
            const infoScreenIndex = parseInt(savedInfoScreenIndex, 10);
            if (!isNaN(infoScreenIndex) && infoScreenIndex >= 0) {
              clientLogger.log('🔄 Восстанавливаем currentInfoScreenIndex из sessionStorage', { infoScreenIndex });
              setCurrentInfoScreenIndex(infoScreenIndex);
              currentInfoScreenIndexRef.current = infoScreenIndex;
            }
          }
          
          // ИСПРАВЛЕНО: Загружаем ответы из API после ремоунта
          // Это критично, так как после ремоунта состояние теряется, но данные остаются на сервере
          // ВАЖНО: Сначала проверяем React Query кэш (синхронно), затем загружаем через API если нужно
          if (typeof window !== 'undefined' && window.Telegram?.WebApp?.initData) {
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
      sessionStorage.setItem('quiz_init_done', 'true');
    }
    
    clientLogger.log('🚀 useEffect: calling init()', {
      initCalled: initCalledRef.current,
      initInProgress: initInProgressRef.current,
      initCompleted: initCompletedRef.current,
      hasLoadQuestionnaireRef: !!loadQuestionnaireRef.current,
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
  }, [questionnaire]);

  // КРИТИЧНО: Отдельный useEffect для восстановления answers из React Query после ремоунта
  // Это гарантирует, что answers восстановятся даже если компонент ремоунтится из-за ошибки
  // ИСПРАВЛЕНО: Зависим от quizProgressFromQuery, чтобы восстанавливать answers при каждом обновлении кэша
  const lastRestoredAnswersIdRef = useRef<string | null>(null);
  const answersRef = useRef<Record<number, string | string[]>>({});
  const answersCountRef = useRef<number>(0);
  useEffect(() => {
    answersRef.current = answers;
    answersCountRef.current = Object.keys(answers).length;
  }, [answers]);
  
  // ИСПРАВЛЕНО: Синхронное восстановление answers из React Query кэша при монтировании
  // Это критично для предотвращения пересчета allQuestions с пустыми ответами после перемонтирования
  useEffect(() => {
    // Не восстанавливаем, если React Query еще загружает
    if (isLoadingProgress) {
      return;
    }
    
    // Восстанавливаем answers только если они есть в React Query кэше и еще не были восстановлены
    const progressAnswers = quizProgressFromQuery?.progress?.answers;
    if (progressAnswers && Object.keys(progressAnswers).length > 0) {
      const answersId = JSON.stringify(progressAnswers);
      const progressAnswersCount = Object.keys(progressAnswers).length;
      
      // Проверяем, не восстанавливали ли мы уже эти answers
      // ИСПРАВЛЕНО: Также проверяем количество answers, чтобы не пропустить восстановление
      // КРИТИЧНО: Восстанавливаем если answers пустые (после перемонтирования) или если количество увеличилось
      if (answersId !== lastRestoredAnswersIdRef.current || progressAnswersCount > answersCountRef.current || answersCountRef.current === 0) {
        // Проверяем, действительно ли answers изменились (используем ref для стабильности)
        const currentAnswersId = JSON.stringify(answersRef.current);
        if (answersId !== currentAnswersId) {
          clientLogger.log('🔄 Восстанавливаем answers из React Query кэша (после ремоунта или обновления)', {
            answersCount: progressAnswersCount,
            previousAnswersCount: answersCountRef.current,
            wasEmpty: answersCountRef.current === 0,
            answersId: answersId.substring(0, 100), // Первые 100 символов для диагностики
          });
          // КРИТИЧНО: Устанавливаем answers синхронно, чтобы allQuestions пересчитался с правильными ответами
          setAnswers(progressAnswers);
          // Также обновляем ref синхронно для немедленного использования
          answersRef.current = progressAnswers;
          answersCountRef.current = progressAnswersCount;
          setSavedProgress({
            answers: progressAnswers,
            questionIndex: quizProgressFromQuery.progress.questionIndex || 0,
            infoScreenIndex: quizProgressFromQuery.progress.infoScreenIndex || 0,
          });
          lastRestoredAnswersIdRef.current = answersId;
        }
      }
    }
  }, [isLoadingProgress, quizProgressFromQuery?.progress?.answers ? JSON.stringify(quizProgressFromQuery.progress.answers) : null, setAnswers, setSavedProgress]); // ИСПРАВЛЕНО: Используем JSON.stringify для стабильности зависимостей

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
  }, [questionnaire, loading, savedProgress]);

  // ИСПРАВЛЕНО: useEffect для загрузки анкеты при перепрохождении
  // Убрали вызов loadQuestionnaire() из render - это плохая практика
  // Теперь загрузка происходит в useEffect, что правильно для React
  useEffect(() => {
    // Загружаем анкета только при перепрохождении, если она еще не загружена
    if (!(isRetakingQuiz || showRetakeScreen)) return;
    if (questionnaire || questionnaireRef.current) return;
    if (loading) return;
    if (loadQuestionnaireInProgressRef.current) return;
    if (loadQuestionnaireAttemptedRef.current) return;
    if (initInProgressRef.current) return;
    if (!initCompletedRef.current) return;
    if (!loadQuestionnaireRef.current) return; // ИСПРАВЛЕНО: Проверяем, что функция доступна

    // КРИТИЧНО: Устанавливаем флаги СРАЗУ, чтобы предотвратить повторные вызовы
    loadQuestionnaireInProgressRef.current = true;
    loadQuestionnaireAttemptedRef.current = true;

    clientLogger.log('ℹ️ Retaking quiz, loading questionnaire in background for retake screen (useEffect)', {
      loading,
      inProgress: loadQuestionnaireInProgressRef.current,
      attempted: loadQuestionnaireAttemptedRef.current,
      initInProgress: initInProgressRef.current,
      initCompleted: initCompletedRef.current,
    });

    // ИСПРАВЛЕНО: Используем loadQuestionnaireRef.current вместо прямого вызова
    // Это решает проблему с использованием переменной до её объявления
    loadQuestionnaireRef.current().catch((err) => {
      clientLogger.error('❌ Failed to load questionnaire during retake', err);
      // При ошибке загрузки при перепрохождении не показываем ошибку пользователю
      // Экран выбора тем покажется без анкеты (темы загружаются из quiz-topics.ts)
      // ИСПРАВЛЕНО: Сбрасываем флаги при ошибке, чтобы можно было повторить
      loadQuestionnaireInProgressRef.current = false;
      loadQuestionnaireAttemptedRef.current = false;
    });
  }, [isRetakingQuiz, showRetakeScreen, questionnaire, loading]); // ИСПРАВЛЕНО: Убрали loadQuestionnaire из зависимостей, используем ref

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
  // ПЕРЕМЕЩЕНО: После объявления loadSavedProgressFromServer, чтобы все зависимости были доступны
  const { waitForTelegram, getInitData, init } = useQuizInit({
    loading,
    currentInfoScreenIndex,
    currentQuestionIndex,
    savedProgress,
    showResumeScreen,
    hasResumed,
    isRetakingQuiz,
    allQuestions,
    setLoading,
    setError,
    setCurrentInfoScreenIndex,
    setCurrentQuestionIndex,
    setPendingInfoScreen,
    questionnaireRef,
    currentInfoScreenIndexRef,
    resumeCompletedRef,
    initCalledRef,
    initInProgressRef,
    initCompletedRef,
    isStartingOverRef,
    hasResumedRef,
    loadProgressInProgressRef,
    progressLoadInProgressRef,
    loadQuestionnaireRef,
    firstScreenResetRef,
    initStartTimeRef,
    initCompletedTimeRef,
    loadSavedProgressFromServer,
    isDev,
  });
  
  // УДАЛЕНО: Старая реализация (вынесена в lib/quiz/handlers/loadSavedProgress.ts)
  const _loadSavedProgressFromServerOld = async () => {
    // КРИТИЧНО: Проверяем, что пользователь уже не на вопросах ПЕРЕД любыми другими проверками
    // Это предотвращает сброс currentInfoScreenIndex после перехода к вопросам
              const initialInfoScreens = getInitialInfoScreens();
    const isAlreadyOnQuestions = currentInfoScreenIndexRef.current >= initialInfoScreens.length;
    
    if (isAlreadyOnQuestions) {
      clientLogger.log('⏸️ loadSavedProgressFromServer: пропущено, пользователь уже на вопросах', {
        currentInfoScreenIndexRef: currentInfoScreenIndexRef.current,
        initialInfoScreensLength: initialInfoScreens.length,
      });
      return;
    }
    
    // ИСПРАВЛЕНО: Кэширование - не загружаем прогресс повторно, если он уже был загружен
    // Это оптимизирует обмен данными и предотвращает лишние запросы
    if (progressLoadedRef.current) {
      clientLogger.log('⏸️ loadSavedProgressFromServer: пропущено, прогресс уже загружен (кэш)', {
        currentInfoScreenIndexRef: currentInfoScreenIndexRef.current,
        hasSavedProgress: !!savedProgress,
      });
      return;
    }
    
    // ИСПРАВЛЕНО: Логируем вызов для отладки в Telegram Mini App
    clientLogger.log('🔄 loadSavedProgressFromServer: вызов', {
      loadProgressInProgress: loadProgressInProgressRef.current,
      progressLoadInProgress: progressLoadInProgressRef.current,
      hasResumedRef: hasResumedRef.current,
      hasResumed,
      initCompleted: initCompletedRef.current,
      currentInfoScreenIndexRef: currentInfoScreenIndexRef.current,
      isAlreadyOnQuestions,
      progressLoaded: progressLoadedRef.current,
      stack: new Error().stack?.split('\n').slice(1, 4).join('\n'),
    });
    
    // Защита от множественных вызовов
    if (loadProgressInProgressRef.current) {
      clientLogger.log('⏸️ loadSavedProgressFromServer: уже выполняется, пропускаем');
      return;
    }
    
    // ИСПРАВЛЕНО: Проверяем hasResumed ПЕРЕД установкой loadProgressInProgressRef
    // Это предотвращает начало загрузки, если пользователь уже продолжил анкету
    if (hasResumedRef.current || hasResumed) {
      clientLogger.log('⏸️ loadSavedProgressFromServer: hasResumed = true, пропускаем');
      return;
    }
    
    // ИСПРАВЛЕНО: Дополнительная проверка progressLoadInProgressRef
    // Это предотвращает повторные вызовы после resumeQuiz
    if (progressLoadInProgressRef.current) {
      clientLogger.log('⏸️ loadSavedProgressFromServer: progressLoadInProgressRef = true, пропускаем');
      return;
    }
    
    loadProgressInProgressRef.current = true;

    try {
      // Если пользователь только что нажал "Начать заново", не загружаем прогресс
      // Используем ref для синхронной проверки, так как состояние обновляется асинхронно
      if (isStartingOverRef.current || isStartingOver) {
        return;
      }
      // Если пользователь уже нажал "Продолжить" (hasResumed = true), не загружаем прогресс снова
      // Это предотвращает повторное появление экрана "Вы не завершили анкету"
      // Используем ref для синхронной проверки, так как состояние обновляется асинхронно
      // ИСПРАВЛЕНО: Проверяем еще раз перед API вызовом
      if (hasResumedRef.current || hasResumed) {
        clientLogger.log('⏸️ loadSavedProgressFromServer: hasResumed = true перед API вызовом, пропускаем');
        return;
      }
      // Проверяем, что Telegram WebApp доступен перед запросом
      if (typeof window === 'undefined' || !window.Telegram?.WebApp?.initData) {
        return;
      }
      
      // ФИКС: Используем React Query для загрузки прогресса (приоритет)
      // Это обеспечивает автоматическое кэширование и уменьшает количество запросов
      let response: {
        progress?: {
          answers: Record<number, string | string[]>;
          questionIndex: number;
          infoScreenIndex: number;
          timestamp: number;
        } | null;
      } | null = null;
      
      if (quizProgressFromQuery) {
        // Используем данные из React Query кэша
        clientLogger.log('✅ Используем прогресс из React Query кэша', {
          hasProgress: !!(quizProgressFromQuery as any)?.progress,
        });
        response = quizProgressFromQuery as any;
      } else if (!isLoadingProgress) {
        // Если React Query не загружает и данных нет, используем прямой вызов API как fallback
        clientLogger.log('🔄 Загружаем прогресс через прямой API вызов (fallback)');
        response = await api.getQuizProgress() as {
          progress?: {
            answers: Record<number, string | string[]>;
            questionIndex: number;
            infoScreenIndex: number;
            timestamp: number;
          } | null;
        };
      } else {
        // Если React Query загружает, ждем завершения
        clientLogger.log('⏳ Ожидаем загрузку прогресса через React Query...');
        // Ждем максимум 3 секунды
        let waitAttempts = 0;
        const maxWaitAttempts = 30; // 30 * 100ms = 3 секунды максимум
        while (isLoadingProgress && !quizProgressFromQuery && waitAttempts < maxWaitAttempts) {
          await new Promise(resolve => setTimeout(resolve, 100));
          waitAttempts++;
        }
        
        if (quizProgressFromQuery) {
          response = quizProgressFromQuery as any;
        } else {
          // Если React Query не загрузил, используем прямой вызов API
          response = await api.getQuizProgress() as {
            progress?: {
              answers: Record<number, string | string[]>;
              questionIndex: number;
              infoScreenIndex: number;
              timestamp: number;
            } | null;
          };
        }
      }
      
      if (!response) {
        return;
      }
      
      // ИСПРАВЛЕНО: Проверяем наличие профиля перед показом экрана "Вы не завершили анкету"
      // Если профиля нет, но есть ответы - это может быть старые данные, которые нужно очистить
      // Не показываем экран "Вы не завершили анкету" если профиля нет
      let hasProfile = false;
      try {
        const profile = await api.getCurrentProfile();
        hasProfile = !!(profile && profile.id);
      } catch (profileErr: any) {
        const isNotFound = profileErr?.status === 404 || 
                          profileErr?.message?.includes('404') || 
                          profileErr?.message?.includes('No profile') ||
                          profileErr?.message?.includes('Profile not found');
        if (isNotFound) {
          hasProfile = false;
        }
      }
      
      // ИСПРАВЛЕНО: Показываем экран "Вы не завершили анкету" если есть ответы, независимо от наличия профиля
      // Профиль создается только после завершения анкеты (отправки ответов)
      // Поэтому для незавершенной анкеты профиля быть не должно
      // ВАЖНО: Проверяем только наличие ответов, а не наличие профиля
      // ИСПРАВЛЕНО: Показываем экран прогресса только если есть минимум 5 ответов или questionIndex >= 5
      const answersCount = response?.progress?.answers ? Object.keys(response.progress.answers).length : 0;
      const questionIndex = response?.progress?.questionIndex ?? -1;
      const shouldShowProgressScreen = 
        answersCount >= QUIZ_CONFIG.VALIDATION.MIN_ANSWERS_FOR_PROGRESS_SCREEN || 
        questionIndex >= QUIZ_CONFIG.VALIDATION.MIN_QUESTION_INDEX_FOR_PROGRESS_SCREEN;
      
      if (response?.progress && response.progress.answers && answersCount > 0 && shouldShowProgressScreen) {
        // ФИКС: Начальные экраны - это только те, которые не имеют showAfterQuestionCode И не имеют showAfterInfoScreenId
              const initialInfoScreens = getInitialInfoScreens();
        
        // ФИКС: Не загружаем прогресс, если пользователь уже перешел к вопросам (currentInfoScreenIndex >= initialInfoScreens.length)
        // Это предотвращает сброс currentInfoScreenIndex на 0 после перехода к вопросам
        // ИСПРАВЛЕНО: Используем ref для синхронной проверки, так как state обновляется асинхронно
        // КРИТИЧНО: Также проверяем, что загруженный прогресс не имеет infoScreenIndex меньше, чем текущий
        // Это предотвращает откат назад после перехода к вопросам
        
        // ФИКС: Проверяем sessionStorage для восстановления индекса при перемонтировании
        let restoredIndex: number | null = null;
        if (typeof window !== 'undefined') {
          try {
            const savedInfoScreenIndex = sessionStorage.getItem(QUIZ_CONFIG.STORAGE_KEYS.CURRENT_INFO_SCREEN);
            if (savedInfoScreenIndex !== null) {
              const savedIndex = parseInt(savedInfoScreenIndex, 10);
              if (!isNaN(savedIndex) && savedIndex >= 0 && savedIndex <= initialInfoScreens.length) {
                restoredIndex = savedIndex;
                // Используем восстановленный индекс, если он больше текущего
                if (restoredIndex > currentInfoScreenIndexRef.current) {
                  currentInfoScreenIndexRef.current = restoredIndex;
                  setCurrentInfoScreenIndex(restoredIndex);
                  clientLogger.log('💾 Использован восстановленный currentInfoScreenIndex из sessionStorage', {
                    restoredIndex,
                    currentInfoScreenIndexRef: currentInfoScreenIndexRef.current,
                  });
                }
              }
            }
          } catch (err) {
            clientLogger.warn('⚠️ Не удалось проверить currentInfoScreenIndex в sessionStorage', err);
          }
        }
        
        let currentInfoIndex = currentInfoScreenIndexRef.current >= initialInfoScreens.length 
          ? currentInfoScreenIndexRef.current 
          : currentInfoScreenIndex;
        const progressInfoIndex = response.progress.infoScreenIndex || 0;
        
        if (currentInfoIndex >= initialInfoScreens.length) {
          clientLogger.log('⏸️ loadSavedProgressFromServer: пропущено, так как пользователь уже на вопросах', {
            currentInfoScreenIndex,
            currentInfoScreenIndexRef: currentInfoScreenIndexRef.current,
            initialInfoScreensLength: initialInfoScreens.length,
            progressInfoScreenIndex: progressInfoIndex,
            currentInfoIndex,
            restoredIndex,
          });
          return;
        }
        
        // КРИТИЧНО: Если текущий infoScreenIndex больше, чем в загруженном прогрессе, не загружаем прогресс
        // Это предотвращает откат назад после того, как пользователь прошел больше экранов
        // ИСПРАВЛЕНО: Также проверяем, что если пользователь уже на вопросах (currentInfoIndex >= initialInfoScreens.length),
        // то НИКОГДА не загружаем прогресс, даже если progressInfoIndex больше
        // Это предотвращает редирект на первый экран после перехода к вопросам
        if (currentInfoIndex >= initialInfoScreens.length) {
          clientLogger.log('⏸️ loadSavedProgressFromServer: пропущено, так как пользователь уже на вопросах (защита от редиректа)', {
            currentInfoScreenIndex,
            currentInfoScreenIndexRef: currentInfoScreenIndexRef.current,
            progressInfoScreenIndex: progressInfoIndex,
            currentInfoIndex,
            restoredIndex,
            initialInfoScreensLength: initialInfoScreens.length,
          });
          return;
        }
        if (currentInfoIndex > progressInfoIndex && currentInfoIndex > 0) {
          clientLogger.log('⏸️ loadSavedProgressFromServer: пропущено, так как текущий прогресс больше загруженного', {
            currentInfoScreenIndex,
            currentInfoScreenIndexRef: currentInfoScreenIndexRef.current,
            progressInfoScreenIndex: progressInfoIndex,
            currentInfoIndex,
            restoredIndex,
            initialInfoScreensLength: initialInfoScreens.length,
          });
          return;
        }
        
        clientLogger.log('✅ Найдены сохраненные ответы, показываем экран продолжения', {
          answersCount: Object.keys(response.progress.answers).length,
          questionIndex: response.progress.questionIndex,
          hasProfile,
        });
        // ВАЖНО: Не загружаем прогресс, если пользователь уже нажал "Продолжить"
        // Это предотвращает повторное появление экрана "Вы не завершили анкету"
        // Используем ref для синхронной проверки, так как состояние обновляется асинхронно
        if (hasResumedRef.current || hasResumed) {
          clientLogger.log('⏸️ loadSavedProgressFromServer: пропущено после получения ответа, так как hasResumed = true', {
            refValue: hasResumedRef.current,
            stateValue: hasResumed,
          });
          return;
        }
        
        // ВАЖНО: Еще раз проверяем hasResumedRef ПЕРЕД установкой состояний
        // Это критично, так как запрос мог быть отправлен до установки hasResumedRef
        if (hasResumedRef.current || hasResumed) {
          clientLogger.log('⏸️ loadSavedProgressFromServer: пропущено перед установкой состояний, так как hasResumed = true', {
            refValue: hasResumedRef.current,
            stateValue: hasResumed,
          });
          return;
        }
        
        // ИСПРАВЛЕНО: Финальная проверка hasResumed ПЕРЕД установкой состояний
        // Это критично для предотвращения бесконечного цикла между экраном продолжения и первым экраном анкеты
        if (hasResumedRef.current || hasResumed) {
          clientLogger.log('⏸️ loadSavedProgressFromServer: hasResumed = true перед установкой состояний, пропускаем', {
            refValue: hasResumedRef.current,
            stateValue: hasResumed,
          });
          return;
        }
        
        // КРИТИЧНО: Финальная проверка перед установкой savedProgress
        // Если пользователь уже на вопросах, не устанавливаем savedProgress, чтобы не сбросить состояние
        const finalCheckInfoIndex = currentInfoScreenIndexRef.current >= initialInfoScreens.length 
          ? currentInfoScreenIndexRef.current 
          : currentInfoScreenIndex;
        if (finalCheckInfoIndex >= initialInfoScreens.length) {
          clientLogger.log('⏸️ loadSavedProgressFromServer: финальная проверка - пользователь уже на вопросах, не устанавливаем savedProgress', {
            currentInfoScreenIndex,
            currentInfoScreenIndexRef: currentInfoScreenIndexRef.current,
            initialInfoScreensLength: initialInfoScreens.length,
            progressInfoScreenIndex: progressInfoIndex,
            finalCheckInfoIndex,
          });
          return;
        }
        
        // ИСПРАВЛЕНО: Финальная проверка ПЕРЕД установкой savedProgress
        // Если пользователь уже на вопросах (currentInfoScreenIndexRef.current >= initialInfoScreens.length),
        // НИКОГДА не устанавливаем savedProgress, даже если он найден на сервере
        // Это предотвращает редирект на первый экран после перехода к вопросам
        const finalCheckBeforeSet = currentInfoScreenIndexRef.current >= initialInfoScreens.length;
        if (finalCheckBeforeSet) {
          clientLogger.log('⏸️ loadSavedProgressFromServer: финальная проверка перед установкой - пользователь уже на вопросах, не устанавливаем savedProgress', {
            currentInfoScreenIndex,
            currentInfoScreenIndexRef: currentInfoScreenIndexRef.current,
            initialInfoScreensLength: initialInfoScreens.length,
            progressInfoScreenIndex: progressInfoIndex,
          });
          return;
        }
        
        clientLogger.log('✅ Прогресс найден на сервере, показываем экран продолжения:', {
          answersCount: Object.keys(response.progress.answers).length,
          questionIndex: response.progress.questionIndex,
          infoScreenIndex: response.progress.infoScreenIndex,
          hasProfile,
        });
        // ИСПРАВЛЕНО: Сначала устанавливаем showResumeScreen и savedProgress СИНХРОННО,
        // чтобы предотвратить показ начальных экранов на промежуточных рендерах
        setSavedProgress(response.progress);
        setShowResumeScreen(true);
        // ИСПРАВЛЕНО: Устанавливаем loading = false ПОСЛЕ установки showResumeScreen,
        // чтобы экран resume показался сразу и не было мигания начальных экранов
        // Это гарантирует, что пользователь увидит экран "Вы не завершили анкету" до первого экрана анкеты
        setLoading(false);
        // ИСПРАВЛЕНО: Прогресс сохраняется в БД через API, localStorage больше не используется
      } else {
        clientLogger.log('ℹ️ Прогресс на сервере не найден или пуст');
        // ИСПРАВЛЕНО: Прогресс хранится в БД, localStorage больше не используется
        setSavedProgress(null);
        setShowResumeScreen(false);
        // Не вызываем loadSavedProgress(), так как прогресс должен быть синхронизирован с сервером
      }
    } catch (err: any) {
      // Если ошибка 401 - это нормально, просто не используем серверный прогресс
      if (err?.message?.includes('401') || err?.message?.includes('Unauthorized')) {
        // Не логируем 401 ошибки, так как это нормально, если пользователь не авторизован
        // ИСПРАВЛЕНО: Прогресс хранится в БД, localStorage больше не используется
        setSavedProgress(null);
        setShowResumeScreen(false);
        return;
      }
        
        // ФИКС: Обработка KV ошибок (max requests limit exceeded)
        const errorMessage = err?.message || String(err);
        const isKVError = errorMessage.includes('max requests limit exceeded') || 
                         errorMessage.includes('Upstash') || 
                         errorMessage.includes('KV') ||
                         errorMessage.includes('rate limit');
        
        if (isKVError) {
          // Если это ошибка KV (лимит запросов), явно устанавливаем savedProgress = null
          // и пропускаем resume-экран, чтобы не застревать на начальных инфо-скринах
          clientLogger.warn('⚠️ Ошибка KV при загрузке прогресса - продолжаем как новый пользователь', {
            error: errorMessage,
            hasResumedRef: hasResumedRef.current,
            hasResumed,
          });
          setSavedProgress(null);
          setShowResumeScreen(false);
          // Сбрасываем currentQuestionIndex на 0 для нового пользователя, если он выходит за пределы
          if (currentQuestionIndex >= allQuestions.length && allQuestions.length > 0) {
            setCurrentQuestionIndex(0);
          }
          // Пропускаем начальные инфо-скрины, если индекс уже прошел их
          // ФИКС: НЕ сбрасываем на первый экран при KV ошибке - это вызывает повторные редиректы
          // Вместо этого пропускаем начальные экраны и переходим к вопросам
          // ФИКС: Начальные экраны - это только те, которые не имеют showAfterQuestionCode И не имеют showAfterInfoScreenId
              const initialInfoScreens = getInitialInfoScreens();
          if (currentInfoScreenIndex >= initialInfoScreens.length && allQuestions.length > 0) {
            // Уже на вопросах - ничего не делаем
          } else if (currentInfoScreenIndex < initialInfoScreens.length && allQuestions.length > 0) {
            // Начальные экраны еще не пройдены - пропускаем их и переходим к вопросам
            // НЕ сбрасываем на 0, чтобы не вызвать редирект на первый экран
            setCurrentInfoScreenIndex(initialInfoScreens.length);
            setCurrentQuestionIndex(0);
          }
          return;
        }
        
      clientLogger.warn('Ошибка загрузки прогресса с сервера:', err);
      // ИСПРАВЛЕНО: Прогресс хранится в БД, localStorage больше не используется
      setSavedProgress(null);
      setShowResumeScreen(false);
    } finally {
      // ИСПРАВЛЕНО: Не сбрасываем флаги, если пользователь уже продолжил анкету
      // Это предотвращает повторные вызовы loadSavedProgressFromServer в Telegram Mini App
      if (!hasResumedRef.current && !hasResumed) {
        loadProgressInProgressRef.current = false;
      } else {
        // Если hasResumed = true, оставляем флаги установленными, чтобы предотвратить повторные вызовы
        clientLogger.log('🔒 loadSavedProgressFromServer: оставляем флаги установленными, так как hasResumed = true');
      }
      
      // ИСПРАВЛЕНО: Дополнительная проверка после завершения загрузки
      // Если hasResumed стал true во время загрузки, очищаем состояния
      if (hasResumedRef.current || hasResumed) {
        clientLogger.log('⏸️ loadSavedProgressFromServer: hasResumed = true после загрузки, очищаем состояния');
        setSavedProgress(null);
        setShowResumeScreen(false);
      }
    }
  };
  
  // КОНЕЦ старой реализации (удалить после проверки)

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
  }, [isDev, isRetakingQuiz, showRetakeScreen, questionnaire, loading, error, savedProgress, currentQuestionIndex, hasResumed]);
  // ИСПРАВЛЕНО: Сохраняем функцию в ref для использования в init
  // КРИТИЧНО: Устанавливаем ref СИНХРОННО при объявлении функции, чтобы он был доступен в init ДО того, как init() начнет ждать
  // ИСПРАВЛЕНО: Не используем useEffect, так как он может выполниться после того, как init() уже начал ждать
  loadQuestionnaireRef.current = loadQuestionnaire;

  // РЕФАКТОРИНГ: Функция вынесена в lib/quiz/handlers/handleAnswer.ts
  const handleAnswer = async (questionId: number, value: string | string[]) => {
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
      addDebugLog,
    });
  };

  // РЕФАКТОРИНГ: Функция вынесена в lib/quiz/handlers/handleNext.ts
  const handleNext = async () => {
    return handleNextFn({
      handleNextInProgressRef,
      currentInfoScreenIndexRef,
      questionnaireRef,
      initCompletedRef,
      questionnaire,
        loading,
        currentInfoScreenIndex,
        currentQuestionIndex,
      allQuestions,
        isRetakingQuiz,
        showRetakeScreen,
        hasResumed,
      pendingInfoScreen,
      answers,
      setIsHandlingNext,
      setCurrentInfoScreenIndex,
      setCurrentQuestionIndex,
      setPendingInfoScreen,
      saveProgress,
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
      setCurrentInfoScreenIndex,
      setCurrentQuestionIndex,
      setPendingInfoScreen,
      saveProgress,
      answers,
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


  const submitAnswers = useCallback(async () => {
    await submitAnswersFn({
      questionnaire,
      answers,
      isSubmitting,
      isSubmittingRef,
      isMountedRef,
      isDev,
      initData: initData || null,
      setAnswers,
      setIsSubmitting,
      setLoading,
      setError,
      setFinalizing,
      setFinalizingStep,
      setFinalizeError,
      redirectInProgressRef,
      submitAnswersRef,
      isRetakingQuiz,
      getInitData: () => getInitData(initData || null),
    });
  }, [questionnaire, answers, isSubmitting, isRetakingQuiz, isMountedRef, initData, setAnswers, setIsSubmitting, setLoading, setError, setFinalizing, setFinalizingStep, setFinalizeError, redirectInProgressRef, submitAnswersRef, isSubmittingRef, getInitData]);

  // Продолжить с сохранённого места
  const resumeQuiz = () => {
    resumeQuizFn({
      savedProgress,
      questionnaire,
      redirectInProgressRef,
      initCompletedRef,
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
      resumeCompletedRef,
    });
  };

  // Начать заново
  const startOver = async () => {
    await startOverFn({
      isStartingOverRef,
      setIsStartingOver,
      initCompletedRef,
      initCalledRef,
      clearProgress,
      setAnswers,
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
  
  // КРИТИЧНО: Логируем состояние allQuestions после каждого вычисления
  // ИСПРАВЛЕНО: Используем примитивные значения в зависимостях, чтобы избежать React Error #310
  useEffect(() => {
    clientLogger.log('📊 allQuestions state updated', {
      allQuestionsRawLength: allQuestionsRaw.length,
      allQuestionsLength: allQuestions.length,
      allQuestionsPrevRefLength: allQuestionsPrevRef.current.length,
      hasQuestionnaire: !!questionnaire,
      hasQuestionnaireRef: !!questionnaireRef.current,
      questionnaireId: questionnaire?.id || questionnaireRef.current?.id,
      questionIds: allQuestions.length > 0 ? allQuestions.map((q: Question) => q?.id).slice(0, 10) : [],
    });
  }, [allQuestions.length, allQuestionsRaw.length, questionnaire?.id]);
  
  // РЕФАКТОРИНГ: savedProgressAnswersCount теперь в useQuizComputed
  useEffect(() => {
    // Логируем всегда для отладки
    clientLogger.log('📊 allQuestions state', {
      allQuestionsRawLength: allQuestionsRaw.length,
      allQuestionsLength: allQuestions.length,
      isRetakingQuiz,
      showRetakeScreen,
      answersCount,
      savedProgressAnswersCount,
      questionIds: allQuestions.map((q: Question) => q.id),
      questionCodes: allQuestions.map((q: Question) => q.code),
    });
  }, [allQuestions.length, allQuestionsRaw.length, isRetakingQuiz, showRetakeScreen, answersCount, savedProgressAnswersCount]);

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
    initCalledRef,
    initInProgressRef,
    isMountedRef,
    progressLoadedRef,
    loadProgressInProgressRef,
    progressLoadInProgressRef,
    loadQuestionnaireInProgressRef,
    loadQuestionnaireAttemptedRef,
    loadQuestionnaireRef,
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
    historyUpdateInProgressRef,
    lastHistoryUpdateTimeRef,
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
    answersCount,
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
    
    // КРИТИЧНО: Для нового пользователя без сохраненного прогресса всегда начинаем с 0
    // Это предотвращает ситуацию, когда currentQuestionIndex установлен из старого прогресса,
    // но после фильтрации вопросов он выходит за границы
    // ФИКС: Проверяем sessionStorage перед сбросом - если там есть сохраненный индекс, не сбрасываем
    const hasNoSavedProgress = !savedProgress || !savedProgress.answers || Object.keys(savedProgress.answers).length === 0;
    let savedQuestionIndexFromStorage: number | null = null;
    let savedInfoScreenIndexFromStorage: number | null = null;
    if (typeof window !== 'undefined') {
      try {
        const saved = sessionStorage.getItem(QUIZ_CONFIG.STORAGE_KEYS.CURRENT_QUESTION);
        if (saved !== null) {
          const parsed = parseInt(saved, 10);
          if (!isNaN(parsed) && parsed >= 0) {
            savedQuestionIndexFromStorage = parsed;
          }
        }
        // ФИКС: Также проверяем currentInfoScreenIndex - если он больше длины начальных экранов,
        // значит пользователь уже прошел начальные экраны и отвечал на вопросы
        const savedInfoScreen = sessionStorage.getItem(QUIZ_CONFIG.STORAGE_KEYS.CURRENT_INFO_SCREEN);
        if (savedInfoScreen !== null) {
          const parsed = parseInt(savedInfoScreen, 10);
          if (!isNaN(parsed) && parsed >= 0) {
            savedInfoScreenIndexFromStorage = parsed;
          }
        }
      } catch (err) {
        // Игнорируем ошибки sessionStorage
      }
    }
    
    // ФИКС: Проверяем, прошел ли пользователь начальные экраны
    // Если да, значит он уже отвечал на вопросы, и не нужно сбрасывать индекс
              const initialInfoScreens = getInitialInfoScreens();
    const hasPassedInitialScreens = savedInfoScreenIndexFromStorage !== null && savedInfoScreenIndexFromStorage >= initialInfoScreens.length;
    
    const shouldResetToZero = hasNoSavedProgress && 
                               currentQuestionIndex > 0 && 
                               answersCount === 0 && 
                               !isRetakingQuiz && 
                               !hasResumed &&
                               savedQuestionIndexFromStorage === null && // ФИКС: Не сбрасываем, если есть сохраненный индекс
                               !hasPassedInitialScreens; // ФИКС: Не сбрасываем, если пользователь уже прошел начальные экраны
    
    if (shouldResetToZero) {
      clientLogger.log('🔄 Сбрасываем currentQuestionIndex на 0 для нового пользователя', {
        currentQuestionIndex,
        allQuestionsLength: allQuestions.length,
        hasNoSavedProgress,
        answersCount,
        isRetakingQuiz,
        hasResumed,
        savedQuestionIndexFromStorage,
      });
      setCurrentQuestionIndex(0);
      return;
    }
    
    // ФИКС: Если есть сохраненный индекс в sessionStorage, но currentQuestionIndex не совпадает - восстанавливаем
    if (savedQuestionIndexFromStorage !== null && 
        savedQuestionIndexFromStorage !== currentQuestionIndex && 
        savedQuestionIndexFromStorage < allQuestions.length) {
      clientLogger.log('🔄 Восстанавливаем currentQuestionIndex из sessionStorage', {
        savedQuestionIndex: savedQuestionIndexFromStorage,
        currentQuestionIndex,
        allQuestionsLength: allQuestions.length,
      });
      setCurrentQuestionIndex(savedQuestionIndexFromStorage);
      return;
    }
    
    // ИСПРАВЛЕНО: Корректируем индекс СРАЗУ, если он невалидный
    if (isOutOfBounds && !isSubmitting && !showResumeScreen) {
      // Если анкета завершена — держим индекс на allQuestions.length для автоотправки.
      // Иначе корректируем на последний валидный вопрос или на 0 для нового пользователя.
      const correctedIndex = isQuizCompleted
        ? allQuestions.length
        : (hasNoSavedProgress && answersCount === 0 ? 0 : Math.max(0, Math.min(currentQuestionIndex, allQuestions.length - 1)));
      
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
  }, [questionnaire, allQuestions, currentQuestionIndex, isSubmitting, loading, hasResumed, showResumeScreen, answers, savedProgress, isRetakingQuiz, showRetakeScreen, allQuestionsRaw.length]);

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
    
    if (isOutOfBounds && !isSubmitting && !showResumeScreen) {
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
    const currentQuestionInAllQuestions = allQuestions[currentQuestionIndex];
    if (!currentQuestionInAllQuestions && allQuestions.length > 0) {
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
  }, [hasResumed, allQuestions, currentQuestionIndex, questionnaire]); // ИСПРАВЛЕНО: Убрали currentQuestion из зависимостей, используем allQuestions[currentQuestionIndex] внутри

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
  }, [isRetakingQuiz, questionnaire, currentQuestionIndex, showResumeScreen, savedProgress, hasResumed, answers, showRetakeScreen]); // ИСПРАВЛЕНО: Убрали currentInfoScreenIndex из зависимостей, чтобы избежать бесконечного цикла

  // РЕФАКТОРИНГ: initialInfoScreens теперь в useQuizComputed

  // ФИКС: Принудительная проверка после завершения всех начальных экранов
  // Это предотвращает застревание на info screens
  // ВАЖНО: Не выполняем, если hasResumed = true, чтобы не сбрасывать состояние после resumeQuiz
  useEffect(() => {
    if (currentInfoScreenIndex >= initialInfoScreens.length && !isRetakingQuiz && !showResumeScreen && !hasResumed && !resumeCompletedRef.current) {
      // Если мы прошли все начальные экраны, но pendingInfoScreen все еще установлен - очищаем его
      if (pendingInfoScreen) {
        if (isDev) {
          clientLogger.warn('🔧 ФИКС: Очищаем pendingInfoScreen после завершения всех начальных экранов', {
            currentInfoScreenIndex,
            initialInfoScreensLength: initialInfoScreens.length,
            pendingInfoScreenId: pendingInfoScreen.id,
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
    if (!savedProgress && !hasResumed && !showResumeScreen && !isRetakingQuiz && !loading && questionnaire && !resumeCompletedRef.current) {
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
    
    // ФИКС: Для нового пользователя принудительно пропускаем инфо-скрины после загрузки анкеты
    // Это гарантирует, что новый пользователь увидит вопросы
    // ВАЖНО: Защита от повторных сбросов
    // ВАЖНО: Не выполняем, если resumeQuiz уже выполнен, чтобы не сбрасывать состояние после resumeQuiz
    // ВАЖНО: Не выполняем, если пользователь уже проходит инфо-экраны (currentInfoScreenIndex > 0), чтобы не сбрасывать на первый экран
    if (questionnaire && allQuestions.length > 0 && !loading && !hasResumed && !showResumeScreen && !isRetakingQuiz && !firstScreenResetRef.current && !resumeCompletedRef.current && currentInfoScreenIndex === 0) {
      const hasNoSavedProgress = !savedProgress || !savedProgress.answers || Object.keys(savedProgress.answers || {}).length === 0;
      const isNewUser = hasNoSavedProgress && currentInfoScreenIndex === 0 && currentQuestionIndex === 0;
      
      if (isNewUser) {
        // Небольшая задержка, чтобы дать время другим useEffect выполниться
        const timeoutId = setTimeout(() => {
          if (currentInfoScreenIndex === 0 && currentQuestionIndex === 0 && allQuestions.length > 0 && !firstScreenResetRef.current) {
            firstScreenResetRef.current = true; // Помечаем, что сброс выполнен
            if (isDev) {
              clientLogger.log('🔧 ФИКС: Новый пользователь - принудительно пропускаем инфо-скрины', {
                currentInfoScreenIndex,
                initialInfoScreensLength: initialInfoScreens.length,
                allQuestionsLength: allQuestions.length,
              });
            }
            setCurrentInfoScreenIndex(initialInfoScreens.length);
            setPendingInfoScreen(null);
            setCurrentQuestionIndex(0);
          }
        }, 100);
        
        return () => clearTimeout(timeoutId);
      }
    }
  }, [currentInfoScreenIndex, initialInfoScreens.length, pendingInfoScreen, isRetakingQuiz, showResumeScreen, hasResumed, currentQuestionIndex, allQuestions.length, Object.keys(answers).length, isDev, savedProgress?.answers ? Object.keys(savedProgress.answers).length : 0, loading, questionnaire?.id, setCurrentQuestionIndex, setCurrentInfoScreenIndex, setPendingInfoScreen]);

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
  }, [currentQuestionIndex, allQuestions.length, answersCount, questionnaire, isSubmitting, showResumeScreen, autoSubmitTriggered, error, pendingInfoScreen, initCompletedRef]);

  // ВАЖНО: ранние return'ы должны быть ПОСЛЕ всех хуков
  // Проверяем состояние загрузки, ошибку и наличие анкеты после вызова всех хуков

  // ИСПРАВЛЕНО: Убрали плановый лоадер из /quiz
  // Логика "Создаем план" должна быть на /plan, а /quiz должен показывать:
  // - лоадер анкеты
  // - вопросы
  // - ошибки анкеты
  // Если анкета отправлена (isSubmitting === true), сразу редиректим на /plan без показа лоадера
  
  // ИСПРАВЛЕНО: Если isSubmitting = true, но init() еще не завершен - сбрасываем isSubmitting
  // Это предотвращает показ планового лоадера для нового пользователя
  // КРИТИЧНО: Проверяем ПЕРЕД проверкой на редирект, чтобы не редиректить для нового пользователя
  if (isSubmitting && !initCompletedRef.current) {
    clientLogger.log('🧹 Сбрасываем isSubmitting, так как init() еще не завершен');
    setIsSubmitting(false);
    isSubmittingRef.current = false;
  }
  
  // КРИТИЧНО: Проверяем isSubmitting ПЕРЕД проверкой loading
  // ИСПРАВЛЕНО: Добавляем проверку initCompletedRef И questionnaire, чтобы не редиректить для нового пользователя
  // Это предотвращает показ планового лоадера, если isSubmitting остался true из предыдущей сессии
  // или если автоотправка сработала до завершения init()
  // КРИТИЧНО: Также проверяем, что questionnaire загружен, чтобы не редиректить при загрузке
  if (isSubmitting && initCompletedRef.current && questionnaire) {
    // Редиректим на /plan, где будет показан правильный лоадер
    // ТОЛЬКО если init() завершен И questionnaire загружен - это гарантирует, что это реальная отправка
    if (typeof window !== 'undefined') {
      const justSubmitted = sessionStorage.getItem(QUIZ_CONFIG.STORAGE_KEYS.JUST_SUBMITTED) === 'true';
      if (!justSubmitted) {
        // Устанавливаем флаг только если его еще нет (защита от дублирования)
        try {
          sessionStorage.setItem('quiz_just_submitted', 'true');
        } catch (error) {
          // Игнорируем ошибки sessionStorage
        }
      }
      // ИСПРАВЛЕНО: Guard против множественных редиректов
      if (redirectInProgressRef.current) {
        return null; // Редирект уже в процессе
      }
      redirectInProgressRef.current = true;
      // Редиректим на /plan?state=generating, где будет показан лоадер
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem('quiz_init_done');
        window.location.replace('/plan?state=generating');
      }
      // Показываем минимальный лоадер во время редиректа (не плановый!)
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
  }

  // КРИТИЧНО: Синхронная проверка quiz_just_submitted ПЕРЕД любым рендером
  // Это предотвращает показ лоадера "Загрузка анкеты..." для нового пользователя
  // и предотвращает показ планового лоадера на 2 секунды
  // ИСПРАВЛЕНО: Проверяем синхронно, до всех условных рендеров
  if (typeof window !== 'undefined') {
    const justSubmitted = sessionStorage.getItem(QUIZ_CONFIG.STORAGE_KEYS.JUST_SUBMITTED) === 'true';
    if (justSubmitted) {
      // Очищаем флаг сразу, чтобы не проверять его снова
      sessionStorage.removeItem(QUIZ_CONFIG.STORAGE_KEYS.JUST_SUBMITTED);
      // ИСПРАВЛЕНО: Guard против множественных редиректов
      if (redirectInProgressRef.current) {
        return null; // Редирект уже в процессе
      }
      redirectInProgressRef.current = true;
      // Устанавливаем initCompletedRef, чтобы предотвратить повторную инициализацию
      initCompletedRef.current = true;
      // Редиректим на /plan?state=generating СРАЗУ, без задержек
      // Используем window.location.replace для немедленного редиректа
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem('quiz_init_done');
        window.location.replace('/plan?state=generating');
      }
      // Возвращаем минимальный лоадер "Перенаправление..." во время редиректа
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
  }

  // ИСПРАВЛЕНО: Убрали setLoading(false) из рендера - это вызывает повторные рендеры
  // Абсолютные таймауты уже реализованы в useEffect
  // ИСПРАВЛЕНО: Логирование перенесено в useEffect для предотвращения спама в логах
  // Логируем только в development или при необходимости диагностики
  if (isDev) {
    clientLogger.log('🔍 Quiz page render - checking what to display', {
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
  
  // ИСПРАВЛЕНО: Показываем лоадер только если анкета действительно не загружена
  // КРИТИЧНО: Проверяем и questionnaire (state), и questionnaireRef.current, чтобы не блокировать отображение
  // если анкета загружена в ref, но state еще не обновился
  // КРИТИЧНО: НЕ показываем лоадер, если анкета загружена в ref или state - это блокирует рендеринг анкеты
  const hasQuestionnaireAnywhereBasic = !!questionnaire || !!questionnaireRef.current;
  
  // ИСПРАВЛЕНО: Логируем только в development, чтобы не создавать спам в production
  if (isDev) {
    clientLogger.log('🔍 RENDER - hasQuestionnaireAnywhereBasic check', {
      timestamp: new Date().toISOString(),
      hasQuestionnaireAnywhereBasic,
      hasQuestionnaireState: !!questionnaire,
      hasQuestionnaireRef: !!questionnaireRef.current,
      loading,
    });
  }
  
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

  // Экран продолжения анкеты
  // Экран выбора тем при повторном прохождении анкеты
  if (showRetakeScreen && isRetakingQuiz) {
    const retakeTopics = getAllTopics();
    
    clientLogger.log('🔄 Retake screen check:', {
      showRetakeScreen,
      isRetakingQuiz,
      hasRetakingPayment,
      paymentKey: 'stored in DB', // ИСПРАВЛЕНО: Флаги оплаты хранятся в БД
    });
    
    const handleTopicSelect = (topic: QuizTopic) => {
      // В paid-состоянии PaymentGate отдаёт children, и клик по карточке работает.
      router.push(`/quiz/update/${topic.id}`);
    };

    const handleFullRetake = async () => {
      // Для полного перепрохождения нужна отдельная оплата 99₽
      if (!hasFullRetakePayment) {
        clientLogger.log('⚠️ Full retake payment not completed, showing payment gate');
        // Показываем PaymentGate для полного перепрохождения
        return;
      }

      clientLogger.log('✅ Full retake payment completed, starting full questionnaire reset');

      // Сбрасываем флаг оплаты после использования в БД
      try {
        await userPreferences.setPaymentFullRetakeCompleted(false);
        clientLogger.log('🔄 Full retake payment flag cleared');
      } catch (err) {
        clientLogger.warn('Failed to clear full retake payment flag:', err);
      }

      // Полное перепрохождение:
      // - скрываем экран выбора тем
      // - очищаем ответы и сохранённый прогресс
      // - сбрасываем индексы и флаги "продолжить"
      setShowRetakeScreen(false);
      setIsRetakingQuiz(true); // остаёмся в режиме перепрохождения, но с чистой анкетой

      // Отмечаем, что пользователь начинает заново
      setIsStartingOver(true);
      isStartingOverRef.current = true;

      // Полный сброс ответов и прогресса
      setAnswers({});
      setSavedProgress(null);
      setShowResumeScreen(false);
      setHasResumed(false);
      hasResumedRef.current = false;

      autoSubmitTriggeredRef.current = false;
      setAutoSubmitTriggered(false);
      setError(null);

      // ИСПРАВЛЕНО: Очищаем флаги перепрохождения в БД
      try {
        await userPreferences.setIsRetakingQuiz(false);
        await userPreferences.setFullRetakeFromHome(false);
      } catch (err) {
        clientLogger.warn('Failed to clear retake flags:', err);
      }

      // Начинаем анкету с самого начала
      if (questionnaire) {
        setCurrentInfoScreenIndex(0); // показываем все инфо-экраны заново
        setCurrentQuestionIndex(0);
        setPendingInfoScreen(null);
        clientLogger.log('✅ Full retake: answers and progress cleared, starting from first info screen');
      }
    };

    const retakeScreenContent = (
      <div style={{
        minHeight: '100vh',
        padding: '20px',
        background: 'linear-gradient(135deg, #F5FFFC 0%, #E8FBF7 100%)',
      }}>
        {/* Логотип */}
        <div style={{
          padding: '20px',
          textAlign: 'center',
        }}>
        </div>

        {/* Заголовок */}
        <div style={{
          textAlign: 'center',
          marginBottom: '32px',
        }}>
          <h1 style={{
            fontSize: '28px',
            fontWeight: 'bold',
            color: '#0A5F59',
            marginBottom: '12px',
          }}>
            Что хотите изменить?
          </h1>
          <p style={{
            fontSize: '16px',
            color: '#6B7280',
            lineHeight: '1.6',
          }}>
            Выберите тему, которую хотите обновить, или пройдите анкету полностью
          </p>
        </div>

        {/* Список тем */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          marginBottom: '24px',
        }}>
          {retakeTopics.map((topic) => {
            const topicButton = (
              <button
                key={topic.id}
                onClick={() => handleTopicSelect(topic)}
                style={{
                  padding: '20px',
                  borderRadius: '16px',
                  backgroundColor: 'white',
                  border: '1px solid #E5E7EB',
                  textAlign: 'left',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  boxShadow: '0 2px 4px rgba(0, 0, 0, 0.05)',
                  width: '100%',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = '#0A5F59';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(10, 95, 89, 0.15)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = '#E5E7EB';
                  e.currentTarget.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.05)';
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <div style={{
                    fontSize: '32px',
                    width: '48px',
                    height: '48px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    {topic.icon || '📝'}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{
                      fontSize: '18px',
                      fontWeight: '600',
                      color: '#111827',
                      marginBottom: '4px',
                    }}>
                      {topic.title}
                    </div>
                    <div style={{
                      fontSize: '14px',
                      color: '#6B7280',
                    }}>
                      {topic.description}
                    </div>
                  </div>
                  <div style={{
                    fontSize: '24px',
                    color: '#9CA3AF',
                  }}>
                    →
                  </div>
                </div>
              </button>
            );
            
            // ИСПРАВЛЕНО: ретейк темы = 49₽ (через productCode=retake_topic).
            // После оплаты сразу переходим в /quiz/update/{topicId}.
            return (
              <PaymentGate
                key={topic.id}
                price={49}
                productCode="retake_topic"
                isRetaking={true}
                onPaymentComplete={() => {
                  clientLogger.log('✅ Retake topic payment completed, navigating to topic', { topicId: topic.id });
                  router.push(`/quiz/update/${topic.id}`);
                }}
              >
                {topicButton}
              </PaymentGate>
            );
          })}
        </div>

        {/* Кнопка полного перепрохождения */}
        {!hasFullRetakePayment ? (
          <PaymentGate
            price={99}
            productCode="retake_full"
            isRetaking={true}
            onPaymentComplete={async () => {
              // Обновляем состояние оплаты из API (источник правды)
              try {
                const entitlements = await api.getEntitlements();
                const hasRetakeFull = entitlements?.entitlements?.some(
                  (e: any) => e.code === 'retake_full_access' && e.active === true
                ) || false;
                setHasFullRetakePayment(hasRetakeFull);
                clientLogger.log('✅ Full retake payment completed, entitlements updated', { hasRetakeFull });
              } catch (err) {
                clientLogger.warn('⚠️ Failed to refresh entitlements after payment, using fallback', err);
                // Сохраняем флаг оплаты в БД
                try {
                  await userPreferences.setPaymentFullRetakeCompleted(true);
                  setHasFullRetakePayment(true);
                } catch (err) {
                  clientLogger.warn('Failed to save full retake payment flag:', err);
                }
              }
              
              // После оплаты разрешаем полное перепрохождение
              setShowRetakeScreen(false);
              // Устанавливаем флаг перепрохождения, чтобы пропустить все info screens
              setIsRetakingQuiz(true);
              // Пропускаем все начальные info screens - переходим сразу к вопросам
              if (questionnaire) {
                // ФИКС: Начальные экраны - это только те, которые не имеют showAfterQuestionCode И не имеют showAfterInfoScreenId
                const initialInfoScreens = getInitialInfoScreens();
                setCurrentInfoScreenIndex(initialInfoScreens.length);
                setCurrentQuestionIndex(0);
                setPendingInfoScreen(null);
                clientLogger.log('✅ Full retake payment: Skipping all info screens, starting from first question');
              }
            }}
          >
            <div style={{ width: '100%', marginTop: '8px' }}>
              <button
                style={{
                  width: '100%',
                  padding: '16px',
                  borderRadius: '16px',
                  backgroundColor: 'rgba(255, 255, 255, 0.8)',
                  border: '2px solid #0A5F59',
                  color: '#0A5F59',
                  fontSize: '16px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#0A5F59';
                  e.currentTarget.style.color = 'white';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.8)';
                  e.currentTarget.style.color = '#0A5F59';
                }}
              >
                Пройти всю анкету заново (99 ₽)
              </button>
            </div>
          </PaymentGate>
        ) : (
        <button
          onClick={handleFullRetake}
          style={{
            width: '100%',
            padding: '16px',
            borderRadius: '16px',
            backgroundColor: 'rgba(255, 255, 255, 0.8)',
            border: '2px solid #0A5F59',
            color: '#0A5F59',
            fontSize: '16px',
            fontWeight: '600',
            cursor: 'pointer',
            transition: 'all 0.2s',
            marginTop: '8px',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#0A5F59';
            e.currentTarget.style.color = 'white';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.8)';
            e.currentTarget.style.color = '#0A5F59';
          }}
        >
          Пройти всю анкету заново
        </button>
        )}

        {/* Кнопка отмены */}
        <div style={{ textAlign: 'center', marginTop: '24px' }}>
          <button
            onClick={() => router.push('/plan')}
            style={{
              padding: '12px 24px',
              borderRadius: '12px',
              backgroundColor: 'transparent',
              border: '1px solid #D1D5DB',
              color: '#6B7280',
              fontSize: '14px',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = '#9CA3AF';
              e.currentTarget.style.color = '#111827';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = '#D1D5DB';
              e.currentTarget.style.color = '#6B7280';
            }}
          >
            Отмена
          </button>
        </div>
      </div>
    );

    // Показываем экран выбора тем
    // Каждая тема и кнопка "Пройти всю анкету" обернуты в свой PaymentGate
    return retakeScreenContent;
  }

  // ВАЖНО: Не показываем экран "Вы не завершили анкету", если пользователь нажал "Начать заново"
  // или уже продолжил анкету
  // ИСПРАВЛЕНО: Добавлена проверка на минимальное количество ответов (>= 5) для показа экрана прогресса
  const savedAnswersCount = savedProgress?.answers ? Object.keys(savedProgress.answers).length : 0;
  const savedQuestionIndex = savedProgress?.questionIndex ?? -1;
  const shouldShowProgressScreen = savedAnswersCount >= 5 || savedQuestionIndex >= 5;
  
  if (showResumeScreen && savedProgress && !isStartingOverRef.current && !hasResumedRef.current && shouldShowProgressScreen) {
    // Получаем все вопросы с фильтрацией
    // ИСПРАВЛЕНО: Добавляем проверку на существование groups и questions
    const allQuestionsRaw = questionnaire ? [
      ...(questionnaire.groups || []).flatMap((g) => g.questions || []),
      ...(questionnaire.questions || []),
    ] : [];
    
    // ИСПРАВЛЕНО: Используем единую функцию filterQuestions вместо дублирующей логики
    // filterQuestions уже использует allAnswers (answers + savedProgress.answers) внутри
    const allQuestions = filterQuestions({
      questions: allQuestionsRaw,
      answers,
      savedProgressAnswers: savedProgress?.answers,
      isRetakingQuiz,
      showRetakeScreen,
      logger: clientLogger, // Передаем clientLogger для логирования
    });
    
    // ИСПРАВЛЕНО: Считаем только ответы на вопросы, которые остались в allQuestions после фильтрации
    // Это предотвращает завышение прогресса, когда часть вопросов была отфильтрована (например, pregnancy для мужчин)
    const relevantQuestionIds = new Set(allQuestions.map(q => q.id.toString()));
    const answeredCount = Object.keys(savedProgress.answers).filter(
      questionId => relevantQuestionIds.has(questionId)
    ).length;
    const totalQuestions = allQuestions.length;
    const progressPercent = totalQuestions > 0 ? Math.round((answeredCount / totalQuestions) * 100) : 0;

    return (
      <div style={{ 
        padding: '20px',
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #F5FFFC 0%, #E8FBF7 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <div style={{
          width: '88%',
          maxWidth: '420px',
          backgroundColor: 'rgba(255, 255, 255, 0.58)',
          backdropFilter: 'blur(26px)',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          borderRadius: '44px',
          padding: '36px 28px 32px 28px',
          boxShadow: '0 16px 48px rgba(0, 0, 0, 0.12), 0 8px 24px rgba(0, 0, 0, 0.08)',
        }}>
          <h1 className="quiz-title" style={{
            fontFamily: "'Unbounded', -apple-system, BlinkMacSystemFont, sans-serif",
            fontWeight: 700,
            fontSize: '32px',
            lineHeight: '38px',
            color: '#0A5F59',
            margin: '0 0 16px 0',
            textAlign: 'center',
          }}>
            Вы не завершили анкету
          </h1>

          <p style={{
            fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
            fontWeight: 400,
            fontSize: '18px',
            lineHeight: '1.5',
            color: '#475467',
            margin: '0 0 24px 0',
            textAlign: 'center',
          }}>
            Продолжите, чтобы получить персональный план ухода
          </p>

          {/* Прогресс */}
          <div style={{
            marginBottom: '28px',
            padding: '16px',
            backgroundColor: 'rgba(10, 95, 89, 0.08)',
            borderRadius: '16px',
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginBottom: '8px',
              fontSize: '14px',
              color: '#0A5F59',
              fontWeight: 600,
            }}>
              <span>Прогресс</span>
              <span>{answeredCount} из {totalQuestions} вопросов</span>
            </div>
            <div style={{
              width: '100%',
              height: '8px',
              backgroundColor: 'rgba(10, 95, 89, 0.2)',
              borderRadius: '4px',
              overflow: 'hidden',
            }}>
              <div style={{
                width: `${progressPercent}%`,
                height: '100%',
                backgroundColor: '#0A5F59',
                transition: 'width 0.3s ease',
              }} />
            </div>
          </div>

          {/* Выгоды */}
          <div style={{
            marginBottom: '28px',
            padding: '0',
          }}>
            <h3 style={{
              fontSize: '16px',
              fontWeight: 600,
              color: '#0A5F59',
              marginBottom: '12px',
            }}>
              Что вы получите:
            </h3>
            {[
              'Персональный план ухода на 12 недель',
              'Рекомендации от косметолога-дерматолога',
              'Точная диагностика типа и состояния кожи',
            ].map((benefit, index) => (
              <div key={index} style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '12px',
                marginBottom: index < 2 ? '12px' : '0',
              }}>
                <div style={{
                  width: '20px',
                  height: '20px',
                  borderRadius: '50%',
                  backgroundColor: '#0A5F59',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  marginTop: '2px',
                }}>
                  <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
                <span style={{
                  fontSize: '15px',
                  color: '#1F2A44',
                  lineHeight: '1.5',
                }}>
                  {String(benefit || '')}
                </span>
              </div>
            ))}
          </div>

          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}>
            <button
              onClick={resumeQuiz}
              style={{
                width: '100%',
                height: '64px',
                background: '#0A5F59',
                color: 'white',
                border: 'none',
                borderRadius: '32px',
                fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
                fontWeight: 500,
                fontSize: '19px',
                boxShadow: '0 8px 24px rgba(10, 95, 89, 0.3), 0 4px 12px rgba(10, 95, 89, 0.2)',
                cursor: 'pointer',
              }}
            >
              Продолжить с вопроса {savedProgress.questionIndex + 1} →
            </button>
          </div>
        </div>
      </div>
    );
  }

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
  }, [loading, questionnaire?.id, allQuestions.length, currentQuestionIndex, currentQuestion?.id, isShowingInitialInfoScreen, pendingInfoScreen?.id, showResumeScreen, hasResumed, isRetakingQuiz, showRetakeScreen, Object.keys(answers).length, savedProgress?.answers ? Object.keys(savedProgress.answers).length : 0, currentInfoScreenIndex, error, allQuestionsRaw.length]);

  // ИСПРАВЛЕНО: Проверяем showResumeScreen ПЕРЕД isShowingInitialInfoScreen,
  // чтобы предотвратить мигание начальных экранов перед показом экрана продолжения
  // Это критично, так как showResumeScreen устанавливается асинхронно после загрузки прогресса
  // ВАЖНО: showResumeScreen уже проверяется выше в коде (строка 3900), но добавляем дополнительную проверку здесь
  // для гарантии правильного порядка рендеринга

  // ИСПРАВЛЕНО: Проверяем showResumeScreen ПЕРЕД info screens,
  // чтобы предотвратить показ info screens, если должен показываться экран продолжения
  // ВАЖНО: showResumeScreen уже обработан выше, поэтому здесь просто пропускаем info screens

  // РЕФАКТОРИНГ: Используем хук useQuizView для определения текущего экрана
  // Это упрощает условия рендеринга и делает код более читаемым
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
    initCompleted: initCompletedRef.current, // ФИКС: Передаем флаг завершения инициализации
    savedProgress,
    answers,
    allQuestionsLength: allQuestions.length,
    isDev,
  });

  // Если показывается информационный экран между вопросами
  // При повторном прохождении пропускаем все info screens
  // ИСПРАВЛЕНО: Не блокируем, если показывается resume screen
  // РЕФАКТОРИНГ: Используем компонент QuizInfoScreen
  if (pendingInfoScreen && !isRetakingQuiz && !showResumeScreen) {
    return (
      <QuizInfoScreen
        screen={pendingInfoScreen}
        currentInfoScreenIndex={currentInfoScreenIndex}
        questionnaire={questionnaire}
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
  const effectiveQuestionnaire = questionnaireRef.current || questionnaire || quizStateMachine.questionnaire;
  // ИСПРАВЛЕНО: Ослабляем условие для инфо-экранов - показываем их даже если effectiveQuestionnaire временно null
  // Это предотвращает блокировку инфо-экранов из-за временных состояний questionnaire
  // КРИТИЧНО: Инфо-экраны должны показываться на первом рендере, даже если анкета еще загружается
  // Проверка !loading убрана, так как она может блокировать показ вопросов после перехода к ним
  // Кнопка на первом экране уже имеет проверку загрузки анкеты
  if (isShowingInitialInfoScreen && 
      currentInitialInfoScreen && 
      currentInfoScreenIndex < initialInfoScreens.length &&
      !isRetakingQuiz && 
      !showResumeScreen && 
      !pendingInfoScreen) {
    // ИСПРАВЛЕНО: Логируем всегда (не только в dev), чтобы видеть в БД, почему инфо-экраны не показываются
      clientLogger.log('📺 Рендерим начальный инфо-экран', {
        currentInfoScreenIndex,
        initialInfoScreensLength: initialInfoScreens.length,
        currentInitialInfoScreenId: currentInitialInfoScreen?.id,
        isShowingInitialInfoScreen,
      hasEffectiveQuestionnaire: !!effectiveQuestionnaire,
      hasQuestionnaireState: !!questionnaire,
      hasQuestionnaireRef: !!questionnaireRef.current,
      hasQuestionnaireStateMachine: !!quizStateMachine.questionnaire,
      loading,
      });
    // РЕФАКТОРИНГ: Используем компонент QuizInfoScreen
    return (
      <QuizInfoScreen
        screen={currentInitialInfoScreen}
        currentInfoScreenIndex={currentInfoScreenIndex}
        questionnaire={questionnaire}
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
      />
    );
  }
  
  // ИСПРАВЛЕНО: Логируем, если инфо-экраны должны показываться, но не показываются
  if (isShowingInitialInfoScreen && currentInfoScreenIndex < initialInfoScreens.length) {
    clientLogger.warn('⚠️ Инфо-экраны должны показываться, но не показываются', {
      currentInfoScreenIndex,
      initialInfoScreensLength: initialInfoScreens.length,
      currentInitialInfoScreen: !!currentInitialInfoScreen,
      isRetakingQuiz,
      showResumeScreen,
      pendingInfoScreen: !!pendingInfoScreen,
      hasEffectiveQuestionnaire: !!effectiveQuestionnaire,
      hasQuestionnaireState: !!questionnaire,
      hasQuestionnaireRef: !!questionnaireRef.current,
      hasQuestionnaireStateMachine: !!quizStateMachine.questionnaire,
      loading,
    });
  }
  
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
  
  // КРИТИЧНО: Если isShowingInitialInfoScreen = true, но currentInitialInfoScreen = null,
  // это означает несоответствие условий (например, элемент массива undefined)
  // В этом случае пропускаем начальные экраны и переходим к вопросам
  // ИСПРАВЛЕНО: Используем useEffect для обновления состояния, чтобы избежать проблем с рендерингом
  // ИСПРАВЛЕНО: Теперь используем isShowingInitialInfoScreen, который уже исправляет несоответствие
  // Но все равно добавляем useEffect для исправления currentInfoScreenIndex, если нужно
  useEffect(() => {
    // ИСПРАВЛЕНО: КРИТИЧЕСКАЯ ЗАЩИТА - НЕ сбрасываем currentInfoScreenIndex, если пользователь уже перешел к вопросам
    // Это предотвращает редирект на первый экран после 4-го инфо-экрана
    if (currentInfoScreenIndexRef.current >= initialInfoScreens.length) {
      // Пользователь уже на вопросах - НИКОГДА не сбрасываем обратно на начальные экраны
      return;
    }
    
    // ВАЖНО: Не выполняем, если resumeQuiz уже выполнен, чтобы не сбрасывать состояние после resumeQuiz
    if (isShowingInitialInfoScreen && !currentInitialInfoScreen && !isRetakingQuiz && !showResumeScreen && !loading && !resumeCompletedRef.current) {
      clientLogger.warn('⚠️ isShowingInitialInfoScreen = true, но currentInitialInfoScreen = null - исправляем несоответствие и пропускаем начальные экраны', {
        currentInfoScreenIndex,
        initialInfoScreensLength: initialInfoScreens.length,
        hasCurrentScreen: !!initialInfoScreens[currentInfoScreenIndex],
        isShowingInitialInfoScreen,
        hasResumed,
        loading,
      });
      // Пропускаем начальные экраны и переходим к вопросам
      // Устанавливаем currentInfoScreenIndex в initialInfoScreens.length, чтобы пропустить все начальные экраны
      if (currentInfoScreenIndex < initialInfoScreens.length) {
        setCurrentInfoScreenIndex(initialInfoScreens.length);
      }
    }
  }, [isShowingInitialInfoScreen, currentInitialInfoScreen, currentInfoScreenIndex, initialInfoScreens.length, isRetakingQuiz, showResumeScreen, loading, hasResumed]);

  // ИСПРАВЛЕНО: Не блокируем отображение вопросов, если они должны показываться
  // Проверяем только критические ошибки, которые действительно требуют вмешательства
  // Если currentQuestion null, но анкета загружена и есть вопросы - это временное состояние,
  // которое исправится в следующем рендере (useEffect корректирует индекс)
  // КРИТИЧНО: Также проверяем, что currentInfoScreenIndex >= initialInfoScreens.length
  // Это означает, что пользователь уже прошел все начальные экраны и должен видеть вопросы
  // ИСПРАВЛЕНО: Используем ref для более точной проверки, так как state может быть устаревшим
  const isPastInitialScreens = currentInfoScreenIndex >= initialInfoScreens.length;
  const isPastInitialScreensRef = currentInfoScreenIndexRef.current >= initialInfoScreens.length;
  // ИСПРАВЛЕНО: Не проверяем currentQuestion, если показываются начальные экраны
  // Это предотвращает блокировку инфо-экранов из-за null currentQuestion
  if (!currentQuestion && !hasResumed && !showResumeScreen && !pendingInfoScreen && !isShowingInitialInfoScreen && !isPastInitialScreens && !isPastInitialScreensRef) {
    // Если анкета загружена и есть вопросы, но currentQuestionIndex выходит за пределы
    if (questionnaire && allQuestions.length > 0) {
      // ИСПРАВЛЕНО: Если индекс выходит за пределы и нет ответов - показываем сообщение "Начать заново"
      // Это состояние может возникнуть при неправильно сохраненном прогрессе
      if (currentQuestionIndex >= allQuestions.length) {
        const answersCount = Object.keys(answers || {}).length;
        if (answersCount === 0) {
          // ИСПРАВЛЕНО: Даем время на корректировку индекса перед показом ошибки
          // useEffect выше должен исправить индекс, поэтому не показываем ошибку сразу
          clientLogger.warn('⚠️ currentQuestion null: индекс >= length, но нет ответов - ждем корректировки', {
            currentQuestionIndex,
            allQuestionsLength: allQuestions.length,
            answersCount,
          });
          // НЕ возвращаем ошибку сразу - даем время на корректировку
          // Продолжаем выполнение, чтобы показать основной рендер (который покажет "Вопрос не найден" если нужно)
        }
        // Если индекс вышел за пределы, но есть ответы - это нормальное состояние после завершения анкеты
        // Продолжаем выполнение, чтобы показать лоадер ниже
      } else if (currentQuestionIndex >= 0 && currentQuestionIndex < allQuestions.length) {
        // Индекс в пределах массива, но вопрос не найден - это временное состояние
        // ФИКС: Показываем fallback "Загрузка вопросов..." вместо продолжения выполнения
        // Это предотвращает показ "Вопрос не найден" слишком рано
        clientLogger.warn('⚠️ currentQuestion null: индекс валидный, но вопрос не найден - показываем fallback', {
          currentQuestionIndex,
          allQuestionsLength: allQuestions.length,
          hasResumed,
          showResumeScreen,
          currentInfoScreenIndex,
          isShowingInitialInfoScreen,
          pendingInfoScreen: !!pendingInfoScreen,
        });
        // Показываем fallback для временного состояния
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
            <div style={{ color: '#0A5F59', fontSize: '18px' }}>
              Загрузка вопросов...
            </div>
          </div>
        );
      }
    }
    
    // ИСПРАВЛЕНО: Убрали лоадер "Загрузка анкеты..."
    // Анкета загружается мгновенно, пользователь увидит вопросы без задержки
  }
  
  // Если вопрос не найден, но hasResumed = true - это временное состояние, показываем загрузку
  if (!currentQuestion && hasResumed) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <div>Загрузка вопроса...</div>
      </div>
    );
  }
  
  // ИСПРАВЛЕНО: Не блокируем отображение вопросов, если они должны показываться
  // Проверяем только критические ошибки, которые действительно требуют вмешательства
  // Если currentQuestion null, но анкета загружена и есть вопросы - это временное состояние,
  // которое исправится в следующем рендере (useEffect корректирует индекс)
  // ВАЖНО: Не проверяем это условие, если показываются info screens или resume screen
  if (!currentQuestion && !isShowingInitialInfoScreen && !pendingInfoScreen && !showResumeScreen && !hasResumed) {
    // ИСПРАВЛЕНО: Если allQuestions пустой, показываем лоадер или сообщение
    // Проверяем независимо от состояния loading, чтобы предотвратить ошибки рендеринга
    // ИСПРАВЛЕНО: Не показываем ошибку если идет загрузка или если allQuestionsRaw еще не пересчитан
    if (allQuestions.length === 0 && !loading && questionnaireRef.current) {
      // Это может произойти во время фильтрации или если все вопросы были отфильтрованы
      // Показываем лоадер, так как это временное состояние
      // ИСПРАВЛЕНО: Проверяем, есть ли вопросы в questionnaire перед показом ошибки
      const hasQuestionsInQuestionnaire = (questionnaire?.groups?.some((g: any) => g?.questions?.length > 0) || 
                                           (questionnaire?.questions && questionnaire.questions.length > 0));
      if (allQuestionsRaw.length === 0 && hasQuestionsInQuestionnaire) {
        // allQuestionsRaw еще не пересчитан, но вопросы есть - это временное состояние
        return null;
      }
      if (allQuestionsRaw.length === 0) {
        // Если даже allQuestionsRaw пустой, значит анкета не содержит вопросов
        return (
          <div style={{ 
            padding: '20px', 
            textAlign: 'center',
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            background: 'linear-gradient(135deg, #F5FFFC 0%, #E8FBF7 100%)'
          }}>
            <div style={{
              backgroundColor: 'rgba(255, 255, 255, 0.9)',
              borderRadius: '24px',
              padding: '32px',
              maxWidth: '500px',
              width: '100%',
              textAlign: 'center',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
            }}>
              <h2 style={{ color: '#0A5F59', marginBottom: '12px', fontSize: '20px', fontWeight: 'bold' }}>
                Анкета не содержит вопросов
              </h2>
              <p style={{ color: '#475467', marginBottom: '24px', lineHeight: '1.6' }}>
                Пожалуйста, обратитесь в поддержку.
              </p>
              <button
                onClick={() => {
                  if (typeof window !== 'undefined') {
                    window.location.reload();
                  }
                }}
                style={{
                  width: '100%',
                  padding: '16px 24px',
                  borderRadius: '12px',
                  backgroundColor: '#0A5F59',
                  color: 'white',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '16px',
                  fontWeight: 'bold',
                  boxShadow: '0 4px 12px rgba(10, 95, 89, 0.3)',
                }}
              >
                Обновить страницу
              </button>
            </div>
          </div>
        );
      }
      // УПРОЩЕНО: Убран лоадер для случая, когда все вопросы отфильтрованы
      // Это не нужно для нового пользователя - анкета должна отображаться сразу
      // Если все вопросы отфильтрованы - это ошибка, показываем ошибку (обрабатывается ниже)
    }
    
    // ИСПРАВЛЕНО: Показываем ошибку только если анкета не загружена И ошибка связана с загрузкой анкеты
    // Это предотвращает показ временных ошибок, которые уже исправлены
    if (!questionnaire && !loading && error && (error.includes('загрузить анкету') || error.includes('Invalid questionnaire') || error.includes('Questionnaire has no questions'))) {
      return (
        <div style={{ 
          padding: '20px', 
          textAlign: 'center',
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          background: 'linear-gradient(135deg, #F5FFFC 0%, #E8FBF7 100%)'
        }}>
          <div style={{
            backgroundColor: 'rgba(255, 255, 255, 0.9)',
            borderRadius: '24px',
            padding: '32px',
            maxWidth: '500px',
            width: '100%',
            textAlign: 'center',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
          }}>
            <h2 style={{ color: '#0A5F59', marginBottom: '12px', fontSize: '20px', fontWeight: 'bold' }}>
              Ошибка загрузки анкеты
            </h2>
            <p style={{ color: '#475467', marginBottom: '24px', lineHeight: '1.6' }}>
              {typeof error === 'string' ? error : ((error as any)?.message || 'Произошла ошибка загрузки анкеты')}
            </p>
            <button
              onClick={() => {
                if (typeof window !== 'undefined') {
                  window.location.reload();
                }
              }}
              style={{
                width: '100%',
                padding: '16px 24px',
                borderRadius: '12px',
                backgroundColor: '#0A5F59',
                color: 'white',
                border: 'none',
                cursor: 'pointer',
                fontSize: '16px',
                fontWeight: 'bold',
                boxShadow: '0 4px 12px rgba(10, 95, 89, 0.3)',
              }}
            >
              Обновить страницу
            </button>
          </div>
        </div>
      );
    }


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
  }

  // ИСПРАВЛЕНО: Заменяем бесконечный лоадер на явную обработку ошибок
  // Различаем два случая: анкета не загрузилась vs все вопросы отфильтрованы
  // ИСПРАВЛЕНО: Не показываем ошибку если идет загрузка или если allQuestionsRaw еще не пересчитан
  // ИСПРАВЛЕНО: Не блокируем отображение, если показываются info screens или resume screen
  // ИСПРАВЛЕНО: Используем isShowingInitialInfoScreen вместо isShowingInitialInfoScreen
  if ((!currentQuestion || allQuestions.length === 0) && !loading && !showResumeScreen && !showRetakeScreen && !isShowingInitialInfoScreen && !pendingInfoScreen && !hasResumed && questionnaireRef.current) {
    // Случай 1: Анкета не загрузилась (questionnaire === null)
    if (!questionnaire) {
      clientLogger.error('❌ Questionnaire not loaded - showing error to user', {
        loading,
        error,
        hasQuestionnaire: !!questionnaire,
        hasQuestionnaireRef: !!questionnaireRef.current,
        questionnaireRefId: questionnaireRef.current?.id,
        initCompleted: initCompletedRef.current,
        initInProgress: initInProgressRef.current,
      });
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
              fontSize: '48px',
              marginBottom: '24px',
            }}>⚠️</div>
            <h2 style={{ color: '#0A5F59', marginBottom: '12px', fontSize: '20px', fontWeight: 'bold' }}>
              Не удалось загрузить анкету
            </h2>
            <p style={{ color: '#475467', fontSize: '16px', lineHeight: '1.5', marginBottom: '24px' }}>
              {typeof error === 'string' ? error : ((error as any)?.message || 'Пожалуйста, откройте приложение через Telegram или обновите страницу.')}
            </p>
            <button
              onClick={() => {
                if (typeof window !== 'undefined') {
                  window.location.reload();
                }
              }}
              style={{
                backgroundColor: '#0A5F59',
                color: 'white',
                border: 'none',
                borderRadius: '12px',
                padding: '12px 24px',
                fontSize: '16px',
                fontWeight: 'bold',
                cursor: 'pointer',
              }}
            >
              Обновить страницу
            </button>
          </div>
        </div>
      );
    }
    
    // Случай 2: Анкета загрузилась, но все вопросы отфильтрованы
    if (questionnaire && allQuestionsRaw.length > 0 && allQuestions.length === 0) {
      clientLogger.error('❌ All questions filtered out - showing error to user', {
        allQuestionsRawLength: allQuestionsRaw.length,
        allQuestionsLength: allQuestions.length,
        answersCount: Object.keys(answers).length,
        isRetakingQuiz,
        showRetakeScreen,
      });
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
              fontSize: '48px',
              marginBottom: '24px',
            }}>⚠️</div>
            <h2 style={{ color: '#0A5F59', marginBottom: '12px', fontSize: '20px', fontWeight: 'bold' }}>
              Все вопросы отфильтрованы
            </h2>
            <p style={{ color: '#475467', fontSize: '16px', lineHeight: '1.5', marginBottom: '24px' }}>
              Похоже, что все вопросы анкеты были отфильтрованы. Пожалуйста, обновите страницу или обратитесь в поддержку.
            </p>
            <button
              onClick={() => {
                if (typeof window !== 'undefined') {
                  window.location.reload();
                }
              }}
              style={{
                backgroundColor: '#0A5F59',
                color: 'white',
                border: 'none',
                borderRadius: '12px',
                padding: '12px 24px',
                fontSize: '16px',
                fontWeight: 'bold',
                cursor: 'pointer',
              }}
            >
              Обновить страницу
            </button>
          </div>
        </div>
      );
    }
    
    // Случай 3: Анкета загрузилась, но allQuestionsRaw пустой (анкета без вопросов)
    // ИСПРАВЛЕНО: Не показываем экран "нет вопросов" если идет загрузка или если allQuestionsRaw еще не пересчитан
    // Проверяем questionnaireRef.current, чтобы убедиться, что анкета действительно загружена
    if (questionnaire && allQuestionsRaw.length === 0 && !loading && questionnaireRef.current) {
      // Дополнительная проверка: если в questionnaire есть вопросы, но allQuestionsRaw пустой - это временное состояние
      const hasQuestionsInQuestionnaire = (questionnaire.groups?.some((g: any) => g?.questions?.length > 0) || 
                                           (questionnaire.questions && questionnaire.questions.length > 0));
      if (hasQuestionsInQuestionnaire) {
        // Есть вопросы в анкете, но allQuestionsRaw еще не пересчитан - не показываем ошибку
        // Это временное состояние, useMemo пересчитается в следующем рендере
        return null;
      }
      
      clientLogger.error('❌ Questionnaire loaded but has no questions - showing error to user', {
        questionnaireId: questionnaire.id,
        hasGroups: !!questionnaire.groups,
        groupsCount: questionnaire.groups?.length || 0,
        hasQuestions: !!questionnaire.questions,
        questionsCount: questionnaire.questions?.length || 0,
      });
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
              fontSize: '48px',
              marginBottom: '24px',
            }}>⚠️</div>
            <h2 style={{ color: '#0A5F59', marginBottom: '12px', fontSize: '20px', fontWeight: 'bold' }}>
              Анкета пуста
            </h2>
            <p style={{ color: '#475467', fontSize: '16px', lineHeight: '1.5', marginBottom: '24px' }}>
              Анкета загружена, но в ней нет вопросов. Пожалуйста, обновите страницу или обратитесь в поддержку.
            </p>
            <button
              onClick={() => {
                if (typeof window !== 'undefined') {
                  window.location.reload();
                }
              }}
              style={{
                backgroundColor: '#0A5F59',
                color: 'white',
                border: 'none',
                borderRadius: '12px',
                padding: '12px 24px',
                fontSize: '16px',
                fontWeight: 'bold',
                cursor: 'pointer',
              }}
            >
              Обновить страницу
            </button>
          </div>
        </div>
      );
    }
    
    // ИСПРАВЛЕНО: Лоадер анкеты убран - его не должно быть на /quiz
    // Лоадер показывается только на главной странице (/)
    // Если анкета не загружена, просто продолжаем рендер (покажем ошибку ниже, если она есть)
  }

  // КРИТИЧНО: Логируем, что именно показывается пользователю в конце рендера
  // Это помогает диагностировать проблему с отображением анкеты
  // ИСПРАВЛЕНО: Используем questionnaireRef.current если questionnaire (state) еще не обновился
  const questionnaireToRender = questionnaire || questionnaireRef.current;
  
  // КРИТИЧНО: Проверяем, почему анкета может не отображаться
  // Если анкета загружена, но loading все еще true - это проблема
  // Это обрабатывается в useEffect выше, который принудительно сбрасывает loading
  if (questionnaireToRender && loading) {
    clientLogger.warn('⚠️ CRITICAL: Questionnaire loaded but loading=true - this should be fixed by useEffect', {
      hasQuestionnaire: !!questionnaire,
      hasQuestionnaireRef: !!questionnaireRef.current,
      questionnaireId: questionnaireToRender?.id,
      loading,
      initCompleted: initCompletedRef.current,
      initInProgress: initInProgressRef.current,
    });
  }
  
  // КРИТИЧНО: Если анкета загружена, но не отображается - логируем все условия
  // ИСПРАВЛЕНО: Логируем только в development для предотвращения спама
  if (isDev && questionnaireToRender && !loading && !error) {
    clientLogger.log('✅ Questionnaire should be visible - all conditions met', {
      hasQuestionnaire: !!questionnaire,
      hasQuestionnaireRef: !!questionnaireRef.current,
      questionnaireId: questionnaireToRender?.id,
      loading,
      error: error || null,
      showResumeScreen,
      showRetakeScreen,
      isShowingInitialInfoScreen,
      pendingInfoScreen: !!pendingInfoScreen,
      isRetakingQuiz,
      hasResumed,
      initCompleted: initCompletedRef.current,
      currentQuestion: !!currentQuestion,
      currentQuestionIndex,
      allQuestionsLength: allQuestions.length,
    });
  }
  
  // КРИТИЧНО: Логируем состояние перед рендерингом анкеты
  // ИСПРАВЛЕНО: Логируем только в development для предотвращения спама
  if (isDev) {
    clientLogger.log('🔍 Final render check - what will be displayed?', {
    timestamp: new Date().toISOString(),
    hasQuestionnaire: !!questionnaire,
    hasQuestionnaireRef: !!questionnaireRef.current,
    hasQuestionnaireToRender: !!questionnaireToRender,
    questionnaireId: questionnaire?.id || questionnaireRef.current?.id || null,
    hasCurrentQuestion: !!currentQuestion,
    currentQuestionId: currentQuestion?.id,
    currentQuestionIndex,
    allQuestionsLength: allQuestions.length,
    allQuestionsRawLength: allQuestionsRaw.length,
    loading,
    error: error || null,
    showResumeScreen,
    showRetakeScreen,
    isShowingInitialInfoScreen,
    pendingInfoScreen: !!pendingInfoScreen,
    initCompleted: initCompletedRef.current,
    initInProgress: initInProgressRef.current,
    willShowLoader: loading && !questionnaireToRender,
    willShowError: !!error && !loading,
    willShowQuestionnaire: !!questionnaireToRender && !loading && !error,
    isRetakingQuiz,
    hasResumed,
    });
  }

  // ФИКС: Показываем лоадер в самом начале, если анкета еще не загружена или идет загрузка
  // Это предотвращает показ белого экрана при загрузке приложения
  // ИСПРАВЛЕНО: Проверка перенесена после всех хуков, чтобы не нарушать правила React hooks
  // Лоадер показывается пока: loading=true ИЛИ анкета не загружена
  // ФИКС: Проверяем initCompletedRef, чтобы лоадер показывался до завершения init()
  // Это предотвращает показ первого инфо-экрана до загрузки анкеты
  // ФИКС: НЕ проверяем allQuestions.length, так как фильтрация происходит динамически после ответов
  // ФИКС: Проверяем не только наличие объекта, но и что он действительно загружен (имеет id)
  // ИСПРАВЛЕНО: Также проверяем questionnaireFromQuery из React Query
  const effectiveQuestionnaireForLoader = questionnaireRef.current || questionnaire || quizStateMachine.questionnaire || questionnaireFromQuery;
  const hasValidQuestionnaire = effectiveQuestionnaireForLoader && effectiveQuestionnaireForLoader.id;
  // ФИКС: Показываем лоадер только при первой загрузке
  // ИСПРАВЛЕНО: Не показываем лоадер, если анкета уже была загружена (даже если идет рефетч)
  // Проверяем, что анкета действительно отсутствует во всех источниках
  // ИСПРАВЛЕНО: Не показываем лоадер, если показывается pendingInfoScreen (предотвращает каскад ремоунтов)
  const hasQuestionnaireAnywhere = !!questionnaireRef.current || !!questionnaire || !!quizStateMachine.questionnaire || !!questionnaireFromQuery;
  const shouldShowInitialLoader = !pendingInfoScreen && !hasQuestionnaireAnywhere && (loading || !initCompletedRef.current);
  
  // ФИКС: Ранний return для лоадера (после всех хуков)
  if (shouldShowInitialLoader && !showResumeScreen && !showRetakeScreen) {
    return (
      <div style={{ 
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #F5FFFC 0%, #E8FBF7 100%)',
        padding: '40px 20px',
      }}>
        <div style={{
          width: '64px',
          height: '64px',
          border: '5px solid rgba(10, 95, 89, 0.2)',
          borderTop: '5px solid #0A5F59',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
          marginBottom: '32px',
        }}></div>
        <div style={{ color: '#0A5F59', fontSize: '20px', fontWeight: 600, marginBottom: '8px' }}>
          Загрузка анкеты...
        </div>
        <div style={{ color: '#6B7280', fontSize: '14px', textAlign: 'center' }}>
          Подождите, мы готовим анкету для вас
        </div>
        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  return (
    <div style={{ 
      padding: '20px',
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #F5FFFC 0%, #E8FBF7 100%)',
      position: 'relative',
    }}>
      {/* Debug Panel (только в development) */}
      {(process.env.NODE_ENV === 'development' || process.env.NEXT_PUBLIC_DEBUG === 'true') && (
        <div style={{
          position: 'fixed',
          bottom: '20px',
          right: '20px',
          zIndex: 10000,
        }}>
          <button
            onClick={() => setShowDebugPanel(!showDebugPanel)}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              backgroundColor: showDebugPanel ? '#0A5F59' : 'rgba(10, 95, 89, 0.7)',
              color: 'white',
              border: 'none',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: 'bold',
            }}
          >
            {showDebugPanel ? '🔽 Скрыть логи' : '🔺 Показать логи'}
          </button>
          {showDebugPanel && (
            <div style={{
              position: 'absolute',
              bottom: '40px',
              right: '0',
              width: '300px',
              maxHeight: '400px',
              backgroundColor: 'rgba(0, 0, 0, 0.9)',
              color: '#0f0',
              padding: '12px',
              borderRadius: '8px',
              fontSize: '11px',
              fontFamily: 'monospace',
              overflow: 'auto',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
            }}>
              <div style={{ marginBottom: '8px', fontWeight: 'bold', color: '#fff' }}>
                Debug Logs ({debugLogs.length})
              </div>
              {debugLogs.map((log, idx) => (
                <div key={idx} style={{ marginBottom: '8px', borderBottom: '1px solid #333', paddingBottom: '4px' }}>
                  <div style={{ color: '#0f0', fontWeight: 'bold' }}>
                    [{log.time}] {log.message}
                  </div>
                  {log.data && (
                    <pre style={{ 
                      marginTop: '4px', 
                      color: '#ccc', 
                      fontSize: '10px',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-all',
                    }}>
                      {log.data}
                    </pre>
                  )}
                </div>
              ))}
              {debugLogs.length === 0 && (
                <div style={{ color: '#666', fontStyle: 'italic' }}>
                  Логи появятся здесь...
                </div>
              )}
            </div>
          )}
        </div>
      )}
      <div style={{
        backgroundColor: 'rgba(255, 255, 255, 0.56)',
        backdropFilter: 'blur(28px)',
        borderRadius: '24px',
        padding: '24px',
        maxWidth: '600px',
        margin: '0 auto',
      }}>
        {/* Проверка на существование вопроса */}
        {/* КРИТИЧНО: Не показываем "Вопрос не найден", если пользователь уже прошел начальные экраны */}
        {/* Это может быть временное состояние из-за гонки состояний, которое исправится в следующем рендере */}
        {/* ИСПРАВЛЕНО: Используем ref для более точной проверки, так как state может быть устаревшим */}
        {(() => {
          const isPastInitialScreensRef = currentInfoScreenIndexRef.current >= initialInfoScreens.length;
          // ИСПРАВЛЕНО: Не показываем ошибку, если анкета не загружена или вопросы еще не готовы
          // Также не показываем ошибку, если пользователь еще на начальных экранах
          const hasQuestions = allQuestions.length > 0;
          // ИСПРАВЛЕНО: Используем effectiveQuestionnaire для проверки наличия анкеты
          // Это гарантирует, что проверка использует все доступные источники
          const effectiveQuestionnaire = questionnaireRef.current || questionnaire || quizStateMachine.questionnaire;
          const hasQuestionnaireData = !!effectiveQuestionnaire;
          const shouldShowError = !currentQuestion && !isPastInitialScreens && !isPastInitialScreensRef && hasQuestions && hasQuestionnaireData;
          // ИСПРАВЛЕНО: Показываем загрузку если:
          // 1. currentQuestion null И
          // 2. (пользователь прошел начальные экраны ИЛИ нет вопросов ИЛИ анкета не загружена)
          // 3. НО НЕ показываем загрузку, если показываются начальные экраны
          // Это гарантирует, что загрузка показывается во всех случаях, когда данные еще не готовы
          // КРИТИЧНО: Не показываем загрузку, если isShowingInitialInfoScreen = true, чтобы не блокировать инфо-экраны
          // ИСПРАВЛЕНО: Также не показываем загрузку, если currentInfoScreenIndex < initialInfoScreens.length
          // Это дополнительная защита от блокировки инфо-экранов
          const shouldShowLoading = !currentQuestion && 
            !isShowingInitialInfoScreen && // ИСПРАВЛЕНО: Не показываем загрузку, если показываются инфо-экраны
            currentInfoScreenIndex >= initialInfoScreens.length && // ИСПРАВЛЕНО: Не показываем загрузку, если еще на начальных экранах
            (
              (isPastInitialScreens || isPastInitialScreensRef) || 
              !hasQuestions || 
              !hasQuestionnaireData ||
              loading // Также показываем загрузку, если идет загрузка
            );
          
          // Логируем состояние для диагностики
          if (!currentQuestion) {
            clientLogger.warn('⚠️ Рендер: currentQuestion null, проверяем условия', {
              hasCurrentQuestion: !!currentQuestion,
              currentQuestionIndex,
              currentInfoScreenIndex,
              currentInfoScreenIndexRef: currentInfoScreenIndexRef.current,
              isPastInitialScreens,
              isPastInitialScreensRef,
              shouldShowError,
              shouldShowLoading,
              initialInfoScreensLength: initialInfoScreens.length,
              allQuestionsLength: allQuestions.length,
              hasQuestions,
              hasQuestionnaireData,
              hasQuestionnaireState: !!questionnaire,
              hasQuestionnaireRef: !!questionnaireRef.current,
              hasQuestionnaireStateMachine: !!quizStateMachine.questionnaire,
              effectiveQuestionnaire: !!(questionnaireRef.current || questionnaire || quizStateMachine.questionnaire),
              isShowingInitialInfoScreen,
            });
          }
          
          if (shouldShowError) {
            return (
          <div style={{ textAlign: 'center', padding: '40px 20px' }}>
            {isDev && (
              <div style={{ marginBottom: '20px', padding: '10px', background: '#fff3cd', borderRadius: '8px', fontSize: '12px', textAlign: 'left' }}>
                <strong>🔍 Диагностика:</strong>
                <pre style={{ marginTop: '8px', fontSize: '11px', overflow: 'auto' }}>
                  {JSON.stringify({
                    currentQuestion: currentQuestion ? 'exists' : 'null',
                    currentQuestionIndex,
                    allQuestionsLength: allQuestions.length,
                    isShowingInitialInfoScreen,
                    isPastInitialScreens,
                    pendingInfoScreen: pendingInfoScreen ? pendingInfoScreen.id : null,
                    showResumeScreen,
                    hasResumed,
                    currentInfoScreenIndex,
                    initialInfoScreensLength: initialInfoScreens.length,
                  }, null, 2)}
                </pre>
              </div>
            )}
            <div style={{ color: '#0A5F59', fontSize: '18px', marginBottom: '12px' }}>
              Вопрос не найден
            </div>
            <div style={{ color: '#6B7280', fontSize: '14px' }}>
              Попробуйте обновить страницу
            </div>
          </div>
            );
          }
          
          if (shouldShowLoading) {
            // Если пользователь уже прошел начальные экраны, но currentQuestion временно null,
            // показываем загрузку вместо ошибки
            return (
              <div style={{ 
                minHeight: '100vh',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: '#FFFFFF',
                padding: '40px 20px',
              }}>
                <div style={{
                  width: '48px',
                  height: '48px',
                  border: '4px solid rgba(10, 95, 89, 0.2)',
                  borderTop: '4px solid #0A5F59',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite',
                  marginBottom: '24px',
                }}></div>
                <div style={{ color: '#0A5F59', fontSize: '18px', fontWeight: 600 }}>
                  Загрузка вопросов...
                </div>
                <style>{`
                  @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                  }
                `}</style>
              </div>
            );
          }
          
          // Если currentQuestion существует, показываем его
          return null;
        })()}
        {/* РЕФАКТОРИНГ: Используем компонент QuizQuestion для рендеринга вопроса */}
        {currentQuestion && currentQuestion.id && (
          <QuizQuestion
            question={currentQuestion}
            currentQuestionIndex={currentQuestionIndex}
            allQuestionsLength={allQuestions.length}
            answers={answers}
            isRetakingQuiz={isRetakingQuiz}
            isSubmitting={isSubmitting}
            onAnswer={handleAnswer}
            onNext={handleNext}
            onSubmit={submitAnswers}
            onBack={handleBack}
            showBackButton={currentQuestionIndex > 0 || currentInfoScreenIndex > 0}
          />
        )}
      </div>
      
      {/* РЕФАКТОРИНГ: Используем компонент QuizFinalizingLoader */}
      <QuizFinalizingLoader
        finalizing={finalizing}
        finalizingStep={finalizingStep}
        finalizeError={finalizeError}
      />
    </div>
  );
}