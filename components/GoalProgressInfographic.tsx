// components/GoalProgressInfographic.tsx
// Инфографика прогресса по целям на 28 дней

'use client';

import type { GoalProgressCurve } from '@/lib/plan-types';

interface GoalProgressInfographicProps {
  goals: string[];
  currentDay: number;
}

// Генерируем кривые прогресса для целей
function generateProgressCurves(goals: string[]): GoalProgressCurve[] {
  const curves: GoalProgressCurve[] = [];

  goals.forEach(goal => {
    const points = Array.from({ length: 28 }, (_, i) => {
      const day = i + 1;
      let relativeLevel = 0;

      // Логика прогресса в зависимости от цели
      if (goal === 'acne' || goal === 'pores') {
        // Для акне/пор: улучшение с 1-7 (адаптация), активная работа 8-21, закрепление 22-28
        if (day <= 7) {
          relativeLevel = 30 + (day / 7) * 10; // 30-40%
        } else if (day <= 21) {
          relativeLevel = 40 + ((day - 7) / 14) * 40; // 40-80%
        } else {
          relativeLevel = 80 + ((day - 21) / 7) * 20; // 80-100%
        }
      } else if (goal === 'pigmentation') {
        // Для пигментации: медленный старт, активная работа с 8 дня
        if (day <= 7) {
          relativeLevel = 20 + (day / 7) * 10; // 20-30%
        } else if (day <= 21) {
          relativeLevel = 30 + ((day - 7) / 14) * 50; // 30-80%
        } else {
          relativeLevel = 80 + ((day - 21) / 7) * 20; // 80-100%
        }
      } else if (goal === 'barrier' || goal === 'dehydration') {
        // Для барьера/увлажнения: быстрый старт, затем стабилизация
        if (day <= 7) {
          relativeLevel = 40 + (day / 7) * 30; // 40-70%
        } else if (day <= 21) {
          relativeLevel = 70 + ((day - 7) / 14) * 20; // 70-90%
        } else {
          relativeLevel = 90 + ((day - 21) / 7) * 10; // 90-100%
        }
      } else if (goal === 'antiage' || goal === 'wrinkles') {
        // Для антиэйджа: медленный прогресс
        if (day <= 7) {
          relativeLevel = 10 + (day / 7) * 10; // 10-20%
        } else if (day <= 21) {
          relativeLevel = 20 + ((day - 7) / 14) * 40; // 20-60%
        } else {
          relativeLevel = 60 + ((day - 21) / 7) * 40; // 60-100%
        }
      } else {
        // Общий прогресс
        relativeLevel = 20 + (day / 28) * 80; // 20-100%
      }

      return {
        day,
        relativeLevel: Math.min(100, Math.max(0, Math.round(relativeLevel))),
      };
    });

    const goalLabels: Record<string, string> = {
      acne: 'Акне / высыпания',
      pores: 'Жирный блеск',
      pigmentation: 'Ровность тона',
      barrier: 'Здоровье барьера',
      dehydration: 'Увлажнение',
      wrinkles: 'Морщины',
      antiage: 'Антиэйдж',
      general: 'Общий уход',
    };

    curves.push({
      goalKey: goal as any,
      points,
    });
  });

  return curves;
}

