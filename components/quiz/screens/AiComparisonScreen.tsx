// components/quiz/screens/AiComparisonScreen.tsx
// Экран ai_comparison («Зеркало»). Появляется после oral_medications, перед блоком
// «Предпочтения» (первый вопрос — makeup_frequency).
//
// Задача экрана — узнавание, а не аргументация: полноэкранное фото по цели
// пользователя, фраза от первого лица про его утро, и только внизу — короткое
// объяснение, что дело не в силе воли, а в способе подбора. Прежняя версия
// сравнивала два списка «как обычно / со skiniq» на фоне-предметке и выпадала
// из ряда остальных инфо-экранов.
//
// Тексты лежат в БД (quiz_screen_variants) и различаются по цели ухода, а фото
// единое для всех вариантов: mirror-кадр держит экран визуально стабильным.

import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import { BackButtonFixed } from '@/components/BackButtonFixed';
import { FixedContinueButton } from '../buttons/FixedContinueButton';
import type { InfoScreen } from '@/app/(miniapp)/quiz/info-screens';
import {
  AI_COMPARISON_FALLBACK,
  AI_COMPARISON_MIRROR_IMAGE,
  fetchScreenVariants,
  pickScreenVariant,
  type QuizScreenVariant,
} from '@/lib/quiz/screen-variants';

export interface AiComparisonScreenProps {
  screen: InfoScreen;
  currentInfoScreenIndex: number;
  onContinue: () => void;
  onBack?: () => void;
  isHandlingNext?: boolean;
  /** Лейблы целей и беспокойств пользователя — по ним выбирается вариант экрана. */
  goalLabels?: string[];
}

const TITLE_FONT =
  "var(--font-unbounded), 'Unbounded', -apple-system, BlinkMacSystemFont, sans-serif";

// Строка доверия — общая для всех целей, поэтому константа, а не поле варианта.
// Формулировка про выгоду и от лица бренда (skiniq, не «AI»), опирается на то, что
// движок реально делает — отбор по совместимости составов и противопоказаниям, —
// без непроверяемых чисел вроде «40+ параметров».
const AUTHORITY_TEXT = 'skiniq тщательно проверяет каждое средство на совместимость с вашей кожей';

