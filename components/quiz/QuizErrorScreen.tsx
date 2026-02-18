// components/quiz/QuizErrorScreen.tsx
// Компонент экрана ошибки для анкеты
// Вынесено из quiz/page.tsx для улучшения читаемости

import React from 'react';

export interface QuizErrorScreenProps {
  error: string;
  onRetry?: () => void;
}

export function QuizErrorScreen({ error, onRetry }: QuizErrorScreenProps) {
  return (
    <div style={{
      padding: '20px',
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      background: 'linear-gradient(135deg, #F5FFFC 0%, #E8FBF7 100%)'
    }}>
      <div style={{
        backgroundColor: 'rgba(255, 255, 255, 0.56)',
        backdropFilter: 'blur(28px)',
        borderRadius: '24px',
        padding: '24px',
        maxWidth: '400px',
        textAlign: 'center',
      }}>
        <h1 style={{ color: '#0A5F59', marginBottom: '16px' }}>Ошибка</h1>
        <p style={{ color: '#475467', marginBottom: '24px' }}>
          {error || 'Произошла неизвестная ошибка'}
        </p>
        {onRetry && (
          <button
            onClick={onRetry}
            style={{
              padding: '12px 24px',
              borderRadius: '12px',
              backgroundColor: '#0A5F59',
              color: 'white',
              border: 'none',
              cursor: 'pointer',
              fontSize: '16px',
              fontWeight: 'bold',
            }}
          >
            Обновить страницу
          </button>
        )}
      </div>
    </div>
  );
}

