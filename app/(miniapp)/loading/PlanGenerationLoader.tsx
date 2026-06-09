'use client';

import type { CSSProperties } from 'react';

export type PlanGenerationStep =
  | 'saving_answers'
  | 'building_recommendations'
  | 'generating_plan'
  | 'loading_plan'
  | 'done'
  | 'error';

interface PlanGenerationLoaderProps {
  step: PlanGenerationStep;
  progress: number;
  error?: string | null;
  onBackToQuiz: () => void;
}

const STEP_CONTENT: Record<PlanGenerationStep, { title: string; caption: string }> = {
  saving_answers: {
    title: 'Сохраняем ответы',
    caption: 'Фиксируем анкету и готовим профиль кожи.',
  },
  building_recommendations: {
    title: 'Анализируем кожу',
    caption: 'Учитываем цели, особенности и ограничения.',
  },
  generating_plan: {
    title: 'Собираем план ухода',
    caption: 'Подбираем последовательность средств и частоту применения.',
  },
  loading_plan: {
    title: 'Проверяем рекомендации',
    caption: 'Финально сверяем шаги перед показом результата.',
  },
  done: {
    title: 'План готов',
    caption: 'Сейчас откроем персональные рекомендации.',
  },
  error: {
    title: 'Не получилось собрать план',
    caption: 'Можно вернуться к анкете и попробовать ещё раз.',
  },
};

const TIMELINE_STEPS: Array<Exclude<PlanGenerationStep, 'done' | 'error'>> = [
  'saving_answers',
  'building_recommendations',
  'generating_plan',
  'loading_plan',
];

