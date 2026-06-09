// components/quiz/screens/AiComparisonScreen.tsx
// Редизайн экрана ai_comparison ("Больше никакой путаницы — AI SkinIQ
// подберёт уход быстро и точно"). Появляется после oral_medications, перед
// блоком "Предпочтения" (первый вопрос — makeup_frequency).
//
// Цель верстки — продающий «VS»-экран, визуально непохожий на остальные
// инфо-экраны (которые стопкой выкладывают одинаковые glass-карточки):
// две колонки лицом к лицу (обычный путь vs SkinIQ) с центральным VS-бейджем,
// time-теги «часы и дни» / «секунды» и прайс-якорь. Без эмодзи.

import React from 'react';
import Image from 'next/image';
import { BackButtonFixed } from '@/components/BackButtonFixed';
import { FixedContinueButton } from '../buttons/FixedContinueButton';
import type { InfoScreen } from '@/app/(miniapp)/quiz/info-screens';
import { getQuizInfoBackgroundImage } from '@/app/(miniapp)/quiz/image-assets';

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
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#E04A4A" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <line x1="6" y1="6" x2="18" y2="18" />
      <line x1="18" y1="6" x2="6" y2="18" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--ink)" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
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
  const backgroundImage = screen.image || getQuizInfoBackgroundImage(screen.id);
  const hint = content.hint ||
    'Большинство персональных планов укладывается в 3–5 средств — от 2 000 ₽/мес в бюджетном сегменте до 5 000+ ₽/мес в премиум.';

  const titleFont =
    "var(--font-unbounded), 'Unbounded', -apple-system, BlinkMacSystemFont, sans-serif";

  // Колонка сравнения. variant='skiniq' — приподнятая, лаймовая, акцентная.
  const renderColumn = (
    variant: 'old' | 'skiniq',
    heading: string,
    timeTag: string,
    items: string[],
  ) => {
    const isSkiniq = variant === 'skiniq';
    return (
      <div
        style={{
          flex: 1,
          minWidth: 0,
          position: 'relative',
          background: isSkiniq ? 'var(--glass-bg-strong)' : 'var(--glass-bg)',
          backdropFilter: 'blur(28px) saturate(160%)',
          WebkitBackdropFilter: 'blur(28px) saturate(160%)',
          border: isSkiniq ? `1.5px solid ${LIME}` : '1px solid var(--glass-border)',
          borderRadius: '22px',
          padding: isSkiniq ? '18px 14px 18px' : '16px 14px',
          marginTop: isSkiniq ? 0 : '14px',
          boxShadow: isSkiniq
            ? '0 14px 34px rgba(var(--accent-rgb),0.28)'
            : '0 6px 18px rgba(0,0,0,0.05)',
          opacity: isSkiniq ? 1 : 0.92,
          overflow: 'hidden',
        }}
      >
        {isSkiniq && (
          <div
            aria-hidden
            style={{
              position: 'absolute',
              top: -30,
              right: -26,
              width: 120,
              height: 120,
              background:
                'radial-gradient(circle, rgba(var(--accent-rgb),0.5) 0%, transparent 65%)',
              pointerEvents: 'none',
            }}
          />
        )}

        {/* time-тег */}
        <div
          style={{
            position: 'relative',
            display: 'inline-block',
            fontSize: 10.5,
            fontWeight: 700,
            letterSpacing: '0.4px',
            textTransform: 'uppercase',
            padding: '4px 9px',
            borderRadius: 999,
            marginBottom: 11,
            color: isSkiniq ? 'var(--ink)' : '#9097A1',
            background: isSkiniq ? LIME : 'rgba(var(--ink-rgb),0.07)',
            boxShadow: isSkiniq ? '0 2px 6px rgba(var(--accent-rgb),0.45)' : 'none',
          }}
        >
          {timeTag}
        </div>

        <div
          style={{
            position: 'relative',
            fontFamily: titleFont,
            fontWeight: 700,
            fontSize: '15px',
            letterSpacing: '-0.3px',
            color: isSkiniq ? 'var(--ink)' : '#6B7280',
            marginBottom: 13,
          }}
        >
          {heading}
        </div>

        <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 11 }}>
          {items.map((t) => (
            <div key={t} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
              <div
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: '50%',
                  background: isSkiniq ? LIME : 'rgba(224, 74, 74, 0.14)',
                  border: isSkiniq ? '1px solid rgba(0,0,0,0.08)' : 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  marginTop: 1,
                  boxShadow: isSkiniq ? '0 2px 5px rgba(var(--accent-rgb),0.4)' : 'none',
                }}
              >
                {isSkiniq ? <CheckIcon /> : <CrossIcon />}
              </div>
              <div
                style={{
                  fontSize: 13,
                  lineHeight: 1.4,
                  color: isSkiniq ? 'var(--ink)' : '#5C6168',
                  fontWeight: isSkiniq ? 500 : 400,
                }}
              >
                {t}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

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
        {/* Фон back1 + лаймовые угловые акценты */}
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
          aria-hidden
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 1,
            pointerEvents: 'none',
            background: `
              radial-gradient(55% 30% at 100% 0%, rgba(var(--accent-rgb),0.5) 0%, transparent 60%),
              radial-gradient(45% 24% at 0% 100%, rgba(var(--accent-rgb),0.3) 0%, transparent 60%)
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
            padding:
              'calc(56px + env(safe-area-inset-top, 0px)) 20px var(--quiz-fixed-cta-clearance, calc(96px + env(safe-area-inset-bottom, 0px)))',
            boxSizing: 'border-box',
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
            overflowY: 'auto',
            WebkitOverflowScrolling: 'touch',
          }}
        >
          {/* Eyebrow-бейдж */}
          <div
            style={{
              alignSelf: 'flex-start',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '1px',
              textTransform: 'uppercase',
              color: 'var(--ink)',
              background: LIME,
              padding: '6px 12px',
              borderRadius: 999,
              boxShadow: '0 4px 14px rgba(var(--accent-rgb),0.4)',
            }}
          >
            <span
              aria-hidden
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: 'var(--ink)',
                display: 'inline-block',
              }}
            />
            AI-подбор ухода
          </div>

          <h1
            style={{
              fontFamily: titleFont,
              fontWeight: 700,
              fontSize: '25px',
              lineHeight: '114%',
              letterSpacing: '-0.5px',
              margin: '0 0 2px',
              color: 'var(--ink)',
            }}
          >
            Больше никакой путаницы.
            <br />
            <span style={{ color: 'var(--ink)' }}>AI подберёт уход </span>
            <span
              style={{
                background: LIME,
                borderRadius: 7,
                padding: '0 6px',
                boxDecorationBreak: 'clone',
                WebkitBoxDecorationBreak: 'clone',
              }}
            >
              быстро и&nbsp;точно
            </span>
          </h1>

          {/* «VS»-сравнение: две колонки лицом к лицу */}
          <div style={{ position: 'relative', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            {renderColumn('old', 'Обычный путь', 'Часы и дни', traditionalItems)}
            {renderColumn('skiniq', 'SkinIQ', 'Секунды', skiniqItems)}

            {/* центральный VS-бейдж */}
            <div
              aria-hidden
              style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                width: 38,
                height: 38,
                borderRadius: '50%',
                background: 'var(--ink)',
                color: '#FFFFFF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: titleFont,
                fontWeight: 700,
                fontSize: 13,
                letterSpacing: '0.5px',
                boxShadow: '0 6px 16px rgba(0,0,0,0.28)',
                zIndex: 3,
              }}
            >
              VS
            </div>
          </div>

          {/* Прайс-якорь */}
          <div
            style={{
              marginTop: 2,
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              background: 'var(--glass-bg)',
              backdropFilter: 'blur(20px) saturate(150%)',
              WebkitBackdropFilter: 'blur(20px) saturate(150%)',
              border: '1px solid var(--glass-border)',
              borderRadius: 18,
              padding: '13px 15px',
            }}
          >
            <div
              style={{
                flexShrink: 0,
                fontFamily: titleFont,
                fontWeight: 700,
                fontSize: 19,
                lineHeight: 1,
                color: 'var(--ink)',
                background: LIME,
                borderRadius: 12,
                padding: '9px 11px',
                boxShadow: '0 3px 10px rgba(var(--accent-rgb),0.4)',
                whiteSpace: 'nowrap',
              }}
            >
              3–5
            </div>
            <div style={{ fontSize: 12.5, lineHeight: 1.45, color: '#1A1A1A' }}>{hint}</div>
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
