// components/quiz/screens/NoMistakesScreen.tsx
// Финальный продающий экран перед закрывающей последовательностью квиза
// («Ваш SkinIQ-план почти готов»).
//
// Стиль выровнен с остальными инфо-экранами анкеты (PersonalAnalysisScreen и др.):
// заголовок слева (Unbounded), фон back11 без скрима. Прогресс «План формируется» —
// чёрная карточка с лаймовым пятном (как CTA на ImproveSkinScreen), бар и цифра
// анимируются 0 → 99% с ease-out, по заполненной части ходит блик.

import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import { BackButtonFixed } from '@/components/BackButtonFixed';
import { FixedContinueButton } from '../buttons/FixedContinueButton';
import type { InfoScreen } from '@/app/(miniapp)/quiz/info-screens';

export interface NoMistakesScreenProps {
  screen: InfoScreen;
  currentInfoScreenIndex: number;
  onContinue: () => void;
  onBack?: () => void;
  isHandlingNext?: boolean;
}

const PLAN_BENEFITS: Array<{ title: string; desc: string }> = [
  { title: 'Средства под ваш тип кожи', desc: 'Подбор с учётом чувствительности и проблем' },
  { title: 'Цели и бюджет', desc: 'Только то, что нужно — без переплат' },
  { title: 'Понятная схема по шагам', desc: 'Что и когда наносить' },
];

const PLAN_PROGRESS = 99;
const PLAN_PROGRESS_DURATION_MS = 1400;

const TITLE_FONT =
  "var(--font-unbounded), 'Unbounded', -apple-system, BlinkMacSystemFont, sans-serif";

function CheckIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="var(--ink)"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function NoMistakesScreenComponent({
  screen,
  currentInfoScreenIndex,
  onContinue,
  onBack,
  isHandlingNext = false,
}: NoMistakesScreenProps) {
  const shouldShowBackButton = currentInfoScreenIndex > 0 && !!onBack;

  // Анимация прогресса: бар и цифра разгоняются 0 → 99 с ease-out при появлении.
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min((now - start) / PLAN_PROGRESS_DURATION_MS, 1);
      const eased = 1 - Math.pow(1 - t, 3); // cubic ease-out
      setProgress(Math.round(eased * PLAN_PROGRESS));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
  const handleBackWithScroll = () => {
    const scrollTop =
      window.pageYOffset ||
      document.documentElement.scrollTop ||
      document.body.scrollTop ||
      0;
    const scrollLeft =
      window.pageXOffset ||
      document.documentElement.scrollLeft ||
      document.body.scrollLeft ||
      0;
    onBack?.();
    setTimeout(() => window.scrollTo(scrollLeft, scrollTop), 0);
  };

  return (
    <>
      <BackButtonFixed show={shouldShowBackButton} onClick={handleBackWithScroll} />
      <div
        className="qz-mobile-fullscreen"
        style={{
          position: 'fixed',
          inset: 0,
          width: '100%',
          overflow: 'hidden',
          backgroundColor: 'var(--canvas)',
          fontFamily: "var(--font-inter), 'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
          color: 'var(--ink)',
        }}
      >
        {/* Текстура back11 */}
        <Image
          className="qz-fullscreen-bg"
          src="/back11.jpg"
          alt=""
          aria-hidden
          fill
          quality={90}
          sizes="100vw"
          style={{ objectPosition: 'center', pointerEvents: 'none' }}
        />
        <div
          className="animate-fade-in"
          style={{
            position: 'relative',
            zIndex: 2,
            width: '100%',
            height: '100%',
            maxWidth: '420px',
            margin: '0 auto',
            padding:
              'calc(64px + env(safe-area-inset-top, 0px)) 20px var(--quiz-fixed-cta-clearance, calc(96px + env(safe-area-inset-bottom, 0px)))',
            boxSizing: 'border-box',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            overflowY: 'auto',
            WebkitOverflowScrolling: 'touch',
          }}
        >
          {/* HEADER — слева, как на остальных инфо-экранах */}
          <h1
            style={{
              fontFamily: TITLE_FONT,
              fontWeight: 700,
              fontSize: '25px',
              lineHeight: '115%',
              letterSpacing: '-0.6px',
              textAlign: 'left',
              margin: '0 0 20px 4px',
              color: 'var(--ink)',
            }}
          >
            {screen.title}
          </h1>
          {screen.subtitle && (
            <p
              style={{
                fontSize: '14px',
                fontWeight: 400,
                lineHeight: 1.5,
                color: '#4B5563',
                margin: '0 0 20px 4px',
              }}
            >
              {screen.subtitle}
            </p>
          )}

          {/* CARD 1 — прогресс «План формируется»: чёрная карточка с лаймовым
              пятном, как CTA-блок на финальном экране (ImproveSkinScreen) */}
          <div
            style={{
              position: 'relative',
              overflow: 'hidden',
              background: 'rgba(var(--ink-rgb),0.92)',
              borderRadius: '22px',
              padding: '18px 20px',
              marginBottom: '14px',
              boxShadow: '0 14px 36px rgba(0,0,0,0.18)',
              color: 'var(--canvas-white)',
            }}
          >
            <div
              aria-hidden
              style={{
                position: 'absolute',
                top: -40,
                right: -30,
                width: 140,
                height: 140,
                borderRadius: '50%',
                background:
                  'radial-gradient(circle, rgba(var(--accent-rgb),0.45) 0%, transparent 70%)',
                pointerEvents: 'none',
              }}
            />
            <div
              style={{
                position: 'relative',
                display: 'flex',
                alignItems: 'baseline',
                justifyContent: 'space-between',
                marginBottom: 12,
              }}
            >
              <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--canvas-white)' }}>
                План формируется
              </span>
              <span
                style={{
                  fontFamily: TITLE_FONT,
                  fontSize: 18,
                  fontWeight: 700,
                  letterSpacing: '-0.5px',
                  color: 'var(--canvas-white)',
                }}
              >
                {progress}<span style={{ fontSize: 12, color: 'rgba(var(--canvas-white-rgb),0.6)' }}>%</span>
              </span>
            </div>
            <div
              style={{
                position: 'relative',
                height: 8,
                borderRadius: 999,
                background: 'rgba(var(--canvas-white-rgb),0.16)',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  position: 'relative',
                  width: `${progress}%`,
                  height: '100%',
                  borderRadius: 999,
                  background: 'var(--accent)',
                  boxShadow: '0 1px 6px rgba(var(--accent-rgb),0.5)',
                  overflow: 'hidden',
                }}
              >
                {/* Бегущий блик по заполненной части */}
                <div
                  aria-hidden
                  style={{
                    position: 'absolute',
                    inset: 0,
                    background:
                      'linear-gradient(105deg, transparent 30%, rgba(255,255,255,0.65) 50%, transparent 70%)',
                    animation: 'qzPlanBarSheen 2.2s ease-in-out 0.9s infinite',
                  }}
                />
              </div>
            </div>
            <style>{`
              @keyframes qzPlanBarSheen {
                0% { transform: translateX(-100%); }
                55% { transform: translateX(100%); }
                100% { transform: translateX(100%); }
              }
              @media (prefers-reduced-motion: reduce) {
                [style*="qzPlanBarSheen"] { animation: none !important; }
              }
            `}</style>
          </div>

          {/* CARD 2 — «В вашем плане»: чек-лист в стиле PersonalAnalysisScreen */}
          <div
            style={{
              background: 'var(--glass-bg)',
              backdropFilter: 'blur(28px) saturate(160%)',
              WebkitBackdropFilter: 'blur(28px) saturate(160%)',
              border: '1px solid var(--glass-border)',
              borderRadius: '22px',
              padding: '20px 22px 22px',
              boxShadow: '0 10px 32px rgba(0,0,0,0.06)',
            }}
          >
            <h2
              style={{
                fontFamily: TITLE_FONT,
                fontWeight: 700,
                fontSize: '16px',
                lineHeight: 1.2,
                letterSpacing: '-0.3px',
                color: 'var(--ink)',
                margin: '0 0 16px 0',
              }}
            >
              В вашем плане
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {PLAN_BENEFITS.map((item) => (
                <div
                  key={item.title}
                  style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}
                >
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      flexShrink: 0,
                      marginTop: 1,
                      borderRadius: '50%',
                      background: 'var(--accent)',
                      border: '1px solid rgba(0,0,0,0.08)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: '0 2px 6px rgba(var(--accent-rgb),0.4)',
                    }}
                  >
                    <CheckIcon />
                  </div>
                  <div>
                    <div
                      style={{
                        fontSize: 15,
                        fontWeight: 700,
                        lineHeight: 1.25,
                        letterSpacing: '-0.2px',
                        color: 'var(--ink)',
                        marginBottom: 3,
                      }}
                    >
                      {item.title}
                    </div>
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 500,
                        lineHeight: 1.45,
                        color: '#4B5563',
                      }}
                    >
                      {item.desc}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>

        <FixedContinueButton
          ctaText={screen.ctaText || 'Завершить анализ'}
          onClick={onContinue}
          disabled={isHandlingNext}
        />
      </div>
    </>
  );
}

export const NoMistakesScreen = React.memo(NoMistakesScreenComponent);
