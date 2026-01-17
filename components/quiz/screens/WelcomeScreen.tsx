// components/quiz/screens/WelcomeScreen.tsx
// Компонент для welcome экрана анкеты
// Вынесен из renderInfoScreen для улучшения читаемости

import React from 'react';
import { FixedContinueButton } from '../buttons/FixedContinueButton';
import { BackButton } from '../buttons/BackButton';
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
      background: '#FFFFFF',
      display: 'flex',
      flexDirection: 'column',
      position: 'relative',
      overflow: 'hidden',
      width: '100%',
      maxWidth: '100vw',
    }}>
      {/* Кнопка "Назад" */}
      {currentInfoScreenIndex > 0 && onBack && (
        <BackButton onClick={onBack} />
      )}

      {/* Картинка */}
      {screen.image && (
        <div style={{
          width: 'calc(100% + 6px)',
          height: '60vh',
          minHeight: '400px',
          maxHeight: '500px',
          position: 'relative',
          marginLeft: '-3px',
          marginTop: '-10px',
          borderBottomRightRadius: '40px',
          borderBottomLeftRadius: '40px',
          overflow: 'hidden',
        }}>
          <img
            src={screen.image}
            alt={screen.title}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              display: 'block', // ФИКС: Предотвращает "пиксельную полоску" из-за baseline
            }}
          />
        </div>
      )}

      {/* Контент (текст) с анимацией */}
      <div 
        className="animate-fade-in"
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'flex-start',
          paddingTop: 'clamp(30px, 8vh, 60px)',
          paddingBottom: '100px', // Отступ снизу для фиксированной кнопки
          paddingLeft: '20px',
          paddingRight: '20px',
          width: '100%',
          boxSizing: 'border-box',
        }}
      >
        {/* Текст */}
        <div style={{
          width: '100%',
          maxWidth: '320px',
          textAlign: 'center',
        }}>
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
            }}>
            Подбери уход<br />
            для своей кожи<br />
            со <span style={{ fontWeight: 700, fontStyle: 'normal' }}>SkinIQ</span>
          </h1>
        </div>
      </div>
      
      {/* Фиксированная кнопка "Продолжить" внизу экрана */}
      <FixedContinueButton
        ctaText={screen.ctaText}
        onClick={onContinue}
        disabled={isHandlingNext}
        loadingText="Загрузка..."
      />
    </div>
  );
}

// ФИКС: Оптимизация рендеринга - мемоизируем компонент для предотвращения лишних перерендеров
export const WelcomeScreen = React.memo(WelcomeScreenComponent);
