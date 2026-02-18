// app/(miniapp)/quiz/components/QuizErrorScreen.tsx
// Компонент для отображения ошибок анкеты

'use client';

interface QuizErrorScreenProps {
  title: string;
  message: string;
  buttonText?: string;
  onReload?: () => void;
}

export function QuizErrorScreen({ 
  title, 
  message, 
  buttonText = 'Обновить страницу',
  onReload
}: QuizErrorScreenProps) {
  const handleReload = () => {
    if (onReload) {
      onReload();
    } else if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

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
        padding: '48px',
        maxWidth: '400px',
        textAlign: 'center',
      }}>
        <div style={{
          fontSize: '48px',
          marginBottom: '24px',
        }}>⚠️</div>
        <h2 style={{ color: '#0A5F59', marginBottom: '12px', fontSize: '20px', fontWeight: 'bold' }}>
          {title}
        </h2>
        <p style={{ color: '#475467', fontSize: '16px', lineHeight: '1.5', marginBottom: '24px' }}>
          {message}
        </p>
        <button
          onClick={handleReload}
          style={{
            backgroundColor: '#0A5F59',
            color: 'white',
            border: 'none',
            borderRadius: '12px',
            padding: '12px 24px',
            fontSize: '16px',
            fontWeight: 'bold',
            cursor: 'pointer',
          }}
        >
          {buttonText}
        </button>
      </div>
    </div>
  );
}
