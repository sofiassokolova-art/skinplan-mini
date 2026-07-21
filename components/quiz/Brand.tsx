// components/quiz/Brand.tsx
// Единое написание бренда в анкете.
//
// Раньше «skiniq» писался строчным вручную в каждом экране, и защита от верхнего
// регистра (textTransform) стояла только у логотипных вхождений — инлайновые
// внутри заголовков и чип в сравнении её не имели. Регистр держался на дисциплине
// авторов, а не на коде. Здесь он задаётся CSS-трансформацией, поэтому любой
// источник (в том числе заголовки, приходящие из БД) отрендерится строчным.

import type { CSSProperties } from 'react';

export type BrandVariant = 'wordmark' | 'inline' | 'chip';

const VARIANT_STYLES: Record<BrandVariant, CSSProperties> = {
  // Логотип вверху экрана поверх фотофона: Inter, светлый, с тенью.
  wordmark: {
    fontFamily: "var(--font-inter), -apple-system, BlinkMacSystemFont, sans-serif",
    fontWeight: 500,
    fontSize: 'clamp(18px, 5vw, 24px)',
    color: 'var(--canvas-white)',
    letterSpacing: '0px',
    textShadow: '0 2px 16px rgba(0,0,0,0.48)',
  },
  // Внутри заголовка: наследует шрифт и размер окружающего текста,
  // чтобы не ломать типографику заголовков на Unbounded.
  inline: {},
  // Чип-метка в экране сравнения.
  chip: {
    fontFamily: "var(--font-inter), 'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    fontWeight: 500,
    letterSpacing: 0,
  },
};

export interface BrandProps {
  variant?: BrandVariant;
  className?: string;
  style?: CSSProperties;
}

export function Brand({ variant = 'inline', className, style }: BrandProps) {
  return (
    <span
      className={className}
      // textTransform идёт последним намеренно: перекрыть его через style нельзя.
      style={{ ...VARIANT_STYLES[variant], ...style, textTransform: 'lowercase' }}
    >
      skiniq
    </span>
  );
}
