// components/quiz/screens/ImproveSkinScreen.tsx
// ФИКС #5: Объединённый финальный экран квиза.
// Заменяет связку skin_transformation + want_improve одной страницей:
//   "Посмотрите, как меняется ваша кожа" (transformation-визуал) +
//   "Хотите улучшить состояние кожи?" + CTA "Получить план ухода".
// Нажатие CTA запускает submitAnswers (генерация плана). Через handleGetPlan-параметры:
// блокировка по isSubmittingRef/isSubmitting, диагностика наличия initData, обработка ошибок.

import React from 'react';
import { BackButtonFixed } from '@/components/BackButtonFixed';
import { handleGetPlan } from '@/lib/quiz/handlers/handleGetPlan';
import type { InfoScreen } from '@/app/(miniapp)/quiz/info-screens';

export interface ImproveSkinScreenProps {
  screen: InfoScreen;
  currentInfoScreenIndex: number;
  onBack?: () => void;
  // Параметры handleGetPlan — пробрасываются из QuizInfoScreen
  isSubmitting: boolean;
  questionnaire: any | null;
  isDev: boolean;
  isSubmittingRef: React.MutableRefObject<boolean>;
  setIsSubmitting: React.Dispatch<React.SetStateAction<boolean>>;
  setError: React.Dispatch<React.SetStateAction<string | null>>;
  setLoading: React.Dispatch<React.SetStateAction<boolean>>;
  submitAnswers: () => Promise<void>;
  error?: string | null;
}

const LIME = 'var(--accent)';
const BLACK = 'var(--ink)';

