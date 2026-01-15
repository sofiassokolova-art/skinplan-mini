// app/(miniapp)/quiz/components/QuizQuestion.tsx
// Компонент для рендеринга вопроса анкеты
// ОБНОВЛЕНО: Новые стили - белый фон, черный текст, черный прогресс-бар с лаймовым прогрессом

'use client';

import Link from 'next/link';
import { createPortal } from 'react-dom';
import type { Question } from '@/lib/quiz/types';
import { getInfoScreenAfterQuestion } from '../info-screens';

interface QuizQuestionProps {
  question: Question;
  currentQuestionIndex: number;
  allQuestionsLength: number;
  answers: Record<number, string | string[]>;
  isRetakingQuiz: boolean;
  isSubmitting: boolean;
  onAnswer: (questionId: number, value: string | string[]) => Promise<void>;
  onNext: () => void;
  onSubmit: () => Promise<void>;
  onBack: () => void;
  showBackButton: boolean;
}

export function QuizQuestion({
  question,
  currentQuestionIndex,
  allQuestionsLength,
  answers,
  isRetakingQuiz,
  isSubmitting,
  onAnswer,
  onNext,
  onSubmit,
  onBack,
  showBackButton,
}: QuizQuestionProps) {
  const isLastQuestion = currentQuestionIndex === allQuestionsLength - 1;
  const hasInfoScreenAfter = !isRetakingQuiz && getInfoScreenAfterQuestion(question.code);
  const showSubmitButton = isLastQuestion && !hasInfoScreenAfter;
  
  // Первый вопрос (user_name) - специальный стиль (без прогресс-бара)
  const isNameQuestion = question?.code === 'user_name' || question?.type === 'free_text';
  const hideProgressBar = isNameQuestion;
  
  // Вопрос о целях (skin_goals) - лаймовый стиль с карточками
  const isGoalsQuestion = question?.code === 'skin_goals';
  const useLimeStyle = isGoalsQuestion && question?.type === 'multi_choice';

  // Кнопка "Назад" - рендерим через портал, чтобы она была вне всех контейнеров
  const backButton = showBackButton && typeof window !== 'undefined' ? createPortal(
    <button
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onBack();
      }}
      style={{
        position: 'fixed',
        top: 'clamp(20px, 4vh, 40px)',
        left: 'clamp(19px, 5vw, 24px)',
        zIndex: 9999,
        width: '44px',
        height: '44px',
        background: 'transparent',
        border: 'none',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        padding: 0,
        pointerEvents: 'auto',
        willChange: 'transform',
      }}
    >
      <svg
        width="12"
        height="20"
        viewBox="0 0 12 20"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M10 2L2 10L10 18"
          stroke="#1A1A1A"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>,
    document.body
  ) : null;

  return (
    <>
      {/* Кнопка "Назад" - рендерится через портал в body для гарантированной фиксации */}
      {backButton}

      {/* Контейнер с анимацией для всего контента вопроса */}
      <div className="animate-fade-in">
        {/* Прогресс-бар - черный фон с лаймовым прогрессом */}
        {!hideProgressBar && (
          <div style={{ 
            marginBottom: '24px',
            marginTop: '75px',
          }}>
            <div style={{
              width: '100%',
              height: '6px',
              backgroundColor: '#000000',
              borderRadius: '3px',
              overflow: 'hidden',
              position: 'relative',
              padding: '1px',
              boxSizing: 'border-box',
            }}>
              <div style={{
                width: `${allQuestionsLength > 0 ? ((currentQuestionIndex + 1) / allQuestionsLength) * 100 : 0}%`,
                height: '100%',
                backgroundColor: '#D5FE61',
                borderRadius: '2px',
                transition: 'width 0.3s ease',
              }} />
            </div>
          </div>
        )}

        {/* Заголовок вопроса - скрыт для skin_goals (отображается внутри лаймового контейнера) */}
      {!useLimeStyle && (
        <h2 className="quiz-title" style={{ 
          fontFamily: "var(--font-unbounded), 'Unbounded', -apple-system, BlinkMacSystemFont, sans-serif",
          fontSize: '24px', 
          fontWeight: 700, 
          color: '#000000',
          marginBottom: '24px',
          marginTop: hideProgressBar ? '60px' : '0',
        }}>
          {question?.text || ''}
        </h2>
      )}

      {/* Single Choice - белые кнопки с серой окантовкой, #F2F2F2 при выборе */}
      {question?.type === 'single_choice' && question?.options && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {question.options.map((option) => {
            const isSelected = answers[question.id] === option.value;
            
            return (
              <button
                key={option.id}
                onClick={async () => {
                  await onAnswer(question.id, option.value);
                  setTimeout(() => onNext(), 300);
                }}
                style={{
                  padding: '16px',
                  borderRadius: '16px',
                  border: '1px solid #000000',
                  backgroundColor: isSelected ? '#F2F2F2' : '#FFFFFF',
                  cursor: 'pointer',
                  textAlign: 'left',
                  fontSize: '16px',
                  color: '#000000',
                  transition: 'all 0.2s',
                  fontFamily: "var(--font-inter), 'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
                }}
              >
                {option.label}
              </button>
            );
          })}
          
          {/* Кнопки навигации для single_choice */}
          {showSubmitButton && answers[question.id] ? (
            <div style={{ marginTop: '24px' }}>
              <button
                onClick={onSubmit}
                disabled={isSubmitting}
                style={{
                  width: '100%',
                  padding: '18px',
                  borderRadius: '20px',
                  backgroundColor: '#000000',
                  color: '#FFFFFF',
                  border: 'none',
                  cursor: isSubmitting ? 'not-allowed' : 'pointer',
                  fontSize: '16px',
                  fontWeight: 600,
                  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)',
                  transition: 'all 0.2s',
                  opacity: isSubmitting ? 0.7 : 1,
                  fontFamily: "var(--font-inter), 'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
                }}
              >
                {isSubmitting ? 'Отправка...' : 'Получить план'}
              </button>
              {!isRetakingQuiz && (
                <p style={{
                  marginTop: '12px',
                  fontSize: '11px',
                  color: '#6B7280',
                  textAlign: 'center',
                  lineHeight: '1.4',
                }}>
                  Нажимая «Получить план», вы соглашаетесь с{' '}
                  <Link
                    href="/terms"
                    style={{
                      color: '#000000',
                      textDecoration: 'underline',
                    }}
                  >
                    пользовательским соглашением
                  </Link>
                </p>
              )}
            </div>
          ) : (
            answers[question.id] && isRetakingQuiz && (
              <button
                onClick={onNext}
                disabled={!answers[question.id]}
                style={{
                  marginTop: '24px',
                  width: '100%',
                  padding: '16px',
                  borderRadius: '20px',
                  backgroundColor: '#D5FE61',
                  color: '#000000',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '16px',
                  fontWeight: 600,
                  opacity: !answers[question.id] ? 0.5 : 1,
                  fontFamily: "var(--font-inter), 'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
                }}
              >
                Продолжить
              </button>
            )
          )}
        </div>
      )}

      {/* Free Text */}
      {question?.type === 'free_text' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <input
            type="text"
            value={(answers[question.id] as string) || ''}
            onChange={(e) => {
              onAnswer(question.id, e.target.value);
            }}
            placeholder="Введите ваше имя"
            style={{
              padding: '16px',
              borderRadius: '16px',
              border: '1px solid #000000',
              backgroundColor: '#FFFFFF',
              fontSize: '16px',
              color: '#000000',
              fontFamily: "var(--font-inter), 'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
              outline: 'none',
              transition: 'all 0.2s',
            }}
            onFocus={(e) => {
              e.target.style.borderColor = '#000000';
              e.target.style.boxShadow = '0 0 0 2px rgba(0, 0, 0, 0.1)';
            }}
            onBlur={(e) => {
              e.target.style.borderColor = '#000000';
              e.target.style.boxShadow = 'none';
            }}
          />
          {answers[question.id] && String(answers[question.id]).trim().length > 0 && (
            <button
              onClick={onNext}
              style={{
                marginTop: '12px',
                width: '100%',
                padding: '16px',
                borderRadius: '20px',
                backgroundColor: '#D5FE61',
                color: '#000000',
                border: 'none',
                cursor: 'pointer',
                fontSize: '16px',
                fontWeight: 600,
                fontFamily: "var(--font-inter), 'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
              }}
            >
              Далее
            </button>
          )}
        </div>
      )}

      {/* Multi Choice - Lime Style (skin_goals) - лаймовый контейнер с отступами */}
      {question?.type === 'multi_choice' && question?.options && useLimeStyle && (
        <div style={{ 
          backgroundColor: '#D5FE61',
          borderRadius: '24px',
          padding: '20px',
          marginTop: '0px',
          paddingTop: '20px',
        }}>
          {/* Заголовок внутри лаймового контейнера */}
          <h2 style={{ 
            fontFamily: "var(--font-unbounded), 'Unbounded', -apple-system, BlinkMacSystemFont, sans-serif",
            fontSize: '24px', 
            fontWeight: 700, 
            color: '#000000',
            marginBottom: '20px',
            marginTop: '0',
          }}>
            {question?.text || ''}
          </h2>

          <div style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            gap: '16px',
          }}>
            {question.options.map((option, index) => {
              const currentAnswers = (answers[question.id] as string[]) || [];
              const isSelected = currentAnswers.includes(option.value);
              // Картинки для каждой опции skin_goals
              const goalImages: Record<number, string> = {
                0: '/wrinkles6.jpeg',      // Сократить морщины и мелкие линии
                1: '/acne6.jpeg',          // Избавиться от акне и высыпаний
                2: '/pores6.jpeg',         // Сделать поры менее заметными
                3: '/puff6.jpeg',          // Уменьшить отёчность лица
                4: '/pigmentation6.jpeg',  // Выровнять тон и пигментацию
                5: '/tone6.jpeg',          // Улучшить текстуру и гладкость кожи
              };
              const imageUrl = goalImages[index] || '/tone6.jpeg';
              
              return (
                <button
                  key={option.id}
                  onClick={async () => {
                    const newAnswers = isSelected
                      ? currentAnswers.filter((v) => v !== option.value)
                      : [...currentAnswers, option.value];
                    await onAnswer(question.id, newAnswers);
                  }}
                  style={{
                    padding: '0',
                    borderRadius: '16px',
                    border: isSelected ? '2px solid #FFFFFF' : 'none',
                    backgroundColor: isSelected ? '#D5FE61' : '#FFFFFF',
                    cursor: 'pointer',
                    textAlign: 'left',
                    overflow: 'hidden',
                    transition: 'all 0.2s',
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                  }}
                >
                  {/* Картинка */}
                  <div style={{
                    width: '100%',
                    height: '140px',
                    backgroundColor: '#f0f0f0',
                    overflow: 'hidden',
                  }}>
                    <img 
                      src={imageUrl}
                      alt={option.label}
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                      }}
                    />
                  </div>
                  {/* Текст и чекбокс */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '16px',
                    backgroundColor: isSelected ? '#D5FE61' : '#FFFFFF',
                  }}>
                    <span style={{
                      fontSize: '16px',
                      fontWeight: 500,
                      color: '#000000',
                      fontFamily: "var(--font-inter), 'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
                    }}>
                      {option.label}
                    </span>
                  {/* Кружок-чекбокс */}
                  <div style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '50%',
                    backgroundColor: isSelected ? '#000000' : '#D5FE61',
                    border: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    boxShadow: isSelected ? 'none' : 'inset 0 2px 4px rgba(0, 0, 0, 0.15)',
                  }}>
                      {isSelected && (
                        <svg width="14" height="10" viewBox="0 0 14 10" fill="none">
                          <path d="M1 5L5 9L13 1" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
            
            {/* Кнопка "Продолжить" - черная для skin_goals (в отличие от остальных экранов) */}
            {answers[question.id] && (Array.isArray(answers[question.id]) ? (answers[question.id] as string[]).length > 0 : true) && (
              <button
                onClick={showSubmitButton ? onSubmit : onNext}
                disabled={isSubmitting}
                style={{
                  marginTop: '8px',
                  width: '100%',
                  padding: '18px',
                  borderRadius: '20px',
                  backgroundColor: '#000000',
                  color: '#FFFFFF',
                  border: 'none',
                  cursor: isSubmitting ? 'not-allowed' : 'pointer',
                  fontSize: '16px',
                  fontWeight: 600,
                  opacity: isSubmitting ? 0.7 : 1,
                  fontFamily: "var(--font-inter), 'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
                }}
              >
                {showSubmitButton ? (isSubmitting ? 'Отправка...' : 'Получить план') : 'Продолжить'}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Multi Choice - Default Style (белые кнопки с серой окантовкой, #F2F2F2 при выборе) */}
      {question?.type === 'multi_choice' && question?.options && !useLimeStyle && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {question.options.map((option) => {
            const currentAnswers = (answers[question.id] as string[]) || [];
            const isSelected = currentAnswers.includes(option.value);
            
            return (
              <button
                key={option.id}
                onClick={() => {
                  const newAnswers = isSelected
                    ? currentAnswers.filter((v) => v !== option.value)
                    : [...currentAnswers, option.value];
                  onAnswer(question.id, newAnswers);
                }}
                style={{
                  padding: '16px',
                  borderRadius: '16px',
                  border: '1px solid #000000',
                  backgroundColor: isSelected ? '#F2F2F2' : '#FFFFFF',
                  cursor: 'pointer',
                  textAlign: 'left',
                  fontSize: '16px',
                  color: '#000000',
                  transition: 'all 0.2s',
                  fontFamily: "var(--font-inter), 'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
                }}
              >
                {option.label}
              </button>
            );
          })}
          
          {/* Кнопки навигации для multi_choice */}
          {showSubmitButton && answers[question.id] && (Array.isArray(answers[question.id]) ? (answers[question.id] as string[]).length > 0 : true) ? (
            <div style={{ marginTop: '24px' }}>
              <button
                onClick={onSubmit}
                disabled={!answers[question.id] || (Array.isArray(answers[question.id]) && (answers[question.id] as string[]).length === 0) || isSubmitting}
                style={{
                  width: '100%',
                  padding: '18px',
                  borderRadius: '20px',
                  backgroundColor: '#000000',
                  color: '#FFFFFF',
                  border: 'none',
                  cursor: (!answers[question.id] || (Array.isArray(answers[question.id]) && (answers[question.id] as string[]).length === 0) || isSubmitting) ? 'not-allowed' : 'pointer',
                  fontSize: '16px',
                  fontWeight: 600,
                  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)',
                  opacity: (!answers[question.id] || (Array.isArray(answers[question.id]) && (answers[question.id] as string[]).length === 0) || isSubmitting) ? 0.5 : 1,
                  transition: 'all 0.2s',
                  fontFamily: "var(--font-inter), 'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
                }}
              >
                {isSubmitting ? 'Отправка...' : 'Получить план'}
              </button>
              {!isRetakingQuiz && (
                <p style={{
                  marginTop: '12px',
                  fontSize: '11px',
                  color: '#6B7280',
                  textAlign: 'center',
                  lineHeight: '1.4',
                }}>
                  Нажимая «Получить план», вы соглашаетесь с{' '}
                  <Link
                    href="/terms"
                    style={{
                      color: '#000000',
                      textDecoration: 'underline',
                    }}
                  >
                    пользовательским соглашением
                  </Link>
                </p>
              )}
            </div>
          ) : (
            answers[question.id] && (
              <button
                onClick={onNext}
                disabled={!answers[question.id] || (Array.isArray(answers[question.id]) && (answers[question.id] as string[]).length === 0)}
                style={{
                  marginTop: '24px',
                  width: '100%',
                  padding: '16px',
                  borderRadius: '20px',
                  backgroundColor: '#D5FE61',
                  color: '#000000',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '16px',
                  fontWeight: 600,
                  opacity: (!answers[question.id] || (Array.isArray(answers[question.id]) && (answers[question.id] as string[]).length === 0)) ? 0.5 : 1,
                  fontFamily: "var(--font-inter), 'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
                }}
              >
                Продолжить
              </button>
            )
          )}
        </div>
      )}
      </div>
    </>
  );
}
