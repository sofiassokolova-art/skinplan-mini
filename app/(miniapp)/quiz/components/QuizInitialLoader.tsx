// app/(miniapp)/quiz/components/QuizInitialLoader.tsx
// Компонент для отображения лоадера перед первым экраном

'use client';

import { useEffect, useState } from 'react';

interface QuizInitialLoaderProps {
  message?: string;
  subMessage?: string;
  // Если передан onTimeout — вызывается через timeoutMs если лоадер всё ещё показывается
  onTimeout?: () => void;
  timeoutMs?: number;
}

export function QuizInitialLoader({
  message: _message,
  subMessage: _subMessage,
  onTimeout,
  timeoutMs = 8000,
}: QuizInitialLoaderProps) {
  const [showReload, setShowReload] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => {
      setShowReload(true);
      onTimeout?.();
    }, timeoutMs);
    return () => clearTimeout(t);
  }, [onTimeout, timeoutMs]);

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
        width: '60px',
        height: '60px',
        border: '4px solid rgba(0, 0, 0, 0.1)',
        borderTop: '4px solid #000000',
        borderRadius: '50%',
        animation: 'spin 1s linear infinite',
      }} />
      {showReload && (
        <div style={{ marginTop: 24, textAlign: 'center' }}>
          <p style={{ color: '#666', fontSize: 14, marginBottom: 12 }}>
            Загрузка занимает больше времени, чем обычно
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: '10px 24px',
              background: '#0A5F59',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              fontSize: 14,
              cursor: 'pointer',
            }}
          >
            Обновить
          </button>
        </div>
      )}
    </div>
  );
}
