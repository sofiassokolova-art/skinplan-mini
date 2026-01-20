// components/quiz/screens/GoalsIntroScreen.tsx
// Компонент для экрана "Расскажите о вашей цели"
// Верстка из коммита bd0914d

import React from 'react';
import { BackButton } from '../buttons/BackButton';
import { FixedContinueButton } from '../buttons/FixedContinueButton';
import type { InfoScreen } from '@/app/(miniapp)/quiz/info-screens';

export interface GoalsIntroScreenProps {
  screen: InfoScreen;
  currentInfoScreenIndex: number;
  onBack: () => void;
  onContinue: () => void;
}

function GoalsIntroScreenComponent({
  screen,
  currentInfoScreenIndex,
  onBack,
  onContinue
}: GoalsIntroScreenProps) {
  return (
    <div style={{
      padding: 0,
      margin: 0,
      minHeight: '100vh',
      background: '#FFFFFF',
      position: 'relative',
      width: '100%',
    }}>

      {/* Кнопка "Назад" */}
      {currentInfoScreenIndex > 0 && (
        <div style={{
          position: 'fixed',
          top: 'clamp(20px, 4vh, 40px)',
          left: 'clamp(19px, 5vw, 24px)',
          zIndex: 1000,
          width: '44px',
          height: '44px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <BackButton onClick={onBack} />
        </div>
      )}

      {/* Контент с абсолютным позиционированием */}
      <div
        className="animate-fade-in"
        style={{
          position: 'relative',
          width: '100%',
          height: '100vh',
          boxSizing: 'border-box',
        }}
      >
        {/* Картинка с абсолютным позиционированием */}
        {screen.image && (
          <div style={{
            position: 'absolute',
            width: '200px',
            height: '241px',
            top: '120px',
            left: '60px',
            zIndex: 10,
          }}>
            <img
              src={screen.image}
              alt={screen.title}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'contain',
                display: 'block',
              }}
            />
          </div>
        )}

        {/* Заголовок с абсолютным позиционированием */}
        <h1 style={{
          position: 'absolute',
          width: '342px',
          height: '93px',
          top: '320px',
          left: '20px',
          fontFamily: "var(--font-unbounded), 'Unbounded', -apple-system, BlinkMacSystemFont, sans-serif",
          fontWeight: 700,
          fontSize: '32px',
          lineHeight: '120%',
          letterSpacing: '0px',
          textAlign: 'left',
          color: '#000000',
          margin: '0',
          whiteSpace: 'pre-line',
          zIndex: 10,
        }}>
          {screen.title}
        </h1>

        {/* Подзаголовок с абсолютным позиционированием */}
        {screen.subtitle && (
          <div style={{
            position: 'absolute',
            width: '342px',
            height: '93px',
            top: '430px',
            left: '20px',
            fontFamily: "var(--font-inter), 'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
            fontWeight: 400,
            fontSize: '18px',
            lineHeight: '140%',
            letterSpacing: '0px',
            textAlign: 'left',
            color: '#000000',
            whiteSpace: 'pre-line',
            zIndex: 10,
          }}>
            {screen.subtitle}
          </div>
        )}
      </div>

      {/* Фиксированная кнопка "Продолжить" внизу экрана */}
      <div style={{
        position: 'fixed',
        bottom: '40px',
        left: '50%',
        transform: 'translateX(-50%)',
        width: '100%',
        maxWidth: '320px',
        padding: '0 20px',
        boxSizing: 'border-box',
        zIndex: 100,
      }}>
        <button
          onClick={onContinue}
          style={{
            width: '100%',
            height: '56px',
            borderRadius: '20px',
            background: '#D5FE61',
            color: '#000000',
            border: 'none',
            fontFamily: "var(--font-inter), -apple-system, BlinkMacSystemFont, sans-serif",
            fontWeight: 600,
            fontSize: '16px',
            cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
          }}
        >
          {screen.ctaText || 'Продолжить'}
        </button>
      </div>
    </div>
  );
}

// ФИКС: Оптимизация рендеринга - мемоизируем компонент для предотвращения лишних перерендеров
export const GoalsIntroScreen = React.memo(GoalsIntroScreenComponent);
