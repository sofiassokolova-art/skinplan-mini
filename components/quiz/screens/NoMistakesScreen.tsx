// components/quiz/screens/NoMistakesScreen.tsx
// Финальный продающий экран перед закрывающей последовательностью квиза.

import React from 'react';
import Image from 'next/image';
import { BackButtonFixed } from '@/components/BackButtonFixed';
import { FixedContinueButton } from '../buttons/FixedContinueButton';
import type { InfoScreen } from '@/app/(miniapp)/quiz/info-screens';
import { getQuizInfoBackgroundImage } from '@/app/(miniapp)/quiz/image-assets';

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
];

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
  const backgroundImage = screen.image || getQuizInfoBackgroundImage(screen.id);
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
        <Image
          className="qz-fullscreen-bg"
          src={backgroundImage}
          alt=""
          aria-hidden
          fill
          quality={95}
          sizes="100vw"
          style={{
            objectPosition: 'center',
            pointerEvents: 'none',
            opacity: 0.78,
          }}
        />
        <div
          aria-hidden
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 1,
            pointerEvents: 'none',
            background: `
              radial-gradient(58% 30% at 100% 0%, rgba(var(--accent-rgb),0.62) 0%, transparent 68%),
              radial-gradient(50% 24% at 0% 100%, rgba(var(--accent-rgb),0.48) 0%, transparent 68%),
              linear-gradient(180deg, rgba(255,251,241,0.28) 0%, rgba(255,251,241,0.1) 100%)
            `,
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
            overflowY: 'auto',
            WebkitOverflowScrolling: 'touch',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              gap: 7,
              marginBottom: 13,
              fontSize: '11px',
              fontWeight: 700,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: 'var(--ink)',
            }}
          >
            <span>Персональный анализ</span>
            <span style={{ color: 'var(--accent)', fontSize: 16, lineHeight: 0.7 }}>•</span>
            <span style={{ color: '#B7D914' }}>92%</span>
          </div>

          <h1
            style={{
              fontFamily: "var(--font-unbounded), 'Unbounded', -apple-system, BlinkMacSystemFont, sans-serif",
              fontWeight: 700,
              fontSize: 'clamp(24px, 7vw, 30px)',
              lineHeight: 1.12,
              letterSpacing: '-0.9px',
              textAlign: 'center',
              margin: '0 auto 13px',
              color: 'var(--ink)',
            }}
          >
            {screen.title}
          </h1>

          <p
            style={{
              margin: '0 auto 18px',
              maxWidth: 355,
              fontSize: 'clamp(13px, 3.7vw, 15px)',
              lineHeight: 1.48,
              textAlign: 'center',
              color: 'rgba(var(--ink-rgb),0.78)',
            }}
          >
            {screen.subtitle}
          </p>

          <div
            style={{
              background: 'rgba(255,255,255,0.52)',
              backdropFilter: 'blur(24px) saturate(150%)',
              WebkitBackdropFilter: 'blur(24px) saturate(150%)',
              border: '1px solid rgba(255,255,255,0.78)',
              borderRadius: 24,
              padding: '17px 18px 9px',
              boxShadow: '0 12px 34px rgba(49,42,28,0.09)',
              marginBottom: 12,
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
            {PLAN_BENEFITS.map((benefit) => (
              <div
                key={benefit}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  minHeight: 42,
                  borderBottom: '1px solid rgba(var(--ink-rgb),0.1)',
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
