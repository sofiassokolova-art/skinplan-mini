// components/quiz/screens/WelcomeScreen.tsx
// Компонент для welcome экрана анкеты
// Верстка из коммита bd0914d

import React from 'react';
import type { InfoScreen } from '@/app/(miniapp)/quiz/info-screens';

export interface WelcomeScreenProps {
  screen: InfoScreen;
  onContinue: () => void;
  isHandlingNext: boolean;
  currentInfoScreenIndex?: number;
  onBack?: () => void;
}

function WelcomeScreenComponent({ screen, onContinue, isHandlingNext, currentInfoScreenIndex = 0, onBack }: WelcomeScreenProps) {
  return (
    <div style={{
      padding: 0,
      margin: 0,
      width: '100%',
      height: '100vh',
      maxWidth: '737px',
      maxHeight: '727px',
      background: '#FFFFFF',
      position: 'relative',
      border: '0px solid rgb(229, 231, 235)',
      boxSizing: 'border-box',
    }}>
      {/* Контент с анимацией */}
      <div
        className="animate-fade-in"
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          paddingTop: '120px',
          paddingBottom: '100px',
          paddingLeft: '20px',
          paddingRight: '20px',
          width: '100%',
          height: '100%',
          boxSizing: 'border-box',
        }}
      >
        {screen.image && (
          <div style={{
            width: '100%',
            height: '436px',
            marginBottom: '24px',
          }}>
            <img
              src={screen.image}
              alt={screen.title}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                display: 'block',
              }}
            />
          </div>
        )}

        {/* Title */}
        <h1 style={{
          fontFamily: "var(--font-unbounded), 'Unbounded', -apple-system, BlinkMacSystemFont, sans-serif",
          fontWeight: 700,
          fontSize: '28px',
          lineHeight: '120%',
          textAlign: 'center',
          color: '#000000',
          margin: '0 0 20px 0',
          maxWidth: '320px',
        }}>
          {screen.title}
        </h1>

        {/* Continue Button */}
        <button
          onClick={() => {
            if (!isHandlingNext) {
              onContinue();
            }
          }}
          disabled={isHandlingNext}
          style={{
            width: '100%',
            maxWidth: 'clamp(224px, 60vw, 320px)',
            height: 'clamp(56px, 8vh, 64px)',
            borderRadius: '20px',
            background: '#D5FE61',
            color: '#000000',
            border: 'none',
            fontFamily: "var(--font-inter), -apple-system, BlinkMacSystemFont, sans-serif",
            fontWeight: 600,
            fontSize: 'clamp(14px, 4vw, 16px)',
            cursor: isHandlingNext ? 'not-allowed' : 'pointer',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
            transition: 'transform 0.2s, box-shadow 0.2s',
            opacity: isHandlingNext ? 0.7 : 1,
            marginTop: '40px',
          }}
          onMouseDown={(e) => {
            if (!isHandlingNext) e.currentTarget.style.transform = 'scale(0.98)';
          }}
          onMouseUp={(e) => {
            if (!isHandlingNext) e.currentTarget.style.transform = 'scale(1)';
          }}
          onMouseLeave={(e) => {
            if (!isHandlingNext) e.currentTarget.style.transform = 'scale(1)';
          }}
        >
          {isHandlingNext ? 'Загрузка...' : (screen.ctaText || 'Продолжить')}
        </button>
      </div>
    </div>
  );
}

// ФИКС: Оптимизация рендеринга - мемоизируем компонент для предотвращения лишних перерендеров
export const WelcomeScreen = React.memo(WelcomeScreenComponent);
