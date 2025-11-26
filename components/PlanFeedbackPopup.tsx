// components/PlanFeedbackPopup.tsx
// Поп-ап для оценки плана раз в неделю

'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';

interface PlanFeedbackPopupProps {
  onClose: () => void;
}

export default function PlanFeedbackPopup({ onClose }: PlanFeedbackPopupProps) {
  const [rating, setRating] = useState<number>(0);
  const [hoveredRating, setHoveredRating] = useState<number>(0);
  const [feedback, setFeedback] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (rating === 0) {
      setError('Пожалуйста, выберите оценку');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Telegram-Init-Data': typeof window !== 'undefined' && window.Telegram?.WebApp?.initData
            ? window.Telegram.WebApp.initData
            : '',
        },
        body: JSON.stringify({
          rating,
          feedback: feedback.trim() || null,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Ошибка сохранения отзыва');
      }

      // Закрываем поп-ап после успешной отправки
      onClose();
    } catch (err: any) {
      console.error('Error submitting feedback:', err);
      setError(err?.message || 'Ошибка отправки отзыва. Попробуйте еще раз.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        backdropFilter: 'blur(4px)',
        zIndex: 10000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }}
      onClick={(e) => {
        // Закрываем только при клике на фон, не на сам поп-ап
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        style={{
          backgroundColor: 'rgba(255, 255, 255, 0.95)',
          backdropFilter: 'blur(28px)',
          borderRadius: '24px',
          padding: '32px',
          maxWidth: '400px',
          width: '100%',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          style={{
            fontSize: '24px',
            fontWeight: 'bold',
            color: '#0A5F59',
            marginBottom: '8px',
            textAlign: 'center',
          }}
        >
          Как вам план?
        </h2>
        <p
          style={{
            fontSize: '16px',
            color: '#475467',
            marginBottom: '24px',
            textAlign: 'center',
          }}
        >
          Ваше мнение поможет нам улучшить рекомендации
        </p>

        {/* Звезды для рейтинга */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            gap: '12px',
            marginBottom: '24px',
          }}
        >
          {[1, 2, 3, 4, 5].map((star) => {
            const isFilled = star <= (hoveredRating || rating);
            return (
              <button
                key={star}
                onClick={() => setRating(star)}
                onMouseEnter={() => setHoveredRating(star)}
                onMouseLeave={() => setHoveredRating(0)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '4px',
                  fontSize: '40px',
                  lineHeight: 1,
                  transition: 'transform 0.2s',
                }}
                onMouseDown={(e) => {
                  e.currentTarget.style.transform = 'scale(0.9)';
                }}
                onMouseUp={(e) => {
                  e.currentTarget.style.transform = 'scale(1)';
                }}
              >
                <span style={{ color: isFilled ? '#FFD700' : '#E5E7EB' }}>
                  ★
                </span>
              </button>
            );
          })}
        </div>

        {/* Поле для обратной связи */}
        <textarea
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
          placeholder="Расскажите, что можно улучшить (необязательно)"
          style={{
            width: '100%',
            minHeight: '100px',
            padding: '12px',
            borderRadius: '12px',
            border: '1px solid rgba(10, 95, 89, 0.2)',
            backgroundColor: 'rgba(255, 255, 255, 0.8)',
            fontSize: '14px',
            color: '#0A5F59',
            resize: 'vertical',
            fontFamily: 'inherit',
            marginBottom: '16px',
          }}
        />

        {error && (
          <div
            style={{
              color: '#DC2626',
              fontSize: '14px',
              marginBottom: '16px',
              textAlign: 'center',
            }}
          >
            {error}
          </div>
        )}

        {/* Кнопки */}
        <div
          style={{
            display: 'flex',
            gap: '12px',
          }}
        >
          <button
            onClick={onClose}
            disabled={isSubmitting}
            style={{
              flex: 1,
              padding: '14px',
              borderRadius: '12px',
              border: '1px solid rgba(10, 95, 89, 0.3)',
              backgroundColor: 'rgba(255, 255, 255, 0.8)',
              color: '#0A5F59',
              fontSize: '16px',
              fontWeight: '500',
              cursor: isSubmitting ? 'not-allowed' : 'pointer',
              opacity: isSubmitting ? 0.6 : 1,
            }}
          >
            Пропустить
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting || rating === 0}
            style={{
              flex: 1,
              padding: '14px',
              borderRadius: '12px',
              border: 'none',
              backgroundColor: rating === 0 ? '#D1D5DB' : '#0A5F59',
              color: 'white',
              fontSize: '16px',
              fontWeight: 'bold',
              cursor: isSubmitting || rating === 0 ? 'not-allowed' : 'pointer',
              opacity: isSubmitting ? 0.7 : 1,
              transition: 'background-color 0.2s',
            }}
          >
            {isSubmitting ? 'Отправка...' : 'Отправить'}
          </button>
        </div>
      </div>
    </div>
  );
}

