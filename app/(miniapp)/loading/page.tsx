// app/(miniapp)/loading/page.tsx
// Страница последовательной загрузки: answers → recommendations → generate → plan

'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import { AppLoader } from '@/components/AppLoader';

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

  useEffect(() => {
    let cancelled = false;
    const profileIdParam = searchParams.get('profileId');
    const sid = searchParams.get('sid');
    const questionnaireId = searchParams.get('questionnaireId');
    const answersJson = searchParams.get('answers');

    // Два потока:
    // 1) profileId — из quiz/submitAnswers (единый поток): пропускаем submitAnswers
    // 2) sid + questionnaireId + answers — внешний вход (deep link): полный цикл
    const hasProfileIdOnly = profileIdParam && !sid && !questionnaireId && !answersJson;
    const hasFullParams = sid && questionnaireId && answersJson;

    if (!hasProfileIdOnly && !hasFullParams) {
      setError('Отсутствуют необходимые параметры (profileId или sid+questionnaireId+answers)');
      setStep('error');
      return;
    }

    (async () => {
      let resolvedProfileId: string;

      try {
        if (hasProfileIdOnly) {
          resolvedProfileId = profileIdParam!;
        } else {
          // Полный цикл: сохранение ответов
          if (cancelled) return;
          setStep('saving_answers');

          let answers: any[];
          try {
            answers = JSON.parse(decodeURIComponent(answersJson!));
          } catch (e) {
            setError('Неверный формат ответов');
            setStep('error');
            return;
          }

          const answersRes = await api.submitAnswers({
            questionnaireId: parseInt(questionnaireId!),
            answers,
            clientSubmissionId: sid!,
          });

          const profile = answersRes?.profile;
          if (!profile?.id || !profile?.version) {
            throw new Error('Профиль не был создан');
          }
          resolvedProfileId = profile.id;
        }

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

        // Шаг 5: Готово — редирект на страницу плана с пейволлом
        // Поток: лоадер → план → пейволл (без навигации) → после оплаты план разблокируется и появляется навигация
        setStep('done');

        await new Promise((resolve) => setTimeout(resolve, 500));

        if (cancelled) return;

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

  return (
    <AppLoader
      variant="light"
      progress={step === 'error' ? undefined : STEP_PROGRESS[step]}
      showProgressPercent={false}
      showAnimation={step !== 'error'}
      message={STEP_LABELS[step]}
      subMessage={step !== 'error' && step !== 'done' ? 'Это может занять до 1 минуты' : undefined}
    >
      {step === 'error' && error && (
        <div
          style={{
            background: '#1A1A1A',
            border: '1px solid #D5FE61',
            borderRadius: '16px',
            padding: '20px',
          }}
        >
          <p style={{ color: '#FFFFFF', fontSize: '14px', lineHeight: '140%', margin: 0 }}>
            {error}
          </p>
          <button
            onClick={() => router.push('/quiz')}
            style={{
              marginTop: '16px',
              width: '100%',
              background: '#D5FE61',
              color: '#000000',
              padding: '14px 16px',
              borderRadius: '999px',
              border: 'none',
              fontSize: '16px',
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            Вернуться к анкете
          </button>
        </div>
      )}
    </AppLoader>
  );
}
