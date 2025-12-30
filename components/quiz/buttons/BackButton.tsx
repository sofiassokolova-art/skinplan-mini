// components/quiz/buttons/BackButton.tsx
// Переиспользуемый компонент кнопки "Назад" для info screens
// Убирает дублирование кода из renderInfoScreen

import React from 'react';

export interface BackButtonProps {
  onClick: () => void;
  label?: string;
}

export function BackButton({ onClick, label = 'Назад' }: BackButtonProps) {
  return (
    <div style={{
      position: 'absolute',
      top: 'clamp(20px, 4vh, 40px)',
      left: 'clamp(19px, 5vw, 24px)',
      zIndex: 10,
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
    }}>
      <button
        onClick={onClick}
        style={{
          width: '34px',
          height: '34px',
          borderRadius: '10px',
          background: '#D5FE61',
          border: 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          padding: 0,
        }}
      >
        <svg
          width="7"
          height="14"
          viewBox="0 0 7 14"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          style={{
            transform: 'rotate(180deg)',
          }}
        >
          <path
            d="M1 1L6 7L1 13"
            stroke="#000000"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      <span style={{
        fontFamily: "var(--font-inter), 'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
        fontWeight: 400,
        fontStyle: 'normal',
        fontSize: '14px',
        lineHeight: '34px',
        letterSpacing: '0px',
        textAlign: 'center',
        color: '#000000',
      }}>
        {label}
      </span>
    </div>
  );
}

