// app/(miniapp)/plan/calendar/page.tsx
// Отдельная страница календаря плана с выбором дня

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { PlanCalendar } from '@/components/PlanCalendar';
import { api } from '@/lib/api';

export default function PlanCalendarPage() {
  const router = useRouter();
  const [currentDay, setCurrentDay] = useState(1);
  const [completedDays, setCompletedDays] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProgress();
  }, []);

  const loadProgress = async () => {
    try {
      const progress = await api.getPlanProgress() as {
        currentDay: number;
        completedDays: number[];
      };
      
      if (progress) {
        setCurrentDay(progress.currentDay || 1);
        setCompletedDays(progress.completedDays || []);
      }
    } catch (err) {
      console.warn('Could not load plan progress:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDaySelect = (day: number) => {
    setCurrentDay(day);
    // Переходим на страницу плана с выбранным днем
    router.push(`/plan?day=${day}`);
  };

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #F5FFFC 0%, #E8FBF7 100%)',
      }}>
        <div style={{ color: '#0A5F59', fontSize: '16px' }}>Загрузка...</div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #F5FFFC 0%, #E8FBF7 100%)',
      padding: '20px',
      paddingBottom: '100px',
    }}>
      {/* Header */}
      <div style={{
        backgroundColor: 'white',
        borderRadius: '24px',
        padding: '24px',
        marginBottom: '24px',
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
        border: '1px solid rgba(10, 95, 89, 0.1)',
      }}>
        <h1 style={{
          fontSize: '28px',
          fontWeight: 'bold',
          color: '#0A5F59',
          marginBottom: '8px',
        }}>
          Выберите день
        </h1>
        <p style={{
          fontSize: '16px',
          color: '#6B7280',
          lineHeight: '1.6',
        }}>
          Выберите день из 28-дневного плана ухода
        </p>
      </div>

      {/* Календарь с увеличенным скроллом */}
      <div style={{
        backgroundColor: 'white',
        borderRadius: '24px',
        padding: '24px',
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
        border: '1px solid rgba(10, 95, 89, 0.1)',
      }}>
        <PlanCalendar
          currentDay={currentDay}
          completedDays={completedDays}
          onDaySelect={handleDaySelect}
        />
      </div>

      {/* Кнопка возврата */}
      <div style={{ marginTop: '24px' }}>
        <button
          onClick={() => router.push('/plan')}
          style={{
            width: '100%',
            padding: '16px',
            borderRadius: '16px',
            backgroundColor: '#0A5F59',
            color: 'white',
            border: 'none',
            fontSize: '16px',
            fontWeight: '600',
            cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(10, 95, 89, 0.3)',
          }}
        >
          Вернуться к плану
        </button>
      </div>
    </div>
  );
}

