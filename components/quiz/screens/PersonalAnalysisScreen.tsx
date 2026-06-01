// components/quiz/screens/PersonalAnalysisScreen.tsx
// Экран «Экспертный анализ от SkinIQ» — статичный (position: fixed, без скролла),
// фон — кремовая текстура (та же, что на simple_care/health_trust) с лаймовыми
// углами-overlay. Hero: 92% социального пруфа. Ниже — стеклянная карточка
// «Что входит в программу» с тремя пунктами (Диагностика / Подбор средств /
// Протокол ухода). CTA — стандартная FixedContinueButton.

import React from 'react';
import { BackButtonFixed } from '@/components/BackButtonFixed';
import { FixedContinueButton } from '../buttons/FixedContinueButton';
import type { InfoScreen } from '@/app/(miniapp)/quiz/info-screens';

export interface PersonalAnalysisScreenProps {
  screen: InfoScreen;
  currentInfoScreenIndex: number;
  onContinue: () => void;
  onBack?: () => void;
}

const CHECKLIST: Array<{ title: string; desc: string }> = [
  {
    title: 'Диагностика',
    desc: 'Тип, чувствительность и активные проблемы кожи',
  },
  {
    title: 'Подбор средств',
    desc: '3–5 продуктов под цели и бюджет',
  },
  {
    title: 'Протокол ухода',
    desc: 'Последовательность и время применения',
  },
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

function PersonalAnalysisScreenComponent({
  screen,
  currentInfoScreenIndex,
  onContinue,
  onBack,
}: PersonalAnalysisScreenProps) {
  const shouldShowBackButton =
    currentInfoScreenIndex > 0 && screen.id !== 'welcome' && !!onBack;
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
      {/* ROOT: статичный экран, нет скролла, кремовый фон-картинка */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          width: '100%',
          height: '100vh',
          maxHeight: '100vh',
          overflow: 'hidden',
          backgroundColor: 'var(--canvas-white)',
          fontFamily:
            "var(--font-inter), 'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
          color: 'var(--ink)',
        }}
      >
        {/* Кремовая картинка-фон (та же, что на simple_care/health_trust) */}
        <img
          src="/image%201576994977.webp"
          alt=""
          aria-hidden
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            objectPosition: 'center',
            zIndex: 0,
            pointerEvents: 'none',
          }}
        />
        {/* Лаймовый overlay-акцент по углам */}
        <div
          aria-hidden
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 1,
            pointerEvents: 'none',
            background: `
              radial-gradient(45% 25% at 100% 0%, rgba(var(--accent-rgb),0.45) 0%, transparent 60%),
              radial-gradient(40% 20% at 0% 100%, rgba(var(--accent-rgb),0.25) 0%, transparent 60%)
            `,
          }}
        />

        {/* CONTENT */}
        <div
          className="animate-fade-in"
          style={{
            position: 'relative',
            zIndex: 2,
            width: '100%',
            height: '100%',
            maxWidth: '420px',
            margin: '0 auto',
            padding: '80px 20px 110px',
            boxSizing: 'border-box',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* HEADER */}
          <h1
            style={{
              fontFamily:
                "var(--font-unbounded), 'Unbounded', -apple-system, BlinkMacSystemFont, sans-serif",
              fontWeight: 700,
              fontSize: '24px',
              lineHeight: '115%',
              letterSpacing: '-0.5px',
              textAlign: 'left',
              margin: '0 0 22px 4px',
              color: 'var(--ink)',
            }}
          >
            Экспертный анализ
            <br />
            от SkinIQ
          </h1>

          {/* HERO: 92% социальный пруф */}
          <div
            style={{
              position: 'relative',
              background: 'var(--glass-bg)',
              backdropFilter: 'blur(28px) saturate(160%)',
              WebkitBackdropFilter: 'blur(28px) saturate(160%)',
              border: '1px solid var(--glass-border)',
              borderRadius: '24px',
              padding: '24px 22px 22px',
              marginBottom: '14px',
              boxShadow: '0 10px 32px rgba(0,0,0,0.06)',
            }}
          >
            {/* Бейдж справа сверху */}
            <div
              style={{
                position: 'absolute',
                top: 20,
                right: 20,
                fontSize: '11px',
                fontWeight: 600,
                letterSpacing: '0.3px',
                textTransform: 'uppercase',
                color: '#4B5563',
                background: 'rgba(var(--accent-rgb),0.5)',
                border: '1px solid rgba(var(--accent-rgb),0.8)',
                padding: '4px 10px',
                borderRadius: '999px',
              }}
            >
              по данным SkinIQ
            </div>
            <div
              style={{
                fontFamily:
                  "var(--font-unbounded), 'Unbounded', -apple-system, BlinkMacSystemFont, sans-serif",
                fontWeight: 700,
                fontSize: '64px',
                lineHeight: 0.95,
                letterSpacing: '-2px',
                color: 'var(--ink)',
                display: 'flex',
                alignItems: 'baseline',
                gap: '4px',
              }}
            >
              92
              <span
                style={{
                  fontSize: '22px',
                  fontWeight: 700,
                  color: '#6B7280',
                }}
              >
                %
              </span>
            </div>
            <div
              style={{
                width: '56px',
                height: '4px',
                background: 'var(--accent)',
                borderRadius: '2px',
                margin: '14px 0 12px',
              }}
            />
            <p
              style={{
                fontSize: '14px',
                fontWeight: 400,
                lineHeight: 1.5,
                color: '#1A1A1A',
                maxWidth: '280px',
                margin: 0,
              }}
            >
              пользователей отмечают улучшение кожи за 4 недели
            </p>
          </div>

          {/* SECTION: что входит в программу — стеклянная карточка */}
          <div
            style={{
              background: 'var(--glass-bg)',
              backdropFilter: 'blur(28px) saturate(160%)',
              WebkitBackdropFilter: 'blur(28px) saturate(160%)',
              border: '1px solid var(--glass-border)',
              borderRadius: '24px',
              padding: '20px 22px 22px',
              boxShadow: '0 10px 32px rgba(0,0,0,0.06)',
            }}
          >
            <h2
              style={{
                fontFamily:
                  "var(--font-unbounded), 'Unbounded', -apple-system, BlinkMacSystemFont, sans-serif",
                fontWeight: 700,
                fontSize: '16px',
                lineHeight: 1.2,
                letterSpacing: '-0.3px',
                color: 'var(--ink)',
                margin: '0 0 16px 0',
              }}
            >
              Что входит в программу
            </h2>

            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
              }}
            >
              {CHECKLIST.map((item) => (
                <div
                  key={item.title}
                  style={{
                    display: 'flex',
                    gap: '14px',
                    alignItems: 'flex-start',
                  }}
                >
                  <div
                    style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '50%',
                      background: 'var(--accent)',
                      border: '1px solid rgba(0,0,0,0.08)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      marginTop: '1px',
                      boxShadow: '0 2px 6px rgba(var(--accent-rgb),0.4)',
                    }}
                  >
                    <CheckIcon />
                  </div>
                  <div>
                    <div
                      style={{
                        fontSize: '16px',
                        fontWeight: 700,
                        lineHeight: 1.25,
                        letterSpacing: '-0.2px',
                        color: 'var(--ink)',
                        marginBottom: '3px',
                      }}
                    >
                      {item.title}
                    </div>
                    <div
                      style={{
                        fontSize: '13px',
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
          ctaText={screen.ctaText || 'Продолжить'}
          onClick={onContinue}
        />
      </div>
    </>
  );
}

// ФИКС: Мемоизация для предотвращения лишних перерендеров.
export const PersonalAnalysisScreen = React.memo(PersonalAnalysisScreenComponent);
