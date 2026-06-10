// components/quiz/screens/NoMistakesScreen.tsx
// Финальный продающий экран перед закрывающей последовательностью квиза
// («Ваш SkinIQ-план почти готов»).
//
// Стиль выровнен с остальными инфо-экранами анкеты (PersonalAnalysisScreen и др.):
// заголовок слева (Unbounded), подзаголовок-описание, стеклянные карточки
// (var(--glass-bg) + blur), лаймовый акцент-делитель. Вместо тяжёлого
// центрированного «кольца 92%» — спокойный горизонтальный прогресс-бар
// «План формируется», по-эпловски тонкий и сдержанный.

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

const PLAN_BENEFITS: Array<{ title: string; desc: string }> = [
  { title: 'Средства под ваш тип кожи', desc: 'Подбор с учётом чувствительности и проблем' },
  { title: 'Цели и бюджет', desc: 'Только то, что нужно — без переплат' },
  { title: 'Понятная схема по шагам', desc: 'Что и когда наносить' },
];

// Поверх текстуры back11 — плотный нейтральный скрим: глушит пузырьки текстуры,
// чтобы фон читался чистым (без «пятен»), оставляя лишь лёгкий намёк на фактуру.
const PLAN_BLOB_OVERLAY = `
  linear-gradient(rgba(244,242,238,0.82), rgba(244,242,238,0.88))
`;

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

function SparkleIcon() {
  return (
    <svg
      width="22"
      height="22"
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
              margin: '0 0 10px 4px',
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

          {/* CARD 1 — прогресс «План формируется» (тонкий бар, по-эпловски) */}
          <div
            style={{
              background: 'var(--glass-bg)',
              backdropFilter: 'blur(28px) saturate(160%)',
              WebkitBackdropFilter: 'blur(28px) saturate(160%)',
              border: '1px solid var(--glass-border)',
              borderRadius: '22px',
              padding: '18px 20px',
              marginBottom: '14px',
              boxShadow: '0 10px 32px rgba(0,0,0,0.06)',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'baseline',
                justifyContent: 'space-between',
                marginBottom: 12,
              }}
            >
              <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>
                План формируется
              </span>
              <span
                style={{
                  fontFamily: TITLE_FONT,
                  fontSize: 18,
                  fontWeight: 700,
                  letterSpacing: '-0.5px',
                  color: 'var(--ink)',
                }}
              >
                92<span style={{ fontSize: 12, color: '#6B7280' }}>%</span>
              </span>
            </div>
            <div
              style={{
                height: 8,
                borderRadius: 999,
                background: 'rgba(var(--ink-rgb),0.08)',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: '92%',
                  height: '100%',
                  borderRadius: 999,
                  background: 'var(--accent)',
                  boxShadow: '0 1px 6px rgba(var(--accent-rgb),0.5)',
                }}
              />
            </div>
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
              marginBottom: '14px',
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

          {/* FOOTER — лаймовая плашка-акцент */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 13,
              padding: '13px 16px',
              borderRadius: 18,
              border: '1px solid rgba(183,217,20,0.55)',
              background: 'rgba(231,252,142,0.40)',
            }}
          >
            <div
              style={{
                width: 38,
                height: 38,
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '50%',
                background: 'rgba(255,255,255,0.5)',
                border: '1px solid rgba(var(--ink-rgb),0.18)',
              }}
            >
              <SparkleIcon />
            </div>
            <span style={{ fontSize: 13.5, fontWeight: 600, lineHeight: 1.34 }}>
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
