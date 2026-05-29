// app/(miniapp)/quiz/components/QuizInitialLoader.tsx
// Компонент для отображения лоадера перед первым экраном

'use client';

import { useEffect, useState } from 'react';
import { AppLoader } from '@/components/AppLoader';

interface QuizInitialLoaderProps {
  message?: string;
  subMessage?: string;
  // Если передан onTimeout — вызывается через timeoutMs если лоадер всё ещё показывается
  onTimeout?: () => void;
  timeoutMs?: number;
}

export function QuizInitialLoader({
  message,
  subMessage,
  onTimeout,
  timeoutMs = 12_000, // 12 сек: даём время на cold start БД (Neon до ~15 сек) и медленную сеть
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
    <AppLoader
      fullScreen
      variant="light"
      message={message}
      subMessage={subMessage}
    >
      {showReload && (
        <div style={{ textAlign: 'center' }}>
          <p style={{ color: '#A3A3A3', fontSize: 14, marginBottom: 12 }}>
            Загрузка занимает больше времени, чем обычно
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: '10px 24px',
              background: '#D5FE61',
              color: '#0A0A0A',
              border: 'none',
              borderRadius: 999,
              fontSize: 14,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Обновить
          </button>
        </div>
      )}
    </AppLoader>
  );
}
