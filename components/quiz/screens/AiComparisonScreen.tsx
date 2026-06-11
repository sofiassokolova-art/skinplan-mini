// components/quiz/screens/AiComparisonScreen.tsx
// Экран ai_comparison («AI подберёт уход быстро и точно»). Появляется после
// oral_medications, перед блоком «Предпочтения» (первый вопрос — makeup_frequency).
//
// Композиция «боль → решение»: сверху приглушённая карточка «Как обычно»
// (хаос, догадки, лишние траты), ниже коннектор SkinIQ, снизу акцентная
// лаймовая карточка «Со SkinIQ» (точный план за секунды). Спокойный продающий
// контраст без кричащего VS-бейджа и красных крестов; стиль общий с остальными
// инфо-экранами анкеты (фон-текстура + нейтральный скрим, заголовок слева, стекло).

import React from 'react';
import Image from 'next/image';
import { BackButtonFixed } from '@/components/BackButtonFixed';
import { FixedContinueButton } from '../buttons/FixedContinueButton';
import type { InfoScreen } from '@/app/(miniapp)/quiz/info-screens';
import { getQuizInfoBackgroundImage } from '@/app/(miniapp)/quiz/image-assets';

export interface AiComparisonScreenProps {
  screen: InfoScreen;
  currentInfoScreenIndex: number;
  onContinue: () => void;
  onBack?: () => void;
  isHandlingNext?: boolean;
}

const TRADITIONAL_ITEMS = [
  'Часы поиска советов в интернете',
  'Деньги на средства, которые не подошли',
  'Непонятно, с чего начать',
];

const SKINIQ_ITEMS = [
  'Точный план под вашу кожу',
  'Готово за секунды',
  'Учитываем цели и бюджет',
];

interface AiComparisonContent {
  traditionalItems?: string[];
  skiniqItems?: string[];
}

function CheckIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="var(--ink)"
      strokeWidth="3.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function AiComparisonScreenComponent({
  screen,
  currentInfoScreenIndex,
  onContinue,
  onBack,
  isHandlingNext = false,
}: AiComparisonScreenProps) {
  const shouldShowBackButton = currentInfoScreenIndex > 0 && !!onBack;
  const content = (screen.content as AiComparisonContent | undefined) || {};
  const traditionalItems = content.traditionalItems || TRADITIONAL_ITEMS;
  const skiniqItems = content.skiniqItems || SKINIQ_ITEMS;
  const backgroundImage = screen.image || getQuizInfoBackgroundImage(screen.id);

  const titleFont =
    "var(--font-unbounded), 'Unbounded', -apple-system, BlinkMacSystemFont, sans-serif";

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
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          width: '100%',
          overflow: 'hidden',
          backgroundColor: 'var(--canvas)',
          fontFamily:
            "var(--font-inter), 'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
          color: 'var(--ink)',
        }}
      >
        {/* Фон-текстура */}
        <Image
          className="qz-fullscreen-bg"
          src={backgroundImage}
          alt=""
          aria-hidden
          fill
          quality={95}
          sizes="100vw"
          style={{ objectPosition: 'center', pointerEvents: 'none' }}
        />
        {/* Нейтральный скрим для читаемости (без лаймовых пятен) */}
        <div
          aria-hidden
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 1,
            pointerEvents: 'none',
            background: 'linear-gradient(rgba(244,242,238,0.46), rgba(244,242,238,0.62))',
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
          {/* HEADER */}
          <h1
            style={{
              fontFamily: titleFont,
              fontWeight: 700,
              fontSize: '25px',
              lineHeight: '114%',
              letterSpacing: '-0.5px',
              textAlign: 'left',
              margin: '0 0 20px 4px',
              color: 'var(--ink)',
            }}
          >
            AI подберёт уход
            <br />
            <span
              style={{
                color: 'var(--ink)',
                background:
                  'linear-gradient(180deg, transparent 60%, var(--accent) 60%)',
                padding: '0 4px',
                borderRadius: 4,
              }}
            >
              быстро и точно
            </span>
          </h1>

          {/* CARD A — «Как обычно»: приглушённая, без тени, нейтральные маркеры */}
          <div
            style={{
              background: 'rgba(255,255,255,0.32)',
              backdropFilter: 'blur(18px) saturate(140%)',
              WebkitBackdropFilter: 'blur(18px) saturate(140%)',
              border: '1px solid rgba(255,255,255,0.5)',
              borderRadius: '20px',
              padding: '16px 18px',
            }}
          >
            <div
              style={{
                fontSize: '11px',
                fontWeight: 700,
                letterSpacing: '0.5px',
                textTransform: 'uppercase',
                color: '#9097A1',
                marginBottom: 12,
              }}
            >
              Как обычно
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
              {traditionalItems.map((t) => (
                <div key={t} style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                  <span
                    aria-hidden
                    style={{
                      width: 18,
                      height: 18,
                      flexShrink: 0,
                      borderRadius: '50%',
                      background: 'rgba(var(--ink-rgb),0.07)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <span
                      style={{
                        width: 8,
                        height: 2,
                        borderRadius: 2,
                        background: '#A2A8B0',
                      }}
                    />
                  </span>
                  <span
                    style={{
                      fontSize: 14,
                      lineHeight: 1.35,
                      color: '#7B818B',
                    }}
                  >
                    {t}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* CONNECTOR — линия + лаймовый чип SkinIQ */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 0,
              margin: '2px 0',
            }}
          >
            <div
              aria-hidden
              style={{
                width: 2,
                height: 12,
                background: 'rgba(var(--ink-rgb),0.16)',
                borderRadius: 2,
              }}
            />
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '5px 12px',
                borderRadius: 999,
                background: 'var(--accent)',
                boxShadow: '0 6px 16px rgba(var(--accent-rgb),0.32)',
                fontSize: 11.5,
                fontWeight: 700,
                letterSpacing: '0.3px',
                textTransform: 'uppercase',
                color: 'var(--ink)',
                zIndex: 1,
              }}
            >
              <svg
                width="13"
                height="13"
                viewBox="0 0 28 28"
                fill="none"
                stroke="var(--ink)"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <path d="M14 2.5c1.6 7 4.5 9.9 11.5 11.5-7 1.6-9.9 4.5-11.5 11.5C12.4 18.5 9.5 15.6 2.5 14 9.5 12.4 12.4 9.5 14 2.5Z" />
              </svg>
              SkinIQ
            </div>
            <div
              aria-hidden
              style={{
                width: 2,
                height: 12,
                background:
                  'linear-gradient(180deg, rgba(var(--accent-rgb),0.7), rgba(var(--accent-rgb),0.2))',
                borderRadius: 2,
              }}
            />
          </div>

          {/* CARD B — «Со SkinIQ»: акцентная, лаймовая рамка, чек-маркеры, тень */}
          <div
            style={{
              position: 'relative',
              background: 'var(--glass-bg-strong)',
              backdropFilter: 'blur(28px) saturate(160%)',
              WebkitBackdropFilter: 'blur(28px) saturate(160%)',
              border: '1.5px solid var(--accent)',
              borderRadius: '22px',
              padding: '18px 18px 20px',
              boxShadow: '0 16px 38px rgba(var(--accent-rgb),0.26)',
            }}
          >
            <div
              style={{
                fontSize: '11px',
                fontWeight: 700,
                letterSpacing: '0.5px',
                textTransform: 'uppercase',
                color: 'var(--ink)',
                marginBottom: 13,
              }}
            >
              Со SkinIQ
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
              {skiniqItems.map((t) => (
                <div key={t} style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                  <span
                    style={{
                      width: 22,
                      height: 22,
                      flexShrink: 0,
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
                  </span>
                  <span
                    style={{
                      fontSize: 15,
                      fontWeight: 600,
                      lineHeight: 1.3,
                      letterSpacing: '-0.2px',
                      color: 'var(--ink)',
                    }}
                  >
                    {t}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <FixedContinueButton
          ctaText={screen.ctaText || 'Продолжить'}
          onClick={onContinue}
          disabled={isHandlingNext}
        />
      </div>
    </>
  );
}

export const AiComparisonScreen = React.memo(AiComparisonScreenComponent);
