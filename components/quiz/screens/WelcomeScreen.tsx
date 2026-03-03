// components/quiz/screens/WelcomeScreen.tsx
// Компонент для welcome экрана анкеты
// Вынесен из renderInfoScreen для улучшения читаемости

import React from 'react';
import { FixedContinueButton } from '../buttons/FixedContinueButton';
import { BackButtonFixed } from '@/components/BackButtonFixed';
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
      minHeight: '100vh',
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      width: '100vw',
      maxWidth: '100vw',
      boxSizing: 'border-box',
      overflow: 'hidden',
      zIndex: 1,
    }}>
      {/* Картинка на весь экран */}
      {screen.image && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            width: '100%',
            height: '100%',
          }}
        >
          <img
            src={screen.image}
            alt={screen.title}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              objectPosition: 'center',
              display: 'block',
              margin: 0,
              padding: 0,
            }}
          />
        </div>
      )}

      <BackButtonFixed
        show={currentInfoScreenIndex > 0 && !!onBack && screen.id !== 'welcome'}
        onClick={onBack ?? (() => {})}
      />

      {/* Стеклянный контейнер с текстом и кнопкой на нижней части изображения */}
      <div
        className="animate-fade-in"
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: '52vh',
          bottom: 0,
          zIndex: 2,
          padding: '16px 20px 32px',
          boxSizing: 'border-box',
          display: 'flex',
          justifyContent: 'stretch',
          pointerEvents: 'none',
        }}
      >
        <div
          style={{
            width: '100%',
            maxWidth: '100%',
            minHeight: '160px',
            backgroundColor: 'rgba(255, 255, 255, 0.35)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            borderRadius: '24px 24px 0 0',
            padding: '20px 20px 24px',
            boxSizing: 'border-box',
            pointerEvents: 'auto',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'stretch',
            gap: 16,
          }}
        >
          <h1
            className="quiz-welcome-title"
            style={{
              fontFamily: "var(--font-unbounded), -apple-system, BlinkMacSystemFont, sans-serif",
              fontWeight: 400,
              fontStyle: 'normal',
              fontSize: '28px',
              lineHeight: '140%',
              letterSpacing: '0px',
              textAlign: 'center',
              color: '#000000',
              margin: 0,
            }}
          >
            Подбери уход
            <br />
            для своей кожи
            <br />
            со <span style={{ fontWeight: 700, fontStyle: 'normal' }}>SkinIQ</span>
          </h1>

          <button
            type="button"
            onClick={onContinue}
            disabled={isHandlingNext}
            style={{
              marginTop: 8,
              width: '100%',
              alignSelf: 'center',
              height: 44,
              borderRadius: 999,
              border: 'none',
              backgroundColor: 'rgba(213, 254, 97, 0.9)',
              color: '#000000',
              fontFamily: "var(--font-inter), -apple-system, BlinkMacSystemFont, sans-serif",
              fontWeight: 500,
              fontSize: 16,
              textTransform: 'uppercase',
              cursor: isHandlingNext ? 'not-allowed' : 'pointer',
              opacity: isHandlingNext ? 0.7 : 1,
            }}
          >
            {isHandlingNext ? 'Загрузка...' : 'Начать'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ФИКС: Оптимизация рендеринга - мемоизируем компонент для предотвращения лишних перерендеров
export const WelcomeScreen = React.memo(WelcomeScreenComponent);
