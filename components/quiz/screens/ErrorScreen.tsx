// components/quiz/screens/ErrorScreen.tsx
// Компонент экрана ошибки для анкеты
// Вынесен из page.tsx для улучшения читаемости

import React from 'react';

export interface ErrorScreenProps {
  error: string;
  onRetry?: () => void;
  showRetry?: boolean;
}

export function ErrorScreen({ error, onRetry, showRetry = false }: ErrorScreenProps) {
  return (
    <div style={{ 
      padding: '20px', 
      textAlign: 'center',
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      background: 'linear-gradient(135deg, #F5FFFC 0%, #E8FBF7 100%)'
    }}>
      <div style={{
        backgroundColor: '#FEE2E2',
        border: '1px solid #FCA5A5',
        borderRadius: '12px',
        padding: '24px',
        maxWidth: '400px',
        width: '100%',
      }}>
        <div style={{
          color: '#DC2626',
          fontWeight: '600',
          marginBottom: '8px',
          fontSize: '18px',
        }}>
          ❌ Ошибка
        </div>
        <div style={{ 
          color: '#991B1B', 
          fontSize: '16px',
          lineHeight: '1.5',
          marginBottom: showRetry ? '20px' : '0',
        }}>
          {error}
        </div>
        {showRetry && onRetry && (
          <button
            onClick={onRetry}
            style={{
              marginTop: '16px',
              padding: '12px 24px',
              backgroundColor: '#0A5F59',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '16px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Попробовать снова
          </button>
        )}
      </div>
    </div>
  );
}

