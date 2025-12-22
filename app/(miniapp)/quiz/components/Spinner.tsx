// app/(miniapp)/quiz/components/Spinner.tsx
// Переиспользуемый компонент спиннера

'use client';

interface SpinnerProps {
  size?: 'small' | 'medium' | 'large';
  color?: string;
  className?: string;
}

const sizeMap = {
  small: 24,
  medium: 48,
  large: 64,
};

export function Spinner({ size = 'medium', color = '#0A5F59', className = '' }: SpinnerProps) {
  const spinnerSize = sizeMap[size];

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
      }}
      className={className}
    >
      <div
        style={{
          width: `${spinnerSize}px`,
          height: `${spinnerSize}px`,
          border: `4px solid rgba(${color === '#0A5F59' ? '10, 95, 89' : '255, 255, 255'}, 0.2)`,
          borderTop: `4px solid ${color}`,
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
        }}
      />
      <style jsx>{`
        @keyframes spin {
          0% {
            transform: rotate(0deg);
          }
          100% {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  );
}

