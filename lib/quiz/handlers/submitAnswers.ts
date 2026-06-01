// lib/quiz/handlers/submitAnswers.ts

import { clientLogger } from '@/lib/client-logger';
import { safeSessionStorageSet, safeSessionStorageRemove } from '@/lib/storage-utils';
import { api } from '@/lib/api';
import * as userPreferences from '@/lib/user-preferences';
import { invalidatePlanWarmCache } from '@/lib/plan-warm-cache';
import type { SubmitAnswersResponse } from '@/lib/api-types';
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

  scopedStorageKeys: {
    JUST_SUBMITTED: string;
  };
}

// Функции заменены на импортированные из storage-utils

function getTelegramInitDataFallback(params: SubmitAnswersParams): string | null {
  try {
    if (params.initData) return params.initData;
    if (typeof window !== 'undefined' && window.Telegram?.WebApp?.initData) return window.Telegram.WebApp.initData;
    return null;
  } catch {
    return null;
  }
}

function buildAnswerArray(answers: Record<number, string | string[]>) {
  return Object.entries(answers)
    .filter(([questionId, value]) => {
      const qId = parseInt(questionId, 10);
      if (!Number.isFinite(qId) || qId <= 0) return false;
      return value !== undefined;
    })
    .map(([questionId, value]) => {
      const qId = parseInt(questionId, 10);
      const isArray = Array.isArray(value);
      return {
        questionId: qId,
        answerValue: isArray ? undefined : (value === null ? undefined : (value as string)),
        answerValues: isArray ? (value as string[]) : undefined,
      };
    });
}

