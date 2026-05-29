// components/AnalysisLoading.tsx
// Экран загрузки с прогресс-баром для анализа кожи

'use client';

import { useEffect, useState } from 'react';
import { AppLoader } from '@/components/AppLoader';

interface AnalysisLoadingProps {
  onComplete: () => void;
  duration?: number; // Длительность в миллисекундах (по умолчанию 5-7 сек)
}

export function AnalysisLoading({ onComplete, duration = 6000 }: AnalysisLoadingProps) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const startTime = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const newProgress = Math.min((elapsed / duration) * 100, 100);
      setProgress(newProgress);

      if (newProgress >= 100) {
        clearInterval(interval);
        // Небольшая задержка перед завершением для плавности
        setTimeout(() => {
          onComplete();
        }, 300);
      }
    }, 50); // Обновляем каждые 50мс для плавности

    return () => clearInterval(interval);
  }, [duration, onComplete]);

  return (
    <AppLoader
      variant="light"
      progress={progress}
      showProgressPercent={false}
      message="Подбираем персональный уход"
      subMessage="Анализируем ваши ответы и состояние кожи…"
    />
  );
}
