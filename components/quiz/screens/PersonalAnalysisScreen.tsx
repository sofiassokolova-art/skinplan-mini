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
        background: `
          radial-gradient(60% 30% at 100% 0%, rgba(213,254,97,0.55) 0%, transparent 65%),
          radial-gradient(70% 30% at 0% 35%, rgba(255,231,200,0.6) 0%, transparent 65%),
          radial-gradient(80% 25% at 100% 70%, rgba(213,254,97,0.35) 0%, transparent 65%),
          radial-gradient(80% 30% at 0% 100%, rgba(220,210,196,0.6) 0%, transparent 60%),
          #F4F2EE`,
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        width: '100%',
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
              icon: '/icons/detailed_3_64.png',
              alt: 'Точная оценка',
              text: 'Точная оценка состояния кожи',
            },
            {
              icon: '/icons/hydration_3_64.png',
              alt: 'Индивидуальный уход',
              text: 'Индивидуально подобранные средства ухода',
            },
            {
              icon: '/icons/face_3_64.png',
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
                minHeight: '80px',
                display: 'flex',
                flexDirection: 'row',
                alignItems: 'center',
                gap: '14px',
                background: 'rgba(255,255,255,0.55)',
                backdropFilter: 'blur(24px) saturate(160%)',
                WebkitBackdropFilter: 'blur(24px) saturate(160%)',
                border: '1px solid rgba(255,255,255,0.75)',
                borderRadius: '20px',
                padding: '16px 18px',
                boxShadow: '0 8px 24px rgba(0,0,0,0.05)',
                boxSizing: 'border-box',
              }}
            >
              <img
                alt={item.alt}
                src={item.icon}
                fetchPriority="high"
                decoding="sync"
                style={{ width: '36px', height: '36px', objectFit: 'contain', flexShrink: 0 }}
              />
              <div
                style={{
                  flex: 1,
                  fontFamily: "var(--font-inter), 'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
                  fontWeight: 400,
                  fontSize: '14px',
                  lineHeight: '1.45',
                  letterSpacing: '0px',
                  textAlign: 'left',
                  color: '#1A1A1A',
                }}
              >
                {item.text}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Подзаголовок фиксированно над кнопкой «Продолжить», адаптивные размеры под экран */}
      {screen.subtitle && (
        <div
          style={{
            position: 'fixed',
            left: 0,
            right: 0,
            bottom: '120px',
            zIndex: 99,
            padding: '0 max(16px, min(24px, 6vw))',
            boxSizing: 'border-box',
            maxWidth: '100%',
          }}
        >
          <div
            style={{
              fontFamily: "var(--font-inter), 'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
              fontWeight: 400,
              fontSize: 'clamp(11px, 2.8vw, 14px)',
              lineHeight: '140%',
              letterSpacing: '0px',
              textAlign: 'center',
              color: '#9D9D9D',
              maxWidth: '100%',
              margin: '0 auto',
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
