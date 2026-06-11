// components/quiz/screens/ImproveSkinScreen.tsx
// ФИКС #5: Объединённый финальный экран квиза.
// Заменяет связку skin_transformation + want_improve одной страницей:
//   "Посмотрите, как меняется ваша кожа" (transformation-визуал) +
//   "Хотите улучшить состояние кожи?" + CTA "Получить план ухода".
// Нажатие CTA запускает submitAnswers (генерация плана). Через handleGetPlan-параметры:
// блокировка по isSubmittingRef/isSubmitting, диагностика наличия initData, обработка ошибок.

import React from 'react';
import Image from 'next/image';
import { BackButtonFixed } from '@/components/BackButtonFixed';
import { ButtonSkeleton } from '@/components/ui/SkeletonLoader';
import { handleGetPlan } from '@/lib/quiz/handlers/handleGetPlan';
import type { InfoScreen } from '@/app/(miniapp)/quiz/info-screens';
import { getQuizInfoBackgroundImage } from '@/app/(miniapp)/quiz/image-assets';

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
  const backgroundImage = screen.image || getQuizInfoBackgroundImage(screen.id);

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

  const hasInitData =
    typeof window !== 'undefined' && !!window.Telegram?.WebApp?.initData;

  return (
    <>
      <BackButtonFixed show={shouldShowBackButton} onClick={onBack ?? (() => {})} />
      <div
        className="qz-mobile-fullscreen"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          width: '100%',
          overflow: 'hidden',
          backgroundColor: 'var(--canvas)',
          fontFamily:
            "var(--font-inter), 'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
          color: 'var(--ink)',
        }}
      >
        {/* Фон из back1-back4 + лаймовые угловые акценты */}
        <Image
          className="qz-fullscreen-bg"
          src={backgroundImage}
          alt=""
          aria-hidden
          fill
          quality={95}
          sizes="100vw"
          style={{
            objectPosition: 'center',
            pointerEvents: 'none',
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
            padding: 'calc(clamp(16px, 4vh, 32px) + 56px) 20px calc(48px + env(safe-area-inset-bottom, 0px))',
            boxSizing: 'border-box',
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
            // Контент (transformation-карточка + список + CTA) выше вьюпорта на
            // невысоких экранах — без прокрутки кнопка «Получить план» уезжала
            // за нижний край (overflow:hidden у родителя её обрезал).
            overflowY: 'auto',
            WebkitOverflowScrolling: 'touch',
          }}
        >
          {/* Eyebrow со статистикой — социальное доказательство сверху */}
          <div
            style={{
              alignSelf: 'flex-start',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '7px 14px',
              borderRadius: 999,
              background: 'rgba(255,255,255,0.78)',
              border: '1px solid rgba(255,255,255,0.85)',
              backdropFilter: 'blur(14px)',
              WebkitBackdropFilter: 'blur(14px)',
              boxShadow: '0 6px 18px rgba(0,0,0,0.06)',
            }}
          >
            <span
              aria-hidden
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: LIME,
                boxShadow: `0 0 0 4px rgba(var(--accent-rgb),0.25)`,
              }}
            />
            <span
              style={{
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: '-0.1px',
                color: 'var(--ink)',
              }}
            >
              Первые изменения — уже на 3-й день
            </span>
          </div>

          {/* Header: transformation */}
          <h1
            style={{
              fontFamily:
                "var(--font-unbounded), 'Unbounded', -apple-system, BlinkMacSystemFont, sans-serif",
              fontWeight: 700,
              fontSize: '26px',
              lineHeight: '112%',
              letterSpacing: '-0.6px',
              margin: '4px 4px 0',
              color: 'var(--ink)',
            }}
          >
            Посмотрите, как <span style={{ color: 'var(--ink)', background: `linear-gradient(180deg, transparent 60%, ${LIME} 60%)`, padding: '0 4px', borderRadius: 4 }}>меняется</span> ваша кожа
          </h1>

          {/* TIMELINE-карточка: что происходит с кожей по дням — продаём будущим
              результатом во времени (новый смысл, не дублирует «состав плана») */}
          <div
            style={{
              // flexShrink: 0 — иначе flex-колонка ужимает карточки под вьюпорт,
              // и кнопка «Получить план» обрезается overflow:hidden CTA-карточки
              flexShrink: 0,
              background: 'var(--glass-bg)',
              backdropFilter: 'blur(28px) saturate(160%)',
              WebkitBackdropFilter: 'blur(28px) saturate(160%)',
              border: '1px solid var(--glass-border)',
              borderRadius: '24px',
              padding: '20px 22px 8px',
              boxShadow: '0 10px 32px rgba(0,0,0,0.06)',
            }}
          >
            <div
              style={{
                fontSize: '12px',
                fontWeight: 600,
                color: '#6B7280',
                textTransform: 'uppercase',
                letterSpacing: '0.12em',
                marginBottom: 4,
              }}
            >
              28-дневный путь
            </div>
            <div
              style={{
                fontFamily:
                  "var(--font-unbounded), 'Unbounded', -apple-system, BlinkMacSystemFont, sans-serif",
                fontSize: '18px',
                fontWeight: 700,
                color: 'var(--ink)',
                letterSpacing: '-0.4px',
                marginBottom: 20,
              }}
            >
              Что произойдёт с кожей
            </div>

            {/* Вертикальный таймлайн с лаймовым рельсом */}
            {[
              { day: 'День 1–3', text: 'Уходит стянутость — кожа увлажнена и спокойна' },
              { day: 'Неделя 1', text: 'Тон выравнивается, меньше новых высыпаний' },
              { day: 'Неделя 2–3', text: 'Поры чище, появляется здоровое сияние' },
              { day: 'День 28', text: 'Кожа плотная и ровная, сияет без фильтров', highlight: true },
            ].map((step, i, arr) => {
              const isLast = i === arr.length - 1;
              return (
                <div key={step.day} style={{ display: 'flex', gap: 14, alignItems: 'stretch' }}>
                  {/* Рельс: точка + соединительная линия */}
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      width: 22,
                      flexShrink: 0,
                    }}
                  >
                    <div
                      style={{
                        width: step.highlight ? 22 : 14,
                        height: step.highlight ? 22 : 14,
                        marginTop: step.highlight ? 1 : 4,
                        borderRadius: '50%',
                        background: 'var(--accent)',
                        border: step.highlight ? '2px solid var(--ink)' : '2px solid rgba(255,255,255,0.85)',
                        boxShadow: step.highlight
                          ? '0 0 0 5px rgba(var(--accent-rgb),0.22)'
                          : '0 1px 4px rgba(var(--accent-rgb),0.4)',
                        display: 'grid',
                        placeItems: 'center',
                      }}
                    >
                      {step.highlight && (
                        <svg width="11" height="11" viewBox="0 0 28 28" fill="var(--ink)" aria-hidden>
                          <path d="M14 2.5c1.6 7 4.5 9.9 11.5 11.5-7 1.6-9.9 4.5-11.5 11.5C12.4 18.5 9.5 15.6 2.5 14 9.5 12.4 12.4 9.5 14 2.5Z" />
                        </svg>
                      )}
                    </div>
                    {!isLast && (
                      <div
                        style={{
                          flex: 1,
                          width: 2,
                          minHeight: 14,
                          marginTop: 3,
                          borderRadius: 2,
                          background:
                            'linear-gradient(180deg, rgba(var(--accent-rgb),0.7), rgba(var(--accent-rgb),0.3))',
                        }}
                      />
                    )}
                  </div>
                  {/* Текст вехи */}
                  <div style={{ paddingBottom: isLast ? 14 : 18 }}>
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        color: 'var(--ink)',
                        letterSpacing: '0.02em',
                        marginBottom: 3,
                      }}
                    >
                      {step.day}
                    </div>
                    <div
                      style={{
                        fontSize: 14.5,
                        fontWeight: step.highlight ? 700 : 600,
                        lineHeight: 1.35,
                        letterSpacing: '-0.2px',
                        color: 'var(--ink)',
                      }}
                    >
                      {step.text}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* CTA-карточка: финальный вопрос + кнопка «Получить план» */}
          <div
            style={{
              flexShrink: 0,
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
              {isCurrentlySubmitting ? <ButtonSkeleton /> : 'Получить план ухода'}
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
