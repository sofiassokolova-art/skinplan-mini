// components/PlanCalendar.tsx
// Календарная навигация по 28 дням плана с фазами

'use client';

import { getPhaseForDay, getPhaseLabel } from '@/lib/plan-types';
import type { PlanPhases } from '@/lib/plan-types';

interface PlanCalendarProps {
  currentDay: number;
  completedDays: number[];
  onDaySelect: (day: number) => void;
}

const PHASE_COLORS: Record<PlanPhases, string> = {
  adaptation: '#FEF3C7', // Желтый
  active: '#DBEAFE', // Синий
  support: '#D1FAE5', // Зеленый
};

const PHASE_BORDER_COLORS: Record<PlanPhases, string> = {
  adaptation: '#FCD34D',
  active: '#60A5FA',
  support: '#34D399',
};

export function PlanCalendar({
  currentDay,
  completedDays,
  onDaySelect,
}: PlanCalendarProps) {
  const days = Array.from({ length: 28 }, (_, i) => i + 1);

  return (
    <div style={{
      backgroundColor: 'white',
      borderRadius: '20px',
      padding: '20px',
      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
    }}>
      <div style={{
        fontSize: '18px',
        fontWeight: '600',
        color: '#111827',
        marginBottom: '16px',
      }}>
        План на 28 дней
      </div>

      {/* Горизонтальная шкала с фазами */}
      <div style={{
        position: 'relative',
        height: '60px',
        marginBottom: '16px',
        borderRadius: '12px',
        overflow: 'hidden',
      }}>
        {/* Фоновые зоны фаз */}
        <div style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: '25%',
          height: '100%',
          backgroundColor: PHASE_COLORS.adaptation,
          borderRight: `2px solid ${PHASE_BORDER_COLORS.adaptation}`,
        }} />
        <div style={{
          position: 'absolute',
          left: '25%',
          top: 0,
          width: '50%',
          height: '100%',
          backgroundColor: PHASE_COLORS.active,
          borderRight: `2px solid ${PHASE_BORDER_COLORS.active}`,
        }} />
        <div style={{
          position: 'absolute',
          left: '75%',
          top: 0,
          width: '25%',
          height: '100%',
          backgroundColor: PHASE_COLORS.support,
        }} />

        {/* Подписи фаз */}
        <div style={{
          position: 'absolute',
          left: '12.5%',
          top: '8px',
          fontSize: '12px',
          fontWeight: '600',
          color: '#92400E',
        }}>
          {getPhaseLabel('adaptation')}
        </div>
        <div style={{
          position: 'absolute',
          left: '50%',
          top: '8px',
          fontSize: '12px',
          fontWeight: '600',
          color: '#1E40AF',
        }}>
          {getPhaseLabel('active')}
        </div>
        <div style={{
          position: 'absolute',
          left: '87.5%',
          top: '8px',
          fontSize: '12px',
          fontWeight: '600',
          color: '#065F46',
        }}>
          {getPhaseLabel('support')}
        </div>
      </div>

      {/* Дни (горизонтальный скролл) */}
      <div style={{
        display: 'flex',
        gap: '8px',
        overflowX: 'auto',
        paddingBottom: '8px',
        scrollbarWidth: 'thin',
      }}>
        {days.map((day) => {
          const phase = getPhaseForDay(day);
          const isCompleted = completedDays.includes(day);
          const isCurrent = day === currentDay;

          return (
            <button
              key={day}
              onClick={() => onDaySelect(day)}
              style={{
                minWidth: '50px',
                height: '50px',
                borderRadius: '12px',
                border: isCurrent
                  ? `3px solid #0A5F59`
                  : `2px solid ${PHASE_BORDER_COLORS[phase]}`,
                backgroundColor: isCompleted
                  ? '#10B981'
                  : isCurrent
                  ? '#F0FDF4'
                  : PHASE_COLORS[phase],
                color: isCompleted
                  ? 'white'
                  : isCurrent
                  ? '#0A5F59'
                  : '#374151',
                fontSize: '14px',
                fontWeight: isCurrent ? '600' : '500',
                cursor: 'pointer',
                transition: 'all 0.2s',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '2px',
              }}
              onMouseEnter={(e) => {
                if (!isCurrent && !isCompleted) {
                  e.currentTarget.style.transform = 'scale(1.1)';
                  e.currentTarget.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.15)';
                }
              }}
              onMouseLeave={(e) => {
                if (!isCurrent && !isCompleted) {
                  e.currentTarget.style.transform = 'scale(1)';
                  e.currentTarget.style.boxShadow = 'none';
                }
              }}
            >
              <span>{day}</span>
              {isCompleted && (
                <span style={{ fontSize: '12px' }}>✓</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Бейдж текущей фазы */}
      <div style={{
        marginTop: '16px',
        padding: '8px 12px',
        borderRadius: '8px',
        backgroundColor: PHASE_COLORS[getPhaseForDay(currentDay)],
        border: `1px solid ${PHASE_BORDER_COLORS[getPhaseForDay(currentDay)]}`,
        display: 'inline-block',
        fontSize: '12px',
        fontWeight: '600',
        color: '#374151',
      }}>
        {getPhaseLabel(getPhaseForDay(currentDay))}
      </div>
    </div>
  );
}

