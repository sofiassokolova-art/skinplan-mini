// lib/quiz/handlers/loadSavedProgress.ts
// РЕФАКТОРИНГ: Вынесена функция loadSavedProgressFromServer из quiz/page.tsx

import { api } from '@/lib/api';
import { clientLogger } from '@/lib/client-logger';
import { QUIZ_CONFIG } from '@/lib/quiz/config/quizConfig';
import { getInitialInfoScreens } from '@/app/(miniapp)/quiz/info-screens';
import type { Questionnaire } from '@/lib/quiz/types';

export interface LoadSavedProgressParams {
  // Refs
  currentInfoScreenIndexRef: React.MutableRefObject<number>;
  currentQuestionIndexRef: React.MutableRefObject<number>;
  hasResumedRef: React.MutableRefObject<boolean>;
  isStartingOverRef: React.MutableRefObject<boolean>;
  progressLoadedRef: React.MutableRefObject<boolean>;
  loadProgressInProgressRef: React.MutableRefObject<boolean>;
  progressLoadInProgressRef: React.MutableRefObject<boolean>;
  
  // State
  currentInfoScreenIndex: number;
  currentQuestionIndex: number;
  hasResumed: boolean;
  isStartingOver: boolean;
  allQuestions: any[];
  
  // State setters
  setCurrentInfoScreenIndex: React.Dispatch<React.SetStateAction<number>>;
  setCurrentQuestionIndex: React.Dispatch<React.SetStateAction<number>>;
  setSavedProgress: React.Dispatch<React.SetStateAction<{
    answers: Record<number, string | string[]>;
    questionIndex: number;
    infoScreenIndex: number;
  } | null>>;
  setShowResumeScreen: React.Dispatch<React.SetStateAction<boolean>>;
  setLoading: React.Dispatch<React.SetStateAction<boolean>>;
  
  // React Query
  quizProgressFromQuery: any;
  isLoadingProgress: boolean;
}

/**
 * Загружает сохраненный прогресс анкеты с сервера
 * Показывает экран "Продолжить анкету" если найден прогресс
 */
export async function loadSavedProgressFromServer({
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
}: LoadSavedProgressParams): Promise<void> {
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
    });
    return;
  }
  
  // ИСПРАВЛЕНО: Логируем вызов для отладки в Telegram Mini App
  clientLogger.log('🔄 loadSavedProgressFromServer: вызов', {
    loadProgressInProgress: loadProgressInProgressRef.current,
    progressLoadInProgress: progressLoadInProgressRef.current,
    hasResumedRef: hasResumedRef.current,
    hasResumed,
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
      progressLoadedRef.current = true;
    } else {
      clientLogger.log('ℹ️ Прогресс на сервере не найден или пуст');
      // ИСПРАВЛЕНО: Прогресс хранится в БД, localStorage больше не используется
      setSavedProgress(null);
      setShowResumeScreen(false);
      progressLoadedRef.current = true;
      
      // КРИТИЧНО: Если прогресса на сервере нет, очищаем sessionStorage
      // Это гарантирует, что пользователь увидит начальные инфо-экраны
      // даже если в sessionStorage сохранены старые индексы от предыдущего прохождения
      if (typeof window !== 'undefined') {
        try {
          sessionStorage.removeItem('quiz_currentInfoScreenIndex');
          sessionStorage.removeItem('quiz_currentQuestionIndex');
          sessionStorage.removeItem('quiz_answers_backup');
          clientLogger.log('🧹 SessionStorage очищен (прогресс на сервере не найден)');
          
          // ФИКС: Сбрасываем currentInfoScreenIndex на 0, чтобы показать все начальные инфо-экраны
          if (setCurrentInfoScreenIndex) {
            setCurrentInfoScreenIndex(0);
          }
          if (currentInfoScreenIndexRef) {
            currentInfoScreenIndexRef.current = 0;
          }
        } catch (storageErr) {
          clientLogger.warn('⚠️ Не удалось очистить sessionStorage:', storageErr);
        }
      }
    }
  } catch (err: any) {
    // Если ошибка 401 - это нормально, просто не используем серверный прогресс
    if (err?.message?.includes('401') || err?.message?.includes('Unauthorized')) {
      // Не логируем 401 ошибки, так как это нормально, если пользователь не авторизован
      // ИСПРАВЛЕНО: Прогресс хранится в БД, localStorage больше не используется
      setSavedProgress(null);
      setShowResumeScreen(false);
      progressLoadedRef.current = true;
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
      if (currentInfoScreenIndex >= initialInfoScreens.length && allQuestions.length > 0) {
        // Уже на вопросах - ничего не делаем
      } else if (currentInfoScreenIndex < initialInfoScreens.length && allQuestions.length > 0) {
        // Начальные экраны еще не пройдены - пропускаем их и переходим к вопросам
        // НЕ сбрасываем на 0, чтобы не вызвать редирект на первый экран
        setCurrentInfoScreenIndex(initialInfoScreens.length);
        setCurrentQuestionIndex(0);
      }
      progressLoadedRef.current = true;
      return;
    }
      
    clientLogger.warn('Ошибка загрузки прогресса с сервера:', err);
    // ИСПРАВЛЕНО: Прогресс хранится в БД, localStorage больше не используется
    setSavedProgress(null);
    setShowResumeScreen(false);
    progressLoadedRef.current = true;
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
}


