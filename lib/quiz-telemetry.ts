// lib/quiz-telemetry.ts
// Поэкранная телеметрия анкеты: фиксирует факт показа каждого инфо-экрана и вопроса.
//
// Зачем отдельный модуль, а не clientLogger: в проде clientLogger отсекает всё,
// кроме level==='error' (см. sendLogFetch в lib/client-logger.ts), плюс троттлит
// до 1 сообщения в секунду с дедупом на 60 секунд. Для пошаговой воронки это
// непригодно — события идут пачками при быстрой навигации. Поэтому шлём напрямую
// в /api/logs тем же способом, что Web Vitals и startup timing (единственные
// info-маяки, реально доходящие до прода).
//
// Зачем это вообще: questionnaire_progress хранит ОДИН текущий индекс и
// перезаписывает его, поэтому «на каком шаге отвалился» из него не достать.
// Здесь пишем по событию на шаг, и воронка считается агрегацией.
//
// ВАЖНО (ПДн): url сюда намеренно не кладём. В Telegram window.location.href
// содержит tgWebAppData с именем/username пользователя, и такие URL уже оседают
// в client_logs от других маяков. Новых источников ПДн не добавляем.

/** Сообщение и тип вынесены, чтобы аналитические скрипты не расходились с клиентом. */
export const QUIZ_STEP_MESSAGE = 'Quiz step view';
export const QUIZ_STEP_TYPE = 'quiz_step';

export type QuizStepKind = 'info' | 'question';

export interface QuizStepView {
  kind: QuizStepKind;
  /** id инфо-экрана или code вопроса */
  id: string;
  /** порядковый номер внутри своей последовательности, если известен */
  index?: number;
}

// Дедуп в рамках одной загрузки страницы: перерендеры и возврат «назад»
// не должны раздувать счётчики. Для воронки нас интересует факт «шаг увиден».
const seen = new Set<string>();

export function trackQuizStep(step: QuizStepView): void {
  if (typeof window === 'undefined') return;

  const key = `${step.kind}:${step.id}`;
  if (seen.has(key)) return;
  seen.add(key);

  try {
    const initData = window.Telegram?.WebApp?.initData || null;

    void fetch('/api/logs', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(initData ? { 'X-Telegram-Init-Data': initData } : {}),
      },
      body: JSON.stringify({
        level: 'info',
        message: QUIZ_STEP_MESSAGE,
        context: {
          type: QUIZ_STEP_TYPE,
          kind: step.kind,
          id: step.id,
          ...(typeof step.index === 'number' ? { index: step.index } : {}),
        },
      }),
      // keepalive — ключевой момент: последний экран перед уходом пользователя
      // это ровно точка отвала, и запрос должен пережить закрытие вкладки.
      keepalive: true,
    }).catch(() => {
      // Телеметрия не должна ломать анкету — молча проглатываем.
    });
  } catch {
    // Тоже молча: любая ошибка отправки не влияет на продукт.
  }
}

/** Для тестов: сбрасывает дедуп-состояние. */
export function __resetQuizTelemetryForTests(): void {
  seen.clear();
}
