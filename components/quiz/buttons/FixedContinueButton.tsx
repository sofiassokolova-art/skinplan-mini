// components/quiz/buttons/FixedContinueButton.tsx
// Унифицированная фиксированная кнопка для всех инфо-экранов (текст задаётся через ctaText: «Начать» на первом экране, «Продолжить» на остальных)

import React from 'react';

export interface FixedContinueButtonProps {
  ctaText?: string;
  onClick: () => void;
  disabled?: boolean;
  loadingText?: string;
  /** Primary-действия по умолчанию чёрные; lime оставлен для редких акцентных вариантов. */
  variant?: 'lime' | 'black';
}

export function FixedContinueButton({
  ctaText,
  onClick,
  disabled = false,
  loadingText = 'Продолжить',
  variant = 'black',
}: FixedContinueButtonProps) {
  const displayText = ctaText ?? loadingText ?? 'Продолжить';
  if (!ctaText) return null;

  const isBlack = variant === 'black';
  const bgColor = disabled
    ? (isBlack ? '#333333' : '#CCCCCC')
    : (isBlack ? '#000000' : '#D5FE61');
  const fgColor = isBlack ? '#FFFFFF' : '#000000';

  return (
    <div className="qz-fixed-cta" style={{
      position: 'fixed',
      bottom: 'clamp(24px, 5vh, 60px)',
      left: 0,
      right: 0,
      padding: '0 20px',
      background: 'transparent',
      zIndex: 100,
      display: 'flex',
      justifyContent: 'center',
      boxSizing: 'border-box',
    }}>
      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (!disabled) {
            onClick();
          }
        }}
        disabled={disabled}
        style={{
          width: '100%',
          maxWidth: 640,
          height: 52,
          borderRadius: 999,
          background: bgColor,
          color: fgColor,
          border: 'none',
          fontFamily: "var(--font-inter), -apple-system, BlinkMacSystemFont, sans-serif",
          fontWeight: 400,
          fontSize: 'clamp(14px, 4vw, 16px)',
          textTransform: 'uppercase',
          cursor: disabled ? 'not-allowed' : 'pointer',
          boxShadow: 'none',
          transition: 'transform 0.2s, box-shadow 0.2s',
          opacity: disabled ? 0.6 : 1,
        }}
        onMouseDown={(e) => {
          if (!disabled) {
            e.currentTarget.style.transform = 'scale(0.98)';
          }
        }}
        onMouseUp={(e) => {
          e.currentTarget.style.transform = 'scale(1)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'scale(1)';
        }}
      >
        {disabled ? (loadingText ?? 'Продолжить') : String(displayText)}
      </button>
    </div>
  );
}