export function PlanGenerationLoader({
  step,
  progress,
  error,
  onBackToQuiz,
}: PlanGenerationLoaderProps) {
  const isError = step === 'error';
  const isDone = step === 'done';
  const safeProgress = isError ? 0 : Math.max(0, Math.min(100, progress));
  const content = STEP_CONTENT[step];
  const activeIndex = isDone
    ? TIMELINE_STEPS.length
    : Math.max(0, TIMELINE_STEPS.findIndex((id) => id === step));

  return (
    <main className={`plan-loader${isError ? ' is-error' : ''}${isDone ? ' is-done' : ''}`}>
      <section className="plan-loader__content" aria-live="polite">
        <div
          className="plan-loader__ring"
          style={{ '--ring-progress': isError ? 100 : safeProgress } as CSSProperties}
          aria-hidden="true"
        >
          <span className="plan-loader__arc" />
          <span className="plan-loader__sheen" />
          <span className="plan-loader__track" />
          {!isError && <span className="plan-loader__cap" />}
          <div className="plan-loader__center">
            {isError ? (
              <span className="plan-loader__center-mark">!</span>
            ) : (
              <span className="plan-loader__center-row">
                <span className="plan-loader__center-value">{Math.round(safeProgress)}</span>
                <span className="plan-loader__center-unit">%</span>
              </span>
            )}
          </div>
        </div>

        <p className="plan-loader__eyebrow">
          {isError ? 'Генерация остановлена' : 'Персональный план'}
        </p>
        <h1 className="plan-loader__title">{content.title}</h1>
        <p className="plan-loader__caption">
          {isError && error ? error : content.caption}
        </p>

        {!isError && (
          <div className="plan-loader__dots" aria-hidden="true">
            {TIMELINE_STEPS.map((id, index) => {
              const state = index < activeIndex || isDone
                ? 'complete'
                : index === activeIndex
                  ? 'current'
                  : 'pending';
              return <span key={id} className={`plan-loader__dot is-${state}`} />;
            })}
          </div>
        )}

        {isError && (
          <button type="button" className="plan-loader__button" onClick={onBackToQuiz}>
            Вернуться к анкете
          </button>
        )}
      </section>

      <style jsx>{`
        @property --ring-progress {
          syntax: '<number>';
          initial-value: 0;
          inherits: false;
        }

        .plan-loader {
          min-height: 100vh;
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          box-sizing: border-box;
          padding: calc(44px + env(safe-area-inset-top, 0px)) 24px
            calc(32px + env(safe-area-inset-bottom, 0px));
          background: var(--canvas-white);
          color: var(--ink);
          font-family: var(--font-inter), -apple-system, BlinkMacSystemFont, sans-serif;
        }

        .plan-loader__content {
          width: 100%;
          max-width: 430px;
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
        }

        /* ── Ring ────────────────────────────────────────── */
        .plan-loader__ring {
          --size: 208px;
          --stroke: 12px;
          position: relative;
          width: var(--size);
          height: var(--size);
          margin-bottom: 36px;
          transition: --ring-progress 0.6s cubic-bezier(0.22, 1, 0.36, 1);
        }

        .plan-loader__arc {
          position: absolute;
          inset: 0;
          border-radius: 50%;
          background: conic-gradient(
            var(--accent) calc(var(--ring-progress) * 1%),
            rgba(var(--ink-rgb), 0.07) 0
          );
          -webkit-mask: radial-gradient(
            farthest-side,
            transparent calc(100% - var(--stroke)),
            #000 calc(100% - var(--stroke) + 1px)
          );
          mask: radial-gradient(
            farthest-side,
            transparent calc(100% - var(--stroke)),
            #000 calc(100% - var(--stroke) + 1px)
          );
        }

        /* thin ink outline so the lime arc keeps definition on white */
        .plan-loader__track {
          position: absolute;
          inset: 0;
          border-radius: 50%;
          box-shadow: inset 0 0 0 1px rgba(var(--ink-rgb), 0.06);
          pointer-events: none;
        }

        /* slow rotating highlight to keep the ring feeling alive */
        .plan-loader__sheen {
          position: absolute;
          inset: calc(-1 * var(--stroke) - 6px);
          border-radius: 50%;
          background: conic-gradient(
            from 0deg,
            transparent 0deg,
            rgba(var(--accent-rgb), 0.35) 40deg,
            transparent 90deg
          );
          -webkit-mask: radial-gradient(
            farthest-side,
            transparent calc(100% - var(--stroke) - 6px),
            #000 calc(100% - var(--stroke) - 5px)
          );
          mask: radial-gradient(
            farthest-side,
            transparent calc(100% - var(--stroke) - 6px),
            #000 calc(100% - var(--stroke) - 5px)
          );
          opacity: 0.7;
          animation: plan-loader-spin 3.2s linear infinite;
        }

        /* lime cap riding the leading edge of the arc */
        .plan-loader__cap {
          position: absolute;
          top: 0;
          left: 50%;
          width: var(--size);
          height: var(--size);
          margin-left: calc(var(--size) / -2);
          transform: rotate(calc(var(--ring-progress) * 3.6deg));
          transition: transform 0.6s cubic-bezier(0.22, 1, 0.36, 1);
          pointer-events: none;
        }

        .plan-loader__cap::before {
          content: '';
          position: absolute;
          top: calc(var(--stroke) / 2);
          left: 50%;
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: var(--accent);
          box-shadow: 0 0 0 4px var(--canvas-white), 0 0 10px rgba(var(--accent-rgb), 0.6);
          transform: translate(-50%, -50%);
        }

        .plan-loader__center {
          position: absolute;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .plan-loader__center-row {
          display: inline-flex;
          align-items: baseline;
          gap: 3px;
        }

        .plan-loader__center-value {
          font-family: var(--font-unbounded), -apple-system, BlinkMacSystemFont, sans-serif;
          font-size: 52px;
          font-weight: 700;
          line-height: 1;
          letter-spacing: -0.02em;
          color: var(--ink);
          font-variant-numeric: tabular-nums;
        }

        .plan-loader__center-unit {
          font-size: 18px;
          font-weight: 700;
          color: var(--ink-mute);
        }

        .plan-loader__center-mark {
          font-family: var(--font-unbounded), -apple-system, BlinkMacSystemFont, sans-serif;
          font-size: 48px;
          font-weight: 700;
          line-height: 1;
          color: #b42318;
        }

        /* ── Text ────────────────────────────────────────── */
        .plan-loader__eyebrow {
          margin: 0 0 12px;
          color: var(--ink-soft);
          font-size: 12px;
          font-weight: 700;
          line-height: 1;
          letter-spacing: 0.04em;
          text-transform: uppercase;
        }

        .plan-loader__title {
          margin: 0;
          color: var(--ink);
          font-family: var(--font-unbounded), -apple-system, BlinkMacSystemFont, sans-serif;
          font-size: 24px;
          font-weight: 700;
          line-height: 1.18;
          transition: opacity 0.3s ease;
        }

        .plan-loader__caption {
          max-width: 320px;
          margin: 12px 0 0;
          color: var(--ink-soft);
          font-size: 15px;
          line-height: 1.45;
        }

        /* ── Step dots ───────────────────────────────────── */
        .plan-loader__dots {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-top: 28px;
        }

        .plan-loader__dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: rgba(var(--ink-rgb), 0.14);
          transition: all 0.35s ease;
        }

        .plan-loader__dot.is-complete {
          background: var(--ink);
        }

        .plan-loader__dot.is-current {
          width: 26px;
          border-radius: 999px;
          background: var(--accent);
          box-shadow: inset 0 0 0 1px rgba(var(--ink-rgb), 0.12);
        }

        /* ── Error ───────────────────────────────────────── */
        .plan-loader.is-error .plan-loader__arc {
          background: conic-gradient(rgba(180, 35, 24, 0.2) 100%, rgba(180, 35, 24, 0.2) 0);
        }

        .plan-loader.is-error .plan-loader__sheen {
          display: none;
        }

        .plan-loader__button {
          width: 100%;
          max-width: 320px;
          min-height: 52px;
          margin-top: 28px;
          border: 0;
          border-radius: 999px;
          background: var(--ink);
          color: var(--canvas-white);
          cursor: pointer;
          font: 700 16px/1 var(--font-inter), -apple-system, BlinkMacSystemFont, sans-serif;
        }

        @keyframes plan-loader-spin {
          to {
            transform: rotate(360deg);
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .plan-loader__sheen {
            animation: none;
            opacity: 0;
          }
          .plan-loader__ring,
          .plan-loader__cap {
            transition: none;
          }
        }

        @media (max-width: 360px) {
          .plan-loader {
            padding-left: 18px;
            padding-right: 18px;
          }
          .plan-loader__ring {
            --size: 184px;
            margin-bottom: 30px;
          }
          .plan-loader__center-value {
            font-size: 46px;
          }
          .plan-loader__title {
            font-size: 21px;
          }
        }
      `}</style>
    </main>
  );
}
