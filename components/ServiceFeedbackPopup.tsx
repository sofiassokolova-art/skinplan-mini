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
    // Проверяем, нужно ли показывать попап
    const checkShouldShow = () => {
      if (typeof window === 'undefined') return;

      // Если пользователь уже отправил обратную связь через попап - больше не показываем
      const feedbackSent = localStorage.getItem(SERVICE_FEEDBACK_SENT_KEY);
      if (feedbackSent === 'true') {
        setIsVisible(false);
        return;
      }

      const lastFeedbackDate = localStorage.getItem(LAST_SERVICE_FEEDBACK_KEY);
      if (lastFeedbackDate) {
        const lastDate = new Date(lastFeedbackDate);
        const now = new Date();
        const daysSinceLastFeedback = (now.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24);
        
        if (daysSinceLastFeedback < FEEDBACK_COOLDOWN_DAYS) {
          setIsVisible(false);
          return;
        }
      }
      
      // Показываем попап
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
      
      // Сохраняем дату отправки и флаг отправки через попап
      if (typeof window !== 'undefined') {
      localStorage.setItem(LAST_SERVICE_FEEDBACK_KEY, new Date().toISOString());
        localStorage.setItem(SERVICE_FEEDBACK_SENT_KEY, 'true');
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

