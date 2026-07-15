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

const STEP_CONTENT: Record<PlanGenerationStep, { caption: string }> = {
  saving_answers: {
    caption: 'Фиксируем анкету и готовим профиль кожи.',
  },
  building_recommendations: {
    caption: 'Учитываем цели, особенности и ограничения.',
  },
  generating_plan: {
    caption: 'Подбираем последовательность средств и частоту применения.',
  },
  loading_plan: {
    caption: 'Финально сверяем шаги перед показом результата.',
  },
  done: {
    caption: 'Сейчас откроем персональные рекомендации.',
  },
  error: {
    caption: 'Можно вернуться к анкете и попробовать ещё раз.',
  },
};

const TIMELINE_STEPS: Array<{ id: Exclude<PlanGenerationStep, 'done' | 'error'>; label: string }> = [
  { id: 'saving_answers', label: 'Сохраняем ответы' },
  { id: 'building_recommendations', label: 'Анализируем кожу' },
  { id: 'generating_plan', label: 'Собираем план ухода' },
  { id: 'loading_plan', label: 'Проверяем рекомендации' },
];

const MARQUEE_TEXT = 'Персональный уход · 28 дней · Утро и вечер · Под ваш тип кожи · ';

export function PlanGenerationLoader({
  step,
  progress,
  error,
  onBackToQuiz,
}: PlanGenerationLoaderProps) {
  const isError = step === 'error';
  const isDone = step === 'done';
  const safeProgress = isError ? 0 : Math.max(0, Math.min(100, progress));
  const roundedProgress = Math.round(safeProgress);
  const activeIndex = isDone
    ? TIMELINE_STEPS.length
    : Math.max(0, TIMELINE_STEPS.findIndex((item) => item.id === step));
  const stepNumber = Math.min(activeIndex + 1, TIMELINE_STEPS.length);
  const caption = isError && error ? error : STEP_CONTENT[step].caption;

  return (
    <main className={`plan-loader${isError ? ' is-error' : ''}`}>
      <section className="plan-loader__content" aria-live="polite">
        <div className="plan-loader__top">
          <div className="plan-loader__head">
            <span className="plan-loader__index">
              {isError ? (
                'ГЕНЕРАЦИЯ ОСТАНОВЛЕНА'
              ) : (
                <>
                  ШАГ{' '}
                  <span className="plan-loader__index-num">
                    {String(stepNumber).padStart(2, '0')}
                  </span>{' '}
                  <em>/ 0{TIMELINE_STEPS.length}</em>
                </>
              )}
            </span>
            <span className="plan-loader__index plan-loader__index--muted">
              <em>skiniq</em>
            </span>
          </div>

          <div className="plan-loader__pct" aria-hidden="true">
            <span className="plan-loader__pct-value">
              {isError ? '!' : roundedProgress}
            </span>
            {!isError && <span className="plan-loader__pct-unit">%</span>}
          </div>

          <div
            className="plan-loader__rule"
            style={{ '--p': `${isError ? 0 : safeProgress}%` } as CSSProperties}
          />

          <ol className="plan-loader__steps">
            {TIMELINE_STEPS.map((item, index) => {
              const state = isDone || index < activeIndex
                ? 'done'
                : index === activeIndex && !isError
                  ? 'now'
                  : 'next';
              return (
                <li key={item.id} className={`plan-loader__step is-${state}`}>
                  <span className="plan-loader__step-num">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <span className="plan-loader__step-txt">{item.label}</span>
                  {state === 'done' && <span className="plan-loader__step-tick">✓</span>}
                  {state === 'now' && <span className="plan-loader__step-dot" />}
                </li>
              );
            })}
          </ol>
        </div>

        <div className="plan-loader__foot">
          <p className="plan-loader__caption">{caption}</p>

          {isError ? (
            <button type="button" className="plan-loader__button" onClick={onBackToQuiz}>
              Вернуться к анкете
            </button>
          ) : (
            <div className="plan-loader__marquee" aria-hidden="true">
              <span className="plan-loader__marquee-inner">
                {MARQUEE_TEXT}
                {MARQUEE_TEXT}
              </span>
            </div>
          )}
        </div>
      </section>

      <style jsx>{`
        .plan-loader {
          min-height: 100vh;
          width: 100%;
          display: flex;
          align-items: stretch;
          justify-content: center;
          box-sizing: border-box;
          padding: calc(56px + env(safe-area-inset-top, 0px)) 30px
            calc(40px + env(safe-area-inset-bottom, 0px));
          background: var(--canvas-white);
          color: var(--ink);
          font-family: var(--font-inter), -apple-system, BlinkMacSystemFont, sans-serif;
        }

        .plan-loader__content {
          width: 100%;
          max-width: 430px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
        }

        /* ── Head row ────────────────────────────────────── */
        .plan-loader__head {
          display: flex;
          align-items: baseline;
          justify-content: space-between;
          gap: 12px;
        }

        .plan-loader__index {
          font-family: var(--font-unbounded), -apple-system, BlinkMacSystemFont, sans-serif;
          font-size: 12px;
          font-weight: 600;
          letter-spacing: 0.06em;
          color: var(--ink);
        }

        .plan-loader__index--muted {
          text-align: right;
        }

        .plan-loader__index em {
          font-style: normal;
          color: var(--ink-mute);
        }

        .plan-loader__index-num {
          font-variant-numeric: tabular-nums;
        }

        /* ── Big percent ─────────────────────────────────── */
        .plan-loader__pct {
          display: flex;
          align-items: flex-start;
          margin: 6px 0 0 -6px;
          line-height: 0.9;
        }

        .plan-loader__pct-value {
          font-family: var(--font-unbounded), -apple-system, BlinkMacSystemFont, sans-serif;
          font-size: 116px;
          font-weight: 700;
          letter-spacing: -0.045em;
          font-variant-numeric: tabular-nums;
          color: var(--ink);
        }

        .plan-loader__pct-unit {
          margin-top: 14px;
          margin-left: 4px;
          font-family: var(--font-unbounded), -apple-system, BlinkMacSystemFont, sans-serif;
          font-size: 28px;
          font-weight: 700;
          color: transparent;
          -webkit-text-stroke: 1.5px var(--ink);
        }

        /* ── Progress rule ───────────────────────────────── */
        .plan-loader__rule {
          position: relative;
          width: 100%;
          height: 1px;
          margin: 18px 0 24px;
          background: rgba(var(--ink-rgb), 0.12);
        }

        .plan-loader__rule::after {
          content: '';
          position: absolute;
          left: 0;
          top: -1.5px;
          height: 4px;
          width: var(--p, 0%);
          background: var(--accent);
          box-shadow: inset 0 0 0 1px rgba(var(--ink-rgb), 0.35);
          transition: width 0.6s cubic-bezier(0.22, 1, 0.36, 1);
        }

        /* ── Steps checklist ─────────────────────────────── */
        .plan-loader__steps {
          list-style: none;
          margin: 0;
          padding: 0;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .plan-loader__step {
          display: flex;
          align-items: center;
          gap: 12px;
          font-size: 16px;
          font-weight: 500;
          transition: color 0.4s ease;
        }

        .plan-loader__step-num {
          font-family: var(--font-unbounded), -apple-system, BlinkMacSystemFont, sans-serif;
          font-size: 11px;
          font-weight: 600;
          width: 22px;
          flex-shrink: 0;
          color: var(--ink-mute);
        }

        .plan-loader__step-txt {
          position: relative;
        }

        .plan-loader__step-txt::after {
          content: '';
          position: absolute;
          left: 0;
          top: 55%;
          height: 1.5px;
          width: 0;
          background: var(--ink);
          transition: width 0.45s cubic-bezier(0.22, 1, 0.36, 1);
        }

        .plan-loader__step.is-done {
          color: var(--ink-mute);
        }

        .plan-loader__step.is-done .plan-loader__step-txt::after {
          width: 100%;
        }

        .plan-loader__step.is-now .plan-loader__step-txt {
          padding: 1px 5px;
          margin: -1px -5px;
          background: var(--accent);
          border-radius: 3px;
        }

        .plan-loader__step.is-next {
          color: rgba(var(--ink-rgb), 0.35);
        }

        .plan-loader__step-tick {
          margin-left: auto;
          font-size: 13px;
          font-weight: 700;
          color: var(--ink-mute);
        }

        .plan-loader__step-dot {
          margin-left: auto;
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: var(--ink);
          animation: plan-loader-pulse 1.1s ease-in-out infinite;
        }

        /* ── Foot ────────────────────────────────────────── */
        .plan-loader__foot {
          margin-top: 32px;
        }

        .plan-loader__caption {
          margin: 0;
          min-height: 42px;
          color: var(--ink-soft);
          font-size: 14.5px;
          line-height: 1.45;
        }

        .plan-loader__marquee {
          margin-top: 18px;
          width: 100%;
          overflow: hidden;
          padding-top: 13px;
          border-top: 1px solid rgba(var(--ink-rgb), 0.1);
          white-space: nowrap;
          -webkit-mask: linear-gradient(90deg, transparent, #000 8%, #000 92%, transparent);
          mask: linear-gradient(90deg, transparent, #000 8%, #000 92%, transparent);
        }

        .plan-loader__marquee-inner {
          display: inline-block;
          font-family: var(--font-unbounded), -apple-system, BlinkMacSystemFont, sans-serif;
          font-size: 10px;
          font-weight: 500;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: var(--ink-mute);
          animation: plan-loader-marquee 16s linear infinite;
        }

        .plan-loader__button {
          width: 100%;
          min-height: 52px;
          margin-top: 20px;
          border: 0;
          border-radius: 999px;
          background: var(--ink);
          color: var(--canvas-white);
          cursor: pointer;
          font: 700 16px/1 var(--font-inter), -apple-system, BlinkMacSystemFont, sans-serif;
        }

        /* ── Error ───────────────────────────────────────── */
        .plan-loader.is-error .plan-loader__pct-value {
          color: #b42318;
        }

        .plan-loader.is-error .plan-loader__pct-unit {
          -webkit-text-stroke-color: #b42318;
        }

        @keyframes plan-loader-pulse {
          50% {
            opacity: 0.25;
            transform: scale(0.7);
          }
        }

        @keyframes plan-loader-marquee {
          to {
            transform: translateX(-50%);
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .plan-loader__marquee-inner,
          .plan-loader__step-dot {
            animation: none;
          }
          .plan-loader__rule::after,
          .plan-loader__step-txt::after {
            transition: none;
          }
        }

        @media (max-width: 360px) {
          .plan-loader {
            padding-left: 22px;
            padding-right: 22px;
          }
          .plan-loader__pct-value {
            font-size: 96px;
          }
          .plan-loader__step {
            font-size: 15px;
          }
        }

        @media (max-height: 700px) {
          .plan-loader__pct-value {
            font-size: 92px;
          }
          .plan-loader__steps {
            gap: 13px;
          }
        }
      `}</style>
    </main>
  );
}
