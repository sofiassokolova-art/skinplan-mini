// app/(miniapp)/quiz/components/ErrorBlock.tsx
// Переиспользуемый компонент блока ошибки

'use client';

interface ErrorBlockProps {
  message: string;
  onRetry?: () => void;
  className?: string;
}

export function ErrorBlock({ message, onRetry, className = '' }: ErrorBlockProps) {
  return (
    <div
      style={{
        padding: '24px',
        backgroundColor: '#FEF2F2',
        border: '1px solid #FECACA',
        borderRadius: '12px',
        margin: '20px',
      }}
      className={className}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          marginBottom: onRetry ? '16px' : '0',
        }}
      >
        <div
          style={{
            width: '24px',
            height: '24px',
            borderRadius: '50%',
            backgroundColor: '#EF4444',
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '14px',
            fontWeight: 'bold',
            flexShrink: 0,
          }}
        >
          !
        </div>
        <p
          style={{
            color: '#991B1B',
            fontSize: '16px',
            margin: 0,
            flex: 1,
          }}
        >
          {message}
        </p>
      </div>
      {onRetry && (
        <button
          onClick={onRetry}
          style={{
            padding: '8px 16px',
            backgroundColor: '#EF4444',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: '600',
            cursor: 'pointer',
          }}
        >
          Попробовать снова
        </button>
      )}
    </div>
  );
}

