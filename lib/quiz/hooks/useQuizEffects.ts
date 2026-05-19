// lib/quiz/hooks/useQuizEffects.ts
// РЕФАКТОРИНГ: Хук для группировки всех useEffect из quiz/page.tsx
// Вынесен для улучшения читаемости и поддержки

import { useEffect, useLayoutEffect, useRef } from 'react';
import { clientLogger } from '@/lib/client-logger';
import { QUIZ_CONFIG } from '@/lib/quiz/config/quizConfig';
import { getInitialInfoScreens } from '@/app/(miniapp)/quiz/info-screens';
import type { Questionnaire, Question } from '@/lib/quiz/types';
import { api } from '@/lib/api';
import * as userPreferences from '@/lib/user-preferences';
import { useQuestionnaireSync } from './useQuestionnaireSync';

export interface UseQuizEffectsParams {
  // State
  questionnaire: Questionnaire | null;
  setQuestionnaire: React.Dispatch<React.SetStateAction<Questionnaire | null>>;
  loading: boolean;
  setLoading: React.Dispatch<React.SetStateAction<boolean>>;
  error: string | null;
  setError: React.Dispatch<React.SetStateAction<string | null>>;
  currentInfoScreenIndex: number;
  setCurrentInfoScreenIndex: React.Dispatch<React.SetStateAction<number>>;
  currentQuestionIndex: number;
  setCurrentQuestionIndex: React.Dispatch<React.SetStateAction<number>>;
  answers: Record<number, string | string[]>;
  setAnswers: React.Dispatch<React.SetStateAction<Record<number, string | string[]>>>;
  showResumeScreen: boolean;
  isSubmitting: boolean;
  setIsSubmitting: React.Dispatch<React.SetStateAction<boolean>>;
  savedProgress: {
    answers: Record<number, string | string[]>;
    questionIndex: number;
    infoScreenIndex: number;
  } | null;
  setSavedProgress: React.Dispatch<React.SetStateAction<{
    answers: Record<number, string | string[]>;
    questionIndex: number;
    infoScreenIndex: number;
  } | null>>;
  isRetakingQuiz: boolean;
  showRetakeScreen: boolean;
  setHasRetakingPayment: React.Dispatch<React.SetStateAction<boolean>>;
  setHasFullRetakePayment: React.Dispatch<React.SetStateAction<boolean>>;
  setPendingInfoScreen: React.Dispatch<React.SetStateAction<any | null>>;
  userPreferencesData: {
    hasPlanProgress?: boolean;
    isRetakingQuiz?: boolean;
    fullRetakeFromHome?: boolean;
    paymentRetakingCompleted?: boolean;
    paymentFullRetakeCompleted?: boolean;
  } | null;
  allQuestions: Question[];
  allQuestionsRaw: Question[];
  pendingInfoScreen: any | null;
  autoSubmitTriggered: boolean;
  setAutoSubmitTriggered: React.Dispatch<React.SetStateAction<boolean>>;
  autoSubmitTriggeredRef: React.MutableRefObject<boolean>;
  submitAnswers: () => Promise<void>;
  scope: string;
  
  // Refs
  questionnaireRef: React.MutableRefObject<Questionnaire | null>;
  currentInfoScreenIndexRef: React.MutableRefObject<number>;
  currentQuestionIndexRef: React.MutableRefObject<number>;
  hasResumedRef: React.MutableRefObject<boolean>;
  isSubmittingRef: React.MutableRefObject<boolean>;
  isStartingOverRef: React.MutableRefObject<boolean>;
  initCompletedRef: React.MutableRefObject<boolean>;
  setInitCompleted: React.Dispatch<React.SetStateAction<boolean>>;
  initCalledRef: React.MutableRefObject<boolean>;
  initInProgressRef: React.MutableRefObject<boolean>;
  isMountedRef: React.MutableRefObject<boolean>;
  progressLoadedRef: React.MutableRefObject<boolean>;
  loadProgressInProgressRef: React.MutableRefObject<boolean>;
  progressLoadInProgressRef: React.MutableRefObject<boolean>;
  loadQuestionnaireInProgressRef: React.MutableRefObject<boolean>;
  loadQuestionnaireAttemptedRef: React.MutableRefObject<boolean>;
  redirectInProgressRef: React.MutableRefObject<boolean>;
  profileCheckInProgressRef: React.MutableRefObject<boolean>;
  resumeCompletedRef: React.MutableRefObject<boolean>;
  initCompletedTimeRef: React.MutableRefObject<number | null>;
  allQuestionsPrevRef: React.MutableRefObject<Question[]>;
  answersRef: React.MutableRefObject<Record<number, string | string[]>>;
  answersCountRef: React.MutableRefObject<number>;
  lastRestoredAnswersIdRef: React.MutableRefObject<string | null>;
  saveProgressTimeoutRef: React.MutableRefObject<NodeJS.Timeout | null>;
  submitAnswersRef: React.MutableRefObject<(() => Promise<void>) | null>;
  firstScreenResetRef: React.MutableRefObject<boolean>;
  
  // React Query
  questionnaireFromQuery: Questionnaire | null | undefined;
  isLoadingQuestionnaire: boolean;
  questionnaireError: Error | null;
  quizProgressFromQuery: any;
  isLoadingProgress: boolean;
  
  // State Machine
  quizStateMachine: any;
  setQuestionnaireInStateMachine: (questionnaire: Questionnaire | null) => void;
  
  // Functions
  init: () => Promise<void>;
  loadQuestionnaire: () => Promise<any>;
  loadSavedProgressFromServer: () => Promise<void>;
  
  // Other
  isDev: boolean;
  hasResumed: boolean;
  isStartingOver: boolean;
  answersCount: number;
}

/**
 * Хук для группировки всех useEffect из основного компонента Quiz
 * Организует эффекты по функциональности для лучшей читаемости
 */
