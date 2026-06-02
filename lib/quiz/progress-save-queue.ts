export interface QuizProgressSaveParams {
  questionnaireId: number;
  questionId: number;
  answerValue?: string;
  answerValues?: string[];
  questionIndex?: number;
  infoScreenIndex?: number;
}

interface QuizProgressSaveQueueOptions {
  onError?: (error: unknown, params: QuizProgressSaveParams) => void;
}

function getSaveKey(params: QuizProgressSaveParams): string {
  return params.questionId === -1 ? 'metadata' : `answer:${params.questionId}`;
}

/**
 * Keeps quiz persistence off the interaction path while preserving request order.
 * Pending writes for the same answer or metadata row collapse to the latest value.
 */
export function createQuizProgressSaveQueue(
  save: (params: QuizProgressSaveParams) => Promise<unknown>,
  options: QuizProgressSaveQueueOptions = {},
) {
  const pending = new Map<string, QuizProgressSaveParams>();
  let flushPromise: Promise<void> | null = null;

  const flush = (): Promise<void> => {
    if (flushPromise) return flushPromise;

    flushPromise = (async () => {
      while (pending.size > 0) {
        const next = pending.entries().next().value as
          | [string, QuizProgressSaveParams]
          | undefined;
        if (!next) break;

        const [key, params] = next;
        pending.delete(key);

        try {
          await save(params);
        } catch (error) {
          options.onError?.(error, params);
        }
      }
    })().finally(() => {
      flushPromise = null;
      if (pending.size > 0) {
        void flush();
      }
    });

    return flushPromise;
  };

  return {
    enqueue(params: QuizProgressSaveParams): void {
      pending.set(getSaveKey(params), params);
      void flush();
    },
    flush,
    getPendingCount(): number {
      return pending.size;
    },
  };
}
