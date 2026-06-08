// app/(miniapp)/quiz/components/QuizInitialLoader.tsx
// Компонент для отображения лоадера перед первым экраном.
// Дополнительно префетчит ленивые чанки анкеты, чтобы переход
// LOADER → INFO/QUESTION был мгновенным после прилёта данных.

'use client';

import { useEffect, useState } from 'react';
import { AppLoader } from '@/components/AppLoader';
import { preloadQuizImages } from '../image-assets';

interface QuizInitialLoaderProps {
  message?: string;
  subMessage?: string;
  // Если передан onTimeout — вызывается через timeoutMs если лоадер всё ещё показывается
  onTimeout?: () => void;
  timeoutMs?: number;
}

// Префетч ленивых чанков следующих экранов анкеты — запускается уже на лоадере,
// пока React Query тянет /api/questionnaire. Когда данные прилетят, чанки
// будут в кэше браузера → переход без мигания и без второго лоадера.
function prefetchQuizChunks(): void {
  if (typeof window === 'undefined') return;
  // dynamic import без await — браузер скачивает и парсит модули в фоне
  void import('./QuizInfoScreen');
  void import('./QuizQuestion');
  void import('./QuizResumeScreen');
  preloadQuizImages();
}

export function QuizInitialLoader({
  message,
  subMessage,
  onTimeout,
  timeoutMs = 12_000, // 12 сек: даём время на cold start БД (Neon до ~15 сек) и медленную сеть
}: QuizInitialLoaderProps) {
  const [showReload, setShowReload] = useState(false);

  useEffect(() => {
    // Префетч следующих экранов параллельно с загрузкой данных
    prefetchQuizChunks();

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
          <p style={{ color: '#6B7280', fontSize: 14, marginBottom: 12 }}>
            Загрузка занимает больше времени, чем обычно
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: '10px 24px',
              background: '#0A0A0A',
              color: '#FFFFFF',
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
