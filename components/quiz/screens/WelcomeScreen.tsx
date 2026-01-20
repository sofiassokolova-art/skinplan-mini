// components/quiz/screens/WelcomeScreen.tsx
// Компонент для welcome экрана анкеты
// Верстка из коммита bd0914d

import React from 'react';
import { FixedContinueButton } from '../buttons/FixedContinueButton';
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
      minHeight: '100vh',
      background: '#FFFFFF',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      boxSizing: 'border-box',
    }}>
      {/* Контент с анимацией */}
      <div
        className="animate-fade-in"
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'flex-start',
          paddingTop: '40px',
          paddingBottom: '80px',
          paddingLeft: '20px',
          paddingRight: '20px',
          width: '100%',
          boxSizing: 'border-box',
        }}
      >
        {screen.image && (
          <div style={{
            width: '378px',
            height: '479px',
            marginTop: '-10px',
            marginLeft: '-3px',
            borderBottomLeftRadius: '40px',
            borderBottomRightRadius: '40px',
            overflow: 'hidden',
            background: '#FFFFFF',
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
          margin: '24px 0 24px 0',
          maxWidth: '320px',
        }}>
          {screen.title}
        </h1>

        <FixedContinueButton
          ctaText={isHandlingNext ? 'Загрузка...' : screen.ctaText}
          onClick={() => {
            if (!isHandlingNext) {
              onContinue();
            }
          }}
        />
      </div>
    </div>
  );
}

// ФИКС: Оптимизация рендеринга - мемоизируем компонент для предотвращения лишних перерендеров
export const WelcomeScreen = React.memo(WelcomeScreenComponent);
