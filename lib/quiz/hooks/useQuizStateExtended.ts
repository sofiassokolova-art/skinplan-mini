// lib/quiz/hooks/useQuizStateExtended.ts
// РЕФАКТОРИНГ: Расширенный хук для управления всеми состояниями анкеты
// Вынесен из quiz/page.tsx для улучшения читаемости и поддержки
// ИСПРАВЛЕНО: Использует специализированные хуки useQuizNavigation и useQuizUI

import { useState, useRef, useEffect, useLayoutEffect } from 'react';
import type { Questionnaire } from '@/lib/quiz/types';
import type { InfoScreen } from '@/app/(miniapp)/quiz/info-screens';
import { useQuizNavigation } from './useQuizNavigation';
import { useQuizUI } from './useQuizUI';
import { QUIZ_CONFIG } from '@/lib/quiz/config/quizConfig';

export interface UseQuizStateExtendedReturn {
  // Основные состояния
  questionnaire: Questionnaire | null;
  setQuestionnaire: React.Dispatch<React.SetStateAction<Questionnaire | null>>;
  loading: boolean;
  setLoading: React.Dispatch<React.SetStateAction<boolean>>;
  error: string | null;
  setError: React.Dispatch<React.SetStateAction<string | null>>;
  
  // Навигация
  currentQuestionIndex: number;
  setCurrentQuestionIndex: React.Dispatch<React.SetStateAction<number>>;
  currentQuestionIndexRef: React.MutableRefObject<number>;
  currentInfoScreenIndex: number;
  setCurrentInfoScreenIndex: React.Dispatch<React.SetStateAction<number>>;
  currentInfoScreenIndexRef: React.MutableRefObject<number>;
  
  // Ответы
  answers: Record<number, string | string[]>;
  setAnswers: React.Dispatch<React.SetStateAction<Record<number, string | string[]>>>;
  
  // UI состояния
  showResumeScreen: boolean;
  setShowResumeScreen: React.Dispatch<React.SetStateAction<boolean>>;
  isSubmitting: boolean;
  setIsSubmitting: React.Dispatch<React.SetStateAction<boolean>>;
  isSubmittingRef: React.MutableRefObject<boolean>;
  finalizing: boolean;
  setFinalizing: React.Dispatch<React.SetStateAction<boolean>>;
  finalizingStep: 'answers' | 'plan' | 'done';
  setFinalizingStep: React.Dispatch<React.SetStateAction<'answers' | 'plan' | 'done'>>;
  finalizeError: string | null;
  setFinalizeError: React.Dispatch<React.SetStateAction<string | null>>;
  pendingInfoScreen: InfoScreen | null;
  pendingInfoScreenRef: React.MutableRefObject<InfoScreen | null>;
  setPendingInfoScreen: React.Dispatch<React.SetStateAction<InfoScreen | null>>;
  
  // Прогресс
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
  
  // Retake состояния
  isRetakingQuiz: boolean;
  setIsRetakingQuiz: React.Dispatch<React.SetStateAction<boolean>>;
  showRetakeScreen: boolean;
  setShowRetakeScreen: React.Dispatch<React.SetStateAction<boolean>>;
  hasRetakingPayment: boolean;
  setHasRetakingPayment: React.Dispatch<React.SetStateAction<boolean>>;
  hasFullRetakePayment: boolean;
  setHasFullRetakePayment: React.Dispatch<React.SetStateAction<boolean>>;
  
  // Resume состояния
  hasResumed: boolean;
  setHasResumed: React.Dispatch<React.SetStateAction<boolean>>;
  hasResumedRef: React.MutableRefObject<boolean>;
  resumeCompletedRef: React.MutableRefObject<boolean>;
  
  // User preferences
  userPreferencesData: {
    hasPlanProgress?: boolean;
    isRetakingQuiz?: boolean;
    fullRetakeFromHome?: boolean;
    paymentRetakingCompleted?: boolean;
    paymentFullRetakeCompleted?: boolean;
  } | null;
  setUserPreferencesData: React.Dispatch<React.SetStateAction<{
    hasPlanProgress?: boolean;
    isRetakingQuiz?: boolean;
    fullRetakeFromHome?: boolean;
    paymentRetakingCompleted?: boolean;
    paymentFullRetakeCompleted?: boolean;
  } | null>>;
  
  // Start over состояния
  isStartingOver: boolean;
  setIsStartingOver: React.Dispatch<React.SetStateAction<boolean>>;
  isStartingOverRef: React.MutableRefObject<boolean>;
  daysSincePlanGeneration: number | null;
  setDaysSincePlanGeneration: React.Dispatch<React.SetStateAction<number | null>>;
  
  // Debug состояния
  debugLogs: Array<{ time: string; message: string; data?: any }>;
  setDebugLogs: React.Dispatch<React.SetStateAction<Array<{ time: string; message: string; data?: any }>>>;
  showDebugPanel: boolean;
  setShowDebugPanel: React.Dispatch<React.SetStateAction<boolean>>;
  
  // Auto submit
  autoSubmitTriggered: boolean;
  setAutoSubmitTriggered: React.Dispatch<React.SetStateAction<boolean>>;
  autoSubmitTriggeredRef: React.MutableRefObject<boolean>;
  
