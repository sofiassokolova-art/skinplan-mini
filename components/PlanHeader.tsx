// components/PlanHeader.tsx
// Header страницы плана с целями и кнопкой редактирования

'use client';

interface PlanHeaderProps {
  mainGoals: string[];
  onEditGoals?: () => void;
}

export function PlanHeader({ mainGoals }: PlanHeaderProps) {
  const goalLabels: Record<string, string> = {
    acne: 'Акне',
    pores: 'Поры',
    pigmentation: 'Пигментация',
    barrier: 'Барьер',
    dehydration: 'Обезвоженность',
    wrinkles: 'Морщины',
    antiage: 'Антиэйдж',
  };

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
            Твой план ухода на 28 дней
          </h1>
          {mainGoals.length > 0 && (
            <div style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '8px',
            }}>
              {mainGoals.map((goal) => (
                <span
                  key={goal}
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
                  {goalLabels[goal] || goal}
                </span>
              ))}
            </div>
          )}
      </div>
    </div>
  );
}

