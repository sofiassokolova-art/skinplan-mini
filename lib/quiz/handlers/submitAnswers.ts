// lib/quiz/handlers/submitAnswers.ts

import { clientLogger } from '@/lib/client-logger';
import { safeSessionStorageSet, safeSessionStorageRemove } from '@/lib/storage-utils';
import { api } from '@/lib/api';
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

async function ensureProfileId(result: any): Promise<string | null> {
  if (result?.profile?.id) return String(result.profile.id);

  // если это дубликат/сеть/непонятный ответ — пробуем найти текущий профиль
  try {
    const profile = (await api.getCurrentProfile()) as any;
    if (profile?.id) return String(profile.id);
  } catch {
    // ignore
  }

  return null;
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

  // 2) показываем финальный лоадер ОДИН РАЗ
  if (params.isMountedRef.current) {
    params.setError(null);
    params.setLoading(false); // скрываем "инициализационный" лоадер анкеты
    params.setIsSubmitting(true);

    params.setFinalizing(true);
    params.setFinalizingStep('answers');
    params.setFinalizeError(null);
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

    // 5) отправка
    const result = await api.submitAnswers({
      questionnaireId: params.questionnaire.id,
      answers: answerArray,
    });

    clientLogger.log('📥 submitAnswers result', {
      keys: result ? Object.keys(result) : [],
      hasProfileId: !!result?.profile?.id,
      success: result?.success,
    });

    // 6) гарантируем profileId (или через getCurrentProfile)
    if (params.isMountedRef.current) {
      params.setFinalizingStep('plan');
    }

    const profileId = await ensureProfileId(result);
    if (!profileId) {
      // очень важно: не оставляем "just_submitted" если профиля нет
      safeSessionStorageRemove('quiz_just_submitted');
      safeSessionStorageRemove(params.scopedStorageKeys.JUST_SUBMITTED);
      throw new Error('Не удалось создать профиль. Попробуйте ещё раз.');
    }

    // 7) ставим флаги ДО редиректа
    safeSessionStorageSet('quiz_just_submitted', 'true');
    safeSessionStorageSet(params.scopedStorageKeys.JUST_SUBMITTED, 'true');

    // чистим кэш профиля (чтобы /plan не взял старое)
    safeSessionStorageRemove('profile_check_cache');
    safeSessionStorageRemove('profile_check_cache_timestamp');

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
      params.setFinalizeError(err?.message || 'Ошибка отправки ответов');
      params.setError(err?.message || 'Ошибка отправки ответов');
      params.setFinalizing(false);
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
      params.setFinalizing(false);
      params.setIsSubmitting(false);
    }
  }
}