  // Refs для синхронизации
  initCalledRef: React.MutableRefObject<boolean>;
  questionnaireRef: React.MutableRefObject<Questionnaire | null>;
  isMountedRef: React.MutableRefObject<boolean>;
  redirectTimeoutRef: React.MutableRefObject<NodeJS.Timeout | null>;
  submitAnswersRef: React.MutableRefObject<(() => Promise<void>) | null>;
  saveProgressTimeoutRef: React.MutableRefObject<NodeJS.Timeout | null>;
  lastSavedAnswerRef: React.MutableRefObject<{ questionId: number; answer: string | string[] } | null>;
  pendingProgressRef: React.MutableRefObject<{ questionIndex?: number; infoScreenIndex?: number } | null>;
  progressLoadedRef: React.MutableRefObject<boolean>;
  answersRef: React.MutableRefObject<Record<number, string | string[]>>;
  answersCountRef: React.MutableRefObject<number>;
  lastRestoredAnswersIdRef: React.MutableRefObject<string | null>;
  loadingRefForTimeout: React.MutableRefObject<boolean>;
  loadingStartTimeRef: React.MutableRefObject<number | null>;
  initCompletedRef: React.MutableRefObject<boolean>;
  initCompleted: boolean;
  setInitCompleted: React.Dispatch<React.SetStateAction<boolean>>;
  isProgressCleared: boolean;
  setIsProgressCleared: React.Dispatch<React.SetStateAction<boolean>>;
  
  // Refs для синхронизации с State Machine и React Query
  lastSyncedFromQueryIdRef: React.MutableRefObject<string | number | null>;
  setQuestionnaireInStateMachineRef: React.MutableRefObject<((questionnaire: Questionnaire | null) => void) | null>;
  questionnaireForCallbackRef: React.MutableRefObject<Questionnaire | null>;
  lastSyncedQuestionnaireIdRef: React.MutableRefObject<string | number | null>;
  lastSyncedQuestionnaireRef: React.MutableRefObject<Questionnaire | null>;
  isSyncingRef: React.MutableRefObject<boolean>;
  lastLoadingResetIdRef: React.MutableRefObject<string | number | null>;
  questionnaireStateRef: React.MutableRefObject<Questionnaire | null>;
  loadingStateRef: React.MutableRefObject<boolean>;
  stateMachineQuestionnaireRef: React.MutableRefObject<Questionnaire | null>;
  stateMachineQuestionnaireIdRef: React.MutableRefObject<string | number | null>;

  // Refs для загрузки и прогресса
  loadProgressInProgressRef: React.MutableRefObject<boolean>;
  progressLoadInProgressRef: React.MutableRefObject<boolean>;
  loadQuestionnaireInProgressRef: React.MutableRefObject<boolean>;
  loadQuestionnaireAttemptedRef: React.MutableRefObject<boolean>;
  redirectInProgressRef: React.MutableRefObject<boolean>;
  profileCheckInProgressRef: React.MutableRefObject<boolean>;
  initCompletedTimeRef: React.MutableRefObject<number | null>;
  firstScreenResetRef: React.MutableRefObject<boolean>;
}

/**
 * Расширенный хук для управления всеми состояниями анкеты
 * Группирует все useState и useRef из основного компонента
 * РЕФАКТОРИНГ: Использует специализированные хуки useQuizNavigation и useQuizUI
 */
