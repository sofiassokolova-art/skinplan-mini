// components/quiz/buttons/FixedContinueButton.tsx
// Переиспользуемый компонент фиксированной кнопки "Продолжить" внизу экрана
// Убирает дублирование кода из renderInfoScreen

import React from 'react';

export interface FixedContinueButtonProps {
  ctaText?: string;
  onClick: () => void;
  disabled?: boolean;
  loadingText?: string;
  /** На инфо-экранах — зелёная (lime), на вопросах — чёрная */
  variant?: 'lime' | 'black';
}

export function FixedContinueButton({
  ctaText,
  onClick,
  disabled = false,
  loadingText = 'Продолжить',
  variant = 'lime',
}: FixedContinueButtonProps) {
  const displayText = ctaText ?? loadingText ?? 'Продолжить';
  if (variant === 'lime' && !ctaText) return null;

  const isBlack = variant === 'black';
  const bgColor = disabled
    ? (isBlack ? '#333333' : '#CCCCCC')
    : (isBlack ? '#000000' : '#D5FE61');
  const fgColor = isBlack ? '#FFFFFF' : '#000000';

  return (
    <div style={{
      position: 'fixed',
      bottom: 'clamp(24px, 5vh, 60px)',
      left: 0,
      right: 0,
      padding: '0 clamp(19px, 5vw, 38px)',
      background: 'transparent',
      zIndex: 100,
      display: 'flex',
      justifyContent: 'center',
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
          maxWidth: 300,
          height: 40,
          borderRadius: 0,
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

