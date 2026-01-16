// lib/quiz/hooks/useQuizEffects.ts
// РЕФАКТОРИНГ: Хук для группировки всех useEffect из quiz/page.tsx
// Вынесен для улучшения читаемости и поддержки

import { useEffect, useRef } from 'react';
import { clientLogger } from '@/lib/client-logger';
import { QUIZ_CONFIG } from '@/lib/quiz/config/quizConfig';
import { getInitialInfoScreens } from '@/app/(miniapp)/quiz/info-screens';
import type { Questionnaire, Question } from '@/lib/quiz/types';
import { api } from '@/lib/api';
import * as userPreferences from '@/lib/user-preferences';

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
  loadQuestionnaireRef: React.MutableRefObject<(() => Promise<any>) | null>;
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
  } = params;

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
        clientLogger.log('🔄 questionnaireRef synchronized with state', {
          questionnaireId: questionnaire.id,
        });
      }
      if (initCompletedTimeRef.current) {
        clientLogger.log('✅ Questionnaire loaded, clearing fallback loader timer');
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
          clientLogger.log('🧹 Очищаем залипший флаг quiz_just_submitted при входе на /quiz');
          sessionStorage.removeItem(QUIZ_CONFIG.STORAGE_KEYS.JUST_SUBMITTED);
        }
        
        clientLogger.log('🧹 Сбрасываем isSubmitting при входе на /quiz (защита от залипшего состояния)');
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
        clientLogger.log('✅ Анкета только что отправлена, редиректим на /plan?state=generating (ранняя проверка)');
        sessionStorage.removeItem(QUIZ_CONFIG.STORAGE_KEYS.JUST_SUBMITTED);
        sessionStorage.removeItem('quiz_init_done');
        initCompletedRef.current = true;
        setInitCompleted(true);
        setLoading(false);
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
            clientLogger.log('ℹ️ Новый пользователь (нет hasPlanProgress) - пропускаем проверку флагов перепрохождения');
            return;
          }
          
          const isRetakingFromStorage = userPreferencesData?.isRetakingQuiz ?? false;
          const fullRetakeFromHome = userPreferencesData?.fullRetakeFromHome ?? false;
          
          if (isRetakingFromStorage || fullRetakeFromHome) {
            try {
              const profile = await api.getCurrentProfile();
              if (!profile || !profile.id) {
                clientLogger.log('⚠️ Флаги перепрохождения установлены, но профиля нет - очищаем флаги');
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
    
    initCalledRef.current = true;
    
    if (typeof window !== 'undefined') {
      const alreadyInit = sessionStorage.getItem('quiz_init_done') === 'true';
      if (alreadyInit) {
        clientLogger.log('⛔ useEffect: init() skipped: quiz_init_done in sessionStorage');
        
        // Восстановление состояния после ремоунта
        try {
          if (!questionnaire && (questionnaireRef.current || quizStateMachine.questionnaire)) {
            const restoredQuestionnaire = questionnaireRef.current || quizStateMachine.questionnaire;
            if (restoredQuestionnaire) {
              clientLogger.log('🔄 Восстанавливаем questionnaire из ref/State Machine после ремоунта', {
                questionnaireId: restoredQuestionnaire.id,
                fromRef: !!questionnaireRef.current,
                fromStateMachine: !!quizStateMachine.questionnaire,
              });
              setQuestionnaire(restoredQuestionnaire);
              if (!quizStateMachine.questionnaire && questionnaireRef.current) {
                setQuestionnaireInStateMachine(questionnaireRef.current);
              }
            }
          }
          
          // Восстановление currentQuestionIndex
          // ИСПРАВЛЕНО: НЕ восстанавливаем индекс, если пользователь уже активно отвечает
          // Это предотвращает перезапись правильного индекса после перехода к следующему вопросу
          // ИСПРАВЛЕНО: Также проверяем, прошел ли пользователь начальные инфо-экраны
          // Это предотвращает восстановление индекса после перехода к следующему вопросу
          const initialInfoScreens = getInitialInfoScreens();
          const hasPassedInitialScreens = currentInfoScreenIndex >= initialInfoScreens.length;
          const isActiveSession = currentQuestionIndex > 0 || 
                                  Object.keys(answers).length > 0 || 
                                  hasPassedInitialScreens;
          const savedQuestionIndex = sessionStorage.getItem(QUIZ_CONFIG.STORAGE_KEYS.CURRENT_QUESTION);
          if (savedQuestionIndex !== null && !isActiveSession) {
            const questionIndex = parseInt(savedQuestionIndex, 10);
            if (!isNaN(questionIndex) && questionIndex >= 0) {
              const currentAllQuestionsLength = allQuestionsPrevRef.current.length || allQuestions.length;
              const validIndex = currentAllQuestionsLength > 0 
                ? (questionIndex < currentAllQuestionsLength ? questionIndex : Math.max(0, currentAllQuestionsLength - 1))
                : 0;
              
              if (currentAllQuestionsLength > 0) {
                setCurrentQuestionIndex(validIndex);
                clientLogger.log('🔄 Восстанавливаем currentQuestionIndex из sessionStorage (синхронно)', { 
                  questionIndex: validIndex,
                  allQuestionsLength: currentAllQuestionsLength,
                  isActiveSession,
                });
              } else {
                setTimeout(() => {
                  const finalLength = allQuestions.length || allQuestionsPrevRef.current.length;
                  const finalValidIndex = finalLength > 0 
                    ? (questionIndex < finalLength ? questionIndex : Math.max(0, finalLength - 1))
                    : 0;
                  setCurrentQuestionIndex(finalValidIndex);
                  clientLogger.log('🔄 Восстанавливаем currentQuestionIndex из sessionStorage (асинхронно)', { 
                    questionIndex: finalValidIndex,
                    allQuestionsLength: finalLength,
                    isActiveSession,
                  });
                }, 100);
              }
            }
          } else if (savedQuestionIndex !== null && isActiveSession) {
            clientLogger.log('⏸️ Пропускаем восстановление currentQuestionIndex: пользователь активно отвечает', {
              savedQuestionIndex,
              currentQuestionIndex,
              answersCount: Object.keys(answers).length,
            });
          }
          
          // Восстановление currentInfoScreenIndex
          const savedInfoScreenIndex = sessionStorage.getItem(QUIZ_CONFIG.STORAGE_KEYS.CURRENT_INFO_SCREEN);
          if (savedInfoScreenIndex !== null) {
            const infoScreenIndex = parseInt(savedInfoScreenIndex, 10);
            if (!isNaN(infoScreenIndex) && infoScreenIndex >= 0) {
              clientLogger.log('🔄 Восстанавливаем currentInfoScreenIndex из sessionStorage', { infoScreenIndex });
              setCurrentInfoScreenIndex(infoScreenIndex);
              currentInfoScreenIndexRef.current = infoScreenIndex;
            }
          }
          
          // Восстановление answers из React Query или API
          if (typeof window !== 'undefined' && window.Telegram?.WebApp?.initData) {
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
    
    init();

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
  
  useEffect(() => {
    if (isLoadingProgress) {
      return;
    }
    
    const progressAnswers = quizProgressFromQuery?.progress?.answers;
    if (progressAnswers && Object.keys(progressAnswers).length > 0) {
      const answersId = JSON.stringify(progressAnswers);
      const progressAnswersCount = Object.keys(progressAnswers).length;
      
      // КРИТИЧНО: Восстанавливаем если answers пустые (после перемонтирования) или если количество увеличилось
      if (answersId !== lastRestoredAnswersIdRef.current || progressAnswersCount > answersCountRef.current || answersCountRef.current === 0) {
        const currentAnswersId = JSON.stringify(answersRef.current);
        if (answersId !== currentAnswersId) {
          clientLogger.log('🔄 Восстанавливаем answers из React Query кэша (после ремоунта или обновления)', {
            answersCount: progressAnswersCount,
            previousAnswersCount: answersCountRef.current,
            wasEmpty: answersCountRef.current === 0,
          });
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
  }, [isLoadingProgress, quizProgressFromQuery?.progress?.answers ? JSON.stringify(quizProgressFromQuery.progress.answers) : null, setAnswers, setSavedProgress]);

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
    if (!loadQuestionnaireRef.current) return;

    loadQuestionnaireInProgressRef.current = true;
    loadQuestionnaireAttemptedRef.current = true;

    clientLogger.log('ℹ️ Retaking quiz, loading questionnaire in background for retake screen (useEffect)', {
      loading,
      inProgress: loadQuestionnaireInProgressRef.current,
      attempted: loadQuestionnaireAttemptedRef.current,
    });

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
      clientLogger.log('💾 allQuestionsPrevRef synced with allQuestions', {
        length: allQuestions.length,
        questionIds: allQuestions.map((q: Question) => q?.id).slice(0, 10),
      });
    }
  }, [allQuestions]);

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

  const savedProgressAnswersCount = Object.keys(savedProgress?.answers || {}).length;
  useEffect(() => {
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

  // ============================================
  // ГРУППА 7: Корректировка currentQuestionIndex
  // ============================================
  
  useEffect(() => {
    if (loading) return;
    
    const initialInfoScreensForCheck = getInitialInfoScreens();
    const isOnInitialInfoScreens = currentInfoScreenIndex < initialInfoScreensForCheck.length;
    if (isOnInitialInfoScreens) {
      return;
    }
    
    if (!questionnaire) return;
    
    if (allQuestions.length === 0 && Object.keys(answers).length > 0) {
      clientLogger.error('⚠️ Edge case: allQuestions.length === 0 but answers exist', {
        answersCount: Object.keys(answers).length,
        questionnaireId: questionnaire.id,
        allQuestionsRawLength: questionnaire.groups?.flatMap(g => g.questions || []).length + (questionnaire.questions || []).length,
        isRetakingQuiz,
        showRetakeScreen,
      });
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
      clientLogger.log('🔄 Сбрасываем currentQuestionIndex на 0 для нового пользователя', {
        currentQuestionIndex,
        allQuestionsLength: allQuestions.length,
        hasNoSavedProgress,
        answersCount: answersCountLocal,
        isRetakingQuiz,
        hasResumed,
        savedQuestionIndexFromStorage,
      });
      setCurrentQuestionIndex(0);
      return;
    }
    
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
    
    if (isOutOfBounds && !isSubmitting && !showResumeScreen) {
      const correctedIndex = isQuizCompleted
        ? allQuestions.length
        : (hasNoSavedProgress && answersCountLocal === 0 ? 0 : Math.max(0, Math.min(currentQuestionIndex, allQuestions.length - 1)));
      
      clientLogger.warn('⚠️ currentQuestionIndex выходит за пределы, корректируем', {
        currentQuestionIndex,
        allQuestionsLength: allQuestions.length,
        correctedIndex,
        answersCount: answersCountLocal,
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
      
      if (correctedIndex !== currentQuestionIndex) {
        setTimeout(() => {
          setCurrentQuestionIndex(correctedIndex);
        }, 0);
      }
    }
  }, [loading, questionnaire, allQuestions.length, allQuestionsRaw.length, currentQuestionIndex, currentInfoScreenIndex, answers, savedProgress, isRetakingQuiz, showRetakeScreen, isSubmitting, showResumeScreen, hasResumed, setCurrentQuestionIndex]);

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
    if (!loadQuestionnaireRef.current) return;

    loadQuestionnaireInProgressRef.current = true;
    loadQuestionnaireAttemptedRef.current = true;

    clientLogger.log('ℹ️ Retaking quiz, loading questionnaire in background for retake screen (useEffect)', {
      loading,
      inProgress: loadQuestionnaireInProgressRef.current,
      attempted: loadQuestionnaireAttemptedRef.current,
    });

    loadQuestionnaire().finally(() => {
      loadQuestionnaireInProgressRef.current = false;
    });
  }, [isRetakingQuiz, showRetakeScreen, questionnaire, loading, loadQuestionnaire]);

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
      clientLogger.log('🔄 Загружаем предыдущие ответы для повторного прохождения...');
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
  }, [isRetakingQuiz, questionnaire, setAnswers, setCurrentQuestionIndex]);

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
          clientLogger.log('✅ Entitlements checked for retake screen', {
            hasRetakeTopic,
            hasRetakeFull,
          });
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
      
      clientLogger.log('✅ Все вопросы отвечены, автоматически отправляем ответы через 5 секунд...', {
        currentQuestionIndex,
        allQuestionsLength: allQuestions.length,
        answersCount: Object.keys(answers).length,
        hasPendingInfoScreen: !!pendingInfoScreen,
      });
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
  }, [currentQuestionIndex, allQuestions.length, Object.keys(answers).length, questionnaire, isSubmitting, showResumeScreen, autoSubmitTriggered, error, pendingInfoScreen, initCompletedRef, isMountedRef, submitAnswersRef, isSubmittingRef, setIsSubmitting, setError, setAutoSubmitTriggered]);

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

