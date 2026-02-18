// app/(miniapp)/quiz/components/QuizErrorDisplay.tsx
// Компонент для отображения ошибок в анкете
// Вынесен из page.tsx для упрощения основного компонента

'use client';

interface QuizErrorDisplayProps {
  error: string | null;
}

export function QuizErrorDisplay({ error }: QuizErrorDisplayProps) {
  if (!error) return null;

  return (
    <div style={{
      backgroundColor: '#FEE2E2',
      border: '1px solid #FCA5A5',
      borderRadius: '12px',
      padding: '16px',
      marginBottom: '20px',
      textAlign: 'center',
    }}>
      <div style={{
        color: '#DC2626',
        fontWeight: '600',
        marginBottom: '4px',
        fontSize: '14px',
      }}>
        ❌ Ошибка
      </div>
      <div style={{ 
        color: '#991B1B', 
        fontSize: '14px',
        lineHeight: '1.4',
      }}>
        {error || 'Произошла ошибка'}
      </div>
    </div>
  );
}