export async function submitAnswers(params: SubmitAnswersParams): Promise<void> {
  console.log('✅ [submitAnswers] called', {
    hasQuestionnaire: !!params.questionnaire,
    questionnaireId: params.questionnaire?.id,
    answersCount: Object.keys(params.answers).length,
    isSubmitting: params.isSubmitting,
    isDev: params.isDev,
    hasInitData: !!params.initData
  });

  clientLogger.log('🚀 submitAnswers called', {
    hasQuestionnaire: !!params.questionnaire,
    questionnaireId: params.questionnaire?.id,
    answersCount: Object.keys(params.answers).length,
  });

  // 0) базовые проверки
  if (!params.questionnaire) {
    if (params.isMountedRef.current) {
      params.setError('Анкета не загружена. Пожалуйста, обновите страницу.');
    }
    return;
  }

  // 1) анти-даблклик: используем ref как источник истины
  if (params.isSubmittingRef.current) {
    clientLogger.warn('⚠️ submitAnswers ignored: already submitting');
    return;
  }
  params.isSubmittingRef.current = true;

  // 2) только блокируем кнопку; один лоадер — страница /loading после редиректа
  if (params.isMountedRef.current) {
    params.setError(null);
    params.setLoading(false); // скрываем "инициализационный" лоадер анкеты
    params.setIsSubmitting(true);
    // Не показываем QuizFinalizingLoader — между анкетой и планом один лоадер (/loading)
  }

  try {
    // 3) Telegram guard (в проде)
    const initData = getTelegramInitDataFallback(params);
    const isInTelegram = typeof window !== 'undefined' && !!window.Telegram?.WebApp;

    if (!params.isDev) {
      if (!isInTelegram) {
        throw new Error('Пожалуйста, откройте приложение через Telegram Mini App.');
      }
      if (!initData) {
        throw new Error('Не удалось получить данные авторизации. Обновите страницу и откройте через бота.');
      }
    }

    // 4) если answers пустые — пробуем подкачать из БД
    let answersToSubmit = params.answers;
    if (Object.keys(answersToSubmit).length === 0) {
      clientLogger.warn('⚠️ answers empty in state, try getQuizProgress');
      try {
        const progressResponse = await api.getQuizProgress();
        const fromDb = (progressResponse as any)?.progress?.answers;
        if (fromDb && Object.keys(fromDb).length > 0) {
          answersToSubmit = fromDb;
          if (params.isMountedRef.current) params.setAnswers(fromDb);
        }
      } catch (e) {
        clientLogger.warn('⚠️ getQuizProgress failed', e);
      }
    }

    const answerArray = buildAnswerArray(answersToSubmit);
    if (answerArray.length === 0) {
      throw new Error('Нет ответов для отправки. Пожалуйста, пройдите анкету.');
    }

    clientLogger.log('📤 submit answers', {
      questionnaireId: params.questionnaire.id,
      answersCount: answerArray.length,
    });

    // 5) отправка с постоянным clientSubmissionId. Сервер атомарно захватывает
    // submission до создания профиля: если первый запрос ещё выполняется, ретрай
    // получает status=processing и ждёт вместо параллельного запуска.
    const clientSubmissionId =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `${params.questionnaire.id}-${Date.now()}-${Math.random().toString(36).slice(2)}`;

    const isNetworkError = (e: any): boolean => {
      const m = String(e?.message || '').toLowerCase();
      return (
        e?.name === 'TypeError' ||
        m.includes('load failed') ||
        m.includes('failed to fetch') ||
        m.includes('networkerror') ||
        m.includes('network request failed')
      );
    };

    const MAX_NETWORK_ATTEMPTS = 3;
    const MAX_PROCESSING_POLLS = 20;
    let networkAttempts = 0;
    let processingPolls = 0;
    let result: SubmitAnswersResponse | undefined;
    while (!result) {
      try {
        const response = await api.submitAnswers({
          questionnaireId: params.questionnaire.id,
          answers: answerArray,
          clientSubmissionId,
        });

        if (response.status === 'processing') {
          processingPolls += 1;
          if (processingPolls >= MAX_PROCESSING_POLLS) {
            throw new Error('Профиль ещё создаётся. Подождите несколько секунд и попробуйте снова.');
          }

          const retryAfterMs = response.retryAfterMs ?? 1000;
          clientLogger.log('⏳ submitAnswers уже обрабатывается сервером, ждём результат', {
            processingPolls,
            retryAfterMs,
          });
          await new Promise((resolve) => setTimeout(resolve, retryAfterMs));
          continue;
        }

        result = response;
        break;
      } catch (e: any) {
        networkAttempts += 1;
        const retriable = isNetworkError(e) && networkAttempts < MAX_NETWORK_ATTEMPTS;
        if (!retriable) throw e;

        clientLogger.warn(`⚠️ submitAnswers сетевая попытка ${networkAttempts}/${MAX_NETWORK_ATTEMPTS} не удалась`, {
          message: e?.message,
          name: e?.name,
        });
        await new Promise((r) => setTimeout(r, networkAttempts * 700));
      }
    }

    clientLogger.log('📥 submitAnswers result', {
      keys: result ? Object.keys(result) : [],
      hasProfileId: !!result?.profile?.id,
      success: result?.success,
    });

    if (!result?.success || !result.profile?.id) {
      safeSessionStorageRemove('quiz_just_submitted');
      safeSessionStorageRemove(params.scopedStorageKeys.JUST_SUBMITTED);
      throw new Error('Сервер не вернул созданный профиль. Попробуйте ещё раз.');
    }
    const profileId = String(result.profile.id);

    // 7) ставим флаги ДО редиректа
    safeSessionStorageSet('quiz_just_submitted', 'true');
    safeSessionStorageSet(params.scopedStorageKeys.JUST_SUBMITTED, 'true');

    // чистим кэш профиля (чтобы /plan не взял старое)
    safeSessionStorageRemove('profile_check_cache');
    safeSessionStorageRemove('profile_check_cache_timestamp');
    invalidatePlanWarmCache();

    // помечаем что есть прогресс плана
    try {
      await userPreferences.setHasPlanProgress(true);
    } catch (e) {
      clientLogger.warn('⚠️ setHasPlanProgress failed (non-blocking)', e);
    }

    // сбрасываем флаги ретейка (non-blocking)
    try {
      await userPreferences.setIsRetakingQuiz(false);
      await userPreferences.setFullRetakeFromHome(false);
    } catch (e) {
      clientLogger.warn('⚠️ clear retake flags failed (non-blocking)', e);
    }

    // 8) редирект (и ставим guard)
    params.redirectInProgressRef.current = true;

    // Единый поток: quiz → /loading → /plan (buildRecs + generatePlan в одном месте)
    const loadingUrl = `/loading?profileId=${encodeURIComponent(profileId)}`;
    clientLogger.log('🔄 redirect to loading', { loadingUrl, profileId });

    if (typeof window !== 'undefined') {
      window.location.replace(loadingUrl);
    }
  } catch (err: any) {
    clientLogger.error('❌ submitAnswers failed', {
      message: err?.message,
      status: err?.status,
      stack: err?.stack?.substring?.(0, 300),
    });

    // показываем ошибку только если НЕ ушли в редирект
    if (!params.redirectInProgressRef.current && params.isMountedRef.current) {
      params.setError(err?.message || 'Ошибка отправки ответов');
      params.setIsSubmitting(false);
    }

    // важный reset ref
    params.isSubmittingRef.current = false;
    return;
  }

  // Если дошли сюда без редиректа (редкий случай: SSR) — сбрасываем ref
  if (!params.redirectInProgressRef.current) {
    params.isSubmittingRef.current = false;
    if (params.isMountedRef.current) {
      params.setIsSubmitting(false);
    }
  }
}
