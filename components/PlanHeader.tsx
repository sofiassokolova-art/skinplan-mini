// components/PlanHeader.tsx
// Header страницы плана с целями и кнопкой редактирования

'use client';

import { useRouter } from 'next/navigation';
import { Edit3 } from 'lucide-react';

interface PlanHeaderProps {
  mainGoals: string[];
  onEditGoals?: () => void;
}

export function PlanHeader({ mainGoals, onEditGoals }: PlanHeaderProps) {
  const router = useRouter();

  const handleEditGoals = () => {
    if (onEditGoals) {
      onEditGoals();
    } else {
      router.push('/quiz/update');
    }
  };

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
      <div style={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: '16px',
      }}>
        <div style={{ flex: 1 }}>
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
        <button
          onClick={handleEditGoals}
          style={{
            padding: '12px',
            borderRadius: '12px',
            backgroundColor: '#F3F4F6',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            color: '#6B7280',
            fontSize: '14px',
            fontWeight: '500',
            transition: 'all 0.2s',
            whiteSpace: 'nowrap',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#E5E7EB';
            e.currentTarget.style.color = '#374151';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = '#F3F4F6';
            e.currentTarget.style.color = '#6B7280';
          }}
        >
          <Edit3 size={16} />
          Редактировать цели
        </button>
      </div>
    </div>
  );
}