export function GoalProgressInfographic({ goals, currentDay }: GoalProgressInfographicProps) {
  const curves = generateProgressCurves(goals);

  const goalLabels: Record<string, string> = {
    acne: 'Акне / высыпания',
    pores: 'Жирный блеск',
    pigmentation: 'Ровность тона',
    barrier: 'Здоровье барьера',
    dehydration: 'Увлажнение',
    wrinkles: 'Морщины',
    antiage: 'Антиэйдж',
    general: 'Общий уход',
  };

  const goalIcons: Record<string, string> = {
    acne: '↓',
    pores: '↓',
    pigmentation: '↑',
    barrier: '↑',
    dehydration: '↑',
    wrinkles: '↓',
    antiage: '↑',
  };

  if (curves.length === 0) {
    return null;
  }

  return (
    <div style={{
      backgroundColor: 'white',
      borderRadius: '24px',
      padding: '24px',
      marginBottom: '24px',
      boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
      border: '1px solid rgba(10, 95, 89, 0.1)',
    }}>
      <h2 style={{
        fontSize: '20px',
        fontWeight: '600',
        color: '#111827',
        marginBottom: '20px',
      }}>
        Как выглядит прогресс, если ты придерживаешься плана
      </h2>

      {/* Общий индекс здоровья кожи */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '8px',
        }}>
          <span style={{
            fontSize: '14px',
            fontWeight: '500',
            color: '#374151',
          }}>
            Здоровье кожи (общий индекс)
          </span>
          <span style={{
            fontSize: '14px',
            fontWeight: '600',
            color: '#0A5F59',
          }}>
            День {currentDay} / 28
          </span>
        </div>
        <div style={{
          height: '8px',
          backgroundColor: '#E5E7EB',
          borderRadius: '4px',
          overflow: 'hidden',
          position: 'relative',
        }}>
          <div style={{
            position: 'absolute',
            left: 0,
            top: 0,
            height: '100%',
            width: `${(currentDay / 28) * 100}%`,
            background: 'linear-gradient(to right, #10B981, #14B8A6)',
            borderRadius: '4px',
          }} />
          <div style={{
            position: 'absolute',
            left: `${((currentDay - 1) / 28) * 100}%`,
            top: '-4px',
            width: '16px',
            height: '16px',
            backgroundColor: '#0A5F59',
            borderRadius: '50%',
            border: '2px solid white',
            boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)',
          }} />
        </div>
      </div>

      {/* Отдельные треки по целям */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {curves.map((curve) => {
          const currentPoint = curve.points.find(p => p.day === currentDay) || curve.points[0];
          const startLevel = curve.points[0].relativeLevel;
          const endLevel = curve.points[27].relativeLevel;
          const progress = ((currentPoint.relativeLevel - startLevel) / (endLevel - startLevel)) * 100;

          return (
            <div key={curve.goalKey}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '8px',
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}>
                  <span style={{ fontSize: '16px' }}>
                    {goalIcons[curve.goalKey] || '•'}
                  </span>
                  <span style={{
                    fontSize: '14px',
                    fontWeight: '500',
                    color: '#374151',
                  }}>
                    {goalLabels[curve.goalKey] || curve.goalKey}
                  </span>
                </div>
                <span style={{
                  fontSize: '12px',
                  color: '#6B7280',
                }}>
                  {currentPoint.relativeLevel}%
                </span>
              </div>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                height: '24px',
              }}>
                {/* Визуализация прогресса */}
                {Array.from({ length: 5 }, (_, i) => {
                  const segmentProgress = Math.min(100, Math.max(0, (currentPoint.relativeLevel / 100) * 5 - i));
                  const isFilled = segmentProgress >= 1;
                  const isPartial = segmentProgress > 0 && segmentProgress < 1;

                  return (
                    <div
                      key={i}
                      style={{
                        flex: 1,
                        height: '20px',
                        backgroundColor: isFilled ? '#10B981' : isPartial ? '#86EFAC' : '#E5E7EB',
                        borderRadius: '4px',
                        transition: 'all 0.3s',
                      }}
                    />
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Легенда */}
      <div style={{
        marginTop: '20px',
        paddingTop: '16px',
        borderTop: '1px solid #E5E7EB',
        fontSize: '12px',
        color: '#9CA3AF',
        lineHeight: '1.6',
      }}>
        <div style={{ marginBottom: '4px' }}>
          <strong>1–7 дни:</strong> кожа привыкает, могут быть мелкие высыпания
        </div>
        <div style={{ marginBottom: '4px' }}>
          <strong>8–14 дни:</strong> выравнивается текстура, уменьшается жирный блеск
        </div>
        <div>
          <strong>15–28 дни:</strong> закрепление, работа с постакне/тоном
        </div>
      </div>
    </div>
  );
}

