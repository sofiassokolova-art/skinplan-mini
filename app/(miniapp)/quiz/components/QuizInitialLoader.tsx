// app/(miniapp)/quiz/components/QuizInitialLoader.tsx
// Компонент для отображения лоадера перед первым экраном

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
      position: 'relative',
    }}>
      {/* Лоадер в центре экрана - черный */}
      <div style={{
        width: '60px',
        height: '60px',
        border: '4px solid rgba(0, 0, 0, 0.1)',
        borderTop: '4px solid #000000',
        borderRadius: '50%',
        animation: 'spin 1s linear infinite',
      }}></div>
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
