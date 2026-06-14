// lib/quiz/prewarm-submit.ts
// Фоновый пред-сабмит ответов: пока пользователь читает финальный экран
// («Хотите улучшить состояние кожи?»), мы заранее создаём профиль на сервере.
// По клику «Получить план ухода» submitAnswers переиспользует уже готовый
// (или ещё выполняющийся) результат — клик становится почти мгновенным.
//
// Безопасность от дублей: пред-сабмит и клик используют ОДИН clientSubmissionId,
// поэтому сервер вернёт уже созданный профиль вместо второго (см. requestSubmitWithRetry).

'use client';

import { clientLogger } from '@/lib/client-logger';
import { resolveTelegramInitData } from '@/lib/telegram-client';
import {
  buildAnswerArray,
  generateClientSubmissionId,
  requestSubmitWithRetry,
} from './handlers/submitAnswersCore';
import type { SubmitAnswersResponse } from '@/lib/api-types';

interface PrewarmEntry {
  key: string;
  clientSubmissionId: string;
  promise: Promise<SubmitAnswersResponse>;
  failed: boolean;
}

let current: PrewarmEntry | null = null;

/**
 * Стабильный ключ по questionnaireId + ответам. Если пользователь вернётся назад
 * и изменит ответы, ключ поменяется — старый пред-сабмит не будет переиспользован.
 */
export function answersKey(
  questionnaireId: number,
  answers: Record<number, string | string[]>,
): string {
  const ids = Object.keys(answers)
    .map(Number)
    .filter((n) => Number.isFinite(n) && n > 0)
    .sort((a, b) => a - b);
  const parts = ids.map((id) => `${id}:${JSON.stringify(answers[id])}`);
  return `${questionnaireId}|${parts.join('|')}`;
}

/**
 * Запустить пред-сабмит в фоне (идемпотентно). Повторные вызовы с теми же
 * ответами не плодят запросов. Без initData в проде не стартует — иначе запрос
 * всё равно упал бы на авторизации.
 */
export function startPrewarmSubmit(params: {
  questionnaireId: number;
  answers: Record<number, string | string[]>;
  isDev: boolean;
}): void {
  if (typeof window === 'undefined') return;

  const { questionnaireId, answers, isDev } = params;
  const answerArray = buildAnswerArray(answers);
  if (answerArray.length === 0) return;

  const key = answersKey(questionnaireId, answers);

  // Уже идёт/готов пред-сабмит для этих же ответов — ничего не делаем.
  if (current && current.key === key && !current.failed) return;

  // Нужен initData (SDK → URL hash → sessionStorage). В проде без него смысла нет.
  const initData = resolveTelegramInitData();
  if (!initData && !isDev) return;

  // Если ранее был пред-сабмит для этих же ответов и он упал — переиспользуем
  // тот же clientSubmissionId (сервер идемпотентен, не создаст дубль профиля).
  const clientSubmissionId =
    current && current.key === key
      ? current.clientSubmissionId
      : generateClientSubmissionId(questionnaireId);

  const entry: PrewarmEntry = {
    key,
    clientSubmissionId,
    failed: false,
    promise: requestSubmitWithRetry({
      questionnaireId,
      answers: answerArray,
      clientSubmissionId,
    }),
  };

  // Глотаем ошибку, чтобы не было unhandled rejection; помечаем failed —
  // по клику submitAnswers сделает обычный запрос (с тем же clientSubmissionId).
  entry.promise.catch((err) => {
    entry.failed = true;
    clientLogger.warn('⚠️ prewarm submit failed (фолбэк на клике)', { message: err?.message });
  });

  current = entry;
  clientLogger.log('🔥 prewarm submit запущен');
}

/**
 * Получить пред-сабмит для текущих ответов (для submitAnswers по клику).
 * Возвращает clientSubmissionId всегда (для идемпотентного фолбэка) и promise,
 * если пред-сабмит ещё валиден (не упал).
 */
export function getPrewarmSubmit(
  questionnaireId: number,
  answers: Record<number, string | string[]>,
): { clientSubmissionId: string; promise: Promise<SubmitAnswersResponse> | null } | null {
  if (!current) return null;
  if (current.key !== answersKey(questionnaireId, answers)) return null;
  return {
    clientSubmissionId: current.clientSubmissionId,
    promise: current.failed ? null : current.promise,
  };
}

export function clearPrewarmSubmit(): void {
  current = null;
}