export function useQuizEffects(params: UseQuizEffectsParams) {
  const {
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
    userPreferencesData,
    allQuestions,
    allQuestionsRaw,
    pendingInfoScreen,
    setPendingInfoScreen,
    autoSubmitTriggered,
    setAutoSubmitTriggered,
    autoSubmitTriggeredRef,
    submitAnswers,
    setHasRetakingPayment,
    setHasFullRetakePayment,
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
  } = params;

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

  // ============================================
  // ГРУППА 1: Синхронизация questionnaire между React Query, state и State Machine
  // ============================================
  
  // ИСПРАВЛЕНО: Синхронизация questionnaire теперь выполняется в useQuestionnaireSync
  // Удалена дублирующая синхронизация, которая вызывала бесконечные циклы
  // useQuestionnaireSync использует refs для setQuestionnaire, setLoading, setError,
  // что предотвращает включение функций в зависимости useEffect

  // Синхронизация questionnaireRef с state
  useEffect(() => {
    if (questionnaire) {
      if (questionnaireRef.current?.id !== questionnaire.id) {
        questionnaireRef.current = questionnaire;
        // УБРАНО: Логирование вызывает бесконечные циклы в продакшене
        // // clientLogger.log('🔄 questionnaireRef synchronized with state', {...});
      }
      if (initCompletedTimeRef.current) {
        // clientLogger.log('✅ Questionnaire loaded, clearing fallback loader timer');
        initCompletedTimeRef.current = null;
      }
    }
  }, [questionnaire]);

  // ============================================
  // ГРУППА 2: Инициализация компонента
  // ============================================
  
  // Cleanup при монтировании
  useEffect(() => {
    try {
      if (typeof window !== 'undefined') {
        const justSubmitted = sessionStorage.getItem(QUIZ_CONFIG.STORAGE_KEYS.JUST_SUBMITTED);
        if (justSubmitted === 'true') {
          // clientLogger.log('🧹 Очищаем залипший флаг quiz_just_submitted при входе на /quiz');
          sessionStorage.removeItem(QUIZ_CONFIG.STORAGE_KEYS.JUST_SUBMITTED);
        }
        
        // clientLogger.log('🧹 Сбрасываем isSubmitting при входе на /quiz (защита от залипшего состояния)');
        setIsSubmitting(false);
        isSubmittingRef.current = false;
        
        if (!initCalledRef.current) {
          initCompletedRef.current = false;
          initInProgressRef.current = false;
        } else {
          initInProgressRef.current = false;
        }
      }
    } catch (error) {
      // Игнорируем ошибки sessionStorage
    }
  }, []);

  // Проверка just_submitted и редирект
  useEffect(() => {
    if (redirectInProgressRef.current) {
      return;
    }
    
    if (typeof window !== 'undefined') {
      const justSubmitted = sessionStorage.getItem(QUIZ_CONFIG.STORAGE_KEYS.JUST_SUBMITTED) === 'true';
      if (justSubmitted) {
        redirectInProgressRef.current = true;
        // clientLogger.log('✅ Анкета только что отправлена, редиректим на /plan?state=generating (ранняя проверка)');

        // ФИКС: Устанавливаем флаг завершения анкеты
        const completedKey = QUIZ_CONFIG.getScopedKey(QUIZ_CONFIG.STORAGE_KEYS.QUIZ_COMPLETED, scope);
        sessionStorage.setItem(completedKey, 'true');

        sessionStorage.removeItem(QUIZ_CONFIG.STORAGE_KEYS.JUST_SUBMITTED);
        sessionStorage.removeItem('quiz_init_done');
        initCompletedRef.current = true;
        setInitCompleted(true);
        setLoading(false);

        // ФИКС: Очищаем прогресс перед редиректом, чтобы предотвратить показ резюма
        if (setSavedProgress) setSavedProgress(null);

        window.location.replace('/plan?state=generating');
        setTimeout(() => {
          redirectInProgressRef.current = false;
        }, 1000);
        return;
      }
    }
    
    // Проверка флагов перепрохождения
    if (typeof window !== 'undefined' && window.Telegram?.WebApp?.initData && !initCompletedRef.current) {
      const checkRetakeFlags = async () => {
        try {
          const hasPlanProgress = userPreferencesData?.hasPlanProgress ?? false;
          
          if (!hasPlanProgress) {
            // clientLogger.log('ℹ️ Новый пользователь (нет hasPlanProgress) - пропускаем проверку флагов перепрохождения');
            return;
          }
          
          const isRetakingFromStorage = userPreferencesData?.isRetakingQuiz ?? false;
          const fullRetakeFromHome = userPreferencesData?.fullRetakeFromHome ?? false;
          
          if (isRetakingFromStorage || fullRetakeFromHome) {
            try {
              const profile = await api.getCurrentProfile();
              if (!profile || !profile.id) {
                // clientLogger.log('⚠️ Флаги перепрохождения установлены, но профиля нет - очищаем флаги');
                await userPreferences.setIsRetakingQuiz(false);
                await userPreferences.setFullRetakeFromHome(false);
                return;
              }
            } catch (profileErr: any) {
              const isNotFound = profileErr?.status === 404 || 
                                profileErr?.message?.includes('404') || 
                                profileErr?.message?.includes('No profile') ||
                                profileErr?.message?.includes('Profile not found');
              if (isNotFound) {
                // clientLogger.log('⚠️ Профиля нет, но флаги перепрохождения установлены - очищаем флаги');
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
          clientLogger.warn('⚠️ Ошибка при проверке флагов перепрохождения:', err?.message);
        }
      };
      
      checkRetakeFlags().catch(() => {});
    }
  }, []);

  // Инициализация компонента (init)
  useEffect(() => {
    isMountedRef.current = true;

    if (resumeCompletedRef.current) {
      // clientLogger.log('⛔ useEffect: init() skipped: resumeQuiz already completed, not resetting state');
      return;
    }

    // ФИКС: Убрана проверка initCalledRef.current, которая могла блокировать инициализацию
    // для новых пользователей в Telegram
    if (initInProgressRef.current) {
      // // clientLogger.log('⛔ useEffect: init() already called or in progress, skipping', {
      //   initCalled: initCalledRef.current,
      //   initInProgress: initInProgressRef.current,
      //   initCompleted: initCompletedRef.current,
      // });
      return;
    }

    // ФИКС: Убрана проверка initCompletedRef.current, которая могла блокировать инициализацию
    // для Telegram пользователей где initCompleted уже был установлен в true
    // if (initCompletedRef.current && !isStartingOverRef.current && questionnaireRef.current) {
    //   // clientLogger.log('⛔ useEffect: init() already completed with questionnaire, skipping', {
    //     questionnaireId: questionnaireRef.current?.id,
    //   });
    //   return;
    // }

    initCalledRef.current = true;

    if (typeof window !== 'undefined') {
      const alreadyInit = sessionStorage.getItem('quiz_init_done') === 'true';
      if (alreadyInit) {
        clientLogger.log('⛔ useEffect: init() skipped: quiz_init_done in sessionStorage', {
          isTelegramUser: !!(window.Telegram?.WebApp?.initData),
          initCompleted: initCompletedRef.current,
          hasQuestionnaire: !!questionnaireRef.current,
        });

        // Восстановление состояния после ремоунта
        try {
          if (!questionnaire && (questionnaireRef.current || quizStateMachine.questionnaire)) {
            const restoredQuestionnaire = questionnaireRef.current || quizStateMachine.questionnaire;
            if (restoredQuestionnaire) {
              // // clientLogger.log('🔄 Восстанавливаем questionnaire из ref/State Machine после ремоунта', {
              //   questionnaireId: restoredQuestionnaire.id,
              //   fromRef: !!questionnaireRef.current,
              //   fromStateMachine: !!quizStateMachine.questionnaire,
              // });
              setQuestionnaireWithStateMachine(restoredQuestionnaire);
            }
          }

          // Восстановление currentQuestionIndex
          // ИСПРАВЛЕНО: НЕ восстанавливаем индекс, если пользователь уже активно отвечает
          // Это предотвращает перезапись правильного индекса после перехода к следующему вопросу
          // ИСПРАВЛЕНО: Также проверяем, прошел ли пользователь начальные инфо-экраны
          // Это предотвращает восстановление индекса после перехода к следующему вопросу
          // КРИТИЧНО: НЕ восстанавливаем индекс, если есть сохраненный прогресс с >= 2 ответами
          // Это исправляет проблему, когда на проде показывается первый вопрос вместо резюм-экрана
          // Проблема: восстановление индекса из sessionStorage делает isActiveSession = true,
          // что скрывает резюм-экран в useResumeScreenLogic
          const initialInfoScreens = getInitialInfoScreens();
          const hasPassedInitialScreens = currentInfoScreenIndex >= initialInfoScreens.length;
          // КРИТИЧНО: НЕ восстанавливаем индекс, если есть сохраненный прогресс с >= 2 ответами
          // Это гарантирует, что резюм-экран будет показан
          const hasSavedProgress = savedProgress && savedProgress.answers && Object.keys(savedProgress.answers).length >= QUIZ_CONFIG.VALIDATION.MIN_ANSWERS_FOR_PROGRESS_SCREEN;
          const isActiveSession = currentQuestionIndex > 0 ||
                                  Object.keys(answers).length > 0 ||
                                  hasPassedInitialScreens;
          const savedQuestionIndex = sessionStorage.getItem(QUIZ_CONFIG.STORAGE_KEYS.CURRENT_QUESTION);
          // КРИТИЧНО: НЕ восстанавливаем индекс, если есть сохраненный прогресс с >= 2 ответами
          // Это гарантирует, что резюм-экран будет показан
          if (savedQuestionIndex !== null && !isActiveSession && !hasSavedProgress) {
            const questionIndex = parseInt(savedQuestionIndex, 10);
            if (!isNaN(questionIndex) && questionIndex >= 0) {
              const currentAllQuestionsLength = allQuestionsPrevRef.current.length || allQuestions.length;
              const validIndex = currentAllQuestionsLength > 0
                ? (questionIndex < currentAllQuestionsLength ? questionIndex : Math.max(0, currentAllQuestionsLength - 1))
                : 0;

              if (currentAllQuestionsLength > 0) {
                setCurrentQuestionIndex(validIndex);
                    // // clientLogger.log('🔄 Восстанавливаем currentQuestionIndex из sessionStorage (синхронно)', {
                    //   questionIndex: validIndex,
                    //   allQuestionsLength: currentAllQuestionsLength,
                    //   isActiveSession,
                    // });
              } else {
                // КРИТИЧНО: Если allQuestions еще не загружены, НЕ устанавливаем индекс в 0
                // Вместо этого ждем, пока вопросы загрузятся, и восстанавливаем индекс в useEffect выше
                // Это исправляет проблему, когда после перезагрузки индекс сбрасывается на 0
                // до того, как вопросы загружены
                // // clientLogger.log('⏸️ Пропускаем восстановление currentQuestionIndex: вопросы еще не загружены', {
                //   savedIndex: questionIndex,
                //   allQuestionsLength: currentAllQuestionsLength,
                // });
              }
            }
          } else if (savedQuestionIndex !== null && isActiveSession) {
            // // clientLogger.log('⏸️ Пропускаем восстановление currentQuestionIndex: пользователь активно отвечает', {
            //   savedQuestionIndex,
            //   currentQuestionIndex,
            //   answersCount: Object.keys(answers).length,
            // });
          }

          // Восстановление currentInfoScreenIndex
          // КРИТИЧНО: НЕ восстанавливаем, если пользователь активно проходит анкету
          // Это предотвращает сброс индекса во время активного прохождения
          const savedInfoScreenIndex = sessionStorage.getItem(QUIZ_CONFIG.STORAGE_KEYS.CURRENT_INFO_SCREEN);
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
                // clientLogger.log('🔄 Восстанавливаем currentInfoScreenIndex из sessionStorage', {
                //   savedIndex: infoScreenIndex,
                //   currentIndex: currentInfoScreenIndex,
                //   isActivelyOnInfoScreens,
                //   isOnQuestions,
                // });
                setCurrentInfoScreenIndex(infoScreenIndex);
                currentInfoScreenIndexRef.current = infoScreenIndex;
              } else {
                // clientLogger.log('⏸️ Пропускаем восстановление currentInfoScreenIndex - пользователь активно проходит анкету', {
                //   savedIndex: infoScreenIndex,
                //   currentIndex: currentInfoScreenIndex,
                //   isActivelyOnInfoScreens,
                //   isOnQuestions,
                // });
              }
            }
          }

          // Восстановление answers из React Query или API
          // КРИТИЧНО: если на сервере >= MIN_ANSWERS ответов, ставим ТОЛЬКО savedProgress
          // (а answers оставляем пустыми) — иначе currentAnswersCount > 0 и резюм-экран
          // не показывается. Восстановление ответов произойдёт после нажатия "Продолжить"
          // на резюм-экране через onResume → setAnswers(savedProgress.answers).
          if (typeof window !== 'undefined' && window.Telegram?.WebApp?.initData) {
            if (quizProgressFromQuery?.progress?.answers && Object.keys(quizProgressFromQuery.progress.answers).length > 0) {
              const progressAnswers = quizProgressFromQuery.progress.answers;
              const cnt = Object.keys(progressAnswers).length;
              const shouldShowResume = cnt >= QUIZ_CONFIG.VALIDATION.MIN_ANSWERS_FOR_PROGRESS_SCREEN;
              if (!shouldShowResume) {
                // Меньше порога — это технические ответы, восстанавливаем сразу
                setAnswers(progressAnswers);
              }
              setSavedProgress({
                answers: progressAnswers,
                questionIndex: quizProgressFromQuery.progress.questionIndex || 0,
                infoScreenIndex: quizProgressFromQuery.progress.infoScreenIndex || 0,
              });
            } else if (!isLoadingProgress) {
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
                    const cnt = Object.keys(response.progress.answers).length;
                    const shouldShowResume = cnt >= QUIZ_CONFIG.VALIDATION.MIN_ANSWERS_FOR_PROGRESS_SCREEN;
                    if (!shouldShowResume) {
                      setAnswers(response.progress.answers);
                    }
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

        // Всегда вызываем init() после ремаунта — init() внутри сам ждёт Telegram initData
        // через waitForTelegram(). Без этого на MacBook Desktop (где SDK грузится медленно)
        // loading оставался true вечно, потому что initData ещё не был доступен здесь.
        clientLogger.log('🔄 Calling init() after remount — will wait for Telegram internally');
        init();
        return;
      }
      sessionStorage.setItem('quiz_init_done', 'true');
    }

    // // clientLogger.log('🚀 useEffect: calling init()', {
    //   initCalled: initCalledRef.current,
    //   initInProgress: initInProgressRef.current,
    //   initCompleted: initCompletedRef.current,
    //   hasLoadQuestionnaire: !!loadQuestionnaire,
    // });

    // ФИКС: Добавлен таймаут для принудительного завершения загрузки
    // Если init() зависнет, через 10 секунд установим loading=false
    const initTimeout = setTimeout(() => {
      if (loading && isMountedRef.current) {
        clientLogger.warn('⚠️ init() timeout reached, forcing loading=false', {
          initCompleted: initCompletedRef.current,
          initInProgress: initInProgressRef.current,
          hasQuestionnaire: !!questionnaireRef.current,
          isTelegramUser: !!(typeof window !== 'undefined' && window.Telegram?.WebApp?.initData),
        });
        setLoading(false);
        setError('Ошибка загрузки. Пожалуйста, обновите страницу.');
      }
    }, 10000); // 10 секунд таймаут

    init().finally(() => {
      clearTimeout(initTimeout);
    });

    return () => {
      isMountedRef.current = false;
    };
  }, []); // Пустой массив зависимостей - вызываем только один раз при монтировании

  // ============================================
  // ГРУППА 3: Восстановление answers из React Query
  // ============================================
  
  useEffect(() => {
    answersRef.current = answers;
    answersCountRef.current = Object.keys(answers).length;
  }, [answers]);
  
  // КРИТИЧНО: Вычисляем стабильное значение ДО useEffect для использования в зависимостях
  const progressAnswersKeysCount = quizProgressFromQuery?.progress?.answers ? Object.keys(quizProgressFromQuery.progress.answers).length : 0;
  
  useEffect(() => {
    if (isLoadingProgress) {
      return;
    }
    
    const progressAnswers = quizProgressFromQuery?.progress?.answers;
    // КРИТИЧНО: НЕ восстанавливаем ответы, если пользователь начал заново (isStartingOver)
    // Это предотвращает восстановление ответов после "Начать анкету заново"
    if (isStartingOverRef.current || isStartingOver) {
      return;
    }
    
    if (progressAnswers && Object.keys(progressAnswers).length > 0) {
      const answersId = JSON.stringify(progressAnswers);
      const progressAnswersCount = Object.keys(progressAnswers).length;
      
      // ИСПРАВЛЕНО: НЕ восстанавливаем answers из React Query, если должен показываться резюм-экран
      // Это необходимо, чтобы currentAnswersCount оставался 0, что позволит показать резюм-экран
      const shouldShowResume = progressAnswersCount >= QUIZ_CONFIG.VALIDATION.MIN_ANSWERS_FOR_PROGRESS_SCREEN;
      
      if (shouldShowResume && answersCountRef.current === 0) {
        // Если должен показываться резюм-экран и answers пустые, НЕ восстанавливаем answers
        // Вместо этого только устанавливаем savedProgress для показа резюм-экрана
        // ИСПРАВЛЕНО: Удаляем флаг quiz_progress_cleared, если на сервере есть прогресс >= 2 ответов
        // Это необходимо, чтобы показать резюм-экран даже после "Начать заново"
        if (typeof window !== 'undefined') {
          const scope = questionnaire?.id?.toString() || 'default';
          const progressClearedKey = QUIZ_CONFIG.getScopedKey('quiz_progress_cleared', scope);
          const isCleared = sessionStorage.getItem(progressClearedKey) === 'true' ||
                          sessionStorage.getItem('quiz_progress_cleared') === 'true' ||
                          sessionStorage.getItem('default:quiz_progress_cleared') === 'true';
          
          if (isCleared) {
            try {
              sessionStorage.removeItem(progressClearedKey);
              sessionStorage.removeItem('quiz_progress_cleared');
              sessionStorage.removeItem('default:quiz_progress_cleared');
              // Также удаляем scoped ключи
              const storageKeys = Object.keys(sessionStorage);
              for (const key of storageKeys) {
                if (key.includes(':quiz_progress_cleared') || key.endsWith(':quiz_progress_cleared')) {
                  sessionStorage.removeItem(key);
                }
              }
              if (isDev) {
                clientLogger.log('🔧 [useQuizEffects] Удален флаг quiz_progress_cleared - на сервере есть прогресс >= 2 ответов', {
                  progressAnswersCount,
                  scope,
                });
              }
            } catch (err) {
              if (isDev) {
                clientLogger.warn('⚠️ [useQuizEffects] Ошибка при удалении quiz_progress_cleared', err);
              }
            }
          }
        }
        
        setSavedProgress({
          answers: progressAnswers,
          questionIndex: quizProgressFromQuery.progress.questionIndex || 0,
          infoScreenIndex: quizProgressFromQuery.progress.infoScreenIndex || 0,
        });
        // НЕ восстанавливаем answers - они останутся пустыми, что позволит показать резюм-экран
        return;
      }
      
      // КРИТИЧНО: Восстанавливаем если answers пустые (после перемонтирования) или если количество увеличилось
      // НО только если НЕ должен показываться резюм-экран
      if (answersId !== lastRestoredAnswersIdRef.current || progressAnswersCount > answersCountRef.current || answersCountRef.current === 0) {
        const currentAnswersId = JSON.stringify(answersRef.current);
        if (answersId !== currentAnswersId) {
          // // clientLogger.log('🔄 Восстанавливаем answers из React Query кэша (после ремоунта или обновления)', {
          //   answersCount: progressAnswersCount,
          //   previousAnswersCount: answersCountRef.current,
          //   wasEmpty: answersCountRef.current === 0,
          // });
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
    // КРИТИЧНО ИСПРАВЛЕНО: Убрали JSON.stringify из зависимостей, так как это создает новую строку каждый раз
    // и вызывает бесконечные циклы. Вместо этого используем стабильные значения:
    // - isLoadingProgress (boolean)
    // - количество ключей в answers (number)
    // - isStartingOver (boolean) - для предотвращения восстановления ответов после "Начать заново"
    // Убрали setAnswers и setSavedProgress - функции из useState стабильны, но не должны быть в зависимостях
  }, [isLoadingProgress, progressAnswersKeysCount, isStartingOver]);

  // ============================================
  // ГРУППА 4: Проверка профиля и retake флагов
  // ============================================
  
  useEffect(() => {
    if (!questionnaire || loading) return;
    if (isStartingOverRef.current) return;
    if (typeof window === 'undefined' || !window.Telegram?.WebApp?.initData) return;
    if (profileCheckInProgressRef.current) return;
    
    if (savedProgress && savedProgress.answers && Object.keys(savedProgress.answers).length > 0) {
      return;
    }
  }, [questionnaire, loading, savedProgress]);

  // ============================================
  // ГРУППА 5: Загрузка анкеты при перепрохождении
  // ============================================

  useEffect(() => {
    if (!(isRetakingQuiz || showRetakeScreen)) return;
    if (questionnaire || questionnaireRef.current) return;
    if (loading) return;
    if (loadQuestionnaireInProgressRef.current) return;
    if (loadQuestionnaireAttemptedRef.current) return;
    if (initInProgressRef.current) return;
    if (!initCompletedRef.current) return;
    if (!loadQuestionnaire) return;

    loadQuestionnaireInProgressRef.current = true;
    loadQuestionnaireAttemptedRef.current = true;

    // // clientLogger.log('ℹ️ Retaking quiz, loading questionnaire in background for retake screen (useEffect)', {
    //   loading,
    //   inProgress: loadQuestionnaireInProgressRef.current,
    //   attempted: loadQuestionnaireAttemptedRef.current,
    // });

    loadQuestionnaire().finally(() => {
      loadQuestionnaireInProgressRef.current = false;
    });
  }, [isRetakingQuiz, showRetakeScreen, questionnaire, loading]);

  // ============================================
  // ГРУППА 6: Синхронизация allQuestions
  // ============================================
  
  useEffect(() => {
    if (allQuestions.length > 0) {
      allQuestionsPrevRef.current = allQuestions;
      // // clientLogger.log('💾 allQuestionsPrevRef synced with allQuestions', {
      //   length: allQuestions.length,
      //   questionIds: allQuestions.map((q: Question) => q?.id).slice(0, 10),
      // });
    }
  }, [allQuestions]);

  // КРИТИЧНО: Восстанавливаем currentQuestionIndex из sessionStorage только когда вопросы загружены
  // Это исправляет проблему, когда после перезагрузки индекс восстанавливается до загрузки вопросов
  // и устанавливается в 0, хотя должен быть сохраненным значением
  // КРИТИЧНО: НЕ восстанавливаем индекс, если прогресс еще загружается
  // Это предотвращает восстановление индекса до загрузки savedProgress из React Query,
  // что может скрыть резюм-экран
  // ИСПРАВЛЕНО: НЕ восстанавливаем индекс, если есть сохраненный прогресс с >= 2 ответами
  // Это позволяет резюм-экрану показаться перед восстановлением индекса
  useEffect(() => {
    if (allQuestions.length === 0 || loading || !initCompletedRef.current) {
      return;
    }
    
    // КРИТИЧНО: НЕ восстанавливаем индекс, если прогресс еще загружается
    // Это предотвращает восстановление индекса до загрузки savedProgress из React Query
    if (isLoadingProgress) {
      return;
    }
    
    // ИСПРАВЛЕНО: НЕ восстанавливаем индекс, если есть сохраненный прогресс с >= 2 ответами
    // Это позволяет резюм-экрану показаться перед восстановлением индекса
    const savedProgressAnswersCount = savedProgress?.answers ? Object.keys(savedProgress.answers).length : 0;
    const currentAnswersCount = answersCountRef.current || Object.keys(answers || {}).length;
    const shouldShowResume = savedProgressAnswersCount >= QUIZ_CONFIG.VALIDATION.MIN_ANSWERS_FOR_PROGRESS_SCREEN && 
                             currentAnswersCount === 0 && 
                             !hasResumed && 
                             !isStartingOver;
    
    if (shouldShowResume) {
      clientLogger.log('⏸️ useQuizEffects: пропускаем восстановление currentQuestionIndex - должен показываться резюм-экран', {
        savedProgressAnswersCount,
        currentAnswersCount,
        minRequired: QUIZ_CONFIG.VALIDATION.MIN_ANSWERS_FOR_PROGRESS_SCREEN,
        hasResumed,
        isStartingOver
      });
      return;
    }
    
    if (typeof window === 'undefined') {
      return;
    }
    
    const savedQuestionIndex = sessionStorage.getItem(QUIZ_CONFIG.STORAGE_KEYS.CURRENT_QUESTION);
    if (savedQuestionIndex === null) {
      return;
    }
    
    const questionIndex = parseInt(savedQuestionIndex, 10);
    if (isNaN(questionIndex) || questionIndex < 0) {
      return;
    }
    
    // Проверяем, что текущий индекс не совпадает с сохраненным
    // и что сохраненный индекс валиден
    const validIndex = questionIndex < allQuestions.length 
      ? questionIndex 
      : Math.max(0, allQuestions.length - 1);
    
    // Восстанавливаем только если текущий индекс отличается от сохраненного
    // и если пользователь не активно отвечает (нет ответов в текущей сессии)
    const hasActiveAnswers = Object.keys(answers).length > 0;
    const hasSavedProgress = savedProgress && savedProgress.answers && Object.keys(savedProgress.answers).length >= QUIZ_CONFIG.VALIDATION.MIN_ANSWERS_FOR_PROGRESS_SCREEN;
    
    // Не восстанавливаем, если есть активные ответы или сохраненный прогресс (резюм-экран)
    if (!hasActiveAnswers && !hasSavedProgress && currentQuestionIndex !== validIndex) {
      setCurrentQuestionIndex(validIndex);
      clientLogger.log('🔄 Восстановлен currentQuestionIndex из sessionStorage после загрузки вопросов', {
        savedIndex: questionIndex,
        restoredIndex: validIndex,
        allQuestionsLength: allQuestions.length,
        currentIndex: currentQuestionIndex,
        isLoadingProgress,
        hasSavedProgress,
      });
    } else if (savedQuestionIndex !== null && (hasActiveAnswers || hasSavedProgress)) {
      clientLogger.log('⏸️ Пропускаем восстановление currentQuestionIndex: есть активные ответы или сохраненный прогресс', {
        savedIndex: questionIndex,
        hasActiveAnswers,
        hasSavedProgress,
        savedProgressAnswersCount: savedProgress?.answers ? Object.keys(savedProgress.answers).length : 0,
      });
    }
  }, [allQuestions.length, loading, isLoadingProgress, currentQuestionIndex, answers, savedProgress]);

  // useEffect(() => {
  //   // clientLogger.log('📊 allQuestions state updated', {
  //     allQuestionsRawLength: allQuestionsRaw.length,
  //     allQuestionsLength: allQuestions.length,
  //     allQuestionsPrevRefLength: allQuestionsPrevRef.current.length,
  //     hasQuestionnaire: !!questionnaire,
  //     hasQuestionnaireRef: !!questionnaireRef.current,
  //     questionnaireId: questionnaire?.id || questionnaireRef.current?.id,
  //     questionIds: allQuestions.length > 0 ? allQuestions.map((q: Question) => q?.id).slice(0, 10) : [],
  //   });
  // }, [allQuestions.length, allQuestionsRaw.length, questionnaire?.id]);

  const savedProgressAnswersCount = Object.keys(savedProgress?.answers || {}).length;
  // useEffect(() => {
  //   // clientLogger.log('📊 allQuestions state', {
  //     allQuestionsRawLength: allQuestionsRaw.length,
  //     allQuestionsLength: allQuestions.length,
  //     isRetakingQuiz,
  //     showRetakeScreen,
  //     answersCount,
  //     savedProgressAnswersCount,
  //     questionIds: allQuestions.map((q: Question) => q.id),
  //     questionCodes: allQuestions.map((q: Question) => q.code),
  //   });
  // }, [allQuestions.length, allQuestionsRaw.length, isRetakingQuiz, showRetakeScreen, answersCount, savedProgressAnswersCount]);

  // ============================================
  // ГРУППА 7: Корректировка currentQuestionIndex
  // ============================================
  
  // КРИТИЧНО: Вычисляем стабильные значения ДО useEffect для использования в зависимостях
  const answersKeysCountForIndexCorrection = Object.keys(answers || {}).length;
  const savedProgressAnswersKeysCountForIndexCorrection = savedProgress ? Object.keys(savedProgress.answers || {}).length : 0;
  
  // Исправление индекса ДО отрисовки: при выходе за границы списка вопросов (например после «Назад»
  // на экране привычек) сразу приводим индекс к валидному, чтобы не показывать «Вопрос не найден»
  useLayoutEffect(() => {
    if (loading || showResumeScreen || isSubmitting || allQuestions.length === 0) return;
    const outOfBounds = currentQuestionIndex < 0 || currentQuestionIndex >= allQuestions.length;
    if (!outOfBounds) return;
    const clamped = Math.max(0, Math.min(currentQuestionIndex, allQuestions.length - 1));
    if (clamped !== currentQuestionIndex) {
      setCurrentQuestionIndex(clamped);
    }
  }, [loading, showResumeScreen, isSubmitting, allQuestions.length, currentQuestionIndex, setCurrentQuestionIndex]);
  
  useEffect(() => {
    if (loading) return;
    
    const initialInfoScreensForCheck = getInitialInfoScreens();
    const isOnInitialInfoScreens = currentInfoScreenIndex < initialInfoScreensForCheck.length;
    if (isOnInitialInfoScreens) {
      return;
    }
    
    if (!questionnaire) return;
    
    if (allQuestions.length === 0 && Object.keys(answers).length > 0) {
      // // clientLogger.error('⚠️ Edge case: allQuestions.length === 0 but answers exist', {
      //   answersCount: Object.keys(answers).length,
      //   questionnaireId: questionnaire.id,
      //   allQuestionsRawLength: questionnaire.groups?.flatMap(g => g.questions || []).length + (questionnaire.questions || []).length,
      //   isRetakingQuiz,
      //   showRetakeScreen,
      // });
    }
    
    if (allQuestions.length === 0) {
      // // clientLogger.warn('⚠️ allQuestions.length === 0 после фильтрации', {
      //   questionnaireId: questionnaire.id,
      //   allQuestionsRawLength: allQuestionsRaw.length,
      //   answersCount: Object.keys(answers).length,
      //   savedProgressAnswersCount: Object.keys(savedProgress?.answers || {}).length,
      //   isRetakingQuiz,
      //   showRetakeScreen,
      // });
      return;
    }
    
    const answersCountLocal = Object.keys(answers).length;
    const isQuizCompleted = allQuestions.length > 0 && answersCountLocal >= allQuestions.length;
    
    const isOutOfBounds =
      currentQuestionIndex > allQuestions.length ||
      (currentQuestionIndex === allQuestions.length && !isQuizCompleted) ||
      currentQuestionIndex < 0;
    
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
    
    const initialInfoScreens = getInitialInfoScreens();
    const hasPassedInitialScreens = savedInfoScreenIndexFromStorage !== null && savedInfoScreenIndexFromStorage >= initialInfoScreens.length;
    
    const shouldResetToZero = hasNoSavedProgress && 
                               currentQuestionIndex > 0 && 
                               answersCountLocal === 0 && 
                               !isRetakingQuiz && 
                               !hasResumed &&
                               savedQuestionIndexFromStorage === null &&
                               !hasPassedInitialScreens;
    
    if (shouldResetToZero) {
      // // clientLogger.log('🔄 Сбрасываем currentQuestionIndex на 0 для нового пользователя', {
      //   currentQuestionIndex,
      //   allQuestionsLength: allQuestions.length,
      //   hasNoSavedProgress,
      //   answersCount: answersCountLocal,
      //   isRetakingQuiz,
      //   hasResumed,
      //   savedQuestionIndexFromStorage,
      // });
      setCurrentQuestionIndex(0);
      return;
    }
    
    if (savedQuestionIndexFromStorage !== null && 
        savedQuestionIndexFromStorage !== currentQuestionIndex && 
        savedQuestionIndexFromStorage < allQuestions.length) {
      // КРИТИЧНО: Проверяем, что вопрос с таким индексом существует
      // Это предотвращает ошибку "Вопрос не найден" при повторном заходе
      const questionExists = allQuestions[savedQuestionIndexFromStorage] !== undefined;
      if (questionExists) {
        // // clientLogger.log('🔄 Восстанавливаем currentQuestionIndex из sessionStorage', {
        //   savedQuestionIndex: savedQuestionIndexFromStorage,
        //   currentQuestionIndex,
        //   allQuestionsLength: allQuestions.length,
        // });
        setCurrentQuestionIndex(savedQuestionIndexFromStorage);
      } else {
        // Если вопрос не существует, корректируем индекс
        clientLogger.warn('⚠️ Восстановление из sessionStorage: вопрос не существует, корректируем индекс', {
          savedQuestionIndex: savedQuestionIndexFromStorage,
          allQuestionsLength: allQuestions.length,
          allQuestionCodes: allQuestions.map((q: any, idx: number) => ({
            index: idx,
            code: q?.code || null,
            id: q?.id || null,
          })),
        });
        // Корректируем индекс: если он выходит за пределы, используем последний валидный индекс или 0
        const correctedIndex = savedQuestionIndexFromStorage >= allQuestions.length 
          ? Math.max(0, allQuestions.length - 1)
          : 0;
        setCurrentQuestionIndex(correctedIndex);
      }
      return;
    }
    
    if (isOutOfBounds && !isSubmitting && !showResumeScreen) {
      const correctedIndex = isQuizCompleted
        ? allQuestions.length
        : (hasNoSavedProgress && answersCountLocal === 0 ? 0 : Math.max(0, Math.min(currentQuestionIndex, allQuestions.length - 1)));
      
      // // clientLogger.warn('⚠️ currentQuestionIndex выходит за пределы, корректируем', {
      //   currentQuestionIndex,
      //   allQuestionsLength: allQuestions.length,
      //   correctedIndex,
      //   answersCount: answersCountLocal,
      //   isQuizCompleted,
      //   isSubmitting,
      //   hasResumed,
      //   showResumeScreen,
      //   isRetakingQuiz,
      //   showRetakeScreen,
      //   hasQuestionnaire: !!questionnaire,
      //   hasNoSavedProgress,
      //   allQuestionsRawLength: allQuestionsRaw.length,
      // });
      
      if (correctedIndex !== currentQuestionIndex) {
        setCurrentQuestionIndex(correctedIndex);
      }
    }
    // КРИТИЧНО ИСПРАВЛЕНО: Заменяем объекты answers и savedProgress на стабильные значения
    // Объекты пересоздаются каждый раз, что вызывает бесконечные циклы
    // Также убрали setCurrentQuestionIndex из зависимостей - функция из useState стабильна
  }, [loading, questionnaire?.id, allQuestions.length, allQuestionsRaw.length, currentQuestionIndex, currentInfoScreenIndex, answersKeysCountForIndexCorrection, savedProgressAnswersKeysCountForIndexCorrection, isRetakingQuiz, showRetakeScreen, isSubmitting, showResumeScreen, hasResumed]);

  // ============================================
  // ГРУППА 8: Загрузка анкеты при retake
  // ============================================

  useEffect(() => {
    if (!(isRetakingQuiz || showRetakeScreen)) return;
    if (questionnaire || questionnaireRef.current) return;
    if (loading) return;
    if (loadQuestionnaireInProgressRef.current) return;
    if (loadQuestionnaireAttemptedRef.current) return;
    if (initInProgressRef.current) return;
    if (!initCompletedRef.current) return;
    if (!loadQuestionnaire) return;

    loadQuestionnaireInProgressRef.current = true;
    loadQuestionnaireAttemptedRef.current = true;

    // // clientLogger.log('ℹ️ Retaking quiz, loading questionnaire in background for retake screen (useEffect)', {
    //   loading,
    //   inProgress: loadQuestionnaireInProgressRef.current,
    //   attempted: loadQuestionnaireAttemptedRef.current,
    // });

    // КРИТИЧНО ИСПРАВЛЕНО: Вызываем loadQuestionnaire напрямую
    // Функция стабильна благодаря useCallback
    if (loadQuestionnaire) {
      loadQuestionnaire().finally(() => {
        loadQuestionnaireInProgressRef.current = false;
      });
    }
  }, [isRetakingQuiz, showRetakeScreen, questionnaire?.id, loading]);

  // ============================================
  // ГРУППА 9: Загрузка предыдущих ответов при retake
  // ============================================
  
  useEffect(() => {
    if (
      isRetakingQuiz &&
      questionnaire &&
      typeof window !== 'undefined' &&
      window.Telegram?.WebApp?.initData
    ) {
      // clientLogger.log('🔄 Загружаем предыдущие ответы для повторного прохождения...');
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
              // clientLogger.log('✅ Загружены предыдущие ответы для повторного прохождения:', Object.keys(data.progress.answers).length, 'ответов');
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
    // КРИТИЧНО ИСПРАВЛЕНО: setAnswers и setCurrentQuestionIndex из useState стабильны, но используем только questionnaire?.id
    // для предотвращения лишних пересчетов
  }, [isRetakingQuiz, questionnaire?.id]);

  // РЕФАКТОРИНГ: Обновление URL при showResumeScreen вынесено в useQuizUrlSync

  // ============================================
  // ГРУППА 11: Проверка entitlements для retake screen
  // ============================================
  
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
          // // clientLogger.log('✅ Entitlements checked for retake screen', {
          //   hasRetakeTopic,
          //   hasRetakeFull,
          // });
        } catch (err) {
          clientLogger.warn('⚠️ Failed to check entitlements for retake screen', err);
          const hasRetaking = userPreferencesData?.paymentRetakingCompleted ?? false;
          const hasFullRetake = userPreferencesData?.paymentFullRetakeCompleted ?? false;
          setHasRetakingPayment(hasRetaking);
          setHasFullRetakePayment(hasFullRetake);
        }
      };
      checkEntitlements();
    }
  }, [showRetakeScreen, isRetakingQuiz, setHasRetakingPayment, setHasFullRetakePayment, userPreferencesData]);

  // ============================================
  // ГРУППА 12: Автоматическая отправка ответов
  // ============================================
  
  // КРИТИЧНО: Вычисляем стабильные значения ДО useEffect для использования в зависимостях
  const answersKeysCountForAutoSubmit = Object.keys(answers || {}).length;
  
  useEffect(() => {
    if (!initCompletedRef.current) {
      return;
    }
    
    if (!autoSubmitTriggeredRef.current && 
        questionnaire && 
        allQuestions.length > 0 && 
        currentQuestionIndex >= allQuestions.length &&
        Object.keys(answers).length > 0 &&
        !isSubmitting &&
        !showResumeScreen &&
        !error &&
        !pendingInfoScreen) {
      
      // // clientLogger.log('✅ Все вопросы отвечены, автоматически отправляем ответы через 5 секунд...', {
      //   currentQuestionIndex,
      //   allQuestionsLength: allQuestions.length,
      //   answersCount: Object.keys(answers).length,
      //   hasPendingInfoScreen: !!pendingInfoScreen,
      // });
      autoSubmitTriggeredRef.current = true;
      setAutoSubmitTriggered(true);
      
      const timeoutId = setTimeout(() => {
        if (isMountedRef.current && submitAnswersRef.current && questionnaire && !isSubmittingRef.current && initCompletedRef.current) {
          isSubmittingRef.current = true;
          setIsSubmitting(true);
          submitAnswersRef.current().catch((err) => {
            console.error('❌ Ошибка при автоматической отправке ответов:', err);
            if (isMountedRef.current) {
              try {
                autoSubmitTriggeredRef.current = false;
                setAutoSubmitTriggered(false);
                setIsSubmitting(false);
                setError(err?.message || 'Ошибка отправки ответов');
              } catch (stateError) {
                clientLogger.warn('⚠️ Не удалось обновить состояние (компонент размонтирован):', stateError);
              }
            }
          });
        } else {
          clientLogger.warn('⚠️ Пропускаем автоматическую отправку: компонент размонтирован или questionnaire отсутствует');
        }
      }, 5000);
      
      return () => {
        clearTimeout(timeoutId);
      };
    }
    // КРИТИЧНО ИСПРАВЛЕНО: Убрали refs из зависимостей (initCompletedRef, isMountedRef, submitAnswersRef, isSubmittingRef)
    // refs не должны быть в зависимостях, так как изменения ref не триггерят ререндер
    // Также убрали setIsSubmitting, setError, setAutoSubmitTriggered - функции из useState стабильны
  }, [currentQuestionIndex, allQuestions.length, answersKeysCountForAutoSubmit, questionnaire?.id, isSubmitting, showResumeScreen, autoSubmitTriggered, error, pendingInfoScreen?.id ?? null]);

  // ============================================
  // ГРУППА 13: Обновление submitAnswersRef
  // ============================================
  
  useEffect(() => {
    submitAnswersRef.current = submitAnswers;
  }, [submitAnswers, submitAnswersRef]);

  // ============================================
  // ГРУППА 10: Cleanup при размонтировании
  // ============================================
  
  useEffect(() => {
    return () => {
      if (saveProgressTimeoutRef.current) {
        clearTimeout(saveProgressTimeoutRef.current);
        saveProgressTimeoutRef.current = null;
      }
    };
  }, []);
}
