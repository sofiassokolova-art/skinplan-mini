// components/PlanHeader.tsx
// Header страницы плана с целями и кнопкой редактирования

'use client';

interface PlanHeaderProps {
  mainGoals: string[];
  onEditGoals?: () => void;
}

export function PlanHeader({ mainGoals }: PlanHeaderProps) {

  const goalsText = mainGoals.length > 0
    ? mainGoals.map(goal => {
        const goalLabels: Record<string, string> = {
          acne: 'акне',
          pores: 'поры',
          pigmentation: 'пигментация',
          barrier: 'барьер',
          dehydration: 'обезвоженность',
          wrinkles: 'морщины',
          antiage: 'антиэйдж',
        };
        return goalLabels[goal] || goal;
      }).join(', ')
    : 'улучшение состояния кожи';

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
          marginBottom: '8px',
        }}>
          Твой план ухода на 28 дней
        </h1>
        <p style={{
          fontSize: '16px',
          color: '#6B7280',
          lineHeight: '1.6',
        }}>
          Цели: {goalsText}
        </p>
      </div>
    </div>
  );
}

