// components/quiz/screens/PersonalAnalysisScreen.tsx
// Компонент для экрана "SkinIQ — ваш персональный анализ кожи"
// Вынесен из renderInfoScreen для улучшения читаемости

import React from 'react';
import { createPortal } from 'react-dom';
import { FixedContinueButton } from '../buttons/FixedContinueButton';
import type { InfoScreen } from '@/app/(miniapp)/quiz/info-screens';

export interface PersonalAnalysisScreenProps {
  screen: InfoScreen;
  currentInfoScreenIndex: number;
  onContinue: () => void;
  onBack?: () => void;
}

function PersonalAnalysisScreenComponent({
  screen,
  currentInfoScreenIndex,
  onContinue,
  onBack
}: PersonalAnalysisScreenProps) {
  // Кнопка "Назад" - создаём один раз для всех экранов
  const shouldShowBackButton = currentInfoScreenIndex > 0 && screen.id !== 'welcome';
  const backButton =
    shouldShowBackButton &&
    typeof window !== 'undefined' &&
    onBack
      ? createPortal(
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              // Prevent any scroll effects
              const html = document.documentElement;
              const body = document.body;
              const scrollTop = window.pageYOffset || html.scrollTop || body.scrollTop || 0;
              const scrollLeft = window.pageXOffset || html.scrollLeft || body.scrollLeft || 0;

              onBack();

              // Restore scroll position in case something changed it
              setTimeout(() => {
                window.scrollTo(scrollLeft, scrollTop);
              }, 0);
            }}
            style={{
              position: 'fixed',
              top: 'clamp(20px, 4vh, 40px)',
              left: 'clamp(19px, 5vw, 24px)',
              zIndex: 99999,
              width: '44px',
              height: '44px',
              background: 'transparent',
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              padding: 0,
              pointerEvents: 'auto',
              transform: 'translateZ(0)', // Создаем новый слой для правильного позиционирования
              backfaceVisibility: 'hidden', // Оптимизация рендеринга
              WebkitTransform: 'translateZ(0)', // Для Safari
              isolation: 'isolate', // Создаем новый контекст стекирования
              willChange: 'transform', // Оптимизация для браузера
              contain: 'layout style paint', // Изолируем кнопку от остального контента
            }}
          >
            <svg
              width="12"
              height="20"
              viewBox="0 0 12 20"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M10 2L2 10L10 18"
                stroke="#1A1A1A"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>,
          document.body
        )
      : null;
  return (
    <>
      {/* Кнопка "Назад" - будет рендерится общей логикой в QuizInfoScreen */}
      <div style={{
        padding: 0,
        margin: 0,
        minHeight: '100vh',
        background: '#FFFFFF',
        position: 'relative',
        width: '100%',
      }}>

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
            boxShadow: '0 4px 12px rgba(213, 254, 97, 0.3)',
          }}
        >
          {screen.ctaText || 'Продолжить'}
        </button>
      </div>
    </div>
    </>
  );
}

// ФИКС: Оптимизация рендеринга - мемоизируем компонент для предотвращения лишних перерендеров
export const PersonalAnalysisScreen = React.memo(PersonalAnalysisScreenComponent);