export function useQuizStateExtended(): UseQuizStateExtendedReturn {
  // РЕФАКТОРИНГ: Используем специализированные хуки
  const navigation = useQuizNavigation();
  const ui = useQuizUI();

  // КРИТИЧНО ИСПРАВЛЕНО: Все useState должны вызываться в стабильном порядке
  // Группируем все useState вместе для предотвращения React Error #300
  
  // Основные состояния
  const [questionnaire, setQuestionnaire] = useState<Questionnaire | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // ИСПРАВЛЕНО: Добавлен useState для initCompleted сразу после основных состояний
  // Это необходимо для корректной работы useQuizView, который зависит от initCompleted
  // КРИТИЧНО: Должен быть вызван сразу после основных useState для стабильности порядка хуков
  const [initCompleted, setInitCompleted] = useState(false);
  
  // Ответы
  const [answers, setAnswers] = useState<Record<number, string | string[]>>({});
  
  // Прогресс
  // ИСПРАВЛЕНО: Инициализируем savedProgress из sessionStorage синхронно, чтобы он был доступен при первом рендере
  // Это необходимо для показа резюм-экрана сразу, даже до выполнения useLayoutEffect
  const [savedProgress, setSavedProgress] = useState<{
    answers: Record<number, string | string[]>;
    questionIndex: number;
    infoScreenIndex: number;
  } | null>(() => {
    // Инициализируем из sessionStorage синхронно
    console.log('🔍 [useQuizStateExtended] Инициализация savedProgress', {
      isWindowDefined: typeof window !== 'undefined',
      isServer: typeof window === 'undefined',
    });
    
    if (typeof window !== 'undefined') {
      try {
        // ИСПРАВЛЕНО: Проверяем флаг quiz_progress_cleared перед восстановлением прогресса из sessionStorage
        // Флаг устанавливается при "Начать заново" на резюм-экране и блокирует восстановление из sessionStorage (локальный прогресс)
        // НО: флаг НЕ блокирует установку savedProgress из серверного прогресса (обрабатывается в useQuizRestorePipeline и useQuizEffects)
        // НО: если есть сохраненные ответы в sessionStorage, это означает, что пользователь начал новую сессию
        // и флаг можно удалить, чтобы разрешить восстановление при следующей загрузке
        let progressCleared = sessionStorage.getItem('quiz_progress_cleared') || 
                             sessionStorage.getItem('default:quiz_progress_cleared');
        
        // ИСПРАВЛЕНО: Проверяем, есть ли сохраненные ответы ПЕРЕД проверкой флага
        // Если есть ответы, но флаг установлен - это означает, что пользователь начал новую сессию
        // и флаг можно удалить
        let hasSavedAnswers = false;
        const storageKeys = Object.keys(sessionStorage);
        for (const key of storageKeys) {
          if (key.includes(':quiz_answers_backup') || key.endsWith(':quiz_answers_backup') || key === 'quiz_answers_backup') {
            const savedAnswersStr = sessionStorage.getItem(key);
            if (savedAnswersStr && savedAnswersStr !== '{}' && savedAnswersStr !== 'null') {
              try {
                const savedAnswers = JSON.parse(savedAnswersStr);
                if (savedAnswers && Object.keys(savedAnswers).length >= QUIZ_CONFIG.VALIDATION.MIN_ANSWERS_FOR_PROGRESS_SCREEN) {
                  hasSavedAnswers = true;
                  break;
                }
              } catch (e) {
                // Игнорируем ошибки парсинга
              }
            }
          }
        }
        
        console.log('🔍 [useQuizStateExtended] Проверка quiz_progress_cleared', {
          progressCleared,
          isCleared: progressCleared === 'true',
          hasSavedAnswers,
        });
        
        // ИСПРАВЛЕНО: Если есть сохраненные ответы, но флаг установлен - удаляем флаг
        // Это означает, что пользователь начал новую сессию после startOver
        if (progressCleared === 'true' && hasSavedAnswers) {
          console.log('🔧 [useQuizStateExtended] Удаляем флаг quiz_progress_cleared - есть сохраненные ответы (новая сессия начата)');
          try {
            sessionStorage.removeItem('quiz_progress_cleared');
            sessionStorage.removeItem('default:quiz_progress_cleared');
            // Также удаляем scoped ключи
            for (const key of storageKeys) {
              if (key.includes(':quiz_progress_cleared') || key.endsWith(':quiz_progress_cleared')) {
                sessionStorage.removeItem(key);
              }
            }
            progressCleared = null; // Сбрасываем флаг, чтобы продолжить восстановление
          } catch (err) {
            console.warn('⚠️ [useQuizStateExtended] Ошибка при удалении quiz_progress_cleared', err);
          }
        }
        
        if (progressCleared === 'true') {
          console.log('⏸️ [useQuizStateExtended] savedProgress НЕ восстановлен - прогресс был очищен (quiz_progress_cleared)');
          return null; // Прогресс был очищен, не восстанавливаем
        }
        
        console.log('🔍 [useQuizStateExtended] Начинаем восстановление savedProgress из sessionStorage');
        
        // ИСПРАВЛЕНО: Пробуем найти questionnaireId из sessionStorage или используем дефолтный ключ
        // Сначала пробуем найти scoped ключи (с questionnaireId)
        let savedAnswersStr: string | null = null;
        for (const key of storageKeys) {
          if (key.includes(':quiz_answers_backup') || key.endsWith(':quiz_answers_backup')) {
            savedAnswersStr = sessionStorage.getItem(key);
            console.log('🔍 [useQuizStateExtended] Найден scoped ключ для answers', { key, hasValue: !!savedAnswersStr });
            break;
          }
        }
        
        // Если не нашли scoped ключ, пробуем без scope (для обратной совместимости)
        if (!savedAnswersStr || savedAnswersStr === '{}' || savedAnswersStr === 'null') {
          savedAnswersStr = sessionStorage.getItem('quiz_answers_backup');
          console.log('🔍 [useQuizStateExtended] Проверяем unscoped ключ quiz_answers_backup', { 
            hasValue: !!savedAnswersStr,
            value: savedAnswersStr ? (savedAnswersStr.length > 100 ? savedAnswersStr.substring(0, 100) + '...' : savedAnswersStr) : null
          });
        }
        
        console.log('🔍 [useQuizStateExtended] Результат поиска savedAnswersStr', {
          found: !!savedAnswersStr,
          isEmpty: savedAnswersStr === '{}' || savedAnswersStr === 'null',
          length: savedAnswersStr?.length || 0,
        });
        
        if (savedAnswersStr && savedAnswersStr !== '{}' && savedAnswersStr !== 'null') {
          try {
            const savedAnswers = JSON.parse(savedAnswersStr);
            console.log('🔍 [useQuizStateExtended] Парсинг savedAnswers', {
              parsed: !!savedAnswers,
              keysCount: savedAnswers ? Object.keys(savedAnswers).length : 0,
              keys: savedAnswers ? Object.keys(savedAnswers).slice(0, 5) : [],
            });
            
            if (savedAnswers && Object.keys(savedAnswers).length > 0) {
              const savedAnswersCount = Object.keys(savedAnswers).length;
              
              console.log('🔍 [useQuizStateExtended] Проверка количества ответов', {
                savedAnswersCount,
                minRequired: QUIZ_CONFIG.VALIDATION.MIN_ANSWERS_FOR_PROGRESS_SCREEN,
                shouldRestore: savedAnswersCount >= QUIZ_CONFIG.VALIDATION.MIN_ANSWERS_FOR_PROGRESS_SCREEN,
              });
              
              // Восстанавливаем только если >= 2 ответов (для резюм-экрана)
              if (savedAnswersCount >= QUIZ_CONFIG.VALIDATION.MIN_ANSWERS_FOR_PROGRESS_SCREEN) {
                // Пробуем найти индексы из sessionStorage
                let savedQuestionIndex = sessionStorage.getItem(QUIZ_CONFIG.STORAGE_KEYS.CURRENT_QUESTION);
                let savedInfoScreenIndex = sessionStorage.getItem(QUIZ_CONFIG.STORAGE_KEYS.CURRENT_INFO_SCREEN);
                
                // Если не нашли, пробуем найти scoped ключи
                if (!savedQuestionIndex) {
                  const keys = Object.keys(sessionStorage);
                  for (const key of keys) {
                    if (key.includes(':quiz_currentQuestionIndex') || key.endsWith(':quiz_currentQuestionIndex')) {
                      savedQuestionIndex = sessionStorage.getItem(key);
                      break;
                    }
                  }
                }
                
                if (!savedInfoScreenIndex) {
                  const keys = Object.keys(sessionStorage);
                  for (const key of keys) {
                    if (key.includes(':quiz_currentInfoScreenIndex') || key.endsWith(':quiz_currentInfoScreenIndex')) {
                      savedInfoScreenIndex = sessionStorage.getItem(key);
                      break;
                    }
                  }
                }
                
                const questionIndex = savedQuestionIndex ? parseInt(savedQuestionIndex, 10) : 0;
                const infoScreenIndex = savedInfoScreenIndex ? parseInt(savedInfoScreenIndex, 10) : 0;
                
                const restoredProgress = {
                  answers: savedAnswers,
                  questionIndex: !isNaN(questionIndex) && questionIndex >= 0 ? questionIndex : 0,
                  infoScreenIndex: !isNaN(infoScreenIndex) && infoScreenIndex >= 0 ? infoScreenIndex : 0,
                };
                
                // ИСПРАВЛЕНО: Добавлено логирование для диагностики
                console.log('✅ [useQuizStateExtended] savedProgress восстановлен из sessionStorage', {
                  savedAnswersCount,
                  questionIndex: restoredProgress.questionIndex,
                  infoScreenIndex: restoredProgress.infoScreenIndex,
                  minRequired: QUIZ_CONFIG.VALIDATION.MIN_ANSWERS_FOR_PROGRESS_SCREEN,
                  shouldShowResume: savedAnswersCount >= QUIZ_CONFIG.VALIDATION.MIN_ANSWERS_FOR_PROGRESS_SCREEN,
                });
                
                return restoredProgress;
              } else {
                console.log('⏸️ [useQuizStateExtended] savedProgress НЕ восстановлен - недостаточно ответов', {
                  savedAnswersCount,
                  minRequired: QUIZ_CONFIG.VALIDATION.MIN_ANSWERS_FOR_PROGRESS_SCREEN,
                });
                return null;
              }
            } else {
              console.log('⏸️ [useQuizStateExtended] savedProgress НЕ восстановлен - savedAnswers пустой или невалидный', {
                hasSavedAnswers: !!savedAnswers,
                keysCount: savedAnswers ? Object.keys(savedAnswers).length : 0,
              });
              return null;
            }
          } catch (e) {
            console.warn('⚠️ [useQuizStateExtended] Ошибка парсинга savedAnswers', e);
            return null;
          }
        } else {
          console.log('⏸️ [useQuizStateExtended] savedProgress НЕ восстановлен - нет savedAnswersStr в sessionStorage', {
            hasSavedAnswersStr: !!savedAnswersStr,
            isEmpty: savedAnswersStr === '{}' || savedAnswersStr === 'null',
          });
        }
      } catch (err) {
        console.warn('⚠️ [useQuizStateExtended] Ошибка при восстановлении savedProgress из sessionStorage', err);
        // Игнорируем ошибки sessionStorage
      }
    }
    console.log('⏸️ [useQuizStateExtended] savedProgress инициализирован как null');
    return null;
  });
  
  // ИСПРАВЛЕНО: Восстанавливаем savedProgress на клиенте, если он был null при инициализации
  // Это необходимо, потому что useState с функцией-инициализатором вызывается только один раз
  // и на сервере window === undefined, поэтому savedProgress всегда null на сервере
  useLayoutEffect(() => {
    console.log('🔍 [useQuizStateExtended] useLayoutEffect: ВХОД', {
      savedProgressIsNull: savedProgress === null,
      isWindowDefined: typeof window !== 'undefined',
      savedProgressValue: savedProgress,
    });
    
    // Пропускаем, если savedProgress уже установлен
    if (savedProgress !== null) {
      console.log('⏸️ [useQuizStateExtended] useLayoutEffect: savedProgress уже установлен, пропускаем', {
        answersCount: Object.keys(savedProgress.answers || {}).length,
      });
      return;
    }
    
    // Пропускаем на сервере
    if (typeof window === 'undefined') {
      console.log('⏸️ [useQuizStateExtended] useLayoutEffect: на сервере, пропускаем');
      return;
    }
    
    console.log('✅ [useQuizStateExtended] useLayoutEffect: продолжаем выполнение на клиенте');
    
    try {
      console.log('🔍 [useQuizStateExtended] useLayoutEffect: пытаемся восстановить savedProgress на клиенте');
      
      // Ищем savedAnswersStr в sessionStorage
      const storageKeys = Object.keys(sessionStorage);
      let savedAnswersStr: string | null = null;
      let foundAnswersCount = 0;
      
      console.log('🔍 [useQuizStateExtended] useLayoutEffect: проверяем sessionStorage на наличие сохраненных ответов', {
        storageKeysCount: storageKeys.length,
        allStorageKeys: storageKeys,
        quizRelatedKeys: storageKeys.filter(k => k.includes('quiz') || k.includes('answer')),
        answersBackupKeys: storageKeys.filter(k => k.includes('answers_backup') || k.includes('quiz_answers')),
        currentQuestionKeys: storageKeys.filter(k => k.includes('currentQuestion') || k.includes('CURRENT_QUESTION')),
      });
      
      // ИСПРАВЛЕНО: Объявляем progressCleared ДО использования
      let progressCleared = sessionStorage.getItem('quiz_progress_cleared') || 
                           sessionStorage.getItem('default:quiz_progress_cleared');
      
      // Также проверяем scoped ключи для progressCleared
      if (!progressCleared) {
        for (const key of storageKeys) {
          if (key.includes(':quiz_progress_cleared') || key.endsWith(':quiz_progress_cleared')) {
            const value = sessionStorage.getItem(key);
            if (value === 'true') {
              progressCleared = value;
              break;
            }
          }
        }
      }
      
      // Сначала проверяем, есть ли сохраненные ответы
      // ИСПРАВЛЕНО: Ищем ответы во всех возможных ключах (scoped и unscoped)
      for (const key of storageKeys) {
        // Проверяем все варианты ключей для ответов
        const isAnswersKey = key.includes('quiz_answers') || 
                            key.includes('answers_backup') ||
                            key === 'quiz_answers_backup' ||
                            key.endsWith(':quiz_answers_backup') ||
                            key.includes(':quiz_answers_backup');
        
        if (isAnswersKey) {
          savedAnswersStr = sessionStorage.getItem(key);
          console.log('🔍 [useQuizStateExtended] useLayoutEffect: проверяем ключ для ответов', { 
            key, 
            hasValue: !!savedAnswersStr,
            valueLength: savedAnswersStr ? savedAnswersStr.length : 0,
            valuePreview: savedAnswersStr && savedAnswersStr.length > 0 ? savedAnswersStr.substring(0, 50) + '...' : null,
          });
          
          if (savedAnswersStr && savedAnswersStr !== '{}' && savedAnswersStr !== 'null' && savedAnswersStr.trim() !== '') {
            try {
              const savedAnswers = JSON.parse(savedAnswersStr);
              foundAnswersCount = savedAnswers ? Object.keys(savedAnswers).length : 0;
              console.log('🔍 [useQuizStateExtended] useLayoutEffect: найдены сохраненные ответы', {
                key,
                answersCount: foundAnswersCount,
                minRequired: QUIZ_CONFIG.VALIDATION.MIN_ANSWERS_FOR_PROGRESS_SCREEN,
                shouldRemoveFlag: foundAnswersCount >= QUIZ_CONFIG.VALIDATION.MIN_ANSWERS_FOR_PROGRESS_SCREEN,
                answerKeys: savedAnswers ? Object.keys(savedAnswers).slice(0, 5) : [],
              });
              
              if (foundAnswersCount >= QUIZ_CONFIG.VALIDATION.MIN_ANSWERS_FOR_PROGRESS_SCREEN) {
                // Есть сохраненные ответы >= 2, это означает, что пользователь начал новую сессию
                // Удаляем флаг quiz_progress_cleared, чтобы разрешить восстановление
                console.log('🔧 [useQuizStateExtended] useLayoutEffect: найдены сохраненные ответы >= 2, удаляем флаг quiz_progress_cleared');
                try {
                  sessionStorage.removeItem('quiz_progress_cleared');
                  sessionStorage.removeItem('default:quiz_progress_cleared');
                  // Также удаляем scoped ключи
                  for (const clearKey of storageKeys) {
                    if (clearKey.includes(':quiz_progress_cleared') || clearKey.endsWith(':quiz_progress_cleared')) {
                      sessionStorage.removeItem(clearKey);
                      console.log('🔧 [useQuizStateExtended] useLayoutEffect: удален scoped ключ', { clearKey });
                    }
                  }
                  console.log('✅ [useQuizStateExtended] useLayoutEffect: флаг quiz_progress_cleared удален');
                  // Обновляем переменную progressCleared для дальнейшей проверки
                  progressCleared = null;
                } catch (err) {
                  console.warn('⚠️ [useQuizStateExtended] useLayoutEffect: ошибка при удалении quiz_progress_cleared', err);
                }
                break;
              }
            } catch (e) {
              console.warn('⚠️ [useQuizStateExtended] useLayoutEffect: ошибка при парсинге savedAnswers', { 
                key, 
                error: e,
                valuePreview: savedAnswersStr ? savedAnswersStr.substring(0, 100) : null,
              });
            }
          }
        }
      }
      
      // Проверяем флаг quiz_progress_cleared (после возможного удаления)
      // ИСПРАВЛЕНО: Перепроверяем флаг после возможного удаления выше
      if (!progressCleared) {
        progressCleared = sessionStorage.getItem('quiz_progress_cleared') || 
                         sessionStorage.getItem('default:quiz_progress_cleared');
        
        // Также проверяем scoped ключи
        if (!progressCleared) {
          for (const key of storageKeys) {
            if (key.includes(':quiz_progress_cleared') || key.endsWith(':quiz_progress_cleared')) {
              const value = sessionStorage.getItem(key);
              if (value === 'true') {
                progressCleared = value;
                break;
              }
            }
          }
        }
      }
      
      // ИСПРАВЛЕНО: Если флаг установлен, но нет ответов, очищаем остаточные данные
      // Это может произойти, если прогресс был частично очищен (ответы удалены, но код вопроса остался)
      if (progressCleared === 'true' && foundAnswersCount === 0) {
        console.log('🧹 [useQuizStateExtended] useLayoutEffect: очищаем остаточные данные (quiz_progress_cleared установлен, но ответов нет)', {
          foundAnswersCount,
        });
        
        // Очищаем остаточные данные, которые могут мешать восстановлению
        try {
          // Очищаем CURRENT_QUESTION_CODE, если он есть, но ответов нет
          for (const key of storageKeys) {
            if (key.includes('currentQuestionCode') || key.includes('CURRENT_QUESTION_CODE')) {
              sessionStorage.removeItem(key);
              console.log('🧹 [useQuizStateExtended] useLayoutEffect: удален остаточный ключ', { key });
            }
          }
          
          // Также очищаем CURRENT_QUESTION и CURRENT_INFO_SCREEN, если они есть
          for (const key of storageKeys) {
            if (key.includes('currentQuestion') && !key.includes('Code')) {
              sessionStorage.removeItem(key);
              console.log('🧹 [useQuizStateExtended] useLayoutEffect: удален остаточный ключ', { key });
            }
            if (key.includes('currentInfoScreen')) {
              sessionStorage.removeItem(key);
              console.log('🧹 [useQuizStateExtended] useLayoutEffect: удален остаточный ключ', { key });
            }
          }
        } catch (err) {
          console.warn('⚠️ [useQuizStateExtended] useLayoutEffect: ошибка при очистке остаточных данных', err);
        }
        
        console.log('⏸️ [useQuizStateExtended] useLayoutEffect: прогресс был очищен и нет ответов, не восстанавливаем', {
          foundAnswersCount,
          minRequired: QUIZ_CONFIG.VALIDATION.MIN_ANSWERS_FOR_PROGRESS_SCREEN,
        });
        return;
      }
      
      console.log('🔍 [useQuizStateExtended] useLayoutEffect: проверка флага quiz_progress_cleared', {
        progressCleared,
        isCleared: progressCleared === 'true',
        foundAnswersCount,
        shouldBlock: progressCleared === 'true' && foundAnswersCount < QUIZ_CONFIG.VALIDATION.MIN_ANSWERS_FOR_PROGRESS_SCREEN,
      });
      
      // ИСПРАВЛЕНО: Если флаг установлен, но есть ответы >= 2, флаг уже должен быть удален выше
      // Если флаг все еще установлен и нет ответов, не восстанавливаем
      if (progressCleared === 'true' && foundAnswersCount < QUIZ_CONFIG.VALIDATION.MIN_ANSWERS_FOR_PROGRESS_SCREEN) {
        console.log('⏸️ [useQuizStateExtended] useLayoutEffect: прогресс был очищен, не восстанавливаем', {
          foundAnswersCount,
          minRequired: QUIZ_CONFIG.VALIDATION.MIN_ANSWERS_FOR_PROGRESS_SCREEN,
        });
        return;
      }
      
      // Сбрасываем savedAnswersStr, чтобы найти его заново после проверки флага
      savedAnswersStr = null;
      
      for (const key of storageKeys) {
        if (key.includes(':quiz_answers_backup') || key.endsWith(':quiz_answers_backup')) {
          savedAnswersStr = sessionStorage.getItem(key);
          console.log('🔍 [useQuizStateExtended] useLayoutEffect: найден scoped ключ для answers', { key, hasValue: !!savedAnswersStr });
          break;
        }
      }
      
      // Если не нашли scoped ключ, пробуем без scope
      if (!savedAnswersStr || savedAnswersStr === '{}' || savedAnswersStr === 'null') {
        savedAnswersStr = sessionStorage.getItem('quiz_answers_backup');
        console.log('🔍 [useQuizStateExtended] useLayoutEffect: проверяем unscoped ключ quiz_answers_backup', { hasValue: !!savedAnswersStr });
      }
      
      if (savedAnswersStr && savedAnswersStr !== '{}' && savedAnswersStr !== 'null') {
        try {
          const savedAnswers = JSON.parse(savedAnswersStr);
          console.log('🔍 [useQuizStateExtended] useLayoutEffect: парсинг savedAnswers', {
            parsed: !!savedAnswers,
            keysCount: savedAnswers ? Object.keys(savedAnswers).length : 0,
          });
          
          if (savedAnswers && Object.keys(savedAnswers).length > 0) {
            const savedAnswersCount = Object.keys(savedAnswers).length;
            
            console.log('🔍 [useQuizStateExtended] useLayoutEffect: проверка количества ответов', {
              savedAnswersCount,
              minRequired: QUIZ_CONFIG.VALIDATION.MIN_ANSWERS_FOR_PROGRESS_SCREEN,
              shouldRestore: savedAnswersCount >= QUIZ_CONFIG.VALIDATION.MIN_ANSWERS_FOR_PROGRESS_SCREEN,
            });
            
            // Восстанавливаем только если >= 2 ответов (для резюм-экрана)
            if (savedAnswersCount >= QUIZ_CONFIG.VALIDATION.MIN_ANSWERS_FOR_PROGRESS_SCREEN) {
              // Пробуем найти индексы из sessionStorage
              let savedQuestionIndex = sessionStorage.getItem(QUIZ_CONFIG.STORAGE_KEYS.CURRENT_QUESTION);
              let savedInfoScreenIndex = sessionStorage.getItem(QUIZ_CONFIG.STORAGE_KEYS.CURRENT_INFO_SCREEN);
              
              // Если не нашли, пробуем найти scoped ключи
              if (!savedQuestionIndex) {
                for (const key of storageKeys) {
                  if (key.includes(':quiz_currentQuestionIndex') || key.endsWith(':quiz_currentQuestionIndex')) {
                    savedQuestionIndex = sessionStorage.getItem(key);
                    break;
                  }
                }
              }
              
              if (!savedInfoScreenIndex) {
                for (const key of storageKeys) {
                  if (key.includes(':quiz_currentInfoScreenIndex') || key.endsWith(':quiz_currentInfoScreenIndex')) {
                    savedInfoScreenIndex = sessionStorage.getItem(key);
                    break;
                  }
                }
              }
              
              const questionIndex = savedQuestionIndex ? parseInt(savedQuestionIndex, 10) : 0;
              const infoScreenIndex = savedInfoScreenIndex ? parseInt(savedInfoScreenIndex, 10) : 0;
              
              const restoredProgress = {
                answers: savedAnswers,
                questionIndex: !isNaN(questionIndex) && questionIndex >= 0 ? questionIndex : 0,
                infoScreenIndex: !isNaN(infoScreenIndex) && infoScreenIndex >= 0 ? infoScreenIndex : 0,
              };
              
              console.log('✅ [useQuizStateExtended] useLayoutEffect: savedProgress восстановлен из sessionStorage', {
                savedAnswersCount,
                questionIndex: restoredProgress.questionIndex,
                infoScreenIndex: restoredProgress.infoScreenIndex,
                minRequired: QUIZ_CONFIG.VALIDATION.MIN_ANSWERS_FOR_PROGRESS_SCREEN,
                shouldShowResume: savedAnswersCount >= QUIZ_CONFIG.VALIDATION.MIN_ANSWERS_FOR_PROGRESS_SCREEN,
              });
              
              setSavedProgress(restoredProgress);
            } else {
              console.log('⏸️ [useQuizStateExtended] useLayoutEffect: недостаточно ответов для восстановления', {
                savedAnswersCount,
                minRequired: QUIZ_CONFIG.VALIDATION.MIN_ANSWERS_FOR_PROGRESS_SCREEN,
              });
            }
          }
        } catch (e) {
          console.warn('⚠️ [useQuizStateExtended] useLayoutEffect: ошибка при парсинге savedAnswers', e);
        }
      } else {
        console.log('⏸️ [useQuizStateExtended] useLayoutEffect: savedAnswersStr не найден или пустой');
      }
    } catch (err) {
      console.warn('⚠️ [useQuizStateExtended] useLayoutEffect: ошибка при восстановлении savedProgress из sessionStorage', err);
    }
  }, [savedProgress]); // Зависимость от savedProgress, чтобы не выполнять повторно, если уже восстановлен
  
  // Retake состояния
  const [isRetakingQuiz, setIsRetakingQuiz] = useState(false);
  const [showRetakeScreen, setShowRetakeScreen] = useState(false);
  const [hasRetakingPayment, setHasRetakingPayment] = useState(false);
  const [hasFullRetakePayment, setHasFullRetakePayment] = useState(false);
  
  // Resume состояния
  const [hasResumed, setHasResumed] = useState(false);
  const hasResumedRef = useRef(false);
  const resumeCompletedRef = useRef(false);
  
  // User preferences
  const [userPreferencesData, setUserPreferencesData] = useState<{
    hasPlanProgress?: boolean;
    isRetakingQuiz?: boolean;
    fullRetakeFromHome?: boolean;
    paymentRetakingCompleted?: boolean;
    paymentFullRetakeCompleted?: boolean;
  } | null>(null);
  
  // Start over состояния
  const [isStartingOver, setIsStartingOver] = useState(false);
  const isStartingOverRef = useRef(false);
  const [daysSincePlanGeneration, setDaysSincePlanGeneration] = useState<number | null>(null);
  const [isProgressCleared, setIsProgressCleared] = useState(false);
  
  // РЕФАКТОРИНГ: Debug и Auto submit состояния теперь в useQuizUI
  
  // Refs для синхронизации
  const initCalledRef = useRef(false);
  const questionnaireRef = useRef<Questionnaire | null>(null);
  const isMountedRef = useRef(true);
  const redirectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const submitAnswersRef = useRef<(() => Promise<void>) | null>(null);
  const saveProgressTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastSavedAnswerRef = useRef<{ questionId: number; answer: string | string[] } | null>(null);
  const pendingProgressRef = useRef<{ questionIndex?: number; infoScreenIndex?: number } | null>(null);
  const progressLoadedRef = useRef(false);
  const answersRef = useRef<Record<number, string | string[]>>({});
  const answersCountRef = useRef(0);
  const lastRestoredAnswersIdRef = useRef<string | null>(null);
  const loadingRefForTimeout = useRef(true);
  const loadingStartTimeRef = useRef<number | null>(null);
  const initCompletedRef = useRef(false);
  
  // Синхронизация initCompleted с ref
  useEffect(() => {
    initCompletedRef.current = initCompleted;
  }, [initCompleted]);

  useEffect(() => {
    answersRef.current = answers;
    answersCountRef.current = Object.keys(answers).length;
  }, [answers]);
  
  // Refs для синхронизации с State Machine и React Query
  const lastSyncedFromQueryIdRef = useRef<string | number | null>(null);
  const setQuestionnaireInStateMachineRef = useRef<((questionnaire: Questionnaire | null) => void) | null>(null);
  const questionnaireForCallbackRef = useRef<Questionnaire | null>(null);
  const lastSyncedQuestionnaireIdRef = useRef<string | number | null>(null);
  const lastSyncedQuestionnaireRef = useRef<Questionnaire | null>(null);
  const isSyncingRef = useRef(false);
  const lastLoadingResetIdRef = useRef<string | number | null>(null);
  const questionnaireStateRef = useRef<Questionnaire | null>(null);
  const loadingStateRef = useRef<boolean>(false);
  const stateMachineQuestionnaireRef = useRef<Questionnaire | null>(null);
  const stateMachineQuestionnaireIdRef = useRef<string | number | null>(null);

  // Refs для загрузки и прогресса
  const loadProgressInProgressRef = useRef(false);
  const progressLoadInProgressRef = useRef(false);
  const loadQuestionnaireInProgressRef = useRef(false);
  const loadQuestionnaireAttemptedRef = useRef(false);
  const redirectInProgressRef = useRef<boolean>(false);
  const profileCheckInProgressRef = useRef(false);
  const initCompletedTimeRef = useRef<number | null>(null);
  const firstScreenResetRef = useRef(false);
  
  // Синхронизация refs с state (для состояний, которые не вынесены в специализированные хуки)
  useEffect(() => {
    hasResumedRef.current = hasResumed;
  }, [hasResumed]);
  
  useEffect(() => {
    isStartingOverRef.current = isStartingOver;
  }, [isStartingOver]);
  
  useEffect(() => {
    loadingRefForTimeout.current = loading;
    if (loading && loadingStartTimeRef.current === null) {
      loadingStartTimeRef.current = Date.now();
    } else if (!loading) {
      loadingStartTimeRef.current = null;
    }
  }, [loading]);
  
  useEffect(() => {
    questionnaireStateRef.current = questionnaire;
  }, [questionnaire]);
  
  useEffect(() => {
    loadingStateRef.current = loading;
  }, [loading]);
  
  useEffect(() => {
    questionnaireForCallbackRef.current = questionnaire;
  }, [questionnaire]);
  
  // Cleanup при размонтировании
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      if (saveProgressTimeoutRef.current) {
        clearTimeout(saveProgressTimeoutRef.current);
        saveProgressTimeoutRef.current = null;
      }
      if (redirectTimeoutRef.current) {
        clearTimeout(redirectTimeoutRef.current);
        redirectTimeoutRef.current = null;
      }
    };
  }, []);
  
  return {
    // Основные состояния
    questionnaire,
    setQuestionnaire,
    loading,
    setLoading,
    error,
    setError,
    
    // Навигация (из useQuizNavigation)
    currentQuestionIndex: navigation.currentQuestionIndex,
    setCurrentQuestionIndex: navigation.setCurrentQuestionIndex,
    currentQuestionIndexRef: navigation.currentQuestionIndexRef,
    currentInfoScreenIndex: navigation.currentInfoScreenIndex,
    setCurrentInfoScreenIndex: navigation.setCurrentInfoScreenIndex,
    currentInfoScreenIndexRef: navigation.currentInfoScreenIndexRef,
    
    // Ответы
    answers,
    setAnswers,
    
    // UI состояния (из useQuizUI)
    showResumeScreen: ui.showResumeScreen,
    setShowResumeScreen: ui.setShowResumeScreen,
    isSubmitting: ui.isSubmitting,
    setIsSubmitting: ui.setIsSubmitting,
    isSubmittingRef: ui.isSubmittingRef,
    finalizing: ui.finalizing,
    setFinalizing: ui.setFinalizing,
    finalizingStep: ui.finalizingStep,
    setFinalizingStep: ui.setFinalizingStep,
    finalizeError: ui.finalizeError,
    setFinalizeError: ui.setFinalizeError,
    pendingInfoScreen: ui.pendingInfoScreen,
    pendingInfoScreenRef: ui.pendingInfoScreenRef,
    setPendingInfoScreen: ui.setPendingInfoScreen,
    
    // Debug состояния (из useQuizUI)
    debugLogs: ui.debugLogs,
    setDebugLogs: ui.setDebugLogs,
    showDebugPanel: ui.showDebugPanel,
    setShowDebugPanel: ui.setShowDebugPanel,
    
    // Auto submit (из useQuizUI)
    autoSubmitTriggered: ui.autoSubmitTriggered,
    setAutoSubmitTriggered: ui.setAutoSubmitTriggered,
    autoSubmitTriggeredRef: ui.autoSubmitTriggeredRef,
    
    // Прогресс
    savedProgress,
    setSavedProgress,
    
    // Retake состояния
    isRetakingQuiz,
    setIsRetakingQuiz,
    showRetakeScreen,
    setShowRetakeScreen,
    hasRetakingPayment,
    setHasRetakingPayment,
    hasFullRetakePayment,
    setHasFullRetakePayment,
    
    // Resume состояния
    hasResumed,
    setHasResumed,
    hasResumedRef,
    resumeCompletedRef,
    
    // User preferences
    userPreferencesData,
    setUserPreferencesData,
    
    // Start over состояния
    isStartingOver,
    setIsStartingOver,
    isStartingOverRef,
    daysSincePlanGeneration,
    setDaysSincePlanGeneration,
    
    // Refs для синхронизации
    initCalledRef,
    questionnaireRef,
    isMountedRef,
    redirectTimeoutRef,
    submitAnswersRef,
    saveProgressTimeoutRef,
    lastSavedAnswerRef,
    pendingProgressRef,
    progressLoadedRef,
    answersRef,
    answersCountRef,
    lastRestoredAnswersIdRef,
    loadingRefForTimeout,
    loadingStartTimeRef,
    initCompletedRef,
    initCompleted,
    setInitCompleted,
    isProgressCleared,
    setIsProgressCleared,
    
    // Refs для синхронизации с State Machine и React Query
    lastSyncedFromQueryIdRef,
    setQuestionnaireInStateMachineRef,
    questionnaireForCallbackRef,
    lastSyncedQuestionnaireIdRef,
    lastSyncedQuestionnaireRef,
    isSyncingRef,
    lastLoadingResetIdRef,
    questionnaireStateRef,
    loadingStateRef,
    stateMachineQuestionnaireRef,
    stateMachineQuestionnaireIdRef,

    // Refs для загрузки и прогресса
    loadProgressInProgressRef,
    progressLoadInProgressRef,
    loadQuestionnaireInProgressRef,
    loadQuestionnaireAttemptedRef,
    redirectInProgressRef,
    profileCheckInProgressRef,
    initCompletedTimeRef,
    firstScreenResetRef,
  };
}
