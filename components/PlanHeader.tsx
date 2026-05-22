// components/PlanHeader.tsx
// Цели плана — белый фон, акцент лайм/чёрный

'use client';

interface PlanHeaderProps {
  mainGoals: string[];
  onEditGoals?: () => void;
  userInfo?: {
    skinType?: string | null;
  };
  userName?: string | null;
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
    general: 'Общий уход',
  };

  if (mainGoals.length === 0) return null;

  return (
    <div style={{ padding: '20px 20px 0' }}>
      <div style={{
        fontSize: '10px',
        fontWeight: 700,
        letterSpacing: '1px',
        textTransform: 'uppercase',
        color: '#6B7280',
        marginBottom: '10px',
      }}>
        Цели плана
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '7px' }}>
        {mainGoals.map((goal) => (
          <span
            key={goal}
            style={{
              padding: '6px 12px',
              borderRadius: '20px',
              background: '#D5FE61',
              color: '#0A0A0A',
              fontSize: '12px',
              fontWeight: 700,
            }}
          >
            {goalLabels[goal] || goal}
          </span>
        ))}
      </div>
    </div>
  );
}
