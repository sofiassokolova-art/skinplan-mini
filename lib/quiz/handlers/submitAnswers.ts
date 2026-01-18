// lib/quiz/handlers/submitAnswers.ts
// Вынесена функция submitAnswers из quiz/page.tsx для улучшения читаемости и поддержки

import { clientLogger } from '@/lib/client-logger';
import { api } from '@/lib/api';
import { QUIZ_CONFIG } from '@/lib/quiz/config/quizConfig';
import * as userPreferences from '@/lib/user-preferences';
import type { Questionnaire } from '@/lib/quiz/types';
import React from 'react';

export interface SubmitAnswersParams {
  questionnaire: Questionnaire | null;
  answers: Record<number, string | string[]>;
  isSubmitting: boolean;
  isSubmittingRef: React.MutableRefObject<boolean>;
  isMountedRef: React.MutableRefObject<boolean>;
  isDev: boolean;
  initData: string | null;
  setAnswers: React.Dispatch<React.SetStateAction<Record<number, string | string[]>>>;
  setIsSubmitting: React.Dispatch<React.SetStateAction<boolean>>;
  setLoading: React.Dispatch<React.SetStateAction<boolean>>;
  setError: React.Dispatch<React.SetStateAction<string | null>>;
  setFinalizing: React.Dispatch<React.SetStateAction<boolean>>;
  setFinalizingStep: React.Dispatch<React.SetStateAction<'answers' | 'plan' | 'done'>>;
  setFinalizeError: React.Dispatch<React.SetStateAction<string | null>>;
  redirectInProgressRef: React.MutableRefObject<boolean>;
  submitAnswersRef: React.MutableRefObject<(() => Promise<void>) | null>;
  isRetakingQuiz: boolean;
  getInitData: () => Promise<string | null>;
}

