import { describe, expect, it, vi } from 'vitest';
import { createQuizProgressSaveQueue } from '@/lib/quiz/progress-save-queue';

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

describe('createQuizProgressSaveQueue', () => {
  it('сохраняет ответы последовательно и схлопывает ожидающие изменения вопроса', async () => {
    const first = deferred();
    const save = vi.fn()
      .mockImplementationOnce(() => first.promise)
      .mockResolvedValue(undefined);
    const queue = createQuizProgressSaveQueue(save);

    queue.enqueue({ questionnaireId: 1, questionId: 10, answerValue: 'first' });
    queue.enqueue({ questionnaireId: 1, questionId: 11, answerValue: 'old' });
    queue.enqueue({ questionnaireId: 1, questionId: 11, answerValue: 'latest' });

    expect(save).toHaveBeenCalledTimes(1);
    first.resolve();
    await queue.flush();

    expect(save).toHaveBeenCalledTimes(2);
    expect(save.mock.calls[1][0]).toMatchObject({
      questionId: 11,
      answerValue: 'latest',
    });
  });

  it('схлопывает ожидающие метаданные позиции до последнего перехода', async () => {
    const first = deferred();
    const save = vi.fn()
      .mockImplementationOnce(() => first.promise)
      .mockResolvedValue(undefined);
    const queue = createQuizProgressSaveQueue(save);

    queue.enqueue({ questionnaireId: 1, questionId: 10, answerValue: 'answer' });
    queue.enqueue({ questionnaireId: 1, questionId: -1, questionIndex: 1, infoScreenIndex: 2 });
    queue.enqueue({ questionnaireId: 1, questionId: -1, questionIndex: 3, infoScreenIndex: 4 });

    first.resolve();
    await queue.flush();

    expect(save).toHaveBeenCalledTimes(2);
    expect(save.mock.calls[1][0]).toMatchObject({
      questionId: -1,
      questionIndex: 3,
      infoScreenIndex: 4,
    });
  });

  it('продолжает очередь после ошибки фонового сохранения', async () => {
    const onError = vi.fn();
    const save = vi.fn()
      .mockRejectedValueOnce(new Error('network unavailable'))
      .mockResolvedValue(undefined);
    const queue = createQuizProgressSaveQueue(save, { onError });

    queue.enqueue({ questionnaireId: 1, questionId: 10, answerValue: 'first' });
    queue.enqueue({ questionnaireId: 1, questionId: 11, answerValue: 'second' });
    await queue.flush();

    expect(onError).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledTimes(2);
  });
});
