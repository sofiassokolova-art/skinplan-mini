// lib/quiz/hooks/useQuizRestorePipeline.ts
// ФИКС C: Хук для управления restore pipeline с четким порядком выполнения
// Предотвращает гонки между восстановлением answers, коррекцией индексов и авто-сабмитом

import { useEffect, useLayoutEffect, useRef } from 'react';
import { clientLogger } from '@/lib/client-logger';
import { QUIZ_CONFIG } from '@/lib/quiz/config/quizConfig';
import { getInitialInfoScreens } from '@/app/(miniapp)/quiz/info-screens';
import { api } from '@/lib/api';
import type { Questionnaire, Question } from '@/lib/quiz/types';

export interface UseQuizRestorePipelineParams {
  // Scope (фиксированный)
  scope: string;
  scopedStorageKeys: {
    CURRENT_INFO_SCREEN: string;
    CURRENT_QUESTION: string;
    CURRENT_QUESTION_CODE: string;
    INIT_CALLED: string;
    JUST_SUBMITTED: string;
  };
  
  // Questionnaire (source of truth)
  questionnaire: Questionnaire | null;
  questionnaireRef: React.MutableRefObject<Questionnaire | null>;
  questionnaireFromQuery: Questionnaire | null;
  
  // Progress
  quizProgressFromQuery: {
    progress?: {
      answers: Record<number, string | string[]>;
      questionIndex: number;
      infoScreenIndex: number;
    } | null;
    isCompleted?: boolean;
  } | null;
  isLoadingProgress: boolean;
  
  // Questions (computed)
  allQuestions: Question[];
  allQuestionsPrevRef: React.MutableRefObject<Question[]>;
  
  // State
  answers: Record<number, string | string[]>;
  setAnswers: React.Dispatch<React.SetStateAction<Record<number, string | string[]>>>;
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
  currentInfoScreenIndex: number;
  setCurrentInfoScreenIndex: React.Dispatch<React.SetStateAction<number>>;
  currentQuestionIndex: number;
  setCurrentQuestionIndex: React.Dispatch<React.SetStateAction<number>>;
  
  // Refs
  answersRef: React.MutableRefObject<Record<number, string | string[]>>;
  answersCountRef: React.MutableRefObject<number>;
  currentInfoScreenIndexRef: React.MutableRefObject<number>;
  currentQuestionIndexRef: React.MutableRefObject<number>;
  lastRestoredAnswersIdRef: React.MutableRefObject<string | null>;
  
  // Flags
  isStartingOver: boolean;
  isStartingOverRef: React.MutableRefObject<boolean>;
  hasResumed: boolean;
  hasResumedRef: React.MutableRefObject<boolean>;
  
  // Other
  isDev: boolean;
}

/**
 * Хук для управления restore pipeline с четким порядком выполнения
 * 
 * Порядок восстановления:
 * 1. Определить scope (уже фиксирован через scopeRef)
 * 2. Загрузить questionnaire (через loadQuestionnaire)
 * 3. Загрузить progress (через React Query или API)
 * 4. Вычислить allQuestions (через useQuizComputed)
 * 5. Выставить индексы (из sessionStorage или progress)
 * 6. Только потом разрешать авто-сабмит и "question not found"
 * 
 * Это предотвращает гонки между восстановлением answers, коррекцией индексов и авто-сабмитом
 */
