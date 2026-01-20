// components/quiz/screens/PersonalAnalysisScreen.tsx
// Компонент для экрана "SkinIQ — ваш персональный анализ кожи"
// Вынесен из renderInfoScreen для улучшения читаемости

import React from 'react';
import { createPortal } from 'react-dom';
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
              zIndex: 1000,
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
      {backButton}
      {/* Кнопка "Назад" - будет рендерится общей логикой в QuizInfoScreen */}
      <div style={{
        padding: 0,
        margin: 0,
        minHeight: '100vh',
        background: '#FFFFFF',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        width: '100%',
        border: '0px solid rgb(229, 231, 235)',
        boxSizing: 'border-box',
      }}>

      <div
        className="animate-fade-in"
        style={{
          flex: '1 1 0%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'flex-start',
          padding: '120px 20px 100px',
          width: '100%',
          boxSizing: 'border-box',
        }}
      >
        <h1
          className="quiz-title"
          style={{
            fontFamily: "var(--font-unbounded), 'Unbounded', -apple-system, BlinkMacSystemFont, sans-serif",
            fontStyle: 'normal',
            fontSize: '32px',
            lineHeight: '120%',
            letterSpacing: '0px',
            textAlign: 'center',
            color: '#000000',
            margin: '0 0 12px 0',
            maxWidth: '311px',
          }}
        >
          <span style={{ fontWeight: 700 }}>SkinIQ</span>
          <span style={{ fontWeight: 400 }}> — ваш персональный анализ кожи</span>
        </h1>

        {screen.subtitle && (
          <div
            style={{
              fontFamily: "var(--font-inter), 'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
              fontWeight: 400,
              fontSize: '14px',
              lineHeight: '140%',
              letterSpacing: '0px',
              textAlign: 'center',
              color: '#9D9D9D',
              marginBottom: '40px',
              maxWidth: '320px',
            }}
          >
            {screen.subtitle}
          </div>
        )}

        <div
          style={{
            width: '100%',
            maxWidth: '320px',
            display: 'flex',
            flexDirection: 'column',
            gap: '24px',
            marginBottom: '40px',
          }}
        >
          {[
            {
              icon: '/icons/detailed_3.PNG',
              alt: 'Точная оценка',
              text: 'Точная оценка состояния кожи',
            },
            {
              icon: '/icons/hydration_3.PNG',
              alt: 'Индивидуальный уход',
              text: 'Индивидуально подобранные средства ухода',
            },
            {
              icon: '/icons/face_3.PNG',
              alt: 'Умная рутина',
              text: (
                <>
                  Умная рутина, которая работает <span style={{ fontWeight: 700 }}>в 3 раза эффективнее</span>
                </>
              ),
            },
          ].map((item) => (
            <div
              key={item.alt}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                textAlign: 'center',
                gap: '12px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <img
                  alt={item.alt}
                  src={item.icon}
                  style={{ width: '48px', height: '48px', objectFit: 'contain' }}
                />
              </div>
              <div
                style={{
                  fontFamily: "var(--font-inter), 'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
                  fontWeight: 400,
                  fontSize: '16px',
                  lineHeight: '120%',
                  letterSpacing: '0px',
                  textAlign: 'center',
                  color: '#000000',
                  maxWidth: '289px',
                }}
              >
                {item.text}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div
        style={{
          position: 'fixed',
          bottom: 'clamp(40px, 6vh, 60px)',
          left: 0,
          right: 0,
          padding: '0 clamp(20px, 5vw, 40px)',
          background: 'transparent',
          zIndex: 100,
          display: 'flex',
          justifyContent: 'center',
        }}
      >
        <button
          onClick={onContinue}
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
            cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
            transition: 'transform 0.2s, box-shadow 0.2s',
            opacity: 1,
            transform: 'scale(1)',
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
