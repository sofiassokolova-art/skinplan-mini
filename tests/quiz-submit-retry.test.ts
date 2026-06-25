import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  submitAnswers: vi.fn(),
  log: vi.fn(),
  warn: vi.fn(),
}));

vi.mock('@/lib/api', () => ({
  api: {
    submitAnswers: (...args: any[]) => mocks.submitAnswers(...args),
  },
}));

vi.mock('@/lib/client-logger', () => ({
  clientLogger: {
    log: (...args: any[]) => mocks.log(...args),
    warn: (...args: any[]) => mocks.warn(...args),
  },
}));

import { requestSubmitWithRetry } from '@/lib/quiz/handlers/submitAnswersCore';

describe('requestSubmitWithRetry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(globalThis, 'setTimeout').mockImplementation((callback: any) => {
      callback();
      return 0 as any;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('waits and retries when submit is rate limited', async () => {
    const rateLimitError = Object.assign(new Error('Слишком много запросов'), {
      status: 429,
      retryAfter: 3,
    });

    mocks.submitAnswers
      .mockRejectedValueOnce(rateLimitError)
      .mockResolvedValueOnce({
        success: true,
        profile: { id: 'profile-1' },
      });

    const result = await requestSubmitWithRetry({
      questionnaireId: 18,
      answers: [{ questionId: 1, answerValue: 'answer' }],
      clientSubmissionId: 'submission-1',
    });

    expect(result).toEqual({ success: true, profile: { id: 'profile-1' } });
    expect(mocks.submitAnswers).toHaveBeenCalledTimes(2);
    expect(globalThis.setTimeout).toHaveBeenCalledWith(expect.any(Function), 3250);
  });

  it('uses slower polling while the server is still processing the submission', async () => {
    mocks.submitAnswers
      .mockResolvedValueOnce({
        success: false,
        status: 'processing',
        retryAfterMs: 1000,
      })
      .mockResolvedValueOnce({
        success: true,
        profile: { id: 'profile-1' },
      });

    await requestSubmitWithRetry({
      questionnaireId: 18,
      answers: [{ questionId: 1, answerValue: 'answer' }],
      clientSubmissionId: 'submission-1',
    });

    expect(mocks.submitAnswers).toHaveBeenCalledTimes(2);
    expect(globalThis.setTimeout).toHaveBeenCalledWith(expect.any(Function), 2000);
  });
});
