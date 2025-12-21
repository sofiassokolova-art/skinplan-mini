// components/FeedbackBlock.tsx
// Блок обратной связи о релевантности рекомендаций

'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';

interface FeedbackBlockProps {
  onSubmit: (feedback: {
    isRelevant: boolean;
    reasons?: string[];
    comment?: string;
  }) => Promise<void>;
  feedbackType?: 'plan_recommendations' | 'service'; // Тип отзыва
}

const LAST_FEEDBACK_KEY = 'last_plan_feedback_date';
const FEEDBACK_COOLDOWN_DAYS = 7; // Показывать раз в неделю для сервисного отзыва
const PLAN_FEEDBACK_SENT_KEY = 'plan_recommendations_feedback_sent'; // Флаг отправки обратной связи по плану

export function FeedbackBlock({ onSubmit, feedbackType = 'plan_recommendations' }: FeedbackBlockProps) {
  const [showFeedback, setShowFeedback] = useState(false);
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showThankYou, setShowThankYou] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  const [hasProfile, setHasProfile] = useState<boolean | null>(null); // null = проверяется

  // Проверяем наличие профиля перед показом виджета
  useEffect(() => {
    const checkProfile = async () => {
      if (typeof window === 'undefined') return;
      
      try {
        const profile = await api.getCurrentProfile() as any;
        setHasProfile(!!profile);
      } catch (err) {
        // Если профиль не найден, не показываем виджет
        setHasProfile(false);
      }
    };
    
    checkProfile();
  }, []);

  // Проверяем, нужно ли показывать виджет обратной связи
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (hasProfile === false) {
      setIsVisible(false);
      return;
    }
    
    // Для plan_recommendations: показываем только один раз, если еще не отправляли
    if (feedbackType === 'plan_recommendations') {
      const checkFeedback = async () => {
        try {
          const { getPlanFeedbackSent } = await import('@/lib/user-preferences');
          const feedbackSent = await getPlanFeedbackSent();
          if (feedbackSent) {
            // Обратная связь уже отправлена - не показываем больше
            setIsVisible(false);
            return;
          }
          // Если еще не отправляли - показываем
          setIsVisible(true);
        } catch (error) {
          // При ошибке показываем виджет
          setIsVisible(true);
        }
      };
      checkFeedback();
      return;
    }
    
    // Для service: показываем раз в неделю
    const checkServiceFeedback = async () => {
      try {
        const { getLastPlanFeedbackDate } = await import('@/lib/user-preferences');
        const lastFeedbackDate = await getLastPlanFeedbackDate();
        if (lastFeedbackDate) {
          const lastDate = new Date(lastFeedbackDate);
          const now = new Date();
          const daysSinceLastFeedback = (now.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24);
          
          if (daysSinceLastFeedback < FEEDBACK_COOLDOWN_DAYS) {
            setIsVisible(false);
            return;
          }
        }
        setIsVisible(true);
      } catch (error) {
        // При ошибке показываем виджет
        setIsVisible(true);
      }
    };
    checkServiceFeedback();
  }, [feedbackType, hasProfile]);

  // Если виджет скрыт, не рендерим его
  if (!isVisible) {
    return null;
  }

  const handleThumbsUp = async () => {
    try {
      setIsSubmitting(true);
      await onSubmit({ isRelevant: true });
      setShowThankYou(true);
      
      // Сохраняем дату отправки и флаг отправки в БД
      try {
        const { setPlanFeedbackSent, setLastPlanFeedbackDate } = await import('@/lib/user-preferences');
        if (feedbackType === 'plan_recommendations') {
          // Для plan_recommendations: помечаем как отправленное, больше не показываем
          await setPlanFeedbackSent(true);
        } else {
          // Для service: сохраняем дату для cooldown
          await setLastPlanFeedbackDate(new Date().toISOString());
        }
      } catch (error) {
        console.warn('Failed to save feedback flag:', error);
      }
      
      // Скрываем виджет после отправки
        setTimeout(() => {
          setIsVisible(false);
        }, 3000);
    } catch (err) {
      console.error('Error submitting feedback:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleThumbsDown = () => {
    setShowFeedback(true);
  };

  const handleSubmitFeedback = async () => {
    try {
      setIsSubmitting(true);
      await onSubmit({
        isRelevant: false,
        comment: comment.trim() || undefined,
      });
      setShowThankYou(true);
      setShowFeedback(false);
      setComment('');
      
      // Сохраняем дату отправки и флаг отправки в БД
      try {
        const { setPlanFeedbackSent, setLastPlanFeedbackDate } = await import('@/lib/user-preferences');
        if (feedbackType === 'plan_recommendations') {
          // Для plan_recommendations: помечаем как отправленное, больше не показываем
          await setPlanFeedbackSent(true);
        } else {
          // Для service: сохраняем дату для cooldown
          await setLastPlanFeedbackDate(new Date().toISOString());
        }
      } catch (error) {
        console.warn('Failed to save feedback flag:', error);
      }
      
      // Скрываем виджет после отправки
        setTimeout(() => {
          setIsVisible(false);
        }, 3000);
    } catch (err) {
      console.error('Error submitting feedback:', err);
    } finally {
      setIsSubmitting(false);
    }
  };


  if (showThankYou) {
    return (
      <div style={{
        backgroundColor: 'rgba(255, 255, 255, 0.58)',
        backdropFilter: 'blur(26px)',
        border: '1px solid rgba(255, 255, 255, 0.2)',
        borderRadius: '24px',
        padding: '32px',
        textAlign: 'center',
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.08)',
      }}>
        <div style={{
          fontSize: '48px',
          marginBottom: '16px',
        }}>
          ✨
        </div>
        <h3 style={{
          fontFamily: "'Satoshi', 'Manrope', -apple-system, BlinkMacSystemFont, sans-serif",
          fontWeight: 700,
          fontSize: '20px',
          color: '#0A5F59',
          marginBottom: '8px',
        }}>
          Спасибо!
        </h3>
        <p style={{
          fontFamily: "'Manrope', -apple-system, BlinkMacSystemFont, sans-serif",
          fontSize: '14px',
          color: '#475467',
          lineHeight: '1.5',
        }}>
          {showFeedback 
            ? 'Ваш отзыв поможет улучшить подбор ухода'
            : 'Рады, что рекомендации подошли!'}
        </p>
      </div>
    );
  }

  if (showFeedback) {
    return (
      <div style={{
        backgroundColor: 'rgba(255, 255, 255, 0.58)',
        backdropFilter: 'blur(26px)',
        border: '1px solid rgba(255, 255, 255, 0.2)',
        borderRadius: '24px',
        padding: '24px',
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.08)',
      }}>
        <h3 style={{
          fontFamily: "'Satoshi', 'Manrope', -apple-system, BlinkMacSystemFont, sans-serif",
          fontWeight: 700,
          fontSize: '20px',
          color: '#0A5F59',
          marginBottom: '12px',
        }}>
          {feedbackType === 'service' ? 'Расскажите, что можно улучшить?' : 'Что не понравилось?'}
        </h3>
        <p style={{
          fontFamily: "'Manrope', -apple-system, BlinkMacSystemFont, sans-serif",
          fontSize: '14px',
          color: '#475467',
          marginBottom: '20px',
          lineHeight: '1.5',
        }}>
          Ваш комментарий поможет нам стать лучше
        </p>

        {/* Поле комментария */}
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Напишите, что можно улучшить..."
          style={{
            width: '100%',
            minHeight: '100px',
            padding: '12px',
            borderRadius: '12px',
            border: '1px solid rgba(10, 95, 89, 0.2)',
            fontFamily: "'Manrope', -apple-system, BlinkMacSystemFont, sans-serif",
            fontSize: '14px',
            color: '#0A5F59',
            backgroundColor: 'rgba(255, 255, 255, 0.8)',
            resize: 'vertical',
            marginBottom: '20px',
          }}
        />

        {/* Кнопки */}
        <div style={{
          display: 'flex',
          gap: '12px',
        }}>
          <button
            onClick={() => {
              setShowFeedback(false);
              setComment('');
            }}
            disabled={isSubmitting}
            style={{
              flex: 1,
              padding: '12px 24px',
              borderRadius: '12px',
              border: '1px solid rgba(10, 95, 89, 0.3)',
              backgroundColor: 'transparent',
              color: '#0A5F59',
              fontFamily: "'Manrope', -apple-system, BlinkMacSystemFont, sans-serif",
              fontWeight: 600,
              fontSize: '14px',
              cursor: isSubmitting ? 'not-allowed' : 'pointer',
              opacity: isSubmitting ? 0.5 : 1,
            }}
          >
            Отмена
          </button>
          <button
            onClick={handleSubmitFeedback}
            disabled={isSubmitting || !comment.trim()}
            style={{
              flex: 1,
              padding: '12px 24px',
              borderRadius: '12px',
              border: 'none',
              backgroundColor: !comment.trim() ? 'rgba(10, 95, 89, 0.3)' : '#0A5F59',
              color: 'white',
              fontFamily: "'Manrope', -apple-system, BlinkMacSystemFont, sans-serif",
              fontWeight: 600,
              fontSize: '14px',
              cursor: (isSubmitting || !comment.trim()) ? 'not-allowed' : 'pointer',
              opacity: (isSubmitting || !comment.trim()) ? 0.5 : 1,
            }}
          >
            {isSubmitting ? 'Отправка...' : 'Отправить'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      backgroundColor: 'rgba(255, 255, 255, 0.58)',
      backdropFilter: 'blur(26px)',
      border: '1px solid rgba(255, 255, 255, 0.2)',
      borderRadius: '24px',
      padding: '24px',
      boxShadow: '0 8px 24px rgba(0, 0, 0, 0.08)',
    }}>
      <h3 style={{
        fontFamily: "'Satoshi', 'Manrope', -apple-system, BlinkMacSystemFont, sans-serif",
        fontWeight: 700,
        fontSize: '20px',
        color: '#0A5F59',
        marginBottom: '8px',
      }}>
        {feedbackType === 'service' ? 'Расскажите, как вам SkinIQ?' : 'Подошли ли вам рекомендации?'}
      </h3>
      <p style={{
        fontFamily: "'Manrope', -apple-system, BlinkMacSystemFont, sans-serif",
        fontSize: '14px',
        color: '#475467',
        marginBottom: '20px',
        lineHeight: '1.5',
      }}>
        {feedbackType === 'service' ? 'Ваше мнение очень важно для нас' : 'Ваш ответ поможет улучшить алгоритм'}
      </p>

      <div style={{
        display: 'flex',
        gap: '12px',
        justifyContent: 'center',
      }}>
        {feedbackType === 'service' ? (
          // Для еженедельной обратной связи - 👍/👎
          <>
            <button
              onClick={handleThumbsDown}
              disabled={isSubmitting}
              style={{
                padding: '16px 32px',
                borderRadius: '16px',
                border: '2px solid rgba(10, 95, 89, 0.3)',
                backgroundColor: 'rgba(255, 255, 255, 0.8)',
                color: '#0A5F59',
                fontFamily: "'Manrope', -apple-system, BlinkMacSystemFont, sans-serif",
                fontWeight: 600,
                fontSize: '32px',
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
                opacity: isSubmitting ? 0.5 : 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                minWidth: '80px',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                if (!isSubmitting) {
                  e.currentTarget.style.backgroundColor = 'rgba(10, 95, 89, 0.1)';
                  e.currentTarget.style.transform = 'scale(1.05)';
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.8)';
                e.currentTarget.style.transform = 'scale(1)';
              }}
            >
              👎
            </button>
            <button
              onClick={handleThumbsUp}
              disabled={isSubmitting}
              style={{
                padding: '16px 32px',
                borderRadius: '16px',
                border: 'none',
                backgroundColor: '#0A5F59',
                color: 'white',
                fontFamily: "'Manrope', -apple-system, BlinkMacSystemFont, sans-serif",
                fontWeight: 600,
                fontSize: '32px',
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
                opacity: isSubmitting ? 0.5 : 1,
                boxShadow: '0 4px 12px rgba(10, 95, 89, 0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                minWidth: '80px',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                if (!isSubmitting) {
                  e.currentTarget.style.backgroundColor = '#059669';
                  e.currentTarget.style.transform = 'scale(1.05)';
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#0A5F59';
                e.currentTarget.style.transform = 'scale(1)';
              }}
            >
              👍
            </button>
          </>
        ) : (
          // Для обратной связи по плану - "Да"/"Нет"
          <>
        <button
              onClick={handleThumbsDown}
          disabled={isSubmitting}
          style={{
                padding: '12px 24px',
            borderRadius: '12px',
            border: '2px solid rgba(10, 95, 89, 0.3)',
            backgroundColor: 'rgba(255, 255, 255, 0.8)',
            color: '#0A5F59',
            fontFamily: "'Manrope', -apple-system, BlinkMacSystemFont, sans-serif",
            fontWeight: 600,
            fontSize: '16px',
            cursor: isSubmitting ? 'not-allowed' : 'pointer',
            opacity: isSubmitting ? 0.5 : 1,
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                if (!isSubmitting) {
                  e.currentTarget.style.backgroundColor = 'rgba(10, 95, 89, 0.1)';
                  e.currentTarget.style.transform = 'scale(1.05)';
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.8)';
                e.currentTarget.style.transform = 'scale(1)';
          }}
        >
          Нет
        </button>
        <button
              onClick={handleThumbsUp}
          disabled={isSubmitting}
          style={{
                padding: '12px 24px',
            borderRadius: '12px',
            border: 'none',
            backgroundColor: '#0A5F59',
            color: 'white',
            fontFamily: "'Manrope', -apple-system, BlinkMacSystemFont, sans-serif",
            fontWeight: 600,
            fontSize: '16px',
            cursor: isSubmitting ? 'not-allowed' : 'pointer',
            opacity: isSubmitting ? 0.5 : 1,
            boxShadow: '0 4px 12px rgba(10, 95, 89, 0.3)',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                if (!isSubmitting) {
                  e.currentTarget.style.backgroundColor = '#059669';
                  e.currentTarget.style.transform = 'scale(1.05)';
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#0A5F59';
                e.currentTarget.style.transform = 'scale(1)';
          }}
        >
          Да
        </button>
          </>
        )}
      </div>
    </div>
  );
}

