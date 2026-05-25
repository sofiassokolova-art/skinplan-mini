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
  const features = [
    {
      icon: '/icons/detailed_3_64.png',
      alt: 'Точная оценка',
      title: 'Точная оценка кожи',
      desc: 'Анализ типа, чувствительности и сезонности',
    },
    {
      icon: '/icons/hydration_3_64.png',
      alt: 'Индивидуальный уход',
      title: 'Индивидуальные средства',
      desc: 'Подбор под ваши цели и бюджет',
    },
    {
      icon: '/icons/face_3_64.png',
      alt: 'Умная рутина',
      title: 'Умная рутина',
      desc: 'Работает в 3 раза эффективнее',
    },
  ];

  return (
    <>
      <BackButtonFixed show={shouldShowBackButton} onClick={handleBackWithScroll} />
      <div style={{
        padding: 0,
        margin: 0,
        height: '100vh',
        maxHeight: '100vh',
        overflow: 'hidden',
        background: `
          radial-gradient(60% 30% at 100% 0%, rgba(213,254,97,0.55) 0%, transparent 65%),
          radial-gradient(70% 30% at 0% 35%, rgba(255,231,200,0.6) 0%, transparent 65%),
          radial-gradient(80% 25% at 100% 70%, rgba(213,254,97,0.35) 0%, transparent 65%),
          radial-gradient(80% 30% at 0% 100%, rgba(220,210,196,0.6) 0%, transparent 60%),
          #F4F2EE`,
        display: 'flex',
        flexDirection: 'column',
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: '100%',
        boxSizing: 'border-box',
        fontFamily: "var(--font-inter), 'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
        color: '#0A0A0A',
      }}>

      <div
        className="animate-fade-in"
        style={{
          flex: '1 1 0%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'stretch',
          justifyContent: 'flex-start',
          padding: '72px 20px 130px',
          width: '100%',
          maxWidth: '420px',
          margin: '0 auto',
          boxSizing: 'border-box',
          overflow: 'hidden',
        }}
      >
        {/* HEADER */}
        <h1
          style={{
            fontFamily: "var(--font-unbounded), 'Unbounded', sans-serif",
            fontWeight: 700,
            fontSize: '26px',
            lineHeight: '112%',
            letterSpacing: '-0.6px',
            textAlign: 'left',
            margin: '0 0 6px 4px',
          }}
        >
          Экспертный анализ<br />от SkinIQ
        </h1>
        <p style={{
          fontSize: '14px',
          lineHeight: 1.45,
          color: '#6B7280',
          margin: '0 0 16px 4px',
          letterSpacing: '-0.1px',
        }}>
          Персональный профиль на основе ваших ответов
        </p>

        {/* HERO CARD */}
        <div style={{
          background: 'rgba(255,255,255,0.55)',
          backdropFilter: 'blur(28px) saturate(160%)',
          WebkitBackdropFilter: 'blur(28px) saturate(160%)',
          border: '1px solid rgba(255,255,255,0.75)',
          borderRadius: '24px',
          padding: '16px 18px',
          marginBottom: '10px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.06)',
          display: 'flex',
          alignItems: 'center',
          gap: '14px',
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontSize: '12px',
              color: '#6B7280',
              marginBottom: '4px',
              letterSpacing: '0.2px',
              textTransform: 'uppercase',
            }}>
              30 секунд
            </div>
            <div style={{
              fontFamily: "var(--font-unbounded), 'Unbounded', sans-serif",
              fontWeight: 700,
              fontSize: '18px',
              lineHeight: '120%',
              letterSpacing: '-0.4px',
            }}>
              Программа под вашу кожу
            </div>
            <div style={{
              fontSize: '12px',
              color: '#6B7280',
              marginTop: '4px',
              lineHeight: 1.4,
            }}>
              Учитываем ответы и 20+ параметров кожи
            </div>
          </div>
          <div style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            border: '4px solid #D5FE61',
            background: 'rgba(255,255,255,0.7)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '24px',
            flexShrink: 0,
          }}>
            <span aria-hidden>✨</span>
          </div>
        </div>

        {/* FEATURE CARDS */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          marginBottom: '10px',
        }}>
          {features.map((item) => (
            <div
              key={item.alt}
              style={{
                display: 'flex',
                flexDirection: 'row',
                alignItems: 'center',
                gap: '12px',
                background: 'rgba(255,255,255,0.55)',
                backdropFilter: 'blur(24px) saturate(160%)',
                WebkitBackdropFilter: 'blur(24px) saturate(160%)',
                border: '1px solid rgba(255,255,255,0.75)',
                borderRadius: '20px',
                padding: '12px 14px',
                boxShadow: '0 6px 20px rgba(0,0,0,0.04)',
                boxSizing: 'border-box',
              }}
            >
              <div style={{
                width: '42px',
                height: '42px',
                borderRadius: '50%',
                background: 'rgba(213,254,97,0.4)',
                border: '1px solid rgba(255,255,255,0.8)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}>
                <img
                  alt={item.alt}
                  src={item.icon}
                  fetchPriority="high"
                  decoding="sync"
                  style={{ width: '24px', height: '24px', objectFit: 'contain' }}
                />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: '14px',
                  fontWeight: 600,
                  lineHeight: 1.3,
                  letterSpacing: '-0.1px',
                  color: '#0A0A0A',
                  marginBottom: '1px',
                }}>
                  {item.title}
                </div>
                <div style={{
                  fontSize: '12px',
                  color: '#6B7280',
                  lineHeight: 1.35,
                }}>
                  {item.desc}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* DARK STAT CARD */}
        <div style={{
          background: 'rgba(10,10,10,0.88)',
          backdropFilter: 'blur(24px) saturate(140%)',
          WebkitBackdropFilter: 'blur(24px) saturate(140%)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '20px',
          padding: '14px 18px',
          display: 'flex',
          alignItems: 'center',
          gap: '14px',
          boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
        }}>
          <div style={{
            fontFamily: "var(--font-unbounded), 'Unbounded', sans-serif",
            fontWeight: 700,
            fontSize: '32px',
            lineHeight: 1,
            letterSpacing: '-1px',
            color: '#D5FE61',
            flexShrink: 0,
          }}>
            92%
          </div>
          <div style={{
            fontSize: '12px',
            color: 'rgba(255,255,255,0.85)',
            lineHeight: 1.4,
          }}>
            пользователей SkinIQ отмечают улучшение кожи за 1 месяц
          </div>
        </div>
      </div>

      <FixedContinueButton ctaText={screen.ctaText || 'Продолжить'} onClick={onContinue} />
    </div>
    </>
  );
}

// ФИКС: Оптимизация рендеринга - мемоизируем компонент для предотвращения лишних перерендеров
export const PersonalAnalysisScreen = React.memo(PersonalAnalysisScreenComponent);
