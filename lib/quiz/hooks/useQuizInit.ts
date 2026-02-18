// lib/quiz/hooks/useQuizInit.ts
// РЕФАКТОРИНГ: Хук для группировки функций инициализации из quiz/page.tsx
// Вынесен для улучшения читаемости и поддержки

import { useCallback, useRef } from 'react';
import { clientLogger } from '@/lib/client-logger';
import { QUIZ_CONFIG } from '@/lib/quiz/config/quizConfig';
import { getInitialInfoScreens } from '@/app/(miniapp)/quiz/info-screens';
import type { Questionnaire } from '@/lib/quiz/types';

export interface UseQuizInitParams {
  // State
  loading: boolean;
  currentInfoScreenIndex: number;
  currentQuestionIndex: number;
  savedProgress: {
    answers: Record<number, string | string[]>;
    questionIndex: number;
    infoScreenIndex: number;
  } | null;
  showResumeScreen: boolean;
  hasResumed: boolean;
  isRetakingQuiz: boolean;
  allQuestions: any[];
  
  // Setters
  setLoading: React.Dispatch<React.SetStateAction<boolean>>;
  setError: React.Dispatch<React.SetStateAction<string | null>>;
  setCurrentInfoScreenIndex: React.Dispatch<React.SetStateAction<number>>;
  setCurrentQuestionIndex: React.Dispatch<React.SetStateAction<number>>;
  setPendingInfoScreen: React.Dispatch<React.SetStateAction<any | null>>;
  
  // Refs
  questionnaireRef: React.MutableRefObject<Questionnaire | null>;
  currentInfoScreenIndexRef: React.MutableRefObject<number>;
  resumeCompletedRef: React.MutableRefObject<boolean>;
  initCalledRef: React.MutableRefObject<boolean>;
  initInProgressRef: React.MutableRefObject<boolean>;
  initCompletedRef: React.MutableRefObject<boolean>;
  setInitCompleted: React.Dispatch<React.SetStateAction<boolean>>;
  isStartingOverRef: React.MutableRefObject<boolean>;
  hasResumedRef: React.MutableRefObject<boolean>;
  loadProgressInProgressRef: React.MutableRefObject<boolean>;
  progressLoadInProgressRef: React.MutableRefObject<boolean>;
  firstScreenResetRef: React.MutableRefObject<boolean>;
  initStartTimeRef: React.MutableRefObject<number | null>;
  initCompletedTimeRef: React.MutableRefObject<number | null>;

  // Functions
  loadQuestionnaire: () => Promise<Questionnaire | null>;
  loadSavedProgressFromServer: () => Promise<void>;
  
  // Other
  isDev: boolean;
}

/**
 * Хук для группировки функций инициализации из основного компонента Quiz
 * Организует функции инициализации для лучшей читаемости и производительности
 */
