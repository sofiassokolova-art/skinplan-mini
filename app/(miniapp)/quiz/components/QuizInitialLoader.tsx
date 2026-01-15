// app/(miniapp)/quiz/components/QuizInitialLoader.tsx
// Компонент для отображения начального лоадера анкеты

'use client';

interface QuizInitialLoaderProps {
  message?: string;
  subMessage?: string;
}

export function QuizInitialLoader({ 
  message = 'Загрузка анкеты...',
  subMessage = 'Подождите, мы готовим анкету для вас'
}: QuizInitialLoaderProps) {
  return (
    <div style={{ 
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #F5FFFC 0%, #E8FBF7 100%)',
      padding: '40px 20px',
    }}>
      <div style={{
        width: '64px',
        height: '64px',
        border: '5px solid rgba(10, 95, 89, 0.2)',
        borderTop: '5px solid #0A5F59',
        borderRadius: '50%',
        animation: 'spin 1s linear infinite',
        marginBottom: '32px',
      }}></div>
      <div style={{ color: '#0A5F59', fontSize: '20px', fontWeight: 600, marginBottom: '8px' }}>
        {message}
      </div>
      <div style={{ color: '#6B7280', fontSize: '14px', textAlign: 'center' }}>
        {subMessage}
      </div>
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
