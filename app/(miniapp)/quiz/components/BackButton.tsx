// app/(miniapp)/quiz/components/BackButton.tsx
// Переиспользуемый компонент кнопки "Назад"

'use client';

interface BackButtonProps {
  onClick: () => void;
  disabled?: boolean;
  className?: string;
}

export function BackButton({ onClick, disabled = false, className = '' }: BackButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '8px 16px',
        backgroundColor: 'transparent',
        border: 'none',
        color: disabled ? '#9CA3AF' : '#6B7280',
        fontSize: '16px',
        fontWeight: '500',
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'color 0.2s',
      }}
      className={className}
      onMouseEnter={(e) => {
        if (!disabled) {
          e.currentTarget.style.color = '#111827';
        }
      }}
      onMouseLeave={(e) => {
        if (!disabled) {
          e.currentTarget.style.color = '#6B7280';
        }
      }}
    >
      <svg
        width="20"
        height="20"
        viewBox="0 0 20 20"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M12.5 15L7.5 10L12.5 5"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      Назад
    </button>
  );
}