function AiComparisonScreenComponent({
  screen,
  currentInfoScreenIndex,
  onContinue,
  onBack,
  isHandlingNext = false,
  goalLabels = [],
}: AiComparisonScreenProps) {
  const shouldShowBackButton = currentInfoScreenIndex > 0 && !!onBack;
  const goalLabelsKey = goalLabels.join('\u001f');

  // Стартуем с вшитого дефолта, чтобы экран отрисовался сразу и без скелетона:
  // фото и текст подменятся, как только приедут варианты.
  const [variant, setVariant] = useState<QuizScreenVariant>(AI_COMPARISON_FALLBACK);

  useEffect(() => {
    let cancelled = false;
    fetchScreenVariants(screen.id).then((variants) => {
      if (cancelled || !variants.length) return;
      setVariant(pickScreenVariant(variants, goalLabelsKey ? goalLabelsKey.split('\u001f') : []));
    });
    return () => {
      cancelled = true;
    };
  }, [screen.id, goalLabelsKey]);

  const handleBackWithScroll = () => {
    const scrollTop =
      window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop || 0;
    const scrollLeft =
      window.pageXOffset || document.documentElement.scrollLeft || document.body.scrollLeft || 0;
    onBack?.();
    setTimeout(() => window.scrollTo(scrollLeft, scrollTop), 0);
  };

  const isLongQuote = variant.quote.length > 44;

  return (
    <>
      <BackButtonFixed
        show={shouldShowBackButton}
        onClick={handleBackWithScroll}
        color="var(--ink)"
      />
      <div
        className="qz-mobile-fullscreen"
        style={{
          position: 'fixed',
          inset: 0,
          width: '100%',
          overflow: 'hidden',
          backgroundColor: 'var(--ink)',
          fontFamily: "var(--font-inter), 'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
        }}
      >
        {/* Единый mirror-кадр — во весь экран */}
        <Image
          key={AI_COMPARISON_MIRROR_IMAGE}
          className="qz-fullscreen-bg animate-fade-in"
          src={AI_COMPARISON_MIRROR_IMAGE}
          alt=""
          aria-hidden
          fill
          priority
          quality={92}
          // Лёгкое увеличение (scale 1.15 от верхнего края) опускает зеркало примерно
          // на середину между заголовком и нижней карточкой. Зум держим маленьким: при
          // 1.15 запрос ~1294px на DPR 3 против исходника 1228 — апскейл незаметен и
          // плоский фон остаётся без JPEG-блоков (в отличие от прежнего scale 1.5).
          sizes="120vw"
          style={{
            objectPosition: 'center',
            pointerEvents: 'none',
            transform: 'scale(1.15)',
            transformOrigin: 'center top',
          }}
        />

        {/* Скрим: кадр светлый, поэтому осветляем верх (под тёмный заголовок) и низ
            (под светлую карточку), середину с кожей оставляем чистой. */}
        <div
          aria-hidden
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'linear-gradient(180deg, rgba(252,252,251,0.55) 0%, rgba(252,252,251,0) 24%, rgba(0,0,0,0) 52%, rgba(0,0,0,0.5) 100%)',
            pointerEvents: 'none',
          }}
        />

        <div
          style={{
            position: 'relative',
            zIndex: 2,
            width: '100%',
            height: '100%',
            maxWidth: '420px',
            margin: '0 auto',
            padding:
              'calc(96px + env(safe-area-inset-top, 0px)) 20px var(--quiz-fixed-cta-clearance, calc(96px + env(safe-area-inset-bottom, 0px)))',
            boxSizing: 'border-box',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div className="animate-fade-in">
            <span
              style={{
                display: 'inline-block',
                fontSize: '11px',
                fontWeight: 700,
                letterSpacing: 0,
                textTransform: 'uppercase',
                padding: '5px 10px',
                borderRadius: 999,
                background: 'var(--accent)',
                color: 'var(--ink)',
                marginBottom: 14,
              }}
            >
              {variant.eyebrow}
            </span>

            <h1
              style={{
                fontFamily: TITLE_FONT,
                fontWeight: 700,
                fontSize: isLongQuote ? '20px' : '24px',
                lineHeight: '118%',
                letterSpacing: 0,
                color: 'var(--ink)',
                textShadow: '0 1px 12px rgba(255,255,255,0.7)',
                margin: 0,
              }}
            >
              {variant.quote}
            </h1>
          </div>

          {/* Объяснение + авторитет — в одной стеклянной карточке. Стекло того же
              цвета, что на первых двух экранах (welcome/how_it_works): тёмное лёгкое
              (--glass-dark-bg, blur 8px, светлая рамка), белый текст. Низ кадра
              затемнён скримом, чтобы белый текст читался. */}
          <div
            className="animate-fade-in"
            style={{
              marginTop: 'auto',
              borderRadius: 22,
              padding: '16px 18px',
              background: 'var(--glass-dark-bg)',
              border: '1px solid var(--glass-dark-border)',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
            }}
          >
            <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.4, fontWeight: 600, color: 'var(--canvas-white)' }}>
              {variant.bodyTitle}
            </p>
            <p
              style={{
                margin: '7px 0 0',
                fontSize: 13,
                lineHeight: 1.45,
                color: 'rgba(var(--canvas-white-rgb),0.72)',
              }}
            >
              {variant.bodyText}
            </p>

            {/* Строка авторитета — внутри той же карточки, отделена линией */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                marginTop: 13,
                paddingTop: 12,
                borderTop: '1px solid rgba(var(--canvas-white-rgb),0.16)',
              }}
            >
              <span
                aria-hidden
                style={{
                  width: 21,
                  height: 21,
                  flexShrink: 0,
                  borderRadius: '50%',
                  background: 'var(--accent)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="var(--ink)"
                  strokeWidth="2.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  <path d="M12 3l7 3v5c0 4.4-3 8.3-7 9.5-4-1.2-7-5.1-7-9.5V6l7-3Z" />
                  <path d="m9 11.5 2 2 4-4.5" />
                </svg>
              </span>
              <span
                style={{
                  fontSize: 11.5,
                  lineHeight: 1.3,
                  fontWeight: 600,
                  color: 'var(--canvas-white)',
                }}
              >
                {AUTHORITY_TEXT}
              </span>
            </div>
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
