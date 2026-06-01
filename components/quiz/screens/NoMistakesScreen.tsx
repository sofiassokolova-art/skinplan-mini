// components/quiz/screens/NoMistakesScreen.tsx
// ФИКС #1: Редизайн экрана «Вы уже сделали главное» (id=no_mistakes) — sunk-cost
// финальный мотивационный экран перед закрывающей tinder-последовательностью.
// Стиль повторяет уже редизайненные экраны (PersonalAnalysisScreen / HowItWorks):
// кремовый фон + лаймовые угловые акценты + стеклянная карточка с чек-листом.
// Старый монолитный рендер этого экрана (в QuizInfoScreen.tsx) теперь не используется
// для no_mistakes — мы возвращаем этот компонент по id.

import React from 'react';
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

const DONE_LIST: Array<{ title: string; desc: string }> = [
  {
    title: 'Анкета пройдена',
    desc: 'Тип кожи, чувствительность и активные проблемы зафиксированы',
  },
  {
    title: 'Цели и предпочтения собраны',
    desc: 'Учли формат ухода, шаги и бюджет',
  },
  {
    title: 'Идёт подбор средств',
    desc: 'Сейчас матчим продукты под ваш профиль и бюджет',
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
          fontFamily: "var(--font-inter), 'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
          color: 'var(--ink)',
        }}
      >
        {/* Кремовый фон (как в PersonalAnalysisScreen / simple_care / health_trust) */}
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
        {/* Лаймовый угловой акцент */}
        <div
          aria-hidden
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 1,
            pointerEvents: 'none',
            background: `
              radial-gradient(50% 28% at 100% 0%, rgba(var(--accent-rgb),0.55) 0%, transparent 60%),
              radial-gradient(40% 22% at 0% 100%, rgba(var(--accent-rgb),0.28) 0%, transparent 60%)
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
            padding: '80px 20px 110px',
            boxSizing: 'border-box',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* Header — берём из screen.title */}
          <h1
            style={{
              fontFamily: "var(--font-unbounded), 'Unbounded', -apple-system, BlinkMacSystemFont, sans-serif",
              fontWeight: 700,
              fontSize: '26px',
              lineHeight: '115%',
              letterSpacing: '-0.5px',
              textAlign: 'left',
              margin: '0 0 18px 4px',
              color: 'var(--ink)',
            }}
          >
            {screen.title}
          </h1>

          {/* Hero — лаймовая «галочка успеха» + sunk-cost фраза */}
          <div
            style={{
              position: 'relative',
              background: 'var(--glass-bg)',
              backdropFilter: 'blur(28px) saturate(160%)',
              WebkitBackdropFilter: 'blur(28px) saturate(160%)',
              border: '1px solid var(--glass-border)',
              borderRadius: '24px',
              padding: '22px 22px 20px',
              marginBottom: '14px',
              boxShadow: '0 10px 32px rgba(0,0,0,0.06)',
              display: 'flex',
              alignItems: 'center',
              gap: 16,
            }}
          >
            <div
              style={{
                width: 56,
                height: 56,
                flexShrink: 0,
                borderRadius: '50%',
                background: 'var(--accent)',
                border: '1px solid rgba(0,0,0,0.08)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 6px 16px rgba(var(--accent-rgb),0.5)',
              }}
            >
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="var(--ink)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <p
              style={{
                fontSize: '14px',
                fontWeight: 500,
                lineHeight: 1.45,
                color: '#1A1A1A',
                margin: 0,
                whiteSpace: 'pre-line',
              }}
            >
              {screen.subtitle || 'Осталось буквально несколько секунд до вашего персонального плана ухода.'}
            </p>
          </div>

          {/* Чек-лист «что уже сделано» */}
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
                fontFamily: "var(--font-unbounded), 'Unbounded', -apple-system, BlinkMacSystemFont, sans-serif",
                fontWeight: 700,
                fontSize: '16px',
                lineHeight: 1.2,
                letterSpacing: '-0.3px',
                color: 'var(--ink)',
                margin: '0 0 16px 0',
              }}
            >
              Что уже сделано
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {DONE_LIST.map((item) => (
                <div key={item.title} style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
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
                    <div style={{ fontSize: '13px', fontWeight: 500, lineHeight: 1.45, color: '#4B5563' }}>
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
          disabled={isHandlingNext}
        />
      </div>
    </>
  );
}

export const NoMistakesScreen = React.memo(NoMistakesScreenComponent);
