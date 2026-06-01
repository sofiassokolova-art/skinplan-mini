// components/quiz/screens/RecognizeYourselfScreen.tsx
// ФИКС #3: Редизайн tinder-экранов recognize_yourself_1/2 ("Вы узнаёте себя в этом?" / "Это похоже на вас?").
// Стиль повторяет WelcomeScreen: полноэкранная фоновая картинка + SkinIQ-лого
// сверху + затемнённый стеклянный контейнер снизу с вопросом и двумя кнопками
// (Нет / Да). Оба ответа ведут в handleNext (commitment-device, не gating —
// см. комментарий в info-screens.ts).

import React from 'react';
import { BackButtonFixed } from '@/components/BackButtonFixed';
import type { InfoScreen } from '@/app/(miniapp)/quiz/info-screens';

export interface RecognizeYourselfScreenProps {
  screen: InfoScreen;
  currentInfoScreenIndex: number;
  onChoose: () => void; // оба варианта (Нет/Да) ведут к одному и тому же next
  onBack?: () => void;
  isHandlingNext?: boolean;
}

const LIME = 'var(--accent)';
const BLACK = 'var(--ink)';

function RecognizeYourselfScreenComponent({
  screen,
  currentInfoScreenIndex,
  onChoose,
  onBack,
  isHandlingNext = false,
}: RecognizeYourselfScreenProps) {
  const shouldShowBackButton = currentInfoScreenIndex > 0 && !!onBack;

  return (
    <div
      className="animate-fade-in"
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
      {/* Фоновая иллюстрация на весь экран */}
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
            background:
              'radial-gradient(circle at top, #2a2a2a 0%, var(--ink) 60%, #000 100%)',
          }}
        >
          <img
            src={screen.image}
            alt=""
            aria-hidden
            fetchPriority="high"
            decoding="sync"
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              objectPosition: 'center',
              display: 'block',
            }}
          />
          {/* Затемнение снизу для читаемости */}
          <div
            aria-hidden
            style={{
              position: 'absolute',
              inset: 0,
              background:
                'linear-gradient(to bottom, rgba(0,0,0,0) 35%, rgba(0,0,0,0.55) 100%)',
              pointerEvents: 'none',
            }}
          />
        </div>
      )}

      <BackButtonFixed
        show={shouldShowBackButton}
        onClick={onBack ?? (() => {})}
        color="var(--canvas-white)"
      />

      {/* SkinIQ logo сверху */}
      <div
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
          style={{
            fontFamily:
              "var(--font-unbounded), -apple-system, BlinkMacSystemFont, sans-serif",
            fontWeight: 700,
            fontSize: 'clamp(18px, 5vw, 24px)',
            color: 'var(--canvas-white)',
            letterSpacing: '0px',
          }}
        >
          SkinIQ
        </span>
      </div>

      {/* Нижний стеклянный контейнер с вопросом и кнопками */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 2,
          padding: 0,
          boxSizing: 'border-box',
        }}
      >
        <div
          className="animate-rise-in-centered"
          style={{
            width: '100%',
            backgroundColor: 'rgba(0, 0, 0, 0.32)',
            backdropFilter: 'blur(12px) saturate(140%)',
            WebkitBackdropFilter: 'blur(12px) saturate(140%)',
            borderTop: '1px solid rgba(var(--canvas-white-rgb),0.18)',
            padding:
              '28px 20px max(28px, env(safe-area-inset-bottom))',
            boxSizing: 'border-box',
            display: 'flex',
            flexDirection: 'column',
            gap: 22,
          }}
        >
          {/* Заголовок */}
          <h1
            style={{
              fontFamily:
                "var(--font-unbounded), 'Unbounded', -apple-system, BlinkMacSystemFont, sans-serif",
              fontWeight: 700,
              fontSize: '22px',
              lineHeight: '120%',
              letterSpacing: '-0.3px',
              textAlign: 'center',
              color: 'var(--canvas-white)',
              margin: 0,
            }}
          >
            {screen.title}
          </h1>

          {/* Цитата/подзаголовок */}
          {screen.subtitle && (
            <div
              style={{
                position: 'relative',
                padding: '14px 16px 14px 18px',
                borderLeft: `3px solid ${LIME}`,
                background: 'rgba(var(--canvas-white-rgb),0.06)',
                borderRadius: '0 12px 12px 0',
                fontFamily:
                  "var(--font-inter), 'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
                fontStyle: 'italic',
                fontWeight: 400,
                fontSize: '15px',
                lineHeight: '145%',
                color: 'rgba(var(--canvas-white-rgb),0.92)',
                whiteSpace: 'pre-line',
              }}
            >
              {screen.subtitle}
            </div>
          )}

          {/* Кнопки Нет / Да */}
          <div style={{ display: 'flex', gap: 12 }}>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (!isHandlingNext) onChoose();
              }}
              disabled={isHandlingNext}
              style={{
                flex: 1,
                height: 60,
                background: 'transparent',
                color: 'var(--canvas-white)',
                border: '1.5px solid var(--glass-bg)',
                borderRadius: 999,
                fontFamily:
                  "var(--font-inter), -apple-system, BlinkMacSystemFont, sans-serif",
                fontWeight: 600,
                fontSize: 17,
                cursor: isHandlingNext ? 'not-allowed' : 'pointer',
                opacity: isHandlingNext ? 0.6 : 1,
                transition: 'transform .12s ease, background .12s ease',
              }}
            >
              Нет
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (!isHandlingNext) onChoose();
              }}
              disabled={isHandlingNext}
              style={{
                flex: 1,
                height: 60,
                background: LIME,
                color: BLACK,
                border: 'none',
                borderRadius: 999,
                fontFamily:
                  "var(--font-inter), -apple-system, BlinkMacSystemFont, sans-serif",
                fontWeight: 700,
                fontSize: 17,
                cursor: isHandlingNext ? 'not-allowed' : 'pointer',
                opacity: isHandlingNext ? 0.6 : 1,
                boxShadow: '0 10px 24px rgba(var(--accent-rgb),0.32)',
                transition: 'transform .12s ease, box-shadow .12s ease',
              }}
            >
              Да
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export const RecognizeYourselfScreen = React.memo(RecognizeYourselfScreenComponent);
