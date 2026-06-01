// components/quiz/screens/AiComparisonScreen.tsx
// ФИКС #2: Редизайн экрана ai_comparison ("Больше никакой путаницы — AI SkinIQ
// подберёт уход быстро и точно"). Появляется после oral_medications, перед
// блоком "Предпочтения" (первый вопрос — makeup_frequency). Стиль — кремовый фон
// в духе PersonalAnalysisScreen, две сравнительные карточки (традиционный подбор
// ❌ vs SkinIQ ✅) и price-anchor подсказка. Старый монолитный inline-рендер
// (type='comparison' в QuizInfoScreen) теперь не используется для этого экрана.

import React from 'react';
import { BackButtonFixed } from '@/components/BackButtonFixed';
import { FixedContinueButton } from '../buttons/FixedContinueButton';
import type { InfoScreen } from '@/app/(miniapp)/quiz/info-screens';

export interface AiComparisonScreenProps {
  screen: InfoScreen;
  currentInfoScreenIndex: number;
  onContinue: () => void;
  onBack?: () => void;
  isHandlingNext?: boolean;
}

const LIME = 'var(--accent)';

const TRADITIONAL_ITEMS = [
  'Долгие поиски советов в интернете',
  'Сложно понять, что подойдёт именно вам',
];

const SKINIQ_ITEMS = [
  'Точный подбор средств на основе анкеты',
  'Рекомендации за пару секунд',
];

interface AiComparisonContent {
  traditionalItems?: string[];
  skiniqItems?: string[];
  hint?: string;
}

function CrossIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#E04A4A" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <line x1="6" y1="6" x2="18" y2="18" />
      <line x1="18" y1="6" x2="6" y2="18" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--ink)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function AiComparisonScreenComponent({
  screen,
  currentInfoScreenIndex,
  onContinue,
  onBack,
  isHandlingNext = false,
}: AiComparisonScreenProps) {
  const shouldShowBackButton = currentInfoScreenIndex > 0 && !!onBack;
  const content = (screen.content as AiComparisonContent | undefined) || {};
  const traditionalItems = content.traditionalItems || TRADITIONAL_ITEMS;
  const skiniqItems = content.skiniqItems || SKINIQ_ITEMS;
  const hint = content.hint ||
    'Большинство персональных планов укладывается в 3–5 средств — от 2 000 ₽/мес в бюджетном сегменте до 5 000+ ₽/мес в премиум.';

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
        {/* Кремовый фон + лаймовый угловой акцент */}
        <img
          src="/image%201576994977.webp"
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
              radial-gradient(40% 22% at 0% 100%, rgba(var(--accent-rgb),0.28) 0%, transparent 60%)
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
            padding: '72px 20px 110px',
            boxSizing: 'border-box',
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          <h1
            style={{
              fontFamily:
                "var(--font-unbounded), 'Unbounded', -apple-system, BlinkMacSystemFont, sans-serif",
              fontWeight: 700,
              fontSize: '24px',
              lineHeight: '115%',
              letterSpacing: '-0.5px',
              margin: '0 0 6px 4px',
              color: 'var(--ink)',
            }}
          >
            {screen.title || 'Больше никакой путаницы'}
          </h1>

          {/* Сравнительные карточки */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {/* Традиционный подбор */}
            <div
              style={{
                background: 'var(--glass-bg)',
                backdropFilter: 'blur(28px) saturate(160%)',
                WebkitBackdropFilter: 'blur(28px) saturate(160%)',
                border: '1px solid var(--glass-border)',
                borderRadius: '22px',
                padding: '16px 18px 18px',
                boxShadow: '0 8px 24px rgba(0,0,0,0.05)',
              }}
            >
              <div
                style={{
                  fontFamily:
                    "var(--font-unbounded), 'Unbounded', -apple-system, BlinkMacSystemFont, sans-serif",
                  fontWeight: 700,
                  fontSize: '14px',
                  letterSpacing: '-0.2px',
                  color: '#6B7280',
                  marginBottom: 12,
                  textTransform: 'uppercase',
                }}
              >
                Традиционный подбор
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {traditionalItems.map((t) => (
                  <div key={t} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                    <div
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: '50%',
                        background: 'rgba(224, 74, 74, 0.14)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        marginTop: 2,
                      }}
                    >
                      <CrossIcon />
                    </div>
                    <div style={{ fontSize: 14, lineHeight: 1.45, color: '#1A1A1A' }}>{t}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* SkinIQ с AI — с лаймовым акцентом */}
            <div
              style={{
                position: 'relative',
                background: 'var(--glass-bg-strong)',
                backdropFilter: 'blur(28px) saturate(160%)',
                WebkitBackdropFilter: 'blur(28px) saturate(160%)',
                border: `1.5px solid ${LIME}`,
                borderRadius: '22px',
                padding: '16px 18px 18px',
                boxShadow: '0 10px 28px rgba(var(--accent-rgb),0.22)',
                overflow: 'hidden',
              }}
            >
              <div
                aria-hidden
                style={{
                  position: 'absolute',
                  top: -28,
                  right: -24,
                  width: 110,
                  height: 110,
                  background:
                    'radial-gradient(circle, rgba(var(--accent-rgb),0.45) 0%, transparent 65%)',
                  pointerEvents: 'none',
                }}
              />
              <div
                style={{
                  position: 'relative',
                  fontFamily:
                    "var(--font-unbounded), 'Unbounded', -apple-system, BlinkMacSystemFont, sans-serif",
                  fontWeight: 700,
                  fontSize: '14px',
                  letterSpacing: '-0.2px',
                  color: 'var(--ink)',
                  marginBottom: 12,
                  textTransform: 'uppercase',
                }}
              >
                SkinIQ с AI ✨
              </div>
              <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 10 }}>
                {skiniqItems.map((t) => (
                  <div key={t} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                    <div
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: '50%',
                        background: LIME,
                        border: '1px solid rgba(0,0,0,0.08)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        marginTop: 2,
                        boxShadow: '0 2px 5px rgba(var(--accent-rgb),0.4)',
                      }}
                    >
                      <CheckIcon />
                    </div>
                    <div style={{ fontSize: 14, lineHeight: 1.45, color: 'var(--ink)', fontWeight: 500 }}>{t}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Price-anchor подсказка */}
          <div
            style={{
              marginTop: 6,
              background: 'rgba(var(--ink-rgb),0.06)',
              border: '1px dashed rgba(var(--ink-rgb),0.16)',
              borderRadius: 16,
              padding: '12px 14px',
              fontSize: 12.5,
              lineHeight: 1.5,
              color: '#1A1A1A',
            }}
          >
            💡 {hint}
          </div>
        </div>

        <FixedContinueButton
          ctaText={screen.ctaText || 'Продолжить'}
          onClick={onContinue}
          disabled={isHandlingNext}
        />
      </div>
    </>
  );
}

export const AiComparisonScreen = React.memo(AiComparisonScreenComponent);
