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

  const progress = STEP_PROGRESS[step];
  const label = STEP_LABELS[step];

  // Палитра анкеты: чёрный фон, лаймовые акценты (#D5FE61), белый текст.
  // Та же палитра используется в QuizQuestion / FixedContinueButton.
  const LIME = '#D5FE61';
  const BLACK = '#000000';
  const WHITE = '#FFFFFF';

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        background: BLACK,
        padding: '24px',
        fontFamily: "var(--font-inter), 'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
      }}
    >
      <div style={{ width: '100%', maxWidth: '420px' }}>
        {/* Лаймовый «пульс» — лёгкая визуальная активность пока пайплайн работает */}
        {step !== 'error' && (
          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              marginBottom: '40px',
            }}
          >
            <div
              style={{
                width: '88px',
                height: '88px',
                borderRadius: '50%',
                background: LIME,
                animation: 'skinplan-pulse 1.6s ease-in-out infinite',
              }}
            />
          </div>
        )}

        {/* Прогресс-бар: дорожка тёмно-серая, заполнение лаймовое */}
        <div
          style={{
            height: '8px',
            background: '#222222',
            borderRadius: '999px',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${progress}%`,
              background: LIME,
              borderRadius: '999px',
              transition: 'width 500ms ease-out',
            }}
          />
        </div>

        {/* Лейбл текущего шага */}
        <p
          style={{
            textAlign: 'center',
            marginTop: '20px',
            color: WHITE,
            fontSize: '18px',
            fontWeight: 600,
            fontFamily: "var(--font-unbounded), 'Unbounded', -apple-system, BlinkMacSystemFont, sans-serif",
            letterSpacing: '-0.01em',
          }}
        >
          {label}
        </p>

        {step !== 'error' && step !== 'done' && (
          <p
            style={{
              textAlign: 'center',
              marginTop: '10px',
              color: '#888888',
              fontSize: '14px',
            }}
          >
            Это может занять до 1 минуты
          </p>
        )}

        {/* Ошибка */}
        {step === 'error' && error && (
          <div
            style={{
              marginTop: '24px',
              background: '#1A1A1A',
              border: `1px solid ${LIME}`,
              borderRadius: '16px',
              padding: '20px',
            }}
          >
            <p style={{ color: WHITE, fontSize: '14px', lineHeight: '140%', margin: 0 }}>
              {error}
            </p>
            <button
              onClick={() => router.push('/quiz')}
              style={{
                marginTop: '16px',
                width: '100%',
                background: LIME,
                color: BLACK,
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
      </div>

      {/* Keyframes для пульсации лаймового круга. Локально, чтобы не зависеть от глобальных стилей. */}
      <style jsx>{`
        @keyframes skinplan-pulse {
          0%, 100% {
            transform: scale(1);
            opacity: 1;
          }
          50% {
            transform: scale(0.85);
            opacity: 0.55;
          }
        }
      `}</style>
    </div>
  );
}

