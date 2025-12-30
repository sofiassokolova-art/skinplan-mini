// components/quiz/buttons/TinderButtons.tsx
// Компонент для кнопок Tinder-экранов (Да/Нет)
// Вынесен из renderInfoScreen для улучшения читаемости

import React from 'react';
import { handleGetPlan } from '@/lib/quiz/handlers/handleGetPlan';
import type { HandleGetPlanParams } from '@/lib/quiz/handlers/handleGetPlan';

export interface TinderButtonsProps {
  // Screen info
  screenId: string;
  isLastInfoScreen: boolean;
  isTinderScreen: boolean;
  
  // State
  isSubmitting: boolean;
  questionnaire: any | null;
  isDev: boolean;
  error: string | null;
  
  // Refs
  isSubmittingRef: React.MutableRefObject<boolean>;
  
  // Setters
  setIsSubmitting: React.Dispatch<React.SetStateAction<boolean>>;
  setError: React.Dispatch<React.SetStateAction<string | null>>;
  setLoading: React.Dispatch<React.SetStateAction<boolean>>;
  
  // Functions
  submitAnswers: () => Promise<void>;
  handleNext: () => void;
}

export function TinderButtons({
  screenId,
  isLastInfoScreen,
  isTinderScreen,
  isSubmitting,
  questionnaire,
  isDev,
  error,
  isSubmittingRef,
  setIsSubmitting,
  setError,
  setLoading,
  submitAnswers,
  handleNext,
}: TinderButtonsProps) {
  // Для последнего tinder-экрана (want_improve) показываем кнопку "Получить план ухода"
  if (isLastInfoScreen && isTinderScreen && screenId === 'want_improve') {
    const handleGetPlanClick = async () => {
      await handleGetPlan({
        isSubmitting,
        questionnaire,
        isDev,
        isSubmittingRef,
        setIsSubmitting,
        setError,
        setLoading,
        submitAnswers,
      });
    };
    
    const hasInitData = typeof window !== 'undefined' && !!window.Telegram?.WebApp?.initData;
    
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '20px' }}>
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            handleGetPlanClick();
          }}
          disabled={isSubmitting}
          style={{
            width: '100%',
            height: '64px',
            background: '#0A5F59',
            color: 'white',
            border: 'none',
            borderRadius: '32px',
            fontFamily: "var(--font-inter), -apple-system, BlinkMacSystemFont, sans-serif",
            fontWeight: 600,
            fontSize: '18px',
            cursor: isSubmitting ? 'not-allowed' : 'pointer',
            boxShadow: '0 8px 24px rgba(10, 95, 89, 0.3), 0 4px 12px rgba(10, 95, 89, 0.2)',
            opacity: isSubmitting ? 0.7 : 1,
          }}
        >
          {isSubmitting ? 'Отправка...' : 'Получить план ухода'}
        </button>
        {/* Fallback кнопка для случаев, когда основная кнопка не работает */}
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            handleGetPlanClick();
          }}
          disabled={isSubmitting}
          style={{
            width: '100%',
            padding: '12px 24px',
            background: 'transparent',
            color: '#0A5F59',
            border: '1px solid #0A5F59',
            borderRadius: '16px',
            fontFamily: "var(--font-inter), -apple-system, BlinkMacSystemFont, sans-serif",
            fontWeight: 500,
            fontSize: '14px',
            cursor: isSubmitting ? 'not-allowed' : 'pointer',
            opacity: isSubmitting ? 0.5 : 1,
          }}
        >
          Пропустить и получить план
        </button>
        {!hasInitData && !isDev && (
          <p style={{
            color: '#6B7280',
            fontSize: '12px',
            textAlign: 'center',
            marginTop: '8px',
          }}>
            Убедитесь, что приложение открыто через Telegram Mini App
          </p>
        )}
      </div>
    );
  }
  
  // Для других tinder-экранов показываем кнопки Да/Нет
  if (isTinderScreen) {
    const handleButtonClick = async () => {
      if (isSubmitting) return;
      if (!questionnaire) {
        setError('Анкета не загружена. Пожалуйста, обновите страницу.');
        return;
      }
      handleNext();
    };
    
    return (
      <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            handleButtonClick();
          }}
          disabled={isSubmitting}
          style={{
            flex: 1,
            height: '64px',
            background: 'rgba(255, 255, 255, 0.8)',
            color: '#0A5F59',
            border: '2px solid rgba(10, 95, 89, 0.3)',
            borderRadius: '32px',
            fontFamily: "var(--font-inter), -apple-system, BlinkMacSystemFont, sans-serif",
            fontWeight: 600,
            fontSize: '18px',
            cursor: isSubmitting ? 'not-allowed' : 'pointer',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
            opacity: isSubmitting ? 0.7 : 1,
          }}
        >
          {isSubmitting ? 'Отправка...' : '❌ Нет'}
        </button>
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            handleButtonClick();
          }}
          disabled={isSubmitting}
          style={{
            flex: 1,
            height: '64px',
            background: '#0A5F59',
            color: 'white',
            border: 'none',
            borderRadius: '32px',
            fontFamily: "var(--font-inter), -apple-system, BlinkMacSystemFont, sans-serif",
            fontWeight: 600,
            fontSize: '18px',
            cursor: isSubmitting ? 'not-allowed' : 'pointer',
            boxShadow: '0 8px 24px rgba(10, 95, 89, 0.3), 0 4px 12px rgba(10, 95, 89, 0.2)',
            opacity: isSubmitting ? 0.7 : 1,
          }}
        >
          {isSubmitting ? 'Отправка...' : '✅ Да'}
        </button>
      </div>
    );
  }
  
  // Если это не tinder-экран, не показываем кнопки
  return null;
}