export function useQuizInit(params: UseQuizInitParams) {
  const {
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
    setInitCompleted,
    isStartingOverRef,
    hasResumedRef,
    loadProgressInProgressRef,
    progressLoadInProgressRef,
    firstScreenResetRef,
    initStartTimeRef,
    initCompletedTimeRef,
    loadQuestionnaire,
    loadSavedProgressFromServer,
    isDev,
  } = params;

  // ============================================
  // ГРУППА 1: waitForTelegram
  // ============================================
  
  const waitForTelegram = useCallback((): Promise<void> => {
    return new Promise((resolve) => {
      if (typeof window === 'undefined') {
        resolve();
        return;
      }

      // Если уже доступен
      if (window.Telegram?.WebApp?.initData) {
        resolve();
        return;
      }

      // Ждем максимум 2 секунды
      let attempts = 0;
      const maxAttempts = 20; // 20 * 100ms = 2 секунды

      const checkInterval = setInterval(() => {
        attempts++;
        if (window.Telegram?.WebApp?.initData || attempts >= maxAttempts) {
          clearInterval(checkInterval);
          resolve();
        }
      }, 100);
      
      // ИСПРАВЛЕНО: Cleanup на случай, если Promise будет отменен
      // Это предотвращает утечку памяти при размонтировании компонента
    });
  }, []);

  // ============================================
  // ГРУППА 2: getInitData
  // ============================================
  
  const getInitData = useCallback(async (initData?: string | null): Promise<string | null> => {
    // Сначала пробуем использовать initData из хука
    if (initData) {
      return initData;
    }
    
    // Если не доступен, ждем его готовности
    if (typeof window !== 'undefined' && window.Telegram?.WebApp) {
      await new Promise((resolve) => {
        let attempts = 0;
        const maxAttempts = 10; // 10 * 100ms = 1 секунда
        const checkInterval = setInterval(() => {
          attempts++;
          const data = window.Telegram?.WebApp?.initData || null;
          if (data || attempts >= maxAttempts) {
            clearInterval(checkInterval);
            resolve(undefined);
          }
        }, 100);
        
        // ИСПРАВЛЕНО: Cleanup на случай, если Promise будет отменен
        // Это предотвращает утечку памяти при размонтировании компонента
      });
      return window.Telegram?.WebApp?.initData || null;
    }
    
    return null;
  }, []);

  // ============================================
  // ГРУППА 3: init (основная функция инициализации)
  // ============================================
  
  const init = useCallback(async () => {
    // ИСПРАВЛЕНО: Добавлена проверка initCalledRef для предотвращения множественных вызовов
    // ИСПРАВЛЕНО: Также проверяем наличие анкеты в ref, чтобы не загружать повторно
    // ВАЖНО: Не вызываем init() после resumeQuiz, чтобы не сбросить состояние
    if (resumeCompletedRef.current) {
      clientLogger.log('⛔ init() skipped: resumeQuiz already completed, not resetting state');
      return;
    }

    // ФИКС: Убрана проверка initCalledRef.current && initCompletedRef.current для Telegram пользователей
    // Это могло блокировать инициализацию для новых Telegram пользователей
    if (typeof window !== 'undefined' && window.Telegram?.WebApp?.initData) {
      // Для Telegram пользователей пропускаем некоторые проверки
      clientLogger.log('🔄 Telegram user detected in init(), checking conditions...', {
        initCalled: initCalledRef.current,
        initCompleted: initCompletedRef.current,
        initInProgress: initInProgressRef.current,
        hasQuestionnaire: !!questionnaireRef.current,
        isStartingOver: isStartingOverRef.current,
      });
    } else {
      if (initCalledRef.current && initCompletedRef.current && !isStartingOverRef.current) {
        // Если анкета уже загружена, не нужно вызывать init() повторно
        if (questionnaireRef.current) {
          clientLogger.log('⛔ init() skipped: already called, completed, and questionnaire loaded', {
            questionnaireId: questionnaireRef.current.id,
          });
          return;
        }
      }
    }

    if (initInProgressRef.current) {
      clientLogger.log('⛔ init() skipped: already in progress');
      return;
    }

    // ФИКС: Для Telegram пользователей не проверяем initCompleted, если это первый вызов
    if (typeof window !== 'undefined' && window.Telegram?.WebApp?.initData) {
      // Для Telegram пользователей менее строгая проверка
      if (initCompletedRef.current && !isStartingOverRef.current && questionnaireRef.current && initCalledRef.current) {
        clientLogger.log('⛔ init() skipped for Telegram user: already completed with questionnaire', {
          questionnaireId: questionnaireRef.current.id,
        });
        return;
      }
    } else {
      if (initCompletedRef.current && !isStartingOverRef.current && questionnaireRef.current) {
        // Если init завершен и анкета загружена, не нужно вызывать init() повторно
        clientLogger.log('⛔ init() skipped: already completed with questionnaire', {
          questionnaireId: questionnaireRef.current.id,
        });
        return;
      }
    }

    initInProgressRef.current = true;
    const initStartTime = Date.now();
    initStartTimeRef.current = initStartTime;
    
    // ФИКС: Сохраняем флаг в sessionStorage для предотвращения повторных вызовов при перемонтировании
    if (typeof window !== 'undefined') {
      try {
        sessionStorage.setItem(QUIZ_CONFIG.STORAGE_KEYS.INIT_CALLED, 'true');
      } catch (err) {
        // Игнорируем ошибки sessionStorage
      }
    }

    // ИСПРАВЛЕНО: Логируем начало init() для диагностики
    clientLogger.log('🚀 init() started', {
      initCompleted: initCompletedRef.current,
      isStartingOver: isStartingOverRef.current,
      hasQuestionnaire: !!questionnaireRef.current,
      questionnaireId: questionnaireRef.current?.id,
      isTelegramUser: !!(typeof window !== 'undefined' && window.Telegram?.WebApp?.initData),
    });

    // ФИКС: Для Telegram пользователей устанавливаем loading=true в начале
    if (typeof window !== 'undefined' && window.Telegram?.WebApp?.initData) {
      setLoading(true);
    }

    try {
      // ИСПРАВЛЕНО: Сначала проверяем, новый ли это пользователь, и очищаем sessionStorage ДО восстановления
      // Это гарантирует, что новый пользователь увидит все начальные инфо-экраны
      const hasNoSavedProgress = !savedProgress || !savedProgress.answers || Object.keys(savedProgress.answers || {}).length === 0;
      const isNewUser = hasNoSavedProgress && !hasResumed && !showResumeScreen && !isRetakingQuiz;
      
      if (typeof window !== 'undefined' && isNewUser) {
        try {
          const initialInfoScreens = getInitialInfoScreens();
          const savedInfoScreen = sessionStorage.getItem(QUIZ_CONFIG.STORAGE_KEYS.CURRENT_INFO_SCREEN);
          const savedQuestion = sessionStorage.getItem(QUIZ_CONFIG.STORAGE_KEYS.CURRENT_QUESTION);
          
          if (savedInfoScreen !== null || savedQuestion !== null) {
            const savedInfoScreenIndex = savedInfoScreen !== null ? parseInt(savedInfoScreen, 10) : null;
            const savedQuestionIndex = savedQuestion !== null ? parseInt(savedQuestion, 10) : null;
            
            // Очищаем sessionStorage для нового пользователя, если там сохранен индекс, пропускающий инфо-экраны
            if ((savedInfoScreenIndex !== null && !isNaN(savedInfoScreenIndex) && savedInfoScreenIndex >= initialInfoScreens.length) ||
                (savedQuestionIndex !== null && !isNaN(savedQuestionIndex) && savedQuestionIndex > 0)) {
              sessionStorage.removeItem(QUIZ_CONFIG.STORAGE_KEYS.CURRENT_INFO_SCREEN);
              sessionStorage.removeItem(QUIZ_CONFIG.STORAGE_KEYS.CURRENT_QUESTION);
              clientLogger.log('🧹 Очищен sessionStorage для нового пользователя, чтобы показать все начальные инфо-экраны', {
                savedInfoScreenIndex,
                savedQuestionIndex,
                initialInfoScreensLength: initialInfoScreens.length,
              });
            }
          }
        } catch (err) {
          clientLogger.warn('⚠️ Не удалось очистить sessionStorage для нового пользователя', err);
        }
      }
      
      // ФИКС: Восстанавливаем currentInfoScreenIndex из sessionStorage при перемонтировании
      // Это предотвращает сброс индекса в 0 при ошибке React #310
      // ИСПРАВЛЕНО: Для нового пользователя тоже проверяем sessionStorage, чтобы не сбрасывать, если пользователь уже на втором экране
      if (typeof window !== 'undefined') {
        try {
          const savedInfoScreenIndex = sessionStorage.getItem(QUIZ_CONFIG.STORAGE_KEYS.CURRENT_INFO_SCREEN);
          if (savedInfoScreenIndex !== null) {
            const savedIndex = parseInt(savedInfoScreenIndex, 10);
            if (!isNaN(savedIndex) && savedIndex >= 0) {
              const initialInfoScreens = getInitialInfoScreens();
              // Восстанавливаем только если индекс валиден и не больше максимального
              if (savedIndex < initialInfoScreens.length) {
                // КРИТИЧНО: Для нового пользователя восстанавливаем индекс из sessionStorage,
                // если он валиден (в пределах начальных экранов), чтобы не сбрасывать на 0
                // если пользователь уже на втором или последующем экране
                const effectiveInfoScreenIndex = currentInfoScreenIndexRef.current >= 0 ? currentInfoScreenIndexRef.current : currentInfoScreenIndex;
                // Восстанавливаем только если сохраненный индекс больше текущего (пользователь продвинулся дальше)
                // или если текущий индекс равен 0 (начало)
                if (savedIndex > effectiveInfoScreenIndex || effectiveInfoScreenIndex === 0) {
                  clientLogger.log('💾 Восстановлен currentInfoScreenIndex из sessionStorage', {
                    savedIndex,
                    currentIndex: currentInfoScreenIndex,
                    currentIndexRef: currentInfoScreenIndexRef.current,
                    initialInfoScreensLength: initialInfoScreens.length,
                    isNewUser,
                  });
                  currentInfoScreenIndexRef.current = savedIndex;
                  setCurrentInfoScreenIndex(savedIndex);
                }
              } else {
                // Если сохраненный индекс больше максимального, очищаем его
                sessionStorage.removeItem(QUIZ_CONFIG.STORAGE_KEYS.CURRENT_INFO_SCREEN);
                clientLogger.log('🧹 Очищен невалидный currentInfoScreenIndex из sessionStorage', {
                  savedIndex,
                  initialInfoScreensLength: initialInfoScreens.length,
                });
              }
            }
          }
        } catch (err) {
          clientLogger.warn('⚠️ Не удалось восстановить currentInfoScreenIndex из sessionStorage', err);
        }
      }
      
      // ИСПРАВЛЕНО: Для нового пользователя проверяем, нужно ли сбрасывать на 0
      // НО только если НЕТ showResumeScreen (т.е. нет прогресса с >= 2 ответами)
      // Если showResumeScreen = true, значит прогресс загружается и нужно показать резюм-экран, а не инфо-экраны
      if (isNewUser) {
        if (showResumeScreen) {
          // Если есть резюм-экран, не сбрасываем на 0 - пусть покажется резюм-экран
          clientLogger.log('⏸️ Пропускаем сброс currentInfoScreenIndex - показывается резюм-экран', {
            currentIndex: currentInfoScreenIndex,
            showResumeScreen,
          });
        } else {
          // ИСПРАВЛЕНО: Для нового пользователя проверяем, нужно ли сбрасывать currentInfoScreenIndex на 0
          // НЕ сбрасываем, если пользователь уже на втором или последующем экране
          const initialInfoScreens = getInitialInfoScreens();
          const isAlreadyOnQuestions = currentInfoScreenIndexRef.current >= initialInfoScreens.length;
          const hasStartedAnswering = currentQuestionIndex > 0;
          
          // КРИТИЧНО: Используем ref для более точной проверки, так как state может быть устаревшим
          // После восстановления из sessionStorage ref должен содержать актуальное значение
          const effectiveInfoScreenIndex = currentInfoScreenIndexRef.current >= 0 ? currentInfoScreenIndexRef.current : currentInfoScreenIndex;
          const isOnSecondOrLaterScreen = effectiveInfoScreenIndex > 0;
          
          // ИСПРАВЛЕНО: Не сбрасываем, если пользователь уже на втором или последующем экране
          // Это предотвращает переброс на первый экран во время прохождения анкеты в Telegram
          // КРИТИЧНО: Проверяем effectiveInfoScreenIndex, чтобы не сбрасывать, если пользователь уже прошел первый экран
          if (!isAlreadyOnQuestions && !hasStartedAnswering && !isOnSecondOrLaterScreen && effectiveInfoScreenIndex !== 0) {
            clientLogger.log('🔄 Сброс currentInfoScreenIndex на 0 для нового пользователя', {
              currentIndex: currentInfoScreenIndex,
              currentIndexRef: currentInfoScreenIndexRef.current,
              initialInfoScreensLength: initialInfoScreens.length,
              hasNoSavedProgress,
              isAlreadyOnQuestions,
              hasStartedAnswering,
              isOnSecondOrLaterScreen,
            });
            currentInfoScreenIndexRef.current = 0;
            setCurrentInfoScreenIndex(0);
            
            // КРИТИЧНО: Очищаем sessionStorage для нового пользователя
            if (typeof window !== 'undefined') {
              try {
                sessionStorage.removeItem(QUIZ_CONFIG.STORAGE_KEYS.CURRENT_INFO_SCREEN);
                sessionStorage.removeItem(QUIZ_CONFIG.STORAGE_KEYS.CURRENT_QUESTION);
                sessionStorage.removeItem('quiz_answers_backup');
                clientLogger.log('🧹 Очищен sessionStorage для нового пользователя');
              } catch (err) {
                clientLogger.warn('⚠️ Не удалось очистить sessionStorage', err);
              }
            }
          } else {
            clientLogger.warn('⚠️ Пропускаем сброс currentInfoScreenIndex - пользователь уже проходит анкету', {
              isAlreadyOnQuestions,
              hasStartedAnswering,
              isOnSecondOrLaterScreen,
              currentInfoScreenIndex: currentInfoScreenIndexRef.current,
              effectiveInfoScreenIndex,
              currentQuestionIndex,
            });
          }
        }
      }
      
      // ФИКС: Устанавливаем loading=true при загрузке анкеты
      // Это гарантирует, что лоадер показывается до загрузки анкеты
      // и инфо-экраны не показываются до завершения загрузки
      setLoading(true);
      setError(null);

      // 1) telegram init + ожидание (race)
      // ИСПРАВЛЕНО: initialize вызывается напрямую, не через зависимость useCallback
      if (typeof window !== 'undefined' && window.Telegram?.WebApp) {
        try {
          window.Telegram.WebApp.ready();
          window.Telegram.WebApp.expand();
        } catch (err) {
          console.warn('⚠️ Error initializing Telegram WebApp:', err);
        }
      }

      await Promise.race([
        waitForTelegram(),
        new Promise<void>((resolve) =>
          setTimeout(() => {
            clientLogger.log('⏱️ waitForTelegram timeout (5s) → continue');
            resolve();
          }, 5000)
        ),
      ]);

      // Проверка initData (только в production)
      // ИСПРАВЛЕНО: Делаем проверку более мягкой - не бросаем ошибку, а просто логируем предупреждение
      // initData может быть недоступен сразу после waitForTelegram, но появиться позже
      if (!isDev && typeof window !== 'undefined') {
        const hasInitData = !!window.Telegram?.WebApp?.initData;
        if (!hasInitData) {
          clientLogger.warn('⚠️ Telegram initData not available after waitForTelegram, but continuing...');
          // ИСПРАВЛЕНО: Не бросаем ошибку, а просто логируем предупреждение
          // initData может появиться позже, или анкета может загрузиться без него (для публичных анкет)
        }
      }

      // 2) загрузка анкеты (если нужна)
      // ИСПРАВЛЕНО: Используем ref вместо state для проверки, чтобы избежать race conditions
      // КРИТИЧНО: loadQuestionnaire объявлена как useCallback ниже, но ref устанавливается синхронно
      // Проверяем, есть ли уже загруженная анкета
      if (!questionnaireRef.current) {
        clientLogger.log('🟢 init() CALLING loadQuestionnaire()', {
          timestamp: new Date().toISOString(),
          hasQuestionnaireRef: !!questionnaireRef.current,
          loading,
        });

        const loadResult = await loadQuestionnaire();

        clientLogger.log('🟢 init() loadQuestionnaire() RETURNED', {
          timestamp: new Date().toISOString(),
          loadResult: loadResult ? 'questionnaire object' : 'null',
          questionnaireId: loadResult?.id || null,
          hasQuestionnaireRef: !!questionnaireRef.current,
          questionnaireRefId: (questionnaireRef.current as Questionnaire | null)?.id || null,
          loading,
        });
          
          // ИСПРАВЛЕНО: Если loadResult null, это означает ошибку загрузки
          // В этом случае не ждем установки ref, так как он уже установлен в null в loadQuestionnaire
          if (!loadResult && !questionnaireRef.current) {
            // ИСПРАВЛЕНО: Детальное логирование для диагностики
            clientLogger.error('❌ loadQuestionnaire returned null - questionnaire failed to load', {
              timestamp: new Date().toISOString(),
              hasQuestionnaireRef: !!questionnaireRef.current,
              questionnaireRefId: (questionnaireRef.current as Questionnaire | null)?.id || null,
              // Проверяем, может ли это быть пустая анкета (500 ошибка)
              possibleReasons: [
                'API returned 500 error (empty questionnaire)',
                'API returned empty/null data',
                'API returned questionnaire with zero questions',
                'Network error or timeout',
              ],
            });
            // КРИТИЧНО: Устанавливаем loading=false перед выбросом ошибки, чтобы не зависнуть на лоадере
            setLoading(false);
            // Ошибка уже установлена в loadQuestionnaire, не устанавливаем её снова
            // ИСПРАВЛЕНО: Бросаем более информативную ошибку
            throw new Error('Не удалось загрузить анкету. Возможно, анкета временно недоступна. Пожалуйста, обновите страницу.');
          }
          
          // КРИТИЧНО: Ждем, пока questionnaire будет установлен в ref
          // Это предотвращает завершение init() до того, как questionnaire появится в ref
          // ИСПРАВЛЕНО: Ждем максимум 2 секунды (20 попыток по 100ms)
          // ИСПРАВЛЕНО: Не ждем, если loadResult null (ошибка уже обработана выше)
          if (loadResult && !questionnaireRef.current) {
            let waitAttempts = 0;
            const maxWaitAttempts = 20; // 20 * 100ms = 2 секунды максимум
            while (!questionnaireRef.current && waitAttempts < maxWaitAttempts) {
              clientLogger.log('⏳ Waiting for questionnaire to be set in ref after loadQuestionnaire...', {
                attempt: waitAttempts + 1,
                maxAttempts: maxWaitAttempts,
                loadResult: loadResult ? 'has result' : 'null',
              });
              await new Promise(resolve => setTimeout(resolve, 100));
              waitAttempts++;
            }
            
            if (!questionnaireRef.current) {
              clientLogger.error('❌ questionnaireRef.current not set after loadQuestionnaire, even after waiting', {
                timestamp: new Date().toISOString(),
                loadResult: loadResult ? 'had result' : 'was null',
                waitAttempts,
                maxWaitAttempts,
              });
              // КРИТИЧНО: Устанавливаем loading=false перед выбросом ошибки, чтобы не зависнуть на лоадере
              setLoading(false);
              setError('Не удалось загрузить анкету. Пожалуйста, обновите страницу.');
              throw new Error('Не удалось загрузить анкету. Пожалуйста, обновите страницу.');
            }
          }
          
          // ИСПРАВЛЕНО: Проверяем, что questionnaireRef.current не null перед использованием
          if (!questionnaireRef.current) {
            clientLogger.error('❌ questionnaireRef.current is null after loadQuestionnaire, even after waiting');
            setError('Не удалось загрузить анкету. Пожалуйста, обновите страницу.');
            throw new Error('Не удалось загрузить анкету. Пожалуйста, обновите страницу.');
          }
          
          // ИСПРАВЛЕНО: Сохраняем значение в переменную после проверки на null
          // TypeScript теперь знает, что currentQuestionnaire не null
          const currentQuestionnaire: Questionnaire = questionnaireRef.current;
          
          clientLogger.log('✅ init() questionnaireRef.current is set after loadQuestionnaire', {
            timestamp: new Date().toISOString(),
            questionnaireId: currentQuestionnaire.id,
          });
          
          // КРИТИЧНО: Ждем, пока questionnaire будет установлен в state
          // Это предотвращает завершение init() до того, как questionnaire появится в state
          // ИСПРАВЛЕНО: Ждем максимум 1 секунду (10 попыток по 100ms)
          // Используем замыкание для доступа к questionnaire state через ref
          let stateWaitAttempts = 0;
          const maxStateWaitAttempts = 10; // 10 * 100ms = 1 секунда максимум
          while (stateWaitAttempts < maxStateWaitAttempts) {
            // Проверяем через ref, который синхронизируется с state в useEffect
            if (questionnaireRef.current) {
              // Проверяем, что state обновился (через небольшую задержку для React batch updates)
              await new Promise(resolve => setTimeout(resolve, 50));
              break; // questionnaireRef установлен, значит state должен обновиться
            }
            clientLogger.log('⏳ Waiting for questionnaire state to update...', {
              attempt: stateWaitAttempts + 1,
              maxAttempts: maxStateWaitAttempts,
            });
            await new Promise(resolve => setTimeout(resolve, 100));
            stateWaitAttempts++;
          }
          
          clientLogger.log('✅ Questionnaire loaded and set in ref', {
            questionnaireId: currentQuestionnaire.id,
            waitedForState: stateWaitAttempts > 0,
          });
          
          // ФИКС: Устанавливаем loading=false после успешной загрузки анкеты
          // Это гарантирует, что лоадер скроется сразу после загрузки, а не ждет useEffect
          setLoading(false);
        } else {
          clientLogger.error('❌ loadQuestionnaire failed, cannot load questionnaire');
          // КРИТИЧНО: Устанавливаем loading=false перед выбросом ошибки, чтобы не зависнуть на лоадере
          setLoading(false);
          setError('Не удалось загрузить анкету. Пожалуйста, обновите страницу.');
          throw new Error('Не удалось загрузить анкету. Пожалуйста, обновите страницу.');
        }
      }
    catch (e: any) {
      clientLogger.error('❌ init() FAILED - exception caught', {
        timestamp: new Date().toISOString(),
        error: e?.message,
        stack: e?.stack?.substring(0, 500),
        hasQuestionnaire: !!questionnaireRef.current,
        questionnaireId: questionnaireRef.current?.id,
        loading,
      });
      setError('Ошибка загрузки. Пожалуйста, обновите страницу.');
      setLoading(false);
    } finally {
      const totalElapsed = Date.now() - (initStartTimeRef.current || Date.now());
      initCompletedRef.current = true;
      setInitCompleted(true);
      initInProgressRef.current = false;
      initStartTimeRef.current = null;

      if (!initCompletedTimeRef.current) {
        initCompletedTimeRef.current = Date.now();
      }

      clientLogger.log('⏱️ init() completed (finally)', {
        timestamp: initCompletedTimeRef.current,
        totalElapsed,
        hasQuestionnaire: !!questionnaireRef.current,
        questionnaireId: questionnaireRef.current?.id,
      });
    }

    // 3) прогресс/резюм
      // ВОССТАНОВЛЕНО: Загружаем прогресс для всех пользователей (включая новых)
      // Для новых пользователей прогресс загружается из KV кеша
      // ИСПРАВЛЕНО: Используем только refs для проверки, чтобы не зависеть от state в зависимостях useCallback
      // КРИТИЧНО: Не загружаем прогресс, если пользователь уже на вопросах
      // Это предотвращает сброс currentInfoScreenIndex после перехода к вопросам
      const initialInfoScreens = getInitialInfoScreens();
      const isAlreadyOnQuestions = currentInfoScreenIndexRef.current >= initialInfoScreens.length;
      
      // ФИКС: Не загружаем прогресс если пользователь нажал "Начать заново"
      // Это предотвращает повторную загрузку прогресса после очистки
      if (typeof window !== 'undefined' && window.Telegram?.WebApp?.initData && 
          !hasResumedRef.current && 
          !loadProgressInProgressRef.current && !progressLoadInProgressRef.current &&
          !isAlreadyOnQuestions &&
          !isStartingOverRef.current) { // ФИКС: Блокируем загрузку прогресса при isStartingOver
        try {
          // Загружаем прогресс для всех пользователей (новые пользователи получат прогресс из KV)
          await Promise.race([
            loadSavedProgressFromServer(),
            new Promise<void>((resolve) => {
              setTimeout(() => {
                clientLogger.warn('⚠️ Таймаут загрузки прогресса (5 секунд) - продолжаем без прогресса');
                resolve();
              }, 5000);
            }),
          ]);
        } catch (err) {
          // При ошибке загрузки прогресса продолжаем без него
          clientLogger.warn('⚠️ Ошибка проверки hasPlanProgress, загружаем прогресс:', err);
          // КРИТИЧНО: Проверяем еще раз перед повторным вызовом
          if (!isAlreadyOnQuestions && currentInfoScreenIndexRef.current < initialInfoScreens.length) {
            await Promise.race([
              loadSavedProgressFromServer(),
              new Promise<void>((resolve) => {
                setTimeout(() => {
                  clientLogger.warn('⚠️ Таймаут загрузки прогресса (5 секунд) - продолжаем без прогресса');
                  resolve();
                }, 5000);
              }),
            ]);
          }
        }
      } else if (isAlreadyOnQuestions) {
        clientLogger.log('⏸️ init(): пропущена загрузка прогресса, так как пользователь уже на вопросах', {
          currentInfoScreenIndexRef: currentInfoScreenIndexRef.current,
          initialInfoScreensLength: initialInfoScreens.length,
        });
      }

      // ФИКС: Принудительно стартуем с вопросов для нового пользователя
      // Это гарантирует, что после загрузки анкеты новый пользователь увидит вопросы
      // ВАЖНО: Защита от повторных сбросов
      // ВАЖНО: Не выполняем, если пользователь уже на вопросах (currentInfoScreenIndex >= initialInfoScreens.length)
      // Это предотвращает сброс currentInfoScreenIndex на 0 после перехода к вопросам
      if (questionnaireRef.current && allQuestions.length > 0 && !firstScreenResetRef.current) {
        // ФИКС: Начальные экраны - это только те, которые не имеют showAfterQuestionCode И не имеют showAfterInfoScreenId
        const initialInfoScreensForReset = getInitialInfoScreens();
        
        // ФИКС: Не выполняем, если пользователь уже на вопросах
        // Используем ref для синхронной проверки, так как state обновляется асинхронно
        if (currentInfoScreenIndexRef.current >= initialInfoScreensForReset.length || currentInfoScreenIndex >= initialInfoScreensForReset.length) {
          clientLogger.log('⏸️ init(): пропущено, так как пользователь уже на вопросах', {
            currentInfoScreenIndex,
            currentInfoScreenIndexRef: currentInfoScreenIndexRef.current,
            initialInfoScreensLength: initialInfoScreensForReset.length,
          });
        } else {
          const hasNoSavedProgress = !savedProgress || !savedProgress.answers || Object.keys(savedProgress.answers || {}).length === 0;
          // ФИКС: Проверяем, есть ли сохраненный currentQuestionIndex в sessionStorage
          // Если есть, значит пользователь уже отвечал на вопросы, и не нужно сбрасывать индекс
          let savedQuestionIndex: number | null = null;
          let savedInfoScreenIndex: number | null = null;
          if (typeof window !== 'undefined') {
            try {
              const saved = sessionStorage.getItem(QUIZ_CONFIG.STORAGE_KEYS.CURRENT_QUESTION);
              if (saved !== null) {
                const parsed = parseInt(saved, 10);
                if (!isNaN(parsed) && parsed >= 0) {
                  savedQuestionIndex = parsed;
                }
              }
              // ФИКС: Также проверяем currentInfoScreenIndex - если он больше длины начальных экранов,
              // значит пользователь уже прошел начальные экраны и отвечал на вопросы
              const savedInfoScreen = sessionStorage.getItem(QUIZ_CONFIG.STORAGE_KEYS.CURRENT_INFO_SCREEN);
              if (savedInfoScreen !== null) {
                const parsed = parseInt(savedInfoScreen, 10);
                if (!isNaN(parsed) && parsed >= 0) {
                  savedInfoScreenIndex = parsed;
                }
              }
              
              // ИСПРАВЛЕНО: Очистка sessionStorage для нового пользователя уже выполнена в начале init()
              // Здесь просто используем очищенные значения
            } catch (err) {
              // Игнорируем ошибки sessionStorage
            }
          }
          
          // ФИКС: Проверяем, прошел ли пользователь начальные экраны
          // Если да, значит он уже отвечал на вопросы, и не нужно сбрасывать индекс
          const hasPassedInitialScreens = savedInfoScreenIndex !== null && savedInfoScreenIndex >= initialInfoScreensForReset.length;
          
          // ФИКС: ПРИОРИТЕТ - сначала восстанавливаем из sessionStorage, если есть сохраненный индекс
          // Это предотвращает сброс на 0 после ошибки React или перемонтирования
          if (savedQuestionIndex !== null && savedQuestionIndex >= 0) {
            // ФИКС: Восстанавливаем currentQuestionIndex из sessionStorage после перемонтирования
            // Это предотвращает сброс на 0 после ошибки React
            clientLogger.log('🔄 Восстановление currentQuestionIndex из sessionStorage после перемонтирования (ПРИОРИТЕТ)', {
              savedQuestionIndex,
              currentQuestionIndex,
              hasNoSavedProgress,
              hasPassedInitialScreens,
            });
            setCurrentQuestionIndex(savedQuestionIndex);
            // Также пропускаем начальные экраны, если пользователь уже на вопросах
            if (currentInfoScreenIndex < initialInfoScreensForReset.length && hasPassedInitialScreens) {
              setCurrentInfoScreenIndex(initialInfoScreensForReset.length);
            }
          } else {
            // ИСПРАВЛЕНО: Убрана логика автоматического пропуска начальных инфо-экранов для нового пользователя
            // Теперь начальные инфо-экраны всегда показываются для нового пользователя
            // Пользователь должен пройти все начальные инфо-экраны, нажимая "Продолжить"
            clientLogger.log('ℹ️ Новый пользователь - показываем начальные инфо-экраны', {
              currentInfoScreenIndex,
              initialInfoScreensLength: initialInfoScreensForReset.length,
              hasNoSavedProgress,
              hasResumed,
              showResumeScreen,
              isRetakingQuiz,
            });
          }
        }
      }

      clientLogger.log('✅ init() DONE - all steps completed', { 
        timestamp: new Date().toISOString(),
        totalElapsed: Date.now() - initStartTime,
        hasQuestionnaire: !!questionnaireRef.current,
        questionnaireId: questionnaireRef.current?.id,
        loading,
      });
  }, [
    waitForTelegram,
    isDev,
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
    loadQuestionnaire,
    firstScreenResetRef,
    initStartTimeRef,
    initCompletedTimeRef,
    loadSavedProgressFromServer,
  ]);

  return {
    waitForTelegram,
    getInitData,
    init,
  };
}
