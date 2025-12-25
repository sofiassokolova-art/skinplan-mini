// components/ServiceFeedbackPopup.tsx
// Сервисный попап для отзыва о SkinIQ (показывается раз в неделю)

'use client';

import { useState, useEffect } from 'react';
import { FeedbackBlock } from './FeedbackBlock';
import { api } from '@/lib/api';

const LAST_SERVICE_FEEDBACK_KEY = 'last_service_feedback_date';
const SERVICE_FEEDBACK_SENT_KEY = 'service_feedback_sent'; // Флаг отправки обратной связи через попап
const FEEDBACK_COOLDOWN_DAYS = 7; // Показывать раз в неделю

export function ServiceFeedbackPopup() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // ТЗ: Проверяем pathname ПЕРЕД любыми async операциями
    // На /quiz и /plan* не показываем попап и не делаем запросы
    if (typeof window !== 'undefined') {
      const pathname = window.location.pathname;
      if (pathname === '/quiz' || pathname.startsWith('/quiz/') ||
          pathname === '/plan' || pathname.startsWith('/plan/')) {
        return; // Не показываем попап на /quiz и /plan*
      }
    }
    
    // Проверяем, нужно ли показывать попап
    const checkShouldShow = async () => {
      if (typeof window === 'undefined') return;
      
      // ТЗ: Проверяем pathname еще раз внутри async функции
      const pathname = window.location.pathname;
      if (pathname === '/quiz' || pathname.startsWith('/quiz/') ||
          pathname === '/plan' || pathname.startsWith('/plan/')) {
        return; // Не показываем попап на /quiz и /plan*
      }

      // Если пользователь уже отправил обратную связь через попап - больше не показываем
      try {
        const { getServiceFeedbackSent } = await import('@/lib/user-preferences');
        const feedbackSent = await getServiceFeedbackSent();
        if (feedbackSent) {
          setIsVisible(false);
          return;
        }
      } catch (error) {
        // При ошибке продолжаем проверку
      }

      // ВАЖНО: Проверяем, прошло ли 3 дня с момента генерации плана
      try {
        const profile = await api.getCurrentProfile() as any;
        if (profile && profile.createdAt) {
          const profileCreatedAt = new Date(profile.createdAt);
          const now = new Date();
          const daysSincePlanGeneration = Math.floor((now.getTime() - profileCreatedAt.getTime()) / (1000 * 60 * 60 * 24));
          
          // Поп-ап показывается только через 3 дня после генерации плана
          if (daysSincePlanGeneration < 3) {
            console.log(`⚠️ Plan generated ${daysSincePlanGeneration} days ago, need 3 days. Skipping service feedback popup.`);
            setIsVisible(false);
            return;
          }
        } else {
          // Если профиль не найден, не показываем поп-ап
          setIsVisible(false);
          return;
        }
      } catch (profileError) {
        // Если профиль не найден, не показываем поп-ап
        console.log('⚠️ Profile not found, skipping service feedback popup');
        setIsVisible(false);
        return;
      }

      try {
        const { getLastServiceFeedbackDate } = await import('@/lib/user-preferences');
        const lastFeedbackDate = await getLastServiceFeedbackDate();
        if (lastFeedbackDate) {
          const lastDate = new Date(lastFeedbackDate);
          const now = new Date();
          const daysSinceLastFeedback = (now.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24);
          
          if (daysSinceLastFeedback < FEEDBACK_COOLDOWN_DAYS) {
            setIsVisible(false);
            return;
          }
        }
      } catch (error) {
        // При ошибке продолжаем проверку
      }
      
      // Показываем попап (прошло 3+ дня и выполнены все условия)
      setIsVisible(true);
    };

    // Задержка перед показом попапа (например, через 3 секунды после загрузки страницы)
    const timer = setTimeout(() => {
      checkShouldShow();
    }, 3000);

    return () => clearTimeout(timer);
  }, []);

  const handleFeedbackSubmit = async (feedback: {
    isRelevant: boolean;
    reasons?: string[];
    comment?: string;
  }) => {
    try {
      await api.submitAnalysisFeedback({
        ...feedback,
        type: 'service',
      });
      
      // Сохраняем дату отправки и флаг отправки через попап в БД
      try {
        const { setLastServiceFeedbackDate, setServiceFeedbackSent } = await import('@/lib/user-preferences');
        await setLastServiceFeedbackDate(new Date().toISOString());
        await setServiceFeedbackSent(true);
      } catch (error) {
        console.warn('Failed to save service feedback flag:', error);
      }
      
      // Скрываем попап
      setIsVisible(false);
    } catch (err: any) {
      console.error('Error submitting service feedback:', err);
      throw err;
    }
  };

  const handleClose = () => {
    // При закрытии просто скрываем попап, но не помечаем как отправленный
    // Пользователь сможет увидеть его снова через неделю
    setIsVisible(false);
  };

  if (!isVisible) {
    return null;
  }

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '20px',
        left: '50%',
        transform: 'translateX(-50%)',
        width: 'calc(100% - 40px)',
        maxWidth: '500px',
        zIndex: 9999,
        animation: 'slideUp 0.3s ease-out',
      }}
    >
      <style>{`
        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateX(-50%) translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateX(-50%) translateY(0);
          }
        }
      `}</style>
      <div style={{ position: 'relative' }}>
        {/* Кнопка закрытия */}
        <button
          onClick={handleClose}
          style={{
            position: 'absolute',
            top: '8px',
            right: '8px',
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            backgroundColor: 'rgba(0, 0, 0, 0.1)',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '20px',
            color: '#6B7280',
            zIndex: 10000,
            transition: 'all 0.2s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.2)';
            e.currentTarget.style.color = '#111827';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.1)';
            e.currentTarget.style.color = '#6B7280';
          }}
          aria-label="Закрыть"
        >
          ×
        </button>
      <FeedbackBlock onSubmit={handleFeedbackSubmit} feedbackType="service" />
      </div>
    </div>
  );
}

