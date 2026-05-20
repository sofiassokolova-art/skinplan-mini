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
    <div style={{
      position: 'fixed',
      inset: 0,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#FFFFFF',
      padding: '40px 20px',
      zIndex: 99998,
    }}>
      {/* Спиннер идентичный #root-loading в app/layout.tsx — чтобы при
          переходе React-фоллбэк ↔ статичный HTML не было визуального скачка. */}
      <div style={{
        width: 40,
        height: 40,
        borderRadius: '50%',
        border: '3px solid rgba(15, 23, 42, 0.12)',
        borderTopColor: '#111827',
        animation: 'spin 0.8s linear infinite',
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
