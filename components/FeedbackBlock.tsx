// components/FeedbackBlock.tsx
// Блок обратной связи о релевантности рекомендаций

'use client';

import { useState } from 'react';

interface FeedbackBlockProps {
  onSubmit: (feedback: {
    isRelevant: boolean;
    reasons?: string[];
    comment?: string;
  }) => Promise<void>;
}

const FEEDBACK_REASONS = [
  'Не подходят под мой тип кожи',
  'Слишком дорогие',
  'Уже пробовала — не помогло',
  'Другое',
];

export function FeedbackBlock({ onSubmit }: FeedbackBlockProps) {
  const [showFeedback, setShowFeedback] = useState(false);
  const [selectedReasons, setSelectedReasons] = useState<string[]>([]);
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showThankYou, setShowThankYou] = useState(false);

  const handleYes = async () => {
    try {
      setIsSubmitting(true);
      await onSubmit({ isRelevant: true });
      setShowThankYou(true);
      setTimeout(() => {
        setShowThankYou(false);
      }, 3000);
    } catch (err) {
      console.error('Error submitting feedback:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleNo = () => {
    setShowFeedback(true);
  };

  const handleSubmitFeedback = async () => {
    try {
      setIsSubmitting(true);
      await onSubmit({
        isRelevant: false,
        reasons: selectedReasons,
        comment: comment.trim() || undefined,
      });
      setShowThankYou(true);
      setShowFeedback(false);
      setSelectedReasons([]);
      setComment('');
      setTimeout(() => {
        setShowThankYou(false);
      }, 3000);
    } catch (err) {
      console.error('Error submitting feedback:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleReason = (reason: string) => {
    setSelectedReasons(prev =>
      prev.includes(reason)
        ? prev.filter(r => r !== reason)
        : [...prev, reason]
    );
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
          Подошли ли вам рекомендации?
        </h3>
        <p style={{
          fontFamily: "'Manrope', -apple-system, BlinkMacSystemFont, sans-serif",
          fontSize: '14px',
          color: '#475467',
          marginBottom: '20px',
          lineHeight: '1.5',
        }}>
          Ваш ответ поможет улучшить алгоритм
        </p>

        {/* Чекбоксы */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          marginBottom: '20px',
        }}>
          {FEEDBACK_REASONS.map((reason) => (
            <label
              key={reason}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                cursor: 'pointer',
                padding: '12px',
                borderRadius: '12px',
                backgroundColor: selectedReasons.includes(reason)
                  ? 'rgba(10, 95, 89, 0.08)'
                  : 'transparent',
                transition: 'background-color 0.2s',
              }}
            >
              <input
                type="checkbox"
                checked={selectedReasons.includes(reason)}
                onChange={() => toggleReason(reason)}
                style={{
                  width: '20px',
                  height: '20px',
                  cursor: 'pointer',
                  accentColor: '#0A5F59',
                }}
              />
              <span style={{
                fontFamily: "'Manrope', -apple-system, BlinkMacSystemFont, sans-serif",
                fontSize: '14px',
                color: '#0A5F59',
                fontWeight: 500,
              }}>
                {reason}
              </span>
            </label>
          ))}
        </div>

        {/* Поле комментария */}
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Дополнительные комментарии (необязательно)"
          style={{
            width: '100%',
            minHeight: '80px',
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
              setSelectedReasons([]);
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
            disabled={isSubmitting || selectedReasons.length === 0}
            style={{
              flex: 1,
              padding: '12px 24px',
              borderRadius: '12px',
              border: 'none',
              backgroundColor: selectedReasons.length === 0 ? 'rgba(10, 95, 89, 0.3)' : '#0A5F59',
              color: 'white',
              fontFamily: "'Manrope', -apple-system, BlinkMacSystemFont, sans-serif",
              fontWeight: 600,
              fontSize: '14px',
              cursor: (isSubmitting || selectedReasons.length === 0) ? 'not-allowed' : 'pointer',
              opacity: (isSubmitting || selectedReasons.length === 0) ? 0.5 : 1,
            }}
          >
            {isSubmitting ? 'Отправка...' : 'Отправить отзыв'}
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
        Подошли ли вам рекомендации?
      </h3>
      <p style={{
        fontFamily: "'Manrope', -apple-system, BlinkMacSystemFont, sans-serif",
        fontSize: '14px',
        color: '#475467',
        marginBottom: '20px',
        lineHeight: '1.5',
      }}>
        Ваш ответ поможет улучшить алгоритм
      </p>

      <div style={{
        display: 'flex',
        gap: '12px',
      }}>
        <button
          onClick={handleNo}
          disabled={isSubmitting}
          style={{
            flex: 1,
            padding: '14px 24px',
            borderRadius: '12px',
            border: '2px solid rgba(10, 95, 89, 0.3)',
            backgroundColor: 'rgba(255, 255, 255, 0.8)',
            color: '#0A5F59',
            fontFamily: "'Manrope', -apple-system, BlinkMacSystemFont, sans-serif",
            fontWeight: 600,
            fontSize: '16px',
            cursor: isSubmitting ? 'not-allowed' : 'pointer',
            opacity: isSubmitting ? 0.5 : 1,
          }}
        >
          Нет
        </button>
        <button
          onClick={handleYes}
          disabled={isSubmitting}
          style={{
            flex: 1,
            padding: '14px 24px',
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
          }}
        >
          Да
        </button>
      </div>
    </div>
  );
}

