// components/PlanHeader.tsx
// Header страницы плана с целями и кнопкой редактирования

'use client';

interface PlanHeaderProps {
  mainGoals: string[];
  onEditGoals?: () => void;
  userInfo?: {
    skinType?: string | null;
  };
  userName?: string | null;
}

export function PlanHeader({ mainGoals, userInfo, userName }: PlanHeaderProps) {
  const goalLabels: Record<string, string> = {
    acne: 'Акне',
    pores: 'Поры',
    pigmentation: 'Пигментация',
    barrier: 'Барьер',
    dehydration: 'Обезвоженность',
    wrinkles: 'Морщины',
    antiage: 'Антиэйдж',
  };

  // Получаем первую цель для отображения
  const mainGoal = mainGoals.length > 0 ? mainGoals[0] : null;
  const mainGoalLabel = mainGoal ? goalLabels[mainGoal] || mainGoal : null;

  return (
    <div style={{
      backgroundColor: 'white',
      borderRadius: '24px',
      padding: '24px',
      marginBottom: '24px',
      boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
      border: '1px solid rgba(10, 95, 89, 0.1)',
    }}>
      <div>
          <h1 style={{
            fontSize: '28px',
            fontWeight: 'bold',
            color: '#0A5F59',
            marginBottom: '16px',
          }}>
            {userName ? `${userName}, ` : ''}Твой план ухода на 28 дней
          </h1>
          {/* Информация о пользователе */}
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '8px',
            marginBottom: '16px',
          }}>
            {userInfo?.skinType && (
              <span
                style={{
                  padding: '6px 12px',
                  borderRadius: '16px',
                  backgroundColor: '#E8FBF7',
                  color: '#0A5F59',
                  fontSize: '14px',
                  fontWeight: '500',
                  border: '1px solid rgba(10, 95, 89, 0.2)',
                }}
              >
                Тип кожи: {userInfo.skinType}
              </span>
            )}
            {mainGoalLabel && (
              <span
                style={{
                  padding: '6px 12px',
                  borderRadius: '16px',
                  backgroundColor: '#E8FBF7',
                  color: '#0A5F59',
                  fontSize: '14px',
                  fontWeight: '500',
                  border: '1px solid rgba(10, 95, 89, 0.2)',
                }}
              >
                Основная цель: {mainGoalLabel}
              </span>
            )}
          </div>
      </div>
    </div>
  );
}

