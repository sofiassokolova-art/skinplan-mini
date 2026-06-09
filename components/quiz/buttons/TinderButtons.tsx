// components/quiz/buttons/TinderButtons.tsx
// Компонент для кнопок Tinder-экранов (Да/Нет)
// Вынесен из renderInfoScreen для улучшения читаемости

import React from 'react';
import { handleGetPlan } from '@/lib/quiz/handlers/handleGetPlan';
import type { HandleGetPlanParams } from '@/lib/quiz/handlers/handleGetPlan';
import { ButtonSkeleton } from '@/components/ui/SkeletonLoader';

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
  // ПАЛИТРА: приведена к чёрно-лаймовой схеме анкеты (#D5FE61 / #000 / #FFF).
  // Раньше кнопки были тёмно-зелёные (#0A5F59), что создавало визуальный разрыв
  // прямо перед финальным CTA. Тиндер-механика (для recognize_yourself_*): оба
  // ответа ведут к handleNext, то есть «Нет» НЕ блокирует продвижение — пользователь
  // всё равно идёт дальше. Это правильный fallback (commitment-device без dead-end).
  const LIME = '#D5FE61';
  const BLACK = '#000000';

  // Для последнего tinder-экрана (want_improve) показываем кнопку "Получить план ухода"
  if (isLastInfoScreen && isTinderScreen && screenId === 'want_improve') {
    const handleGetPlanClick = async () => {
      // ИСПРАВЛЕНО: Проверяем isSubmittingRef.current перед вызовом handleGetPlan
      // Это предотвращает множественные вызовы submitAnswers
      if (isSubmittingRef.current || isSubmitting) {
        console.warn('⚠️ [TinderButtons] handleGetPlanClick: уже отправляется, пропускаем');
        return;
      }

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

    // ИСПРАВЛЕНО: Используем isSubmittingRef.current для более надежной блокировки
    const isCurrentlySubmitting = isSubmitting || isSubmittingRef.current;

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '20px' }}>
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            // ИСПРАВЛЕНО: Дополнительная проверка перед вызовом
            if (isSubmittingRef.current || isSubmitting) {
              console.warn('⚠️ [TinderButtons] Кнопка заблокирована, пропускаем клик');
              return;
            }
            handleGetPlanClick();
          }}
          disabled={isCurrentlySubmitting}
          style={{
            width: '100%',
            height: '64px',
            background: LIME,
            color: BLACK,
            border: 'none',
            borderRadius: '32px',
            fontFamily: "var(--font-inter), -apple-system, BlinkMacSystemFont, sans-serif",
            fontWeight: 600,
            fontSize: '18px',
            cursor: isCurrentlySubmitting ? 'not-allowed' : 'pointer',
            opacity: isCurrentlySubmitting ? 0.6 : 1,
          }}
        >
          {isCurrentlySubmitting ? <ButtonSkeleton /> : 'Получить план ухода'}
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

  // Для других tinder-экранов (recognize_yourself_1/2) показываем кнопки Нет/Да.
  // Оба ответа ведут в handleNext — это commitment-device, не gating. Поэтому
  // «Нет» не приводит к dead-end, пользователь просто продвигается дальше.
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
            background: 'transparent',
            color: BLACK,
            border: `2px solid ${BLACK}`,
            borderRadius: '32px',
            fontFamily: "var(--font-inter), -apple-system, BlinkMacSystemFont, sans-serif",
            fontWeight: 600,
            fontSize: '18px',
            cursor: isSubmitting ? 'not-allowed' : 'pointer',
            opacity: isSubmitting ? 0.6 : 1,
          }}
        >
          {isSubmitting ? '...' : 'Нет'}
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
            background: LIME,
            color: BLACK,
            border: 'none',
            borderRadius: '32px',
            fontFamily: "var(--font-inter), -apple-system, BlinkMacSystemFont, sans-serif",
            fontWeight: 600,
            fontSize: '18px',
            cursor: isSubmitting ? 'not-allowed' : 'pointer',
            opacity: isSubmitting ? 0.6 : 1,
          }}
        >
          {isSubmitting ? '...' : 'Да'}
        </button>
      </div>
    );
  }
  
  // Если это не tinder-экран, не показываем кнопки
  return null;
}
