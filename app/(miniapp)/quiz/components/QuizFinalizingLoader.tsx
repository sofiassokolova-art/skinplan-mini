// app/(miniapp)/quiz/components/QuizFinalizingLoader.tsx
// Компонент для отображения лоадера финализации анкеты
// Вынесен из page.tsx для упрощения основного компонента

'use client';

interface QuizFinalizingLoaderProps {
  finalizing: boolean;
  finalizingStep: 'answers' | 'plan' | 'done';
  finalizeError: string | null;
}

export function QuizFinalizingLoader({
  finalizing,
  finalizingStep,
  finalizeError,
}: QuizFinalizingLoaderProps) {
  if (!finalizing) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center">
      <div className="rounded-2xl bg-white/10 border border-white/20 p-6 text-white w-[320px] backdrop-blur-md">
        <div className="text-lg font-semibold mb-2">Анализируем кожу...</div>
        <div className="mt-2 text-sm opacity-80 mb-4">
          Это может занять до 1 минуты
        </div>
        <div className="mt-4 h-2 w-full bg-white/20 rounded-full overflow-hidden">
          <div
            className="h-2 bg-white rounded-full animate-pulse"
            style={{ width: '100%' }}
          />
        </div>
        {finalizeError && (
          <div className="mt-4 text-sm text-red-300">
            {finalizeError}
          </div>
        )}
      </div>
    </div>
  );
}

