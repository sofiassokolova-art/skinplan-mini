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
      {/* Картинка на весь экран с мягким появлением */}
      {screen.image && (
        <div
          className="animate-fade-in"
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

      {/* SkinIQ — логотип вверху экрана */}
      <div
        className="animate-fade-in"
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 0,
          padding: 'max(24px, env(safe-area-inset-top)) 20px 0',
          zIndex: 2,
          textAlign: 'center',
          pointerEvents: 'none',
        }}
      >
        <span
          className="quiz-welcome-title"
          style={{
            fontFamily: "var(--font-unbounded), -apple-system, BlinkMacSystemFont, sans-serif",
            fontWeight: 700,
            fontSize: 'clamp(18px, 5vw, 24px)',
            color: '#FFFFFF',
            letterSpacing: '0px',
          }}
        >
          SkinIQ
        </span>
      </div>

      {/* Стеклянный контейнер на всю ширину и до низа экрана */}
      <div
        className="animate-fade-in"
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: '74vh',
          bottom: 0,
          width: '100%',
          zIndex: 2,
          padding: 0,
          boxSizing: 'border-box',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-end',
          pointerEvents: 'none',
        }}
      >
        <div
          style={{
            width: '100%',
            minHeight: '100%',
            backgroundColor: 'rgba(0, 0, 0, 0.12)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            borderRadius: 0,
            padding: '24px 20px max(24px, env(safe-area-inset-bottom))',
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
              fontSize: '17px',
              lineHeight: '130%',
              letterSpacing: '0px',
              textAlign: 'center',
              color: '#FFFFFF',
              margin: 0,
            }}
          >
            Создай персональный
            <br />
            план ухода за 5 минут
          </h1>
        </div>
      </div>

      <FixedContinueButton
        ctaText="Начать"
        onClick={onContinue}
        disabled={isHandlingNext}
        loadingText="Загрузка..."
      />
    </div>
  );
}

// ФИКС: Оптимизация рендеринга - мемоизируем компонент для предотвращения лишних перерендеров
export const WelcomeScreen = React.memo(WelcomeScreenComponent);
