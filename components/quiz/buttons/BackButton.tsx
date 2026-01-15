// components/quiz/buttons/BackButton.tsx
// Переиспользуемый компонент кнопки "Назад" для info screens
// ОБНОВЛЕНО: Простая стрелка без фона и текста

import React from 'react';

export interface BackButtonProps {
  onClick: () => void;
}

export function BackButton({ onClick }: BackButtonProps) {
  return (
    <button
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onClick();
      }}
      style={{
        position: 'fixed',
        top: 'clamp(20px, 4vh, 40px)',
        left: 'clamp(19px, 5vw, 24px)',
        zIndex: 1000,
        width: '44px',
        height: '44px',
        background: 'transparent',
        border: 'none',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        padding: 0,
        pointerEvents: 'auto',
      }}
    >
      <svg
        width="12"
        height="20"
        viewBox="0 0 12 20"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M10 2L2 10L10 18"
          stroke="#1A1A1A"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}
