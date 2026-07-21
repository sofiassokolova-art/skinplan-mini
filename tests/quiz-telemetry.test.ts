// tests/quiz-telemetry.test.ts
// Телеметрия воронки анкеты: проверяем ровно то, что легко сломать при рефакторинге —
// форму события (по ней считает scripts/quiz-funnel.ts), дедуп, keepalive
// и отсутствие URL в payload (в Telegram он содержит ПДн).

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  trackQuizStep,
  __resetQuizTelemetryForTests,
  QUIZ_STEP_MESSAGE,
  QUIZ_STEP_TYPE,
} from '@/lib/quiz-telemetry';

const fetchMock = vi.fn(() => Promise.resolve({ ok: true } as Response));

function lastBody() {
  const call = fetchMock.mock.calls.at(-1) as any[];
  return JSON.parse(call[1].body);
}

describe('quiz telemetry', () => {
  beforeEach(() => {
    __resetQuizTelemetryForTests();
    fetchMock.mockClear();
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('window', { Telegram: { WebApp: { initData: 'init-data-stub' } } });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('шлёт событие показа инфо-экрана в форме, которую ждёт агрегатор', () => {
    trackQuizStep({ kind: 'info', id: 'welcome', index: 0 });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as any[];
    expect(url).toBe('/api/logs');
    expect(init.method).toBe('POST');

    const body = lastBody();
    expect(body.level).toBe('info');
    expect(body.message).toBe(QUIZ_STEP_MESSAGE);
    expect(body.context).toMatchObject({
      type: QUIZ_STEP_TYPE,
      kind: 'info',
      id: 'welcome',
      index: 0,
    });
  });

  it('шлёт код вопроса для шагов-вопросов', () => {
    trackQuizStep({ kind: 'question', id: 'skin_goals', index: 3 });
    expect(lastBody().context).toMatchObject({ kind: 'question', id: 'skin_goals', index: 3 });
  });

  it('дедуплицирует повторные показы одного шага (перерендеры и возврат назад)', () => {
    trackQuizStep({ kind: 'info', id: 'welcome', index: 0 });
    trackQuizStep({ kind: 'info', id: 'welcome', index: 0 });
    trackQuizStep({ kind: 'info', id: 'welcome', index: 5 }); // тот же шаг, другой индекс

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('различает шаги с одинаковым id, но разного типа', () => {
    trackQuizStep({ kind: 'info', id: 'budget' });
    trackQuizStep({ kind: 'question', id: 'budget' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('ставит keepalive, чтобы последний экран перед уходом успел отправиться', () => {
    trackQuizStep({ kind: 'question', id: 'age' });
    const [, init] = fetchMock.mock.calls[0] as any[];
    expect(init.keepalive).toBe(true);
  });

  it('прокидывает initData для привязки события к пользователю', () => {
    trackQuizStep({ kind: 'question', id: 'age' });
    const [, init] = fetchMock.mock.calls[0] as any[];
    expect(init.headers['X-Telegram-Init-Data']).toBe('init-data-stub');
  });

  it('не кладёт url в payload — в Telegram он содержит ПДн', () => {
    trackQuizStep({ kind: 'info', id: 'welcome' });
    const body = lastBody();
    expect(body).not.toHaveProperty('url');
    expect(JSON.stringify(body)).not.toContain('tgWebAppData');
  });

  it('не роняет анкету, если отправка упала', () => {
    fetchMock.mockImplementationOnce(() => Promise.reject(new Error('network down')));
    expect(() => trackQuizStep({ kind: 'info', id: 'welcome' })).not.toThrow();
  });
});
