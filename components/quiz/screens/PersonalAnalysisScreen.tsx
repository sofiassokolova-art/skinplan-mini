// components/quiz/screens/PersonalAnalysisScreen.tsx
// Компонент для экрана "SkinIQ — ваш персональный анализ кожи"
// Вынесен из renderInfoScreen для улучшения читаемости

import React from 'react';
import { BackButtonFixed } from '@/components/BackButtonFixed';
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
  const shouldShowBackButton = currentInfoScreenIndex > 0 && screen.id !== 'welcome' && !!onBack;
  const handleBackWithScroll = () => {
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop || 0;
    const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft || document.body.scrollLeft || 0;
    onBack?.();
    setTimeout(() => window.scrollTo(scrollLeft, scrollTop), 0);
  };
  return (
    <>
      <BackButtonFixed show={shouldShowBackButton} onClick={handleBackWithScroll} />
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
          padding: '64px 20px 100px',
          width: '100%',
          boxSizing: 'border-box',
        }}
      >
        <h1
          className="quiz-title"
          style={{
            fontFamily: "var(--font-unbounded), 'Unbounded', -apple-system, BlinkMacSystemFont, sans-serif",
            fontStyle: 'normal',
            fontSize: '22px',
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

        {/* Subtitle перенесён к кнопке «Продолжить» */}

        <div
          style={{
            width: '360px',
            maxWidth: '100%',
            minWidth: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            marginTop: '16px',
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
                width: '100%',
                minWidth: '100%',
                minHeight: '96px',
                display: 'flex',
                flexDirection: 'row',
                alignItems: 'center',
                gap: '12px',
                backgroundColor: '#FFFFFF',
                borderRadius: '12px',
                padding: '14px 16px',
                boxShadow: '0 4px 16px rgba(0, 0, 0, 0.12), 0 2px 6px rgba(0, 0, 0, 0.08)',
                boxSizing: 'border-box',
              }}
            >
              <img
                alt={item.alt}
                src={item.icon}
                style={{ width: '32px', height: '32px', objectFit: 'contain', flexShrink: 0 }}
              />
              <div
                style={{
                  flex: 1,
                  fontFamily: "var(--font-inter), 'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
                  fontWeight: 400,
                  fontSize: '14px',
                  lineHeight: '120%',
                  letterSpacing: '0px',
                  textAlign: 'left',
                  color: '#000000',
                }}
              >
                {item.text}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Подзаголовок фиксированно над кнопкой «Продолжить», небольшой отступ */}
      {screen.subtitle && (
        <div
          style={{
            position: 'fixed',
            left: 0,
            right: 0,
            bottom: '88px',
            zIndex: 99,
            padding: '0 24px',
            boxSizing: 'border-box',
          }}
        >
          <div
            style={{
              fontFamily: "var(--font-inter), 'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
              fontWeight: 400,
              fontSize: '12px',
              lineHeight: '140%',
              letterSpacing: '0px',
              textAlign: 'center',
              color: '#9D9D9D',
            }}
          >
            {screen.subtitle}
          </div>
        </div>
      )}

      <FixedContinueButton ctaText={screen.ctaText || 'Продолжить'} onClick={onContinue} />
    </div>
    </>
  );
}

// ФИКС: Оптимизация рендеринга - мемоизируем компонент для предотвращения лишних перерендеров
export const PersonalAnalysisScreen = React.memo(PersonalAnalysisScreenComponent);
