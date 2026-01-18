// app/(miniapp)/quiz/components/QuizInitialLoader.tsx
// Компонент для отображения простой надписи загрузки анкеты

'use client';

interface QuizInitialLoaderProps {
  // Параметры оставлены для обратной совместимости, но не используются
  message?: string;
  subMessage?: string;
}

export function QuizInitialLoader({
  message: _message,
  subMessage: _subMessage
}: QuizInitialLoaderProps) {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#FFFFFF',
      padding: '40px 20px',
    }}>
      <div style={{
        fontSize: '18px',
        fontWeight: '500',
        color: '#666',
        textAlign: 'center'
      }}>
        Загрузка...
      </div>
    </div>
  );
}