export async function submitAnswers(params: SubmitAnswersParams): Promise<void> {
  clientLogger.log('🚀 submitAnswers вызвана');
  
  // КРИТИЧНО: Устанавливаем флаги quiz_just_submitted СРАЗУ, синхронно, ДО любых асинхронных операций
  // Это защита от редиректа на первый экран, если что-то пойдет не так
  // НУЖНО СТАВИТЬ ОБА КЛЮЧА: и обычный для RootPage, и scoped для quiz-логики
  if (typeof window !== 'undefined') {
    try {
      sessionStorage.setItem('quiz_just_submitted', 'true');
      sessionStorage.setItem(QUIZ_CONFIG.STORAGE_KEYS.JUST_SUBMITTED, 'true');
      clientLogger.log('✅ Флаги quiz_just_submitted установлены СРАЗУ при вызове submitAnswers');
    } catch (storageError) {
      clientLogger.warn('⚠️ Не удалось установить флаги quiz_just_submitted:', storageError);
    }
  }
  
  // ВАЖНО: Логируем вызов submitAnswers на сервер
  // ИСПРАВЛЕНО: Используем синхронный доступ к params.initData, чтобы не блокировать выполнение
  let currentInitData: string | null = null;
  try {
    // Сначала пробуем использовать params.initData из хука (синхронно)
    if (params.initData) {
      currentInitData = params.initData;
    } else if (typeof window !== 'undefined' && window.Telegram?.WebApp?.initData) {
      currentInitData = window.Telegram?.WebApp?.initData;
    }
    
    // ВАЖНО: Логируем на сервер асинхронно, но не блокируем выполнение
    
    // НЕ ждем завершения логирования - продолжаем выполнение
    // logPromise будет выполняться в фоне
  } catch (logError) {
    // Игнорируем ошибки логирования, чтобы не блокировать выполнение
    console.warn('⚠️ Ошибка при подготовке логирования (submitAnswers called):', logError);
  }
  
  // РЕФАКТОРИНГ: clientLogger уже отправляет логи на сервер, дублирующие fetch-вызовы удалены
  clientLogger.info('✅ submitAnswers started', {
    hasQuestionnaire: !!params.questionnaire,
    questionnaireId: params.questionnaire?.id,
    answersCount: Object.keys(params.answers).length,
  });
  
  if (!params.questionnaire) {
    clientLogger.error('❌ Анкета не загружена - блокируем отправку');
    if (params.isMountedRef.current) {
      params.setError('Анкета не загружена. Пожалуйста, обновите страницу.');
      // ИСПРАВЛЕНО: Устанавливаем state, ref синхронизируется автоматически через useEffect
      params.setIsSubmitting(false);
    }
    return;
  }

  // Защита от множественных вызовов: проверяем state (ref синхронизирован через useEffect)
  // ИСПРАВЛЕНО: Используем только state для проверки, так как ref синхронизирован автоматически
  if (params.isSubmitting) {
    // ИСПРАВЛЕНО: Если state = true, но ref = false - это рассинхронизация (редкий случай)
    // Синхронизируем ref и игнорируем повторный вызов
    if (!params.isSubmittingRef.current) {
      clientLogger.warn('⚠️ Обнаружена рассинхронизация: params.isSubmitting=true, но params.isSubmittingRef=false. Синхронизируем ref', {
        isSubmitting: params.isSubmitting,
        isSubmittingRef: params.isSubmittingRef.current,
      });
      params.isSubmittingRef.current = true;
    }
    // Оба флага true - действительно идет отправка
    clientLogger.warn('⚠️ Уже отправляется, игнорируем повторный вызов', {
      isSubmitting: params.isSubmitting,
      isSubmittingRef: params.isSubmittingRef.current,
    });
    return;
  }

  if (params.isMountedRef.current) {
    // КРИТИЧНО: Устанавливаем params.isSubmitting ПЕРВЫМ, затем loading=false в одном батче
    // Это предотвращает промежуточный рендер, где loading=true, а params.isSubmitting=false
    params.setIsSubmitting(true);
    params.setLoading(false); // ВАЖНО: Устанавливаем loading = false, чтобы не показывался лоадер "Загрузка анкеты..."
    params.setError(null);
    
    // Устанавливаем состояния для финализации с лоадером
    params.setFinalizing(true);
    params.setFinalizingStep('answers');
    params.setFinalizeError(null);
    
    clientLogger.log('✅ Флаг params.isSubmitting установлен ПЕРВЫМ, loading=false установлен сразу после');
  } else {
    clientLogger.warn('⚠️ Компонент размонтирован, но продолжаем выполнение submitAnswers');
  }

  try {
    // Проверяем, что приложение открыто через Telegram
    const initData = typeof window !== 'undefined' ? window.Telegram?.WebApp?.initData : null;
    const isInTelegram = typeof window !== 'undefined' && !!window.Telegram?.WebApp;
    
    clientLogger.log('📱 Проверка Telegram WebApp:', {
      hasWindow: typeof window !== 'undefined',
      hasTelegram: typeof window !== 'undefined' && !!window.Telegram,
      hasWebApp: isInTelegram,
      hasInitData: !!params.initData,
      initDataLength: params.initData?.length || 0,
    });
    
    // ВАЖНО: Логируем перед каждой проверкой
    clientLogger.log('🔍 Проверка условий перед отправкой ответов:', {
      hasQuestionnaire: !!params.questionnaire,
      questionnaireId: params.questionnaire?.id,
      answersCount: Object.keys(params.answers).length,
      isInTelegram,
      hasInitData: !!params.initData,
    });

    // Если мы в Telegram, но params.initData нет - это может быть preview mode
    // В development не блокируем, чтобы можно было тестировать локально без Mini App
    if (isInTelegram && !params.initData && !params.isDev) {
      clientLogger.error('❌ Telegram WebApp доступен, но initData отсутствует (возможно, preview mode)');
      if (params.isMountedRef.current) {
        params.setError('Приложение открыто в режиме предпросмотра. Пожалуйста, откройте его через кнопку бота или используйте ссылку формата: https://t.me/your_bot?startapp=...');
        // ИСПРАВЛЕНО: Устанавливаем state, ref синхронизируется автоматически через useEffect
        params.setIsSubmitting(false);
      }
      return;
    }

    if (!isInTelegram && !params.isDev) {
      clientLogger.error('❌ Telegram WebApp не доступен - блокируем отправку');
      if (params.isMountedRef.current) {
        params.setError('Пожалуйста, откройте приложение через Telegram Mini App (не просто по ссылке, а через кнопку бота).');
        // ИСПРАВЛЕНО: Устанавливаем state, ref синхронизируется автоматически через useEffect
        params.setIsSubmitting(false);
      }
      return;
    }

    if (!params.initData && !params.isDev) {
      clientLogger.error('❌ Telegram WebApp params.initData не доступен - блокируем отправку');
      if (params.isMountedRef.current) {
        params.setError('Не удалось получить данные авторизации. Попробуйте обновить страницу.');
        // ИСПРАВЛЕНО: Устанавливаем state, ref синхронизируется автоматически через useEffect
        params.setIsSubmitting(false);
      }
      return;
    }
    
    clientLogger.log('✅ Все проверки пройдены, продолжаем формирование answerArray');

    // Собираем ответы из state, если они пустые - пытаемся загрузить из БД
    let answersToSubmit = params.answers;
    clientLogger.log('📝 Текущие ответы в state:', Object.keys(answersToSubmit).length);
    
    if (Object.keys(answersToSubmit).length === 0) {
      clientLogger.log('📦 Ответы пустые, пытаемся загрузить из БД...');
      try {
        // ИСПРАВЛЕНО: Загружаем ответы из БД через API, не из localStorage
        const progressResponse = await api.getQuizProgress();
        if (progressResponse?.progress?.answers && Object.keys(progressResponse.progress.answers).length > 0) {
          answersToSubmit = progressResponse.progress.answers;
          if (params.isMountedRef.current) {
            params.setAnswers(progressResponse.progress.answers);
          }
          clientLogger.log('✅ Загружены ответы из БД:', Object.keys(progressResponse.progress.answers).length);
        }
      } catch (e) {
        console.error('❌ Ошибка загрузки из БД:', e);
      }
    }

    if (Object.keys(answersToSubmit).length === 0) {
      console.error('❌ Нет ответов для отправки');
      clientLogger.error('❌ Нет ответов для отправки - блокируем вызов API', {
        answersToSubmitKeys: Object.keys(answersToSubmit),
        answersToSubmitCount: Object.keys(answersToSubmit).length,
        answersInState: Object.keys(params.answers).length,
      });
      if (params.isMountedRef.current) {
        params.setError('Нет ответов для отправки. Пожалуйста, пройдите анкету.');
        // ИСПРАВЛЕНО: Устанавливаем state, ref синхронизируется автоматически через useEffect
        params.setIsSubmitting(false);
      }
      return;
    }

    // ВАЖНО: Логируем все ответы перед формированием массива
    clientLogger.log('📝 Формирование answerArray из answersToSubmit:', {
      answersToSubmitKeys: Object.keys(answersToSubmit),
      answersToSubmitCount: Object.keys(answersToSubmit).length,
      answersToSubmitEntries: Object.entries(answersToSubmit).slice(0, 5).map(([k, v]) => ({
        key: k,
        keyType: typeof k,
        value: v,
        valueType: typeof v,
        isArray: Array.isArray(v),
      })),
    });

    const answerArray = Object.entries(answersToSubmit)
      .filter(([questionId, value]) => {
        // ВАЖНО: Фильтруем только валидные ответы
        // Игнорируем ответы с questionId = -1 (метаданные позиции)
        const qId = parseInt(questionId, 10);
        if (isNaN(qId) || qId <= 0) {
          clientLogger.warn('⚠️ Пропущен невалидный questionId:', {
            questionId,
            value,
            parsed: qId,
          });
          return false;
        }
        // ВАЖНО: Пустые строки и null - это валидные ответы (пользователь может намеренно не отвечать)
        // Игнорируем только undefined, так как это означает отсутствие ответа
        if (value === undefined) {
          clientLogger.warn('⚠️ Пропущен ответ с undefined:', {
            questionId: qId,
            value,
          });
          return false;
        }
        // null и пустая строка - это валидные ответы, сохраняем их
        return true;
      })
      .map(([questionId, value]) => {
        const isArray = Array.isArray(value);
        const qId = parseInt(questionId, 10);
        // ВАЖНО: Сохраняем все ответы, включая пустые строки и null
        // Пустая строка - это валидный ответ (пользователь может намеренно не отвечать)
        return {
          questionId: qId,
          // ВАЖНО: Преобразуем null в undefined для совместимости с API
          // null и пустая строка - это валидные ответы
          answerValue: isArray ? undefined : (value === null ? undefined : (value as string)),
          answerValues: isArray ? (value as string[]) : undefined,
        };
      });

    clientLogger.log('📤 Отправка ответов на сервер:', {
      questionnaireId: params.questionnaire?.id,
      answersCount: answerArray.length,
      answerArrayQuestionIds: answerArray.map(a => a.questionId),
      answerArraySample: answerArray.slice(0, 5),
    });
    
    // ВАЖНО: Проверяем, что answerArray не пустой
    if (answerArray.length === 0) {
      clientLogger.error('❌ answerArray пустой после фильтрации - блокируем вызов API', {
        answersToSubmitCount: Object.keys(answersToSubmit).length,
        answerArrayLength: answerArray.length,
      });
      if (params.isMountedRef.current) {
        params.setError('Нет валидных ответов для отправки. Пожалуйста, пройдите анкету.');
        // ИСПРАВЛЕНО: Устанавливаем state, ref синхронизируется автоматически через useEffect
        params.setIsSubmitting(false);
      }
      return;
    }

    let result: any;
    try {
      // ВАЖНО: Логируем перед вызовом API
      clientLogger.log('📤 Вызываем api.submitAnswers:', {
        questionnaireId: params.questionnaire?.id,
        answersCount: answerArray.length,
        answerQuestionIds: answerArray.map(a => a.questionId),
        answerArraySample: answerArray.slice(0, 3),
      });
      
      // ВАЖНО: Проверяем, что params.initData доступен перед вызовом API
      const currentInitData = typeof window !== 'undefined' ? window.Telegram?.WebApp?.initData : null;
      clientLogger.log('🔍 Проверка params.initData перед вызовом API:', {
        hasInitData: !!currentInitData,
        initDataLength: currentInitData?.length || 0,
        hasTelegram: typeof window !== 'undefined' && !!window.Telegram,
        hasWebApp: typeof window !== 'undefined' && !!window.Telegram?.WebApp,
      });
      
      if (!currentInitData) {
        clientLogger.error('❌ params.initData не доступен перед вызовом api.submitAnswers');
        throw new Error('initData не доступен. Пожалуйста, обновите страницу.');
      }
      
      // ВАЖНО: Логируем непосредственно перед вызовом API
      clientLogger.log('🚀 Вызываем api.submitAnswers СЕЙЧАС:', {
        questionnaireId: params.questionnaire?.id,
        answersCount: answerArray.length,
        hasInitData: !!currentInitData,
        answerQuestionIds: answerArray.map(a => a.questionId),
      });
      
      result = await api.submitAnswers({
        questionnaireId: params.questionnaire?.id!,
        answers: answerArray,
      });
      
      // ВАЖНО: Логируем сразу после получения ответа
      clientLogger.log('📥 Получен ответ от api.submitAnswers:', {
        hasResult: !!result,
        resultType: typeof result,
        resultKeys: result ? Object.keys(result) : [],
      });
      
      clientLogger.log('✅ Ответы отправлены, профиль создан:', {
        result,
        success: result?.success,
        hasResult: !!result,
        resultType: typeof result,
        resultKeys: result ? Object.keys(result) : [],
        resultString: JSON.stringify(result).substring(0, 200),
        profileId: result?.profile?.id,
      });
      
      // ВАЖНО: Проверяем, что профиль действительно был создан
      // Если профиль не был создан, не продолжаем редирект
      if (!result?.profile?.id) {
        console.error('❌ КРИТИЧЕСКАЯ ОШИБКА: Профиль не был создан после отправки ответов:', {
          result,
          hasProfile: !!result?.profile,
          profileId: result?.profile?.id,
          resultKeys: result ? Object.keys(result) : [],
        });
        clientLogger.error('❌ Профиль не был создан после отправки ответов', {
          result,
          hasProfile: !!result?.profile,
          profileId: result?.profile?.id,
        });
        
        // ВАЖНО: Очищаем флаг quiz_just_submitted, чтобы не происходил редирект на /plan без профиля
        // Это предотвратит редирект на первый экран при следующей загрузке страницы
        if (typeof window !== 'undefined') {
          try {
            sessionStorage.removeItem(QUIZ_CONFIG.STORAGE_KEYS.JUST_SUBMITTED);
            clientLogger.log('✅ Флаг quiz_just_submitted очищен, так как профиль не был создан');
          } catch (storageError) {
            clientLogger.warn('⚠️ Не удалось очистить флаг quiz_just_submitted:', storageError);
          }
        }
        
        // Не продолжаем редирект, если профиль не создан
        if (params.isMountedRef.current) {
          params.setError('Не удалось создать профиль. Пожалуйста, попробуйте еще раз.');
          params.setFinalizeError('Не удалось создать профиль');
          // ИСПРАВЛЕНО: Устанавливаем state, ref синхронизируется автоматически через useEffect
          params.setIsSubmitting(false);
          params.setFinalizing(false);
        }
        return;
      }
      
      // ВАЖНО: Очищаем кэш профиля после успешного создания, чтобы при редиректе на /plan
      // профиль загрузился заново из БД, а не из старого кэша
      if (typeof window !== 'undefined') {
        try {
          // Очищаем кэш профиля в sessionStorage
          sessionStorage.removeItem('profile_check_cache');
          sessionStorage.removeItem('profile_check_cache_timestamp');
          clientLogger.log('✅ Кэш профиля очищен после создания профиля');
        } catch (cacheError) {
          clientLogger.warn('⚠️ Не удалось очистить кэш профиля:', cacheError);
        }
      }
    } catch (submitError: any) {
      // ИСПРАВЛЕНО: Логируем ошибку более детально и НЕ продолжаем редирект, если профиль не создан
      console.error('❌ КРИТИЧЕСКАЯ ОШИБКА при отправке ответов:', {
        error: submitError,
        message: submitError?.message,
        status: submitError?.status,
        stack: submitError?.stack,
        questionnaireId: params.questionnaire?.id,
        answersCount: answerArray.length,
      });
      clientLogger.error('❌ Ошибка при отправке ответов:', {
        error: submitError,
        message: submitError?.message,
        status: submitError?.status,
        stack: submitError?.stack?.substring(0, 500),
        questionnaireId: params.questionnaire?.id,
        answersCount: answerArray.length,
        errorName: submitError?.name,
        errorType: typeof submitError,
      });
      
      // Если это не дубликат и не временная ошибка сети, показываем ошибку пользователю
      const isDuplicate = submitError?.message?.includes('duplicate') || 
                         submitError?.message?.includes('already submitted') ||
                         submitError?.status === 409;
      const isNetworkError = submitError?.message?.includes('fetch') || 
                            submitError?.message?.includes('network') ||
                            !submitError?.status;
      
      if (isDuplicate) {
        clientLogger.log('⚠️ Обнаружена повторная отправка (дубликат), проверяем наличие профиля');
        
        // Проверяем, существует ли профиль, даже если это дубликат
        try {
          const profileCheck = await api.getCurrentProfile() as any;
          if (profileCheck && profileCheck.id) {
            // Профиль существует - продолжаем редирект
            clientLogger.log('✅ Профиль существует при дубликате, продолжаем редирект');
            result = { success: true, profile: profileCheck, isDuplicate: true, error: submitError?.message };
          } else {
            // Профиль не существует - это странно для дубликата, но показываем ошибку и очищаем флаг
            clientLogger.error('❌ Профиль не существует при дубликате отправки');
            
            // ВАЖНО: Очищаем флаг quiz_just_submitted, чтобы не происходил редирект на /plan без профиля
            if (typeof window !== 'undefined') {
              try {
                sessionStorage.removeItem(QUIZ_CONFIG.STORAGE_KEYS.JUST_SUBMITTED);
                clientLogger.log('✅ Флаг quiz_just_submitted очищен, так как профиль не найден при дубликате');
              } catch (storageError) {
                clientLogger.warn('⚠️ Не удалось очистить флаг quiz_just_submitted:', storageError);
              }
            }
            
            if (params.isMountedRef.current) {
              params.setError('Обнаружена повторная отправка, но профиль не найден. Пожалуйста, попробуйте еще раз.');
              // ИСПРАВЛЕНО: Устанавливаем state, ref синхронизируется автоматически через useEffect
              params.setIsSubmitting(false);
            }
            return;
          }
        } catch (profileCheckError) {
          // Не удалось проверить профиль - для дубликата продолжаем редирект (профиль мог быть создан ранее)
          clientLogger.warn('⚠️ Не удалось проверить профиль при дубликате, продолжаем редирект');
          result = { success: true, isDuplicate: true, error: submitError?.message };
        }
      } else if (isNetworkError) {
        // Ошибка сети - проверяем, был ли профиль создан, перед редиректом
        clientLogger.warn('⚠️ Ошибка сети при отправке, проверяем наличие профиля перед редиректом');
        
        // Пытаемся проверить, был ли профиль создан, делая запрос к API
        try {
          const profileCheck = await api.getCurrentProfile() as any;
          if (profileCheck && profileCheck.id) {
            // Профиль существует - продолжаем редирект
            clientLogger.log('✅ Профиль существует после ошибки сети, продолжаем редирект');
            result = { success: true, profile: profileCheck, error: submitError?.message };
          } else {
            // Профиль не существует - показываем ошибку и очищаем флаг
            clientLogger.error('❌ Профиль не был создан после ошибки сети');
            
            // ВАЖНО: Очищаем флаг quiz_just_submitted, чтобы не происходил редирект на /plan без профиля
            if (typeof window !== 'undefined') {
              try {
                sessionStorage.removeItem(QUIZ_CONFIG.STORAGE_KEYS.JUST_SUBMITTED);
                clientLogger.log('✅ Флаг quiz_just_submitted очищен, так как профиль не был создан после ошибки сети');
              } catch (storageError) {
                clientLogger.warn('⚠️ Не удалось очистить флаг quiz_just_submitted:', storageError);
              }
            }
            
            if (params.isMountedRef.current) {
              params.setError('Ошибка сети при отправке ответов. Профиль не был создан. Пожалуйста, попробуйте еще раз.');
              // ИСПРАВЛЕНО: Устанавливаем state, ref синхронизируется автоматически через useEffect
              params.setIsSubmitting(false);
            }
            return;
          }
        } catch (profileCheckError) {
          // Не удалось проверить профиль - показываем ошибку
          clientLogger.error('❌ Не удалось проверить наличие профиля после ошибки сети', profileCheckError);
          if (params.isMountedRef.current) {
            params.setError('Ошибка сети при отправке ответов. Не удалось проверить создание профиля. Пожалуйста, попробуйте еще раз.');
            // ИСПРАВЛЕНО: Устанавливаем state, ref синхронизируется автоматически через useEffect
            params.setIsSubmitting(false);
          }
          return;
        }
      } else {
        // Другая ошибка - проверяем, не является ли это ошибкой создания профиля (500)
        // Если это ошибка 500, проверяем, был ли профиль создан несмотря на ошибку
        const isProfileCreationError = submitError?.status === 500 && 
                                      (submitError?.message?.includes('Profile was not created') ||
                                       submitError?.message?.includes('profile') ||
                                       submitError?.message?.includes('Profile'));
        
        if (isProfileCreationError) {
          clientLogger.warn('⚠️ Ошибка создания профиля (500), проверяем наличие профиля');
          
          // Проверяем, был ли профиль создан, несмотря на ошибку
          try {
            const profileCheck = await api.getCurrentProfile() as any;
            if (profileCheck && profileCheck.id) {
              // Профиль существует - продолжаем редирект
              clientLogger.log('✅ Профиль существует после ошибки создания, продолжаем редирект');
              result = { success: true, profile: profileCheck, error: submitError?.message };
            } else {
              // Профиль не существует - показываем ошибку и очищаем флаг
              clientLogger.error('❌ Профиль не был создан после ошибки 500');
              
              // ВАЖНО: Очищаем флаг quiz_just_submitted, чтобы не происходил редирект на /plan без профиля
              if (typeof window !== 'undefined') {
                try {
                  sessionStorage.removeItem(QUIZ_CONFIG.STORAGE_KEYS.JUST_SUBMITTED);
                  clientLogger.log('✅ Флаг quiz_just_submitted очищен, так как профиль не был создан после ошибки 500');
                } catch (storageError) {
                  clientLogger.warn('⚠️ Не удалось очистить флаг quiz_just_submitted:', storageError);
                }
              }
              
              if (params.isMountedRef.current) {
                params.setError('Не удалось создать профиль. Пожалуйста, попробуйте еще раз.');
                // ИСПРАВЛЕНО: Устанавливаем state, ref синхронизируется автоматически через useEffect
                params.setIsSubmitting(false);
              }
              return;
            }
          } catch (profileCheckError) {
            // Не удалось проверить профиль - показываем ошибку
            clientLogger.error('❌ Не удалось проверить наличие профиля после ошибки 500', profileCheckError);
            if (params.isMountedRef.current) {
              params.setError('Ошибка при создании профиля. Пожалуйста, попробуйте еще раз.');
              // ИСПРАВЛЕНО: Устанавливаем state, ref синхронизируется автоматически через useEffect
              params.setIsSubmitting(false);
            }
            return;
          }
        } else {
          // Другая ошибка - проверяем, был ли профиль создан, перед показом ошибки
          // ВАЖНО: Флаг quiz_just_submitted уже установлен, не очищаем его
          // Это защита от редиректа на первый экран, даже если произошла ошибка
          clientLogger.warn('⚠️ Другая ошибка при отправке ответов, проверяем наличие профиля');
          
          // Проверяем, был ли профиль создан, несмотря на ошибку
          try {
            const profileCheck = await api.getCurrentProfile() as any;
            if (profileCheck && profileCheck.id) {
              // Профиль существует - продолжаем редирект, несмотря на ошибку
              clientLogger.log('✅ Профиль существует после другой ошибки, продолжаем редирект');
              result = { success: true, profile: profileCheck, error: submitError?.message };
              // Продолжаем выполнение - редирект произойдет ниже
            } else {
              // Профиль не существует - показываем ошибку и очищаем флаг quiz_just_submitted
              // Это предотвратит редирект на /plan без профиля и редирект на первый экран
              clientLogger.error('❌ Профиль не был создан после другой ошибки');
              
              // ВАЖНО: Очищаем флаг quiz_just_submitted, чтобы не происходил редирект на /plan без профиля
              if (typeof window !== 'undefined') {
                try {
                  sessionStorage.removeItem(QUIZ_CONFIG.STORAGE_KEYS.JUST_SUBMITTED);
                  clientLogger.log('✅ Флаг quiz_just_submitted очищен, так как профиль не был создан после ошибки');
                } catch (storageError) {
                  clientLogger.warn('⚠️ Не удалось очистить флаг quiz_just_submitted:', storageError);
                }
              }
              
              if (params.isMountedRef.current) {
                params.setError(submitError?.message || 'Ошибка отправки ответов. Пожалуйста, попробуйте еще раз.');
                // ИСПРАВЛЕНО: Устанавливаем state, ref синхронизируется автоматически через useEffect
                params.setIsSubmitting(false);
              }
              return;
            }
          } catch (profileCheckError) {
            // Не удалось проверить профиль - показываем ошибку, но НЕ очищаем флаг
            clientLogger.error('❌ Не удалось проверить наличие профиля после другой ошибки', profileCheckError);
            if (params.isMountedRef.current) {
              params.setError(submitError?.message || 'Ошибка отправки ответов. Пожалуйста, попробуйте еще раз.');
              // ИСПРАВЛЕНО: Устанавливаем state, ref синхронизируется автоматически через useEffect
              params.setIsSubmitting(false);
            }
            // ВАЖНО: НЕ очищаем флаг quiz_just_submitted - он будет очищен только после успешного редиректа
            return;
          }
        }
      }
    }
    
    // ВАЖНО: При перепрохождении анкеты НЕ устанавливаем флаг is_retaking_quiz в БД
    // Флаг должен быть очищен после успешной отправки, чтобы при следующем заходе показывалась обычная анкета
    // ВАЖНО: Очищаем флаг ПЕРЕД редиректом, чтобы при возврате на /quiz не показывался экран "что хотите изменить?"
    try {
      // Очищаем флаги перепрохождения независимо от params.isRetakingQuiz, чтобы избежать показа экрана "что хотите изменить?" после редиректа
      await userPreferences.setIsRetakingQuiz(false);
      await userPreferences.setFullRetakeFromHome(false);
      clientLogger.log('✅ Флаги перепрохождения очищены после успешной отправки ответов');
    } catch (storageError) {
      clientLogger.warn('⚠️ Ошибка при очистке localStorage (некритично):', storageError);
    }
    
    // Если это дубликат отправки, все равно перенаправляем пользователя
    if (result?.isDuplicate) {
      clientLogger.log('⚠️ Обнаружена повторная отправка, перенаправляем на результаты...');
    }
    
    // ВАЖНО: НЕ очищаем прогресс (ответы) сразу после отправки!
    // Ответы нужны для генерации плана, они будут удалены только после успешной генерации
    // ВАЖНО: НЕ очищаем localStorage и НЕ сбрасываем состояния ДО редиректа,
    // чтобы избежать перерендера и показа первого экрана анкеты
    // Очистка будет выполнена после редиректа или на странице /plan
    
    // ИСПРАВЛЕНО: Устанавливаем флаг quiz_just_submitted ПЕРВЫМ, ДО установки params.isSubmitting
    // Это гарантирует, что лоадер "Загрузка анкеты..." не покажется даже на мгновение
    // Флаг предотвратит редирект на первый экран анкеты при возврате на /quiz
    if (typeof window !== 'undefined') {
      try {
        sessionStorage.setItem('quiz_just_submitted', 'true');
        // ОПТИМИЗАЦИЯ: Очищаем кэш профиля, чтобы новый профиль был доступен сразу после создания
        sessionStorage.removeItem('profile_check_cache');
        sessionStorage.removeItem('profile_check_cache_timestamp');
        clientLogger.log('✅ Флаг quiz_just_submitted установлен ПЕРВЫМ, ДО params.isSubmitting');
      } catch (storageError) {
        clientLogger.warn('⚠️ Не удалось установить флаг quiz_just_submitted:', storageError);
      }
    }
    
    // КРИТИЧНО: Устанавливаем params.isSubmitting и loading в ОДНОМ батче React, синхронно
    // Это предотвращает промежуточный рендер, где loading=true, а params.isSubmitting=false
    // React батчит setState вызовы, но мы делаем это явно для гарантии
    if (params.isMountedRef.current) {
      // Устанавливаем params.isSubmitting ПЕРВЫМ, чтобы лоадер плана имел приоритет
      params.setIsSubmitting(true);
      // Затем сразу устанавливаем loading=false, чтобы скрыть лоадер анкеты
      params.setLoading(false);
      clientLogger.log('🔄 Установлены params.isSubmitting=true и loading=false в одном батче');
    }
    
    // ИСПРАВЛЕНО: Генерируем план ПЕРЕД редиректом, чтобы план был готов
    // Это критично, так как после редиректа код не выполняется
    clientLogger.log('🔍 Проверка result перед генерацией плана:', {
      result,
      success: result?.success,
      hasResult: !!result,
      resultKeys: result ? Object.keys(result) : [],
    });
    
    // ИСПРАВЛЕНО: Проверяем, нужно ли генерировать план
    // ApiResponse.success() возвращает объект с данными напрямую
    // В /api/params.questionnaire/params.answers возвращается {success: true, profile: {...}, answersCount: number}
    // Проверяем наличие result, отсутствие поля error и что success не false
    // result может быть просто объектом с данными, поэтому проверяем отсутствие ошибки
    // ВАЖНО: Также проверяем, что профиль существует
    const hasProfileId = result?.profile?.id;
    const shouldGeneratePlan = result && !result.error && result.success !== false && hasProfileId;
    
    // Логируем для диагностики (включая отправку на сервер)
    const logData = {
      hasResult: !!result,
      hasError: !!result?.error,
      success: result?.success,
      successType: typeof result?.success,
      hasProfileId,
      profileId: result?.profile?.id,
      shouldGeneratePlan,
      resultKeys: result ? Object.keys(result) : [],
      resultPreview: result ? JSON.stringify(result).substring(0, 300) : 'null',
    };
    clientLogger.log('🔍 Проверка shouldGeneratePlan:', logData);
    
    // ВАЖНО: Отправляем лог на сервер для диагностики (неблокирующе)
    
    // ВАЖНО: Генерация плана теперь происходит на бэкенде в submitAnswers
    // Не нужно генерировать план на клиенте - просто редиректим на /plan?state=generating
    clientLogger.log('✅ Профиль создан, генерация плана запущена на бэкенде, редиректим на /plan?state=generating');
    
    // ИСПРАВЛЕНО: Устанавливаем hasPlanProgress = true, чтобы пользователь не редиректился на /quiz после прохождения анкеты
    try {
      await userPreferences.setHasPlanProgress(true);
      clientLogger.log('✅ hasPlanProgress установлен в true после прохождения анкеты');
    } catch (error) {
      clientLogger.warn('⚠️ Ошибка при установке hasPlanProgress (некритично):', error);
    }
    
    // ВАЖНО: Очищаем флаги перепрохождения ПЕРЕД редиректом, чтобы при возврате на /quiz не показывался экран "что хотите изменить?"
    try {
      await userPreferences.setIsRetakingQuiz(false);
      await userPreferences.setFullRetakeFromHome(false);
      clientLogger.log('✅ Флаги перепрохождения очищены перед редиректом на /plan');
    } catch (storageError) {
      clientLogger.warn('⚠️ Ошибка при очистке флагов перед редиректом (некритично):', storageError);
    }
    
    // Устанавливаем этап "done" перед редиректом
    if (params.isMountedRef.current) {
      params.setFinalizingStep('done');
    }
    
    // Небольшая задержка для видимости этапа "done"
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Редирект на страницу плана с состоянием generating
    // ИСПРАВЛЕНО: Передаем profileId для read-your-write consistency
    const profileId = result?.profile?.id;
    const planUrl = profileId 
      ? `/plan?state=generating&profileId=${profileId}`
      : '/plan?state=generating';
    
    clientLogger.log('🔄 Редирект на /plan?state=generating', {
      hasResult: !!result,
      resultSuccess: result?.success,
      hasError: !!result?.error,
      answersCount: Object.keys(params.answers).length,
      profileId: profileId || null,
      planUrl,
    });
    
    // ИСПРАВЛЕНО: Лоадер уже показан выше (params.isSubmitting = true установлен ДО генерации плана)
    // Теперь просто редиректим на /plan после того, как план готов
    // ВАЖНО: Редирект должен произойти после готовности плана
    // Это предотвращает перерендер компонента и показ первого экрана анкеты
    // ИСПРАВЛЕНО: Добавляем небольшую задержку перед редиректом, чтобы лоадер был виден
    // И устанавливаем isMountedRef.current = false только непосредственно перед редиректом
    // Закрываем лоадер финализации перед редиректом
    if (params.isMountedRef.current) {
      params.setFinalizing(false);
      params.setIsSubmitting(false);
    }
    
    if (typeof window !== 'undefined') {
      try {
        // ИСПРАВЛЕНО: Устанавливаем isMountedRef.current = false только непосредственно перед редиректом
        // Это гарантирует, что лоадер успеет показаться
        params.isMountedRef.current = false;
        
        // Редирект на страницу плана с состоянием generating
        // ИСПРАВЛЕНО: Передаем profileId для read-your-write consistency
        const profileId = result?.profile?.id;
        const planUrl = profileId 
          ? `/plan?state=generating&profileId=${profileId}`
          : '/plan?state=generating';
        // ИСПРАВЛЕНО: Guard против множественных редиректов
        if (params.redirectInProgressRef.current) {
          return; // Редирект уже в процессе
        }
        params.redirectInProgressRef.current = true;
        clientLogger.log('🔄 Редирект на /plan?state=generating после показа лоадера', {
          profileId: profileId || null,
          planUrl,
        });
        if (typeof window !== 'undefined') {
          sessionStorage.removeItem('quiz_init_done');
          window.location.replace(planUrl);
          // ФИКС: Сбрасываем params.redirectInProgressRef через задержку после редиректа
          setTimeout(() => {
            params.redirectInProgressRef.current = false;
          }, 1000);
        }
        // После редиректа код не должен выполняться, но на всякий случай выходим
        return;
      } catch (redirectError) {
        console.error('❌ Ошибка при редиректе:', redirectError);
        // Если редирект не сработал, пробуем через href (не используем router после размонтирования)
        try {
          window.location.href = '/plan';
          return;
        } catch (hrefError) {
          console.error('❌ Все методы редиректа не сработали:', hrefError);
          if (params.isMountedRef.current) {
            params.setIsSubmitting(false); // Сбрасываем лоадер только если редирект не сработал
          }
        }
      }
    } else {
      // SSR режим - используем window.location вместо router после размонтирования
      try {
        if (typeof window !== 'undefined') {
          (window as Window).location.replace('/plan');
          return;
        }
      } catch (redirectError) {
        console.error('❌ Ошибка при редиректе (SSR):', redirectError);
      }
    }
  } catch (err: any) {
    // ВАЖНО: Все операции должны быть безопасными, чтобы не выбрасывать новые ошибки
    // Закрываем лоадер финализации при любой ошибке
    if (params.isMountedRef.current) {
      params.setFinalizing(false);
      params.setIsSubmitting(false);
      params.setFinalizeError(err?.message || 'Произошла ошибка при обработке ответов');
    }
    
    try {
      console.error('❌ Ошибка при отправке ответов:', err);
      console.error('   Error message:', err?.message);
      console.error('   Error stack:', err?.stack);
      console.error('   Error status:', err?.status);
    } catch (logError) {
      // Игнорируем ошибки логирования
    }
    
    // ВАЖНО: Проверяем, был ли профиль создан, перед установкой флага quiz_just_submitted
    // Если профиль не создан, не устанавливаем флаг, чтобы не происходил редирект на /plan без профиля
    let profileExists = false;
    try {
      const profileCheck = await api.getCurrentProfile() as any;
      if (profileCheck && profileCheck.id) {
        profileExists = true;
        clientLogger.log('✅ Профиль существует после ошибки в catch блоке, устанавливаем флаг quiz_just_submitted');
      } else {
        clientLogger.error('❌ Профиль не существует после ошибки в catch блоке, НЕ устанавливаем флаг quiz_just_submitted');
      }
    } catch (profileCheckError) {
      clientLogger.warn('⚠️ Не удалось проверить профиль после ошибки в catch блоке, НЕ устанавливаем флаг quiz_just_submitted');
    }
    
    // ИСПРАВЛЕНО: Устанавливаем флаг в sessionStorage ПЕРЕД редиректом ТОЛЬКО если профиль существует
    if (profileExists && typeof window !== 'undefined') {
      try {
        sessionStorage.setItem('quiz_just_submitted', 'true');
        // ОПТИМИЗАЦИЯ: Очищаем кэш профиля, чтобы новый профиль был доступен сразу после создания
        sessionStorage.removeItem('profile_check_cache');
        sessionStorage.removeItem('profile_check_cache_timestamp');
      } catch (storageError) {
        clientLogger.warn('⚠️ Не удалось установить флаг quiz_just_submitted:', storageError);
      }
    } else {
      // Профиль не существует - очищаем флаг, если он был установлен ранее
      if (typeof window !== 'undefined') {
        try {
          sessionStorage.removeItem(QUIZ_CONFIG.STORAGE_KEYS.JUST_SUBMITTED);
          clientLogger.log('✅ Флаг quiz_just_submitted очищен, так как профиль не существует после ошибки');
        } catch (storageError) {
          clientLogger.warn('⚠️ Не удалось очистить флаг quiz_just_submitted:', storageError);
        }
      }
    }
    
    // ВАЖНО: Проверяем, что компонент еще смонтирован перед обновлением состояния
    if (!params.isMountedRef.current) {
      clientLogger.warn('⚠️ Компонент размонтирован, пропускаем обновление состояния');
      // ИСПРАВЛЕНО: Guard против множественных редиректов
      if (params.redirectInProgressRef.current) {
        return; // Редирект уже в процессе
      }
      params.redirectInProgressRef.current = true;
      // Все равно пытаемся редиректить, даже если компонент размонтирован
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem('quiz_init_done');
        setTimeout(() => {
          try {
            window.location.replace('/plan');
            // ФИКС: Сбрасываем params.redirectInProgressRef через задержку после редиректа
            setTimeout(() => {
              params.redirectInProgressRef.current = false;
            }, 1000);
          } catch (e) {
            // Игнорируем ошибки редиректа
            params.redirectInProgressRef.current = false; // Сбрасываем при ошибке
          }
        }, 500);
      }
      return;
    }
    
    // ВАЖНО: Вместо показа ошибки продолжаем показывать лоадер и редиректим на /plan
    // Это обеспечивает лучший UX - пользователь видит лоадер, а не экран ошибки
    // План может генерироваться в фоне, даже если отправка ответов вернула ошибку
    try {
      clientLogger.log('⚠️ Ошибка при отправке ответов, но продолжаем показывать лоадер и редиректим на /plan');
      
      // КРИТИЧНО: Устанавливаем params.isSubmitting ПЕРВЫМ, затем loading=false в одном батче
      params.setIsSubmitting(true); // Показываем лоадер "Создаем ваш план ухода..."
      params.setLoading(false); // Скрываем лоадер "Загрузка анкеты..."
      
      // Обработка различных типов ошибок - но все равно редиректим
      const errorMessage = err?.message || err?.error || '';
      if (errorMessage.includes('Unauthorized') || errorMessage.includes('401') || errorMessage.includes('initData')) {
        clientLogger.warn('⚠️ Ошибка авторизации, но продолжаем редирект');
      } else if (errorMessage.includes('уже была отправлена') || errorMessage.includes('301') || errorMessage.includes('302') || err?.status === 301 || err?.status === 302) {
        // Ошибка 301/302 - форма уже была отправлена - это нормально, редиректим
        clientLogger.log('✅ Форма уже была отправлена, редиректим на /plan');
      } else {
        // Другие ошибки - логируем, но все равно редиректим
        clientLogger.warn('⚠️ Ошибка при отправке ответов, но продолжаем редирект на /plan:', errorMessage);
      }
    } catch (logError) {
      // Игнорируем ошибки логирования
    }
    
    // КРИТИЧНО: Устанавливаем params.isSubmitting ПЕРВЫМ, затем loading=false в одном батче
    // Это предотвращает промежуточный рендер, где loading=true, а params.isSubmitting=false
    params.setIsSubmitting(true); // Показываем лоадер "Создаем ваш план ухода..."
    params.setLoading(false); // Скрываем лоадер "Загрузка анкеты..."
    
    // ВАЖНО: НЕ устанавливаем params.setIsSubmitting(false) и НЕ устанавливаем params.setError
    // Продолжаем показывать лоадер и редиректим на /plan
    // План может генерироваться в фоне, даже если отправка ответов вернула ошибку
    // ИСПРАВЛЕНО: Устанавливаем флаг в sessionStorage ПЕРЕД редиректом
    if (typeof window !== 'undefined') {
      try {
        sessionStorage.setItem('quiz_just_submitted', 'true');
        // ОПТИМИЗАЦИЯ: Очищаем кэш профиля, чтобы новый профиль был доступен сразу после создания
        sessionStorage.removeItem('profile_check_cache');
        sessionStorage.removeItem('profile_check_cache_timestamp');
      } catch (storageError) {
        clientLogger.warn('⚠️ Не удалось установить флаг quiz_just_submitted:', storageError);
      }
    }
    
    // ВАЖНО: Используем setTimeout с проверкой params.isMountedRef, чтобы избежать React Error #300
    // Сбрасываем флаг монтирования перед редиректом
    params.isMountedRef.current = false;
    
    // ИСПРАВЛЕНО: Guard против множественных редиректов
    if (params.redirectInProgressRef.current) {
      return; // Редирект уже в процессе
    }
    params.redirectInProgressRef.current = true;
    if (typeof window !== 'undefined') {
      try {
        setTimeout(() => {
          try {
            // Используем replace вместо href для предотвращения React Error #300
            clientLogger.log('🔄 Редирект на /plan после ошибки');
            window.location.replace('/plan');
            // ФИКС: Сбрасываем params.redirectInProgressRef через задержку после редиректа
            setTimeout(() => {
              params.redirectInProgressRef.current = false;
            }, 1000);
          } catch (redirectError) {
            // Если replace не сработал, пробуем href
            try {
              window.location.href = '/plan';
              setTimeout(() => {
                params.redirectInProgressRef.current = false;
              }, 1000);
            } catch (hrefError) {
              console.error('❌ Все методы редиректа не сработали:', hrefError);
              params.redirectInProgressRef.current = false; // Сбрасываем при ошибке
            }
          }
        }, 1500); // Небольшая задержка, чтобы пользователь увидел лоадер
      } catch (timeoutError) {
        // Если setTimeout не сработал, пробуем сразу
        try {
          window.location.replace('/plan');
        } catch (e) {
          // Игнорируем ошибки
        }
      }
    } else {
      // SSR режим - используем window.location вместо router после размонтирования
      try {
        if (typeof window !== 'undefined') {
          (window as Window).location.replace('/plan');
        }
      } catch (redirectError) {
        // Игнорируем ошибки
      }
    }
  } finally {
    // ИСПРАВЛЕНО: Гарантированно сбрасываем флаг params.isSubmitting только если компонент смонтирован
    // Ref синхронизируется автоматически через useEffect
    // Это предотвращает блокировку повторных попыток отправки
    if (params.isMountedRef.current) {
      // Сбрасываем state только если он еще true (не был сброшен в catch блоке)
      // Если state уже false, значит он был сброшен в catch блоке, ничего не делаем
      if (params.isSubmitting) {
        params.setIsSubmitting(false);
        clientLogger.log('✅ Флаг params.isSubmitting сброшен в finally блоке');
      }
    } else {
      // Компонент размонтирован - сбрасываем флаг принудительно
      params.isSubmittingRef.current = false;
      clientLogger.log('✅ Флаг params.isSubmittingRef сброшен в finally (компонент размонтирован)');
    }
  }
}
