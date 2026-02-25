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

      {/* Текст поверх картинки — белый */}
      <div
        className="animate-fade-in"
        style={{
          position: 'relative',
          zIndex: 2,
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'flex-start',
          paddingTop: 'clamp(30px, 8vh, 60px)',
          paddingBottom: '100px',
          paddingLeft: '20px',
          paddingRight: '20px',
          width: '100%',
          boxSizing: 'border-box',
          pointerEvents: 'none',
        }}
      >
        <div style={{ width: '100%', maxWidth: '320px', textAlign: 'center', pointerEvents: 'auto' }}>
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
              color: '#FFFFFF',
              margin: 0,
              textShadow: '0 1px 2px rgba(0,0,0,0.3)',
            }}
          >
            Подбери уход<br />
            для своей кожи<br />
            со <span style={{ fontWeight: 700, fontStyle: 'normal' }}>SkinIQ</span>
          </h1>
        </div>
      </div>

      <div style={{ position: 'relative', zIndex: 2, pointerEvents: 'auto' }}>
        <FixedContinueButton
          ctaText={screen.ctaText}
          onClick={onContinue}
          disabled={isHandlingNext}
          loadingText="Загрузка..."
        />
      </div>
    </div>
  );
}

// ФИКС: Оптимизация рендеринга - мемоизируем компонент для предотвращения лишних перерендеров
export const WelcomeScreen = React.memo(WelcomeScreenComponent);
