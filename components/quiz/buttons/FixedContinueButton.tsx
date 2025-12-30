// components/quiz/buttons/FixedContinueButton.tsx
// Переиспользуемый компонент фиксированной кнопки "Продолжить" внизу экрана
// Убирает дублирование кода из renderInfoScreen

import React from 'react';

export interface FixedContinueButtonProps {
  ctaText?: string;
  onClick: () => void;
  disabled?: boolean;
  loadingText?: string;
}

export function FixedContinueButton({
  ctaText,
  onClick,
  disabled = false,
  loadingText = 'Загрузка...',
}: FixedContinueButtonProps) {
  if (!ctaText) return null;

  return (
    <div style={{
      position: 'fixed',
      bottom: 'clamp(40px, 6vh, 60px)',
      left: 0,
      right: 0,
      padding: '0 clamp(20px, 5vw, 40px)',
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
          maxWidth: 'clamp(224px, 60vw, 320px)',
          height: 'clamp(56px, 8vh, 64px)',
          borderRadius: '20px',
          background: disabled ? '#CCCCCC' : '#D5FE61',
          color: '#000000',
          border: 'none',
          fontFamily: "var(--font-inter), -apple-system, BlinkMacSystemFont, sans-serif",
          fontWeight: 600,
          fontSize: 'clamp(14px, 4vw, 16px)',
          cursor: disabled ? 'not-allowed' : 'pointer',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
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
        {disabled ? loadingText : String(ctaText || 'Продолжить')}
      </button>
    </div>
  );
}

