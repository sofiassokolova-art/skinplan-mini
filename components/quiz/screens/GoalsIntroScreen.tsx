// components/quiz/screens/GoalsIntroScreen.tsx
// Компонент для экрана "Расскажите о вашей цели"
// Верстка из коммита bd0914d

import React from 'react';
import { FixedContinueButton } from '../buttons/FixedContinueButton';
import { BackButtonFixed } from '@/components/BackButtonFixed';
import type { InfoScreen } from '@/app/(miniapp)/quiz/info-screens';

export interface GoalsIntroScreenProps {
  screen: InfoScreen;
  currentInfoScreenIndex: number;
  onBack: () => void;
  onContinue: () => void;
}

const PAGE_BG = '#FFFFFF';

function GoalsIntroScreenComponent({
  screen,
  currentInfoScreenIndex,
  onBack,
  onContinue
}: GoalsIntroScreenProps) {
  const isSkinFeaturesIntro = screen.id === 'skin_features_intro';
  const isHealthData = screen.id === 'health_data';
  const useSameLayoutAsSkinFeatures = isSkinFeaturesIntro || isHealthData;

  return (
    <div style={{
      padding: 0,
      margin: 0,
      minHeight: '100vh',
      background: PAGE_BG,
      position: 'relative',
      width: '100%',
    }}>

      <BackButtonFixed show={currentInfoScreenIndex > 0} onClick={onBack} />

      {/* Контент с картинкой и текстом */}
      <div
        className="animate-fade-in"
        style={{
          position: 'relative',
          width: '100%',
          height: '100vh',
          boxSizing: 'border-box',
        }}
      >
        {/* Картинка с градиентом в белый по краям */}
        {screen.image && (
          <div style={{
            position: 'absolute',
            width: '200px',
            height: '241px',
            top: '104px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 10,
            background: PAGE_BG,
            boxShadow: 'none',
            border: 'none',
            overflow: 'hidden',
          }}>
            <img
              src={screen.image}
              alt={screen.title}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'contain',
                display: 'block',
                margin: 0,
                padding: 0,
                border: 'none',
                boxShadow: 'none',
                background: PAGE_BG,
              }}
            />
            <div
              style={{
                position: 'absolute',
                inset: 0,
                background: `linear-gradient(to right, ${PAGE_BG} 0%, transparent 10%, transparent 90%, ${PAGE_BG} 100%), linear-gradient(to bottom, ${PAGE_BG} 0%, transparent 10%, transparent 90%, ${PAGE_BG} 100%)`,
                pointerEvents: 'none',
              }}
            />
          </div>
        )}

        {/* Текстовый блок под картинкой — заголовок и подзаголовок всегда идут друг за другом */}
        <div
          style={{
            position: 'relative',
            paddingTop: useSameLayoutAsSkinFeatures ? '360px' : '356px',
            paddingLeft: '20px',
            paddingRight: '20px',
            paddingBottom: '80px',
            boxSizing: 'border-box',
          }}
        >
          <h1
            style={{
              fontFamily:
                "var(--font-unbounded), 'Unbounded', -apple-system, BlinkMacSystemFont, sans-serif",
              fontWeight: 700,
              fontSize: 'clamp(23px, 6vw, 33px)',
              lineHeight: '120%',
              letterSpacing: '0px',
              textAlign: 'left',
              color: '#000000',
              margin: 0,
              whiteSpace: 'pre-line',
            }}
          >
            {screen.title}
          </h1>

          {screen.subtitle && (
            <div
              style={{
                marginTop: '12px',
                fontFamily:
                  "var(--font-inter), 'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
                fontWeight: 400,
                fontSize: '15px',
                lineHeight: '140%',
                letterSpacing: '0px',
                textAlign: 'left',
                color: '#000000',
                whiteSpace: 'pre-line',
              }}
            >
              {screen.subtitle}
            </div>
          )}
        </div>
      </div>

      <FixedContinueButton ctaText={screen.ctaText || 'Продолжить'} onClick={onContinue} />
    </div>
  );
}

// ФИКС: Оптимизация рендеринга - мемоизируем компонент для предотвращения лишних перерендеров
export const GoalsIntroScreen = React.memo(GoalsIntroScreenComponent);
