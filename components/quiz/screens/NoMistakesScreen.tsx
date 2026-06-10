// components/quiz/screens/NoMistakesScreen.tsx
// Финальный продающий экран перед закрывающей последовательностью квиза.

import React from 'react';
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

const PLAN_BENEFITS = [
  'Средства под ваш тип кожи',
  'Учитываем цели и бюджет',
  'Понятная схема ухода по шагам',
  'Без лишних трат и ненужных средств',
];

// Поверх текстуры back9 — мягкие цветовые пятна в стиле страницы плана (PlanPageV2)
// + лёгкий скрим для читаемости тёмного текста. Прозрачные участки пропускают текстуру,
// так экран «Ваш SkinIQ-план почти готов» рифмуется и с планом, и с остальными
// текстурными инфо-экранами анкеты.
const PLAN_BLOB_OVERLAY = `
  radial-gradient(68% 30% at 100% 0%, rgba(213,254,97,0.40) 0%, transparent 64%),
  radial-gradient(70% 30% at 0% 14%, rgba(255,224,188,0.52) 0%, transparent 62%),
  radial-gradient(62% 26% at 0% 86%, rgba(220,210,196,0.42) 0%, transparent 66%),
  radial-gradient(78% 32% at 100% 98%, rgba(213,254,97,0.42) 0%, transparent 60%),
  linear-gradient(rgba(244,242,238,0.42), rgba(244,242,238,0.58))
`;

function CheckIcon() {
  return (
    <svg
      width="15"
      height="15"
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

function SparkleIcon() {
  return (
    <svg
      width="27"
      height="27"
      viewBox="0 0 28 28"
      fill="none"
      stroke="var(--ink)"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M14 2.5c1.6 7 4.5 9.9 11.5 11.5-7 1.6-9.9 4.5-11.5 11.5C12.4 18.5 9.5 15.6 2.5 14 9.5 12.4 12.4 9.5 14 2.5Z" />
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
        {/* Текстура back9 */}
        <Image
          className="qz-fullscreen-bg"
          src="/back9.jpg"
          alt=""
          aria-hidden
          fill
          quality={90}
          sizes="100vw"
          style={{ objectPosition: 'center', pointerEvents: 'none' }}
        />
        {/* Бренд-пятна + скрим поверх текстуры */}
        <div
          aria-hidden
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 1,
            pointerEvents: 'none',
            background: PLAN_BLOB_OVERLAY,
          }}
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
              'calc(clamp(16px, 4vh, 32px) + 54px) 20px var(--quiz-fixed-cta-clearance, calc(96px + env(safe-area-inset-bottom, 0px)))',
            boxSizing: 'border-box',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            gap: 16,
            overflowY: 'auto',
            WebkitOverflowScrolling: 'touch',
          }}
        >
          <h1
            style={{
              fontFamily: "var(--font-unbounded), 'Unbounded', -apple-system, BlinkMacSystemFont, sans-serif",
              fontWeight: 700,
              fontSize: 'clamp(24px, 7vw, 30px)',
              lineHeight: 1.12,
              letterSpacing: '-0.9px',
              textAlign: 'center',
              margin: 0,
              color: 'var(--ink)',
            }}
          >
            {screen.title}
          </h1>

          <div
            style={{
              background: 'rgba(255,255,255,0.52)',
              backdropFilter: 'blur(24px) saturate(150%)',
              WebkitBackdropFilter: 'blur(24px) saturate(150%)',
              border: '1px solid rgba(255,255,255,0.78)',
              borderRadius: 24,
              padding: '17px 18px 11px',
              boxShadow: '0 12px 34px rgba(49,42,28,0.09)',
            }}
          >
            <div
              style={{
                width: 112,
                height: 112,
                margin: '0 auto 9px',
                padding: 9,
                boxSizing: 'border-box',
                borderRadius: '50%',
                background: `conic-gradient(var(--accent) 0deg 331deg, rgba(255,255,255,0.56) 331deg 360deg)`,
                boxShadow: '0 5px 18px rgba(var(--accent-rgb),0.24)',
              }}
            >
              <div
                style={{
                  width: '100%',
                  height: '100%',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'rgba(255,252,244,0.92)',
                  fontFamily: "var(--font-unbounded), 'Unbounded', -apple-system, BlinkMacSystemFont, sans-serif",
                  fontSize: 31,
                  fontWeight: 600,
                  letterSpacing: '-2px',
                }}
              >
                92<span style={{ fontSize: 18, letterSpacing: '-1px' }}>%</span>
              </div>
            </div>

            <div
              style={{
                marginBottom: 14,
                fontSize: 14,
                fontWeight: 600,
                textAlign: 'center',
                color: 'var(--ink)',
              }}
            >
              План формируется
            </div>

            <div style={{ height: 1, background: 'rgba(var(--ink-rgb),0.12)', marginBottom: 13 }} />

            <h2
              style={{
                margin: '0 0 6px',
                fontSize: 15,
                fontWeight: 700,
                color: 'var(--ink)',
              }}
            >
              В вашем плане:
            </h2>
            {PLAN_BENEFITS.map((benefit, i) => (
              <div
                key={benefit}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  minHeight: 42,
                  borderBottom:
                    i < PLAN_BENEFITS.length - 1
                      ? '1px solid rgba(var(--ink-rgb),0.1)'
                      : 'none',
                }}
              >
                <div
                  style={{
                    width: 24,
                    height: 24,
                    flexShrink: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: '50%',
                    background: 'var(--accent)',
                    boxShadow: '0 2px 7px rgba(var(--accent-rgb),0.38)',
                  }}
                >
                  <CheckIcon />
                </div>
                <span style={{ fontSize: 13, fontWeight: 500, lineHeight: 1.35 }}>{benefit}</span>
              </div>
            ))}
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              padding: '13px 16px',
              borderRadius: 19,
              border: '1px solid rgba(183,217,20,0.62)',
              background: 'rgba(231,252,142,0.44)',
              boxShadow: '0 8px 20px rgba(var(--accent-rgb),0.16)',
            }}
          >
            <div
              style={{
                width: 42,
                height: 42,
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '50%',
                border: '1px solid rgba(var(--ink-rgb),0.24)',
              }}
            >
              <SparkleIcon />
            </div>
            <span style={{ fontSize: 14, fontWeight: 700, lineHeight: 1.34 }}>
              Только то, что действительно нужно вашей коже
            </span>
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