function ImproveSkinScreenComponent({
  screen,
  currentInfoScreenIndex,
  onBack,
  isSubmitting,
  questionnaire,
  isDev,
  isSubmittingRef,
  setIsSubmitting,
  setError,
  setLoading,
  submitAnswers,
  error,
}: ImproveSkinScreenProps) {
  const shouldShowBackButton = currentInfoScreenIndex > 0 && !!onBack;
  const isCurrentlySubmitting = isSubmitting || isSubmittingRef.current;

  const onGetPlanClick = async () => {
    if (isSubmittingRef.current || isSubmitting) {
      return;
    }
    await handleGetPlan({
      isSubmitting,
      questionnaire,
      isDev,
      isSubmittingRef,
      setIsSubmitting,
      setError,
      setLoading,
      submitAnswers,
    });
  };

  const transformationContent = (screen.content as
    | { from?: string; to?: string; indicator?: string }
    | undefined) || {};

  const hasInitData =
    typeof window !== 'undefined' && !!window.Telegram?.WebApp?.initData;

  return (
    <>
      <BackButtonFixed show={shouldShowBackButton} onClick={onBack ?? (() => {})} />
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          width: '100%',
          height: '100vh',
          maxHeight: '100vh',
          overflow: 'hidden',
          backgroundColor: 'var(--canvas-white)',
          fontFamily:
            "var(--font-inter), 'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
          color: 'var(--ink)',
        }}
      >
        {/* Кремовый фон + лаймовые угловые акценты */}
        <img
          src="/image%201576994977.png"
          alt=""
          aria-hidden
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            objectPosition: 'center',
            zIndex: 0,
            pointerEvents: 'none',
          }}
        />
        <div
          aria-hidden
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 1,
            pointerEvents: 'none',
            background: `
              radial-gradient(50% 28% at 100% 0%, rgba(var(--accent-rgb),0.5) 0%, transparent 60%),
              radial-gradient(45% 22% at 0% 100%, rgba(var(--accent-rgb),0.3) 0%, transparent 60%)
            `,
          }}
        />

        <div
          className="animate-fade-in"
          style={{
            position: 'relative',
            zIndex: 2,
            width: '100%',
            height: '100%',
            maxWidth: '420px',
            margin: '0 auto',
            padding: '72px 20px 132px',
            boxSizing: 'border-box',
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
          }}
        >
          {/* Header: transformation */}
          <h1
            style={{
              fontFamily:
                "var(--font-unbounded), 'Unbounded', -apple-system, BlinkMacSystemFont, sans-serif",
              fontWeight: 700,
              fontSize: '24px',
              lineHeight: '115%',
              letterSpacing: '-0.5px',
              margin: '0 0 8px 4px',
              color: 'var(--ink)',
            }}
          >
            Посмотрите, как меняется ваша кожа
          </h1>

          {/* Transformation-карточка: from → to */}
          <div
            style={{
              background: 'var(--glass-bg)',
              backdropFilter: 'blur(28px) saturate(160%)',
              WebkitBackdropFilter: 'blur(28px) saturate(160%)',
              border: '1px solid var(--glass-border)',
              borderRadius: '24px',
              padding: '20px 22px',
              boxShadow: '0 10px 32px rgba(0,0,0,0.06)',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 16,
              }}
            >
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    fontSize: '12px',
                    fontWeight: 600,
                    color: '#6B7280',
                    textTransform: 'uppercase',
                    letterSpacing: '0.12em',
                    marginBottom: 6,
                  }}
                >
                  {transformationContent.from || 'Сейчас'}
                </div>
                <div
                  style={{
                    fontFamily:
                      "var(--font-unbounded), 'Unbounded', -apple-system, BlinkMacSystemFont, sans-serif",
                    fontSize: '17px',
                    fontWeight: 700,
                    color: 'var(--ink)',
                    letterSpacing: '-0.3px',
                  }}
                >
                  {transformationContent.indicator || 'Здоровье кожи'}
                </div>
              </div>
              <div
                aria-hidden
                style={{
                  width: 56,
                  height: 4,
                  borderRadius: 2,
                  background: `linear-gradient(90deg, #D0D0D0 0%, ${LIME} 100%)`,
                  flexShrink: 0,
                }}
              />
              <div style={{ flex: 1, textAlign: 'right' }}>
                <div
                  style={{
                    fontSize: '12px',
                    fontWeight: 600,
                    color: 'var(--ink)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.12em',
                    marginBottom: 6,
                  }}
                >
                  {transformationContent.to || 'Ваша цель'}
                </div>
                <div
                  style={{
                    fontFamily:
                      "var(--font-unbounded), 'Unbounded', -apple-system, BlinkMacSystemFont, sans-serif",
                    fontSize: '17px',
                    fontWeight: 700,
                    color: 'var(--ink)',
                    letterSpacing: '-0.3px',
                  }}
                >
                  +28 дней
                </div>
              </div>
            </div>
            {screen.subtitle && (
              <div
                style={{
                  marginTop: 14,
                  paddingTop: 14,
                  borderTop: '1px solid rgba(0,0,0,0.06)',
                  fontSize: '13px',
                  lineHeight: 1.55,
                  color: '#4B5563',
                }}
              >
                {screen.subtitle}
              </div>
            )}
          </div>

          {/* CTA-карточка: финальный вопрос + кнопка «Получить план» */}
          <div
            style={{
              marginTop: 4,
              background: 'rgba(var(--ink-rgb),0.92)',
              borderRadius: '24px',
              padding: '22px 22px 22px',
              boxShadow: '0 14px 36px rgba(0,0,0,0.18)',
              color: 'var(--canvas-white)',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <div
              aria-hidden
              style={{
                position: 'absolute',
                top: -40,
                right: -30,
                width: 140,
                height: 140,
                borderRadius: '50%',
                background:
                  'radial-gradient(circle, rgba(var(--accent-rgb),0.45) 0%, transparent 70%)',
                pointerEvents: 'none',
              }}
            />
            <div
              style={{
                position: 'relative',
                fontSize: '11px',
                fontWeight: 700,
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                color: LIME,
                marginBottom: 8,
              }}
            >
              Финальный шаг
            </div>
            <h2
              style={{
                position: 'relative',
                fontFamily:
                  "var(--font-unbounded), 'Unbounded', -apple-system, BlinkMacSystemFont, sans-serif",
                fontWeight: 700,
                fontSize: '22px',
                lineHeight: '120%',
                letterSpacing: '-0.3px',
                color: 'var(--canvas-white)',
                margin: '0 0 18px 0',
              }}
            >
              {screen.title || 'Хотите улучшить состояние кожи?'}
            </h2>
            {error && (
              <div
                role="alert"
                style={{
                  position: 'relative',
                  marginBottom: 14,
                  padding: '10px 12px',
                  borderRadius: 12,
                  background: 'rgba(var(--canvas-white-rgb),0.1)',
                  border: '1px solid rgba(var(--canvas-white-rgb),0.18)',
                  color: 'var(--canvas-white)',
                  fontSize: 13,
                  lineHeight: 1.4,
                }}
              >
                {error}
              </div>
            )}
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onGetPlanClick();
              }}
              disabled={isCurrentlySubmitting}
              style={{
                position: 'relative',
                width: '100%',
                height: 60,
                background: LIME,
                color: BLACK,
                border: 'none',
                borderRadius: 999,
                fontFamily:
                  "var(--font-inter), -apple-system, BlinkMacSystemFont, sans-serif",
                fontWeight: 700,
                fontSize: 17,
                cursor: isCurrentlySubmitting ? 'not-allowed' : 'pointer',
                opacity: isCurrentlySubmitting ? 0.65 : 1,
                boxShadow: '0 12px 30px rgba(var(--accent-rgb),0.35)',
                transition: 'transform .14s ease, box-shadow .14s ease',
              }}
            >
              {isCurrentlySubmitting ? 'Отправка...' : 'Получить план ухода'}
            </button>
            {!hasInitData && !isDev && (
              <p
                style={{
                  position: 'relative',
                  marginTop: 10,
                  marginBottom: 0,
                  fontSize: 12,
                  textAlign: 'center',
                  color: 'rgba(var(--canvas-white-rgb),0.6)',
                }}
              >
                Убедитесь, что приложение открыто через Telegram Mini App
              </p>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

export const ImproveSkinScreen = React.memo(ImproveSkinScreenComponent);
