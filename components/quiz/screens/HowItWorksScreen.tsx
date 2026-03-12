// components/quiz/screens/HowItWorksScreen.tsx
// Компонент для экрана "Как это работает?"
// Вынесен из renderInfoScreen для улучшения читаемости

import React from 'react';
import { FixedContinueButton } from '../buttons/FixedContinueButton';
import { BackButtonFixed } from '@/components/BackButtonFixed';
import type { InfoScreen } from '@/app/(miniapp)/quiz/info-screens';

export interface HowItWorksScreenProps {
  screen: InfoScreen;
  currentInfoScreenIndex: number;
  onBack: () => void;
  onContinue: () => void;
}

function HowItWorksScreenComponent({
  screen,
  currentInfoScreenIndex,
  onBack,
  onContinue,
}: HowItWorksScreenProps) {
  const rawLines = screen.subtitle?.split('\n').filter(line => line.trim()) || [];
  const steps: string[] = [];
  for (const line of rawLines) {
    if (/^\d+\.\s/.test(line)) {
      steps.push(line);
    } else if (steps.length > 0) {
      steps[steps.length - 1] += '\n' + line;
    }
  }

  return (
    <div
      style={{
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
      }}
    >
      {/* Фон: полноэкранная картинка, как на welcome-экране, с мягким появлением */}
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
          zIndex: 0,
          // Fallback фон, который виден до загрузки фоновой фотографии
          background:
            'radial-gradient(circle at top, #0f172a 0%, #020617 40%, #020617 100%)',
        }}
      >
        <img
          src="/ea01dd6e_nano_4K.jpg"
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

      <BackButtonFixed show={true} onClick={onBack} color="#FFFFFF" />

      {/* Контейнер контента: по центру экрана по вертикали и горизонтали */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 'clamp(19px, 5vw, 38px)',
          right: 'clamp(19px, 5vw, 38px)',
          bottom: 0,
          boxSizing: 'border-box',
          pointerEvents: 'none',
        }}
      >
        <div
          className="animate-fade-in"
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: '100%',
            maxWidth: 300,
            boxSizing: 'border-box',
            pointerEvents: 'auto',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'stretch',
          }}
        >
          {/* Единый прозрачный контейнер для заголовка и шагов */}
          <div
            style={{
              width: '100%',
              padding: '18px 16px 20px',
              borderRadius: 20,
              backgroundColor: 'rgba(0, 0, 0, 0.12)',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              boxSizing: 'border-box',
              display: 'flex',
              flexDirection: 'column',
              gap: 24,
            }}
          >
            {/* Заголовок */}
            <h1
              className="quiz-how-it-works-title"
              style={{
                fontFamily: "var(--font-unbounded), 'Unbounded', -apple-system, BlinkMacSystemFont, sans-serif",
                fontWeight: 900,
                fontStyle: 'normal',
                fontSize: '20px',
                lineHeight: '120%',
                letterSpacing: '0px',
                textAlign: 'center',
                color: '#FFFFFF',
                margin: 0,
              }}
            >
              Как это работает?
            </h1>

            {/* Шаги */}
            <div
              style={{
                width: '100%',
                display: 'flex',
                flexDirection: 'column',
                gap: 28,
                alignItems: 'stretch',
              }}
            >
              {steps.map((step, index) => {
                const stepNumber = index + 1;
                const stepText = step.replace(/^\d+\.\s*/, '');

                return (
                  <div
                    key={index}
                    style={{
                      width: '100%',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                      boxSizing: 'border-box',
                      textAlign: 'center',
                    }}
                  >
                    {/* Номер шага — лаймовая цифра над текстом, по центру */}
                    <span
                      style={{
                        fontFamily: "var(--font-unbounded), 'Unbounded', -apple-system, BlinkMacSystemFont, sans-serif",
                        fontWeight: 700,
                        fontSize: '52px',
                        lineHeight: 1,
                        letterSpacing: '0px',
                        color: '#D5FE61',
                      }}
                    >
                      {stepNumber}
                    </span>

                    {/* Текст шага — шрифт как у заголовка, обычный вес, по центру */}
                    <div
                      style={{
                        flex: 1,
                        fontFamily: "var(--font-unbounded), 'Unbounded', -apple-system, BlinkMacSystemFont, sans-serif",
                        fontWeight: 400,
                        fontSize: '13px',
                        lineHeight: '140%',
                        letterSpacing: '0px',
                        color: '#FFFFFF',
                        textAlign: 'center',
                        whiteSpace: 'pre-line',
                      }}
                    >
                      {stepText}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Фиксированная кнопка \"Продолжить\" внизу экрана, под стеклянным контейнером */}
      <FixedContinueButton ctaText={screen.ctaText || 'Продолжить'} onClick={onContinue} />
    </div>
  );
}

// ФИКС: Оптимизация рендеринга - мемоизируем компонент для предотвращения лишних перерендеров
export const HowItWorksScreen = React.memo(HowItWorksScreenComponent);
