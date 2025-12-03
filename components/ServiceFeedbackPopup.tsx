// components/ServiceFeedbackPopup.tsx
// Сервисный попап для отзыва о SkinIQ (показывается раз в неделю)

'use client';

import { useState, useEffect } from 'react';
import { FeedbackBlock } from './FeedbackBlock';
import { api } from '@/lib/api';

const LAST_SERVICE_FEEDBACK_KEY = 'last_service_feedback_date';
const FEEDBACK_COOLDOWN_DAYS = 7; // Показывать раз в неделю

export function ServiceFeedbackPopup() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Проверяем, нужно ли показывать попап
    const checkShouldShow = () => {
      if (typeof window === 'undefined') return;

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
      
      // Сохраняем дату отправки
      localStorage.setItem(LAST_SERVICE_FEEDBACK_KEY, new Date().toISOString());
      
      // Скрываем попап
      setIsVisible(false);
    } catch (err: any) {
      console.error('Error submitting service feedback:', err);
      throw err;
    }
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
      <FeedbackBlock onSubmit={handleFeedbackSubmit} feedbackType="service" />
    </div>
  );
}

