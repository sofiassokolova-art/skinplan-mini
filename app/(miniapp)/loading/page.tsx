// app/(miniapp)/loading/page.tsx
// Страница последовательной загрузки: answers → recommendations → generate → plan

'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';

type LoadingStep =
  | 'saving_answers'
  | 'building_recommendations'
  | 'generating_plan'
  | 'loading_plan'
  | 'done'
  | 'error';

const STEP_LABELS: Record<LoadingStep, string> = {
  saving_answers: 'Сохраняем ответы...',
  building_recommendations: 'Анализируем кожу...',
  generating_plan: 'Подбираем средства...',
  loading_plan: 'Составляем план на 28 дней...',
  done: 'Готово!',
  error: 'Произошла ошибка',
};

const STEP_PROGRESS: Record<LoadingStep, number> = {
  saving_answers: 10,
  building_recommendations: 30,
  generating_plan: 60,
  loading_plan: 90,
  done: 100,
  error: 0,
};

export default function LoadingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [step, setStep] = useState<LoadingStep>('saving_answers');
  const [error, setError] = useState<string | null>(null);
  const [profileId, setProfileId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const sid = searchParams.get('sid');
    const questionnaireId = searchParams.get('questionnaireId');
    const answersJson = searchParams.get('answers');

    if (!sid || !questionnaireId || !answersJson) {
      setError('Отсутствуют необходимые параметры');
      setStep('error');
      return;
    }

    let answers: any[];
    try {
      answers = JSON.parse(decodeURIComponent(answersJson));
    } catch (e) {
      setError('Неверный формат ответов');
      setStep('error');
      return;
    }

    (async () => {
      try {
        // Шаг 1: Сохранение ответов
        if (cancelled) return;
        setStep('saving_answers');

        const answersRes = await api.submitAnswers({
          questionnaireId: parseInt(questionnaireId),
          answers,
          clientSubmissionId: sid,
        });

        const profile = answersRes?.profile;
        if (!profile?.id || !profile?.version) {
          throw new Error('Профиль не был создан');
        }

        const resolvedProfileId = profile.id;
        const version = profile.version;
        setProfileId(resolvedProfileId);

        if (cancelled) return;

        // Шаг 2: Подбор рекомендаций
        setStep('building_recommendations');
        try {
          await api.buildRecommendations(resolvedProfileId);
        } catch (err: any) {
          // Не критично, продолжаем
          console.warn('Recommendations build failed (non-critical):', err);
        }

        if (cancelled) return;

        // Шаг 3: Генерация плана
        setStep('generating_plan');
        const generateRes = await api.generatePlan(resolvedProfileId);
        
        if (!generateRes?.plan28 && !generateRes?.weeks) {
          throw new Error('План не был сгенерирован');
        }

        if (cancelled) return;

        // Шаг 4: Загрузка плана (прогрев кэша)
        setStep('loading_plan');
        try {
          await api.getPlan(resolvedProfileId);
        } catch (err: any) {
          // Не критично, план уже сгенерирован
          console.warn('Plan preload failed (non-critical):', err);
        }

        if (cancelled) return;

        // Шаг 5: Готово - редирект на план
        setStep('done');
        
        // Небольшая задержка для показа "Готово"
        await new Promise((resolve) => setTimeout(resolve, 500));

        if (cancelled) return;

        // Редирект на план с параметрами
        router.replace(`/plan?profileId=${resolvedProfileId}&paywall=1&blur=1`);
      } catch (e: any) {
        if (cancelled) return;
        console.error('Loading pipeline error:', e);
        setError(e?.message || 'Произошла ошибка при создании плана');
        setStep('error');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [router, searchParams]);

  const progress = STEP_PROGRESS[step];
  const label = STEP_LABELS[step];

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-b from-purple-50 to-white p-4">
      <div className="w-full max-w-md">
        {/* Прогресс бар */}
        <div className="mb-8">
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-500 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-center mt-4 text-gray-600 text-lg font-medium">
            {label}
          </p>
          {step !== 'error' && step !== 'done' && (
            <p className="text-center mt-2 text-gray-400 text-sm">
              Это может занять до 1 минуты
            </p>
          )}
        </div>

        {/* Ошибка */}
        {step === 'error' && error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
            <p className="text-red-800 text-sm">{error}</p>
            <button
              onClick={() => router.push('/quiz')}
              className="mt-4 w-full bg-red-500 text-white py-2 px-4 rounded-lg hover:bg-red-600 transition-colors"
            >
              Вернуться к анкете
            </button>
          </div>
        )}

        {/* Индикатор загрузки */}
        {step !== 'error' && step !== 'done' && (
          <div className="flex justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500" />
          </div>
        )}
      </div>
    </div>
  );
}

