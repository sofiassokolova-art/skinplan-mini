// lib/quiz/handlers/submitAnswersCore.ts
// Чистое сетевое ядро отправки ответов: построение массива ответов + цикл
// запроса с ретраями и ожиданием server-side processing.
// Вынесено из submitAnswers.ts, чтобы переиспользовать в фоновом пред-сабмите
// (lib/quiz/prewarm-submit.ts) без дублирования логики и без циклических импортов.

import { clientLogger } from '@/lib/client-logger';
import { api } from '@/lib/api';
import type { SubmitAnswersResponse } from '@/lib/api-types';

export interface AnswerArrayItem {
  questionId: number;
  answerValue?: string;
  answerValues?: string[];
}

export function buildAnswerArray(
  answers: Record<number, string | string[]>,
): AnswerArrayItem[] {
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

export function generateClientSubmissionId(questionnaireId: number): string {
  return typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${questionnaireId}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function isNetworkError(e: any): boolean {
  const m = String(e?.message || '').toLowerCase();
  return (
    e?.name === 'TypeError' ||
    m.includes('load failed') ||
    m.includes('failed to fetch') ||
    m.includes('networkerror') ||
    m.includes('network request failed')
  );
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getRateLimitRetryMs(e: any): number | null {
  if (e?.status !== 429) return null;

  const retryAfterSeconds = Number(e?.retryAfter);
  if (Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0) {
    return Math.min(retryAfterSeconds * 1000 + 250, 15_000);
  }

  return 3_000;
}

function getProcessingRetryMs(retryAfterMs: number | undefined, poll: number): number {
  const base = Math.max(retryAfterMs ?? 1000, 2000);
  return Math.min(base * Math.min(poll, 5), 10_000);
}

/**
 * Отправка ответов с постоянным clientSubmissionId.
 * Сервер атомарно захватывает submission до создания профиля: если первый запрос
 * ещё выполняется, ретрай получает status=processing и ждёт вместо параллельного
 * запуска. Сетевые ошибки ретраятся до MAX_NETWORK_ATTEMPTS.
 *
 * Один и тот же clientSubmissionId безопасно использовать повторно (фон + клик):
 * сервер вернёт уже созданный профиль вместо дубля.
 */
export async function requestSubmitWithRetry(args: {
  questionnaireId: number;
  answers: AnswerArrayItem[];
  clientSubmissionId: string;
}): Promise<SubmitAnswersResponse> {
  const { questionnaireId, answers, clientSubmissionId } = args;

  const MAX_NETWORK_ATTEMPTS = 3;
  const MAX_RATE_LIMIT_ATTEMPTS = 8;
  const MAX_PROCESSING_POLLS = 20;
  let networkAttempts = 0;
  let rateLimitAttempts = 0;
  let processingPolls = 0;

  while (true) {
    try {
      const response = await api.submitAnswers({
        questionnaireId,
        answers,
        clientSubmissionId,
      });

      if (response.status === 'processing') {
        processingPolls += 1;
        if (processingPolls >= MAX_PROCESSING_POLLS) {
          throw new Error('Профиль ещё создаётся. Подождите несколько секунд и попробуйте снова.');
        }

        const retryAfterMs = getProcessingRetryMs(response.retryAfterMs, processingPolls);
        clientLogger.log('⏳ submitAnswers уже обрабатывается сервером, ждём результат', {
          processingPolls,
          retryAfterMs,
        });
        await wait(retryAfterMs);
        continue;
      }

      return response;
    } catch (e: any) {
      const rateLimitRetryMs = getRateLimitRetryMs(e);
      if (rateLimitRetryMs !== null && rateLimitAttempts < MAX_RATE_LIMIT_ATTEMPTS) {
        rateLimitAttempts += 1;
        clientLogger.warn('⚠️ submitAnswers получил rate limit, ждём Retry-After', {
          rateLimitAttempts,
          retryAfterMs: rateLimitRetryMs,
        });
        await wait(rateLimitRetryMs);
        continue;
      }

      networkAttempts += 1;
      const retriable = isNetworkError(e) && networkAttempts < MAX_NETWORK_ATTEMPTS;
      if (!retriable) throw e;

      clientLogger.warn(`⚠️ submitAnswers сетевая попытка ${networkAttempts}/${MAX_NETWORK_ATTEMPTS} не удалась`, {
        message: e?.message,
        name: e?.name,
      });
      await wait(networkAttempts * 700);
    }
  }
}
