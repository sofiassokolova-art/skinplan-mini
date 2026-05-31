// app/(miniapp)/quiz/components/QuizFinalizingLoader.tsx
// Лоадер финализации анкеты — единый чёрно-серый стиль (как первый лоадер).
// Вынесен из page.tsx для упрощения основного компонента.

'use client';

import { AppLoader } from '@/components/AppLoader';

interface QuizFinalizingLoaderProps {
  finalizing: boolean;
  finalizingStep: 'answers' | 'plan' | 'done';
  finalizeError: string | null;
}

export function QuizFinalizingLoader({
  finalizing,
  finalizingStep: _finalizingStep,
  finalizeError,
}: QuizFinalizingLoaderProps) {
  if (!finalizing) return null;

  return (
    <AppLoader
      fullScreen
      variant="light"
      zIndex={50}
      message="Анализируем кожу..."
      subMessage="Это может занять до 1 минуты"
    >
      {finalizeError && (
        <p
          style={{
            margin: 0,
            color: '#B91C1C',
            fontSize: 14,
            lineHeight: 1.5,
            textAlign: 'center',
          }}
        >
          {finalizeError}
        </p>
      )}
    </AppLoader>
  );
}
