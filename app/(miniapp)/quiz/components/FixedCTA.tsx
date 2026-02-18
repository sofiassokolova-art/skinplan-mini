// app/(miniapp)/quiz/components/FixedCTA.tsx
// Переиспользуемый компонент фиксированной кнопки CTA

'use client';

interface FixedCTAProps {
  onClick?: () => void | Promise<void>;
  disabled?: boolean;
  loading?: boolean;
  children: React.ReactNode;
  className?: string;
  variant?: 'primary' | 'secondary';
}

export function FixedCTA({
  onClick,
  disabled = false,
  loading = false,
  children,
  className = '',
  variant = 'primary',
}: FixedCTAProps) {
  const baseStyles = {
    position: 'fixed' as const,
    bottom: 0,
    left: 0,
    right: 0,
    padding: '16px 20px',
    paddingBottom: 'calc(16px + env(safe-area-inset-bottom))',
    backgroundColor: 'white',
    borderTop: '1px solid #E5E7EB',
    zIndex: 1000,
    boxShadow: '0 -4px 6px -1px rgba(0, 0, 0, 0.1)',
  };

  const buttonStyles = {
    width: '100%',
    padding: '14px 24px',
    borderRadius: '12px',
    fontSize: '16px',
    fontWeight: '600' as const,
    border: 'none',
    cursor: disabled || loading ? 'not-allowed' : 'pointer',
    transition: 'all 0.2s',
    ...(variant === 'primary'
      ? {
          backgroundColor: disabled || loading ? '#D1D5DB' : '#0A5F59',
          color: 'white',
        }
      : {
          backgroundColor: disabled || loading ? '#F3F4F6' : 'white',
          color: disabled || loading ? '#9CA3AF' : '#0A5F59',
          border: '1px solid #0A5F59',
        }),
  };

  return (
    <div style={baseStyles} className={className}>
      <button
        onClick={onClick}
        disabled={disabled || loading}
        style={buttonStyles}
        onMouseEnter={(e) => {
          if (!disabled && !loading) {
            e.currentTarget.style.opacity = '0.9';
          }
        }}
        onMouseLeave={(e) => {
          if (!disabled && !loading) {
            e.currentTarget.style.opacity = '1';
          }
        }}
      >
        {loading ? 'Загрузка...' : children}
      </button>
    </div>
  );
}

