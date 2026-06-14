// lib/quiz/handlers/submitAnswers.ts

import { clientLogger } from '@/lib/client-logger';
import { safeSessionStorageSet, safeSessionStorageRemove } from '@/lib/storage-utils';
import { api } from '@/lib/api';
import * as userPreferences from '@/lib/user-preferences';
import { invalidatePlanWarmCache } from '@/lib/plan-warm-cache';
import { resolveTelegramInitData } from '@/lib/telegram-client';
import {
  buildAnswerArray,
  generateClientSubmissionId,
  requestSubmitWithRetry,
} from './submitAnswersCore';
import { getPrewarmSubmit } from '@/lib/quiz/prewarm-submit';
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

  // Клиентская навигация на /loading (router.replace). Если не передан —
  // фолбэк на window.location.replace (полная перезагрузка документа).
  navigate?: (url: string) => void;

  scopedStorageKeys: {
    JUST_SUBMITTED: string;
  };
}

// Функции заменены на импортированные из storage-utils

function getTelegramInitDataFallback(params: SubmitAnswersParams): string | null {
  try {
    if (params.initData) return params.initData;
    // resolveTelegramInitData: SDK → URL hash → sessionStorage.
    // Работает даже когда window.Telegram.WebApp отсутствует (SDK-скрипт не загрузился).
    return resolveTelegramInitData() || null;
  } catch {
    return null;
  }
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
    // 3) Telegram guard (в проде).
    // Опираемся на наличие initData (SDK → URL hash → sessionStorage), а НЕ на
    // window.Telegram.WebApp: на части устройств telegram-web-app.js не грузится,
    // объект WebApp не создаётся, но initData приходит в URL hash и валиден.
    const initData = getTelegramInitDataFallback(params);

    if (!params.isDev && !initData) {
      throw new Error('Не удалось получить данные авторизации Telegram. Закройте и откройте приложение заново.');
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
    //
    // ОПТИМИЗАЦИЯ: на финальном экране мог быть запущен фоновый пред-сабмит
    // (lib/quiz/prewarm-submit). Если он есть для тех же ответов — переиспользуем
    // его результат (клик становится мгновенным). Один clientSubmissionId на фон
    // и клик гарантирует, что сервер не создаст дубль профиля.
    const prewarm = getPrewarmSubmit(params.questionnaire.id, answersToSubmit);
    const clientSubmissionId =
      prewarm?.clientSubmissionId ?? generateClientSubmissionId(params.questionnaire.id);

    let result: SubmitAnswersResponse | undefined;

    if (prewarm?.promise) {
      try {
        result = await prewarm.promise;
        clientLogger.log('⚡ submitAnswers переиспользовал фоновый пред-сабмит');
      } catch (e: any) {
        // Пред-сабмит упал — делаем обычный запрос с тем же clientSubmissionId.
        clientLogger.warn('⚠️ пред-сабмит упал, фолбэк на обычный запрос', { message: e?.message });
      }
    }

    if (!result) {
      result = await requestSubmitWithRetry({
        questionnaireId: params.questionnaire.id,
        answers: answerArray,
        clientSubmissionId,
      });
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
      // Клиентский переход (router.replace) вместо полной перезагрузки документа —
      // не перекачиваем весь бандл заново. Фолбэк на window.location.replace, если
      // navigate не передан (например, внешние вызовы submitAnswers).
      if (params.navigate) {
        params.navigate(loadingUrl);
      } else {
        window.location.replace(loadingUrl);
      }
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