export function useQuizRestorePipeline(params: UseQuizRestorePipelineParams) {
  const {
    scope,
    scopedStorageKeys,
    questionnaire,
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
  } = params;

  // Флаг для отслеживания, что restore pipeline уже выполнен
  const restoreCompletedRef = useRef(false);
  // Фикс React #185: не вызывать setSavedProgress повторно при том же прогрессе с сервера
  const serverResumeProgressFingerprintRef = useRef<string | null>(null);

  useEffect(() => {
    if (hasResumed || isStartingOver) {
      serverResumeProgressFingerprintRef.current = null;
    }
  }, [hasResumed, isStartingOver]);

  // Утилита для проверки, был ли прогресс очищен
  const isProgressCleared = () =>
    typeof window !== 'undefined' &&
    sessionStorage.getItem(QUIZ_CONFIG.getScopedKey('quiz_progress_cleared', scope)) === 'true';
  
  // Шаг 1: Восстановление answers из sessionStorage (быстро и синхронно)
  // Выполняется в useLayoutEffect для синхронного выполнения ДО рендера
  // ИСПРАВЛЕНО: НЕ пропускаем восстановление из sessionStorage, даже если isLoadingProgress = true
  // Это необходимо для показа резюм-экрана сразу, даже если React Query еще загружается
  useLayoutEffect(() => {
    // Пропускаем если:
    // - Пользователь начал заново
    // - Есть сохраненный прогресс с >= 2 ответами (уже восстановлен)
    const hasSavedProgress = savedProgress && savedProgress.answers && 
      Object.keys(savedProgress.answers).length >= QUIZ_CONFIG.VALIDATION.MIN_ANSWERS_FOR_PROGRESS_SCREEN;
    
    if (isDev) {
      clientLogger.log('🔍 [Restore Pipeline Step 1] Проверка условий', {
        hasSavedProgress,
        savedProgressAnswersCount: savedProgress?.answers ? Object.keys(savedProgress.answers).length : 0,
        answersCountRef: answersCountRef.current,
        isStartingOver,
        isProgressCleared: isProgressCleared(),
      });
    }
    
    if (typeof window === 'undefined' ||
        answersCountRef.current > 0 ||
        isStartingOver ||
        isStartingOverRef.current ||
        hasSavedProgress ||
        isProgressCleared()) {
      if (isDev && hasSavedProgress) {
        clientLogger.log('⏸️ [Restore Pipeline Step 1] Пропускаем - savedProgress уже восстановлен', {
          savedProgressAnswersCount: savedProgress?.answers ? Object.keys(savedProgress.answers).length : 0,
        });
      }
      return;
    }
    
    try {
      const answersBackupKey = QUIZ_CONFIG.getScopedKey('quiz_answers_backup', scope);
      const savedAnswersStr = sessionStorage.getItem(answersBackupKey);
      
      if (isDev) {
        clientLogger.log('🔍 [Restore Pipeline Step 1] Проверка sessionStorage', {
          hasSavedAnswersStr: !!savedAnswersStr,
          answersBackupKey,
          answersCountRef: answersCountRef.current,
          isLoadingProgress,
          hasSavedProgress,
        });
      }
      
      if (savedAnswersStr) {
        const savedAnswers = JSON.parse(savedAnswersStr);
        if (savedAnswers && Object.keys(savedAnswers).length > 0) {
          const savedAnswersCount = Object.keys(savedAnswers).length;
          // ИСПРАВЛЕНО: НЕ восстанавливаем answers из sessionStorage, если должен показываться резюм-экран
          // Это необходимо, чтобы currentAnswersCount оставался 0, что позволит показать резюм-экран
          // answers будут восстановлены только после того, как пользователь нажмет "Продолжить" на резюм-экране
          const shouldShowResume = savedAnswersCount >= QUIZ_CONFIG.VALIDATION.MIN_ANSWERS_FOR_PROGRESS_SCREEN;
          
          if (shouldShowResume) {
            // ИСПРАВЛЕНО: НЕ перезаписываем savedProgress, если он уже установлен из useQuizStateExtended
            // Это предотвращает перезапись savedProgress, который был установлен синхронно при инициализации
            if (hasSavedProgress) {
              if (isDev) {
                clientLogger.log('⏸️ [Restore Pipeline Step 1] Пропускаем установку savedProgress - уже установлен из useQuizStateExtended', {
                  savedProgressAnswersCount: savedProgress?.answers ? Object.keys(savedProgress.answers).length : 0,
                  newAnswersCount: savedAnswersCount,
                });
              }
              return; // Не перезаписываем уже установленный savedProgress
            }
            
            // Если должен показываться резюм-экран, НЕ восстанавливаем answers
            // Вместо этого только устанавливаем savedProgress для показа резюм-экрана
            const savedQuestionIndex = sessionStorage.getItem(QUIZ_CONFIG.getScopedKey(QUIZ_CONFIG.STORAGE_KEYS.CURRENT_QUESTION, scope));
            const savedInfoScreenIndex = sessionStorage.getItem(QUIZ_CONFIG.getScopedKey(QUIZ_CONFIG.STORAGE_KEYS.CURRENT_INFO_SCREEN, scope));
            const questionIndex = savedQuestionIndex ? parseInt(savedQuestionIndex, 10) : 0;
            const infoScreenIndex = savedInfoScreenIndex ? parseInt(savedInfoScreenIndex, 10) : 0;
            
            if (isDev) {
              clientLogger.log('🔄 [Restore Pipeline Step 1] Устанавливаем savedProgress для резюм-экрана (answers НЕ восстанавливаем)', {
                answersCount: savedAnswersCount,
                questionIndex,
                infoScreenIndex,
                minRequired: QUIZ_CONFIG.VALIDATION.MIN_ANSWERS_FOR_PROGRESS_SCREEN,
                shouldShowResume: true,
                currentAnswersCount: answersCountRef.current,
              });
            }
            setSavedProgress({
              answers: savedAnswers,
              questionIndex: !isNaN(questionIndex) && questionIndex >= 0 ? questionIndex : 0,
              infoScreenIndex: !isNaN(infoScreenIndex) && infoScreenIndex >= 0 ? infoScreenIndex : 0,
            });
            // НЕ восстанавливаем answers - они останутся пустыми, что позволит показать резюм-экран
          } else if (answersCountRef.current === 0 || savedAnswersCount > answersCountRef.current) {
            // Для пользователей с < 2 ответов восстанавливаем answers как обычно
            if (isDev) {
              clientLogger.log('🔄 [Restore Pipeline Step 1] Восстанавливаем answers из sessionStorage (нет резюм-экрана)', {
                answersCount: savedAnswersCount,
                isLoadingProgress,
              });
            }
            setAnswers(savedAnswers);
            answersRef.current = savedAnswers;
            answersCountRef.current = savedAnswersCount;
            
            // Также устанавливаем savedProgress для полноты
            const savedQuestionIndex = sessionStorage.getItem(QUIZ_CONFIG.getScopedKey(QUIZ_CONFIG.STORAGE_KEYS.CURRENT_QUESTION, scope));
            const savedInfoScreenIndex = sessionStorage.getItem(QUIZ_CONFIG.getScopedKey(QUIZ_CONFIG.STORAGE_KEYS.CURRENT_INFO_SCREEN, scope));
            const questionIndex = savedQuestionIndex ? parseInt(savedQuestionIndex, 10) : 0;
            const infoScreenIndex = savedInfoScreenIndex ? parseInt(savedInfoScreenIndex, 10) : 0;
            
            setSavedProgress({
              answers: savedAnswers,
              questionIndex: !isNaN(questionIndex) && questionIndex >= 0 ? questionIndex : 0,
              infoScreenIndex: !isNaN(infoScreenIndex) && infoScreenIndex >= 0 ? infoScreenIndex : 0,
            });
          }
        }
      } else if (isDev) {
        clientLogger.log('⚠️ [Restore Pipeline Step 1] Нет сохраненных ответов в sessionStorage', {
          answersBackupKey,
        });
      }
    } catch (err) {
      clientLogger.warn('⚠️ Ошибка при восстановлении answers из sessionStorage', err);
    }
  }, [
    scope,
    isStartingOver,
    isLoadingProgress,
    savedProgress, // ФИКС: Используем сам объект вместо вычисления количества ключей
  ]);
  
  // Шаг 2: Восстановление answers из React Query кэша
  // Выполняется после загрузки progress из React Query
  useLayoutEffect(() => {
    // Пропускаем если:
    // - Прогресс загружается
    // - Пользователь начал заново
    if (isLoadingProgress || isStartingOver || isStartingOverRef.current) {
      return;
    }
    
    const progressAnswers = quizProgressFromQuery?.progress?.answers;
    if (progressAnswers && Object.keys(progressAnswers).length > 0) {
      const answersId = JSON.stringify(progressAnswers);
      const progressAnswersCount = Object.keys(progressAnswers).length;
      
      // ИСПРАВЛЕНО: Если на сервере есть прогресс >= 2 ответов, устанавливаем savedProgress
      // даже если флаг quiz_progress_cleared установлен (он блокирует только локальное восстановление)
      // Это необходимо для показа резюм-экрана, когда пользователь вернулся после "Начать заново"
      const shouldShowResume = progressAnswersCount >= QUIZ_CONFIG.VALIDATION.MIN_ANSWERS_FOR_PROGRESS_SCREEN;
      
      // Повторный заход: резюм-экран, answers не трогаем (даже если savedProgress уже есть из sessionStorage)
      if (shouldShowResume && !hasResumed && !hasResumedRef.current) {
        // Если answers уже попали в state (гонка/старый баг) — очищаем, иначе резюм не покажется
        if (answersCountRef.current > 0) {
          if (isDev) {
            clientLogger.log('🧹 [Restore Pipeline Step 2] Очищаем answers для показа резюм-экрана', {
              previousAnswersCount: answersCountRef.current,
            });
          }
          setAnswers({});
          answersRef.current = {};
          answersCountRef.current = 0;
          lastRestoredAnswersIdRef.current = null;
        }
        // Устанавливаем/обновляем savedProgress с сервера, answers не восстанавливаем
        // ИСПРАВЛЕНО: Удаляем флаг quiz_progress_cleared, если на сервере есть прогресс >= 2 ответов
        // Это означает, что пользователь вернулся после "Начать заново", но на сервере есть старый прогресс
        if (isProgressCleared() && typeof window !== 'undefined') {
          try {
            sessionStorage.removeItem(QUIZ_CONFIG.getScopedKey('quiz_progress_cleared', scope));
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
              clientLogger.log('🔧 [Restore Pipeline Step 2] Удален флаг quiz_progress_cleared - на сервере есть прогресс >= 2 ответов', {
                progressAnswersCount,
                scope,
              });
            }
          } catch (err) {
            if (isDev) {
              clientLogger.warn('⚠️ [Restore Pipeline Step 2] Ошибка при удалении quiz_progress_cleared', err);
            }
          }
        }
        
        const progressFingerprint = `${answersId}:${quizProgressFromQuery.progress?.questionIndex ?? 0}:${quizProgressFromQuery.progress?.infoScreenIndex ?? 0}`;
        if (serverResumeProgressFingerprintRef.current !== progressFingerprint) {
          serverResumeProgressFingerprintRef.current = progressFingerprint;
          if (isDev) {
            clientLogger.log('🔄 [Restore Pipeline Step 2] Устанавливаем savedProgress из серверного прогресса для резюм-экрана', {
              answersCount: progressAnswersCount,
              wasProgressCleared: isProgressCleared(),
            });
          }
          setSavedProgress({
            answers: progressAnswers,
            questionIndex: quizProgressFromQuery.progress?.questionIndex || 0,
            infoScreenIndex: quizProgressFromQuery.progress?.infoScreenIndex || 0,
          });
        }
        // НЕ восстанавливаем answers - они останутся пустыми, что позволит показать резюм-экран
        return;
      }
      
      // ИСПРАВЛЕНО: Если флаг quiz_progress_cleared установлен и нет >= 2 ответов на сервере,
      // блокируем восстановление из серверного прогресса (локальный прогресс был очищен)
      if (isProgressCleared() && progressAnswersCount < QUIZ_CONFIG.VALIDATION.MIN_ANSWERS_FOR_PROGRESS_SCREEN) {
        if (isDev) {
          clientLogger.log('⏸️ [Restore Pipeline Step 2] Пропускаем восстановление - флаг quiz_progress_cleared установлен и на сервере < 2 ответов', {
            progressAnswersCount,
            minRequired: QUIZ_CONFIG.VALIDATION.MIN_ANSWERS_FOR_PROGRESS_SCREEN,
          });
        }
        return;
      }
      
      // Восстанавливаем если answers пустые или количество увеличилось
      if (answersId !== lastRestoredAnswersIdRef.current || 
          progressAnswersCount > answersCountRef.current || 
          answersCountRef.current === 0) {
        const currentAnswersId = JSON.stringify(answersRef.current);
        if (answersId !== currentAnswersId) {
          if (isDev) {
            clientLogger.log('🔄 [Restore Pipeline Step 2] Восстанавливаем answers из React Query кэша', {
              answersCount: progressAnswersCount,
            });
          }
          setAnswers((prevAnswers) => {
            const merged = Object.keys(prevAnswers).length === 0 ? progressAnswers : { ...prevAnswers, ...progressAnswers };
            answersRef.current = merged;
            answersCountRef.current = Object.keys(merged).length;
            return merged;
          });
          setSavedProgress({
            answers: progressAnswers,
            questionIndex: quizProgressFromQuery.progress?.questionIndex || 0,
            infoScreenIndex: quizProgressFromQuery.progress?.infoScreenIndex || 0,
          });
          lastRestoredAnswersIdRef.current = answersId;
        }
      }
    }
  }, [
    isLoadingProgress,
    isStartingOver,
    hasResumed,
    quizProgressFromQuery, // ФИКС: Используем сам объект вместо вычисления количества ключей
    // savedProgress намеренно не в deps — иначе setSavedProgress → эффект снова → React error #185
  ]);
  
  // Шаг 3: Восстановление индексов из sessionStorage или progress
  // Выполняется после восстановления answers и вычисления allQuestions
  useEffect(() => {
    // Пропускаем если:
    // - Пользователь начал заново
    // - Прогресс загружается
    // - Есть сохраненный прогресс с >= 2 ответами (ждем резюм-экрана)
    // - Прогресс был очищен (флаг quiz_progress_cleared)
    const hasSavedProgress = savedProgress && savedProgress.answers &&
      Object.keys(savedProgress.answers).length >= QUIZ_CONFIG.VALIDATION.MIN_ANSWERS_FOR_PROGRESS_SCREEN;

    // ФИКС: Проверяем флаг блокировки восстановления
    const progressCleared = typeof window !== 'undefined' ?
      sessionStorage.getItem(QUIZ_CONFIG.getScopedKey('quiz_progress_cleared', scope)) === 'true' : false;

    // ФИКС: Не восстанавливать прогресс, если анкета завершена
    const completedKey = QUIZ_CONFIG.getScopedKey(QUIZ_CONFIG.STORAGE_KEYS.QUIZ_COMPLETED, scope);
    const isQuizCompleted = typeof window !== 'undefined' && sessionStorage.getItem(completedKey) === 'true';

    if (isStartingOver ||
        isStartingOverRef.current ||
        isLoadingProgress ||
        hasSavedProgress ||
        progressCleared ||
        isQuizCompleted) { // ФИКС: Не восстанавливать прогресс при завершении анкеты
      return;
    }
    
    // Используем allQuestions для восстановления индексов
    const currentAllQuestions = allQuestions.length > 0 ? allQuestions : 
      (allQuestionsPrevRef.current.length > 0 ? allQuestionsPrevRef.current : []);
    
    if (currentAllQuestions.length === 0) {
      return; // Ждем загрузки вопросов
    }
    
    // Шаг 3.1: Восстановление currentQuestionIndex по коду вопроса
    const savedQuestionCode = sessionStorage.getItem(scopedStorageKeys.CURRENT_QUESTION_CODE);
    if (savedQuestionCode) {
      const questionIndex = currentAllQuestions.findIndex(q => q.code === savedQuestionCode);
      if (questionIndex >= 0 && questionIndex !== currentQuestionIndex) {
        if (isDev) {
          clientLogger.log('🔄 [Restore Pipeline Step 3.1] Восстанавливаем currentQuestionIndex по коду', {
            questionCode: savedQuestionCode,
            questionIndex,
          });
        }
        setCurrentQuestionIndex(questionIndex);
        currentQuestionIndexRef.current = questionIndex;
      }
    }
    
    // Шаг 3.2: Восстановление currentInfoScreenIndex
    const savedInfoScreenIndex = sessionStorage.getItem(scopedStorageKeys.CURRENT_INFO_SCREEN);
    if (savedInfoScreenIndex !== null) {
      const infoScreenIndex = parseInt(savedInfoScreenIndex, 10);
      if (!isNaN(infoScreenIndex) && infoScreenIndex >= 0) {
        const initialInfoScreens = getInitialInfoScreens();
        const isActivelyOnInfoScreens = currentInfoScreenIndex > 0 && currentInfoScreenIndex < initialInfoScreens.length;
        const isOnQuestions = currentInfoScreenIndex >= initialInfoScreens.length;
        
        const shouldRestore = currentInfoScreenIndex === 0 || 
                             infoScreenIndex > currentInfoScreenIndex || 
                             (!isActivelyOnInfoScreens && !isOnQuestions);
        
        if (shouldRestore && infoScreenIndex !== currentInfoScreenIndex) {
          if (isDev) {
            clientLogger.log('🔄 [Restore Pipeline Step 3.2] Восстанавливаем currentInfoScreenIndex', {
              savedIndex: infoScreenIndex,
              currentIndex: currentInfoScreenIndex,
            });
          }
          setCurrentInfoScreenIndex(infoScreenIndex);
          currentInfoScreenIndexRef.current = infoScreenIndex;
        }
      }
    }
    
    // Шаг 3.3: Восстановление индексов из savedProgress (если есть)
    if (savedProgress && !hasSavedProgress) {
      // Используем индексы из savedProgress только если они валидны
      if (savedProgress.questionIndex >= 0 && 
          savedProgress.questionIndex < currentAllQuestions.length &&
          savedProgress.questionIndex !== currentQuestionIndex) {
        if (isDev) {
          clientLogger.log('🔄 [Restore Pipeline Step 3.3] Восстанавливаем currentQuestionIndex из savedProgress', {
            questionIndex: savedProgress.questionIndex,
          });
        }
        setCurrentQuestionIndex(savedProgress.questionIndex);
        currentQuestionIndexRef.current = savedProgress.questionIndex;
      }
      
      if (savedProgress.infoScreenIndex >= 0 && 
          savedProgress.infoScreenIndex !== currentInfoScreenIndex) {
        if (isDev) {
          clientLogger.log('🔄 [Restore Pipeline Step 3.3] Восстанавливаем currentInfoScreenIndex из savedProgress', {
            infoScreenIndex: savedProgress.infoScreenIndex,
          });
        }
        setCurrentInfoScreenIndex(savedProgress.infoScreenIndex);
        currentInfoScreenIndexRef.current = savedProgress.infoScreenIndex;
      }
    }
    
    // Помечаем, что restore pipeline выполнен
    restoreCompletedRef.current = true;
  }, [
    scope,
    scopedStorageKeys.CURRENT_QUESTION_CODE,
    scopedStorageKeys.CURRENT_INFO_SCREEN,
    allQuestions.length,
    isStartingOver,
    isLoadingProgress,
    savedProgress, // ФИКС: Используем сам объект вместо отдельных свойств и вычислений
  ]);
  
  return {
    restoreCompleted: restoreCompletedRef.current,
  };
}
