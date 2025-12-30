// components/quiz/QuizLoader.tsx
// Компонент лоадера для анкеты
// Вынесено из quiz/page.tsx для улучшения читаемости

import React from 'react';

export interface QuizLoaderProps {
  message?: string;
}

export function QuizLoader({ message = 'Загрузка анкеты...' }: QuizLoaderProps) {
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
        <div style={{ 
          color: '#0A5F59', 
          fontSize: '18px',
          marginBottom: '16px',
        }}>
          {message}
        </div>
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: '8px',
        }}>
          <div style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            backgroundColor: '#0A5F59',
            animation: 'pulse 1.5s ease-in-out infinite',
          }} />
          <div style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            backgroundColor: '#0A5F59',
            animation: 'pulse 1.5s ease-in-out infinite 0.3s',
          }} />
          <div style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            backgroundColor: '#0A5F59',
            animation: 'pulse 1.5s ease-in-out infinite 0.6s',
          }} />
        </div>
      </div>
      <style jsx>{`
        @keyframes pulse {
          0%, 100% {
            opacity: 0.3;
            transform: scale(1);
          }
          50% {
            opacity: 1;
            transform: scale(1.2);
          }
        }
      `}</style>
    </div>
  );
}

