// app/(miniapp)/quiz/components/QuizQuestion.tsx
// Компонент для рендеринга вопроса анкеты
// ОБНОВЛЕНО: Новые стили - белый фон, черный текст, черный прогресс-бар с лаймовым прогрессом

'use client';

import Link from 'next/link';
import Image from 'next/image';
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
  // Лаймовый стиль для skin_type
  const isSkinTypeQuestion = question?.code === 'skin_type';
  // Специальный стиль для lifestyle_habits
  const isLifestyleHabitsQuestion = question?.code === 'lifestyle_habits';

  // Для skin_type используем лаймовый стиль независимо от типа вопроса
  const useLimeStyle = (isGoalsQuestion && question?.type === 'multi_choice') || isSkinTypeQuestion;

  const questionText = question?.text || '';

  const splitTitleSubtitle = (text: string) => {
    const parts = text.split('\n');
    let title = parts[0] || '';
    let subtitle = parts.slice(1).join('\n') || '';

    if (!subtitle) {
      const bracketMatch = title.match(/^(.+?)\s*\((.+?)\)\s*$/);
      if (bracketMatch) {
        title = bracketMatch[1].trim();
        subtitle = `(${bracketMatch[2].trim()})`;
      }
    }

    // Убираем "из средств по уходу за кожей"
    if (title.includes('из средств по уходу за кожей')) {
      title = title.replace(/\s*из средств по уходу за кожей\.?\s*/gi, '').trim();
    }

    return { title, subtitle };
  };

  const { title, subtitle } = splitTitleSubtitle(questionText);

  const renderTitle = (t: string) => {
    const isAvoidIngredientsQuestion = question?.code === 'avoid_ingredients';
    if (isAvoidIngredientsQuestion && t.includes('исключить')) {
      const parts = t.split('исключить');
      return (
        <>
          {parts[0]}
          <strong>исключить</strong>
          {parts[1]}
        </>
      );
    }
    return t;
  };

  const ProgressBar = ({ useLimeOffsets }: { useLimeOffsets: boolean }) => {
    if (hideProgressBar) return null;

    return (
      <div
        style={{
          marginBottom: '24px',
          marginTop: '75px',
          width: '100%',
          maxWidth: '600px',
          marginLeft: useLimeOffsets ? 'max(20px, calc(50% - 300px))' : 'auto',
          marginRight: useLimeOffsets ? 'max(20px, calc(50% - 300px))' : 'auto',
          paddingLeft: '0',
          paddingRight: '0',
          boxSizing: 'border-box',
        }}
      >
        <div
          style={{
            width: '100%',
            height: '6px',
            backgroundColor: '#000000',
            borderRadius: '3px',
            overflow: 'hidden',
            position: 'relative',
            padding: '1px',
            boxSizing: 'border-box',
          }}
        >
          <div
            style={{
              width: `${
                allQuestionsLength > 0
                  ? ((currentQuestionIndex + 1) / allQuestionsLength) * 100
                  : 0
              }%`,
              height: '100%',
              backgroundColor: '#D5FE61',
              borderRadius: '2px',
              transition: 'width 0.3s ease',
            }}
          />
        </div>
      </div>
    );
  };

  // Кнопка "Назад" - портал в body
  const backButton =
    showBackButton && typeof window !== 'undefined'
      ? createPortal(
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
              zIndex: 99999,
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
            }}
          >
            <svg width="12" height="20" viewBox="0 0 12 20" fill="none" xmlns="http://www.w3.org/2000/svg">
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
        )
      : null;

  const hasAnswer = (qid: number) => {
    const v = answers[qid];
    if (!v) return false;
    if (Array.isArray(v)) return v.length > 0;
    return String(v).trim().length > 0;
  };

  const renderSubmitOrContinueDisclaimer = () => (
    !isRetakingQuiz ? (
      <p
        style={{
          marginTop: '12px',
          fontSize: '11px',
          color: '#6B7280',
          textAlign: 'center',
          lineHeight: '1.4',
        }}
      >
        Нажимая «Получить план», вы соглашаетесь с{' '}
        <Link href="/terms" style={{ color: '#000000', textDecoration: 'underline' }}>
          пользовательским соглашением
        </Link>
      </p>
    ) : null
  );

  const SingleChoiceDefault = () => {
    if (question?.type !== 'single_choice' || !question?.options || isSkinTypeQuestion) return null;

    return (
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
                fontFamily:
                  "var(--font-inter), 'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
              }}
            >
              {option.label}
            </button>
          );
        })}

        {/* Навигация */}
        {showSubmitButton && hasAnswer(question.id) ? (
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
                fontFamily:
                  "var(--font-inter), 'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
              }}
            >
              {isSubmitting ? 'Отправка...' : 'Получить план'}
            </button>
            {renderSubmitOrContinueDisclaimer()}
          </div>
        ) : hasAnswer(question.id) && isRetakingQuiz ? (
          <button
            onClick={onNext}
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
              fontFamily:
                "var(--font-inter), 'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
            }}
          >
            Продолжить
          </button>
        ) : null}
      </div>
    );
  };

  const FreeText = () => {
    if (question?.type !== 'free_text') return null;

    const value = (answers[question.id] as string) || '';

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <input
          type="text"
          value={value}
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
            e.currentTarget.style.borderColor = '#000000';
            e.currentTarget.style.boxShadow = '0 0 0 2px rgba(0, 0, 0, 0.1)';
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = '#000000';
            e.currentTarget.style.boxShadow = 'none';
          }}
        />

        {String(value).trim().length > 0 && (
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
              fontFamily:
                "var(--font-inter), 'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
            }}
          >
            Далее
          </button>
        )}
      </div>
    );
  };

  const LimeStyle = () => {
    if (!question?.options || !useLimeStyle) return null;

    const isMultiChoice = question?.type === 'multi_choice';

    const getImageUrl = (index: number) => {
      let imageUrl = '/tone6.jpeg';

      if (isGoalsQuestion) {
        const goalImages: Record<number, string> = {
          0: '/wrinkles6.jpeg',
          1: '/acne6.jpeg',
          2: '/pores6.jpeg',
          3: '/puff6.jpeg',
          4: '/pigmentation6.jpeg',
          5: '/tone6.jpeg',
        };
        imageUrl = goalImages[index] || '/tone6.jpeg';
      } else if (isSkinTypeQuestion) {
        const skinTypeImages: Record<number, string> = {
          0: '/wrinkles6.jpeg',
          1: '/acne6.jpeg',
          2: '/pores6.jpeg',
          3: '/puff6.jpeg',
          4: '/pigmentation6.jpeg',
        };
        imageUrl = skinTypeImages[index] || '/tone6.jpeg';
      }

      return imageUrl;
    };

    return (
      <div
        style={{
          backgroundColor: '#D5FE61',
          ...(isGoalsQuestion
            ? {
                borderTopLeftRadius: '24px',
                borderTopRightRadius: '24px',
                borderBottomLeftRadius: '0',
                borderBottomRightRadius: '0',
              }
            : { borderRadius: '24px' }),
          padding: '20px',
          marginTop: '0px',
          paddingTop: '20px',
          width: (isGoalsQuestion || isSkinTypeQuestion) ? '100%' : 'auto',
          marginLeft: (isGoalsQuestion || isSkinTypeQuestion) ? '0' : 'auto',
          marginRight: (isGoalsQuestion || isSkinTypeQuestion) ? '0' : 'auto',
          minHeight: isGoalsQuestion ? '100vh' : 'auto',
          position: 'static',
          boxSizing: 'border-box',
          display: isGoalsQuestion ? 'flex' : 'block',
          flexDirection: 'column',
        }}
      >
        {/* Заголовок */}
        <h2
          style={{
            fontFamily:
              "var(--font-unbounded), 'Unbounded', -apple-system, BlinkMacSystemFont, sans-serif",
            fontSize: '24px',
            fontWeight: 700,
            color: '#000000',
            marginBottom: subtitle ? '4px' : '20px',
            marginTop: '0',
          }}
        >
          {renderTitle(title)}
        </h2>

        {/* Подзаголовок */}
        {subtitle && (
          <div
            style={{
              fontFamily:
                "var(--font-inter), 'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
              fontSize: '14px',
              fontWeight: 400,
              color: '#9D9D9D',
              marginBottom: '20px',
              marginTop: '0',
              lineHeight: '1.5',
              whiteSpace: 'pre-line',
            }}
          >
            {subtitle}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {question.options.map((option, index) => {
            const currentAnswers = isMultiChoice
              ? ((answers[question.id] as string[]) || [])
              : answers[question.id]
                ? [answers[question.id] as string]
                : [];

            const isSelected = currentAnswers.includes(option.value);

            const imageUrl = getImageUrl(index);

            const optionText = option.label || '';
            const optionParts = optionText.split('\n');
            const optionTitle = optionParts[0] || '';
            const optionDescription = optionParts.slice(1).join('\n') || '';

            return (
              <button
                key={option.id}
                onClick={async () => {
                  if (isMultiChoice) {
                    const newAnswers = isSelected
                      ? currentAnswers.filter((v) => v !== option.value)
                      : [...currentAnswers, option.value];
                    await onAnswer(question.id, newAnswers);
                  } else {
                    await onAnswer(question.id, option.value);
                    setTimeout(() => onNext(), 300);
                  }
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
                <div
                  style={{
                    width: '100%',
                    height: '140px',
                    backgroundColor: '#f0f0f0',
                    overflow: 'hidden',
                    position: 'relative',
                  }}
                >
                  <Image
                    src={imageUrl}
                    alt={option.label}
                    width={600}
                    height={140}
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      display: 'block',
                    }}
                    sizes="(max-width: 768px) 100vw, 420px"
                  />
                </div>

                {/* Текст */}
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    flex: 1,
                    padding: '16px',
                    backgroundColor: isSelected ? '#D5FE61' : '#FFFFFF',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: optionDescription ? '8px' : '0',
                    }}
                  >
                    <span
                      style={{
                        fontSize: '16px',
                        fontWeight: 500,
                        color: '#000000',
                        fontFamily:
                          "var(--font-inter), 'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
                      }}
                    >
                      {optionTitle}
                    </span>

                    {/* чекбокс убираем для skin_type */}
                    {!isSkinTypeQuestion && (
                      <div
                        style={{
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
                        }}
                      >
                        {isSelected && (
                          <svg width="14" height="10" viewBox="0 0 14 10" fill="none">
                            <path
                              d="M1 5L5 9L13 1"
                              stroke="#FFFFFF"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        )}
                      </div>
                    )}
                  </div>

                  {optionDescription && (
                    <div
                      style={{
                        fontSize: '14px',
                        fontWeight: 400,
                        color: '#666666',
                        fontFamily:
                          "var(--font-inter), 'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
                        lineHeight: '1.4',
                        whiteSpace: 'pre-line',
                      }}
                    >
                      {optionDescription}
                    </div>
                  )}
                </div>
              </button>
            );
          })}

          {/* Кнопка продолжить/получить план только для multi_choice */}
          {question?.type === 'multi_choice' && hasAnswer(question.id) && (
            <button
              onClick={showSubmitButton ? onSubmit : onNext}
              disabled={isSubmitting}
              style={{
                marginTop: isGoalsQuestion ? 'auto' : '8px',
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
                fontFamily:
                  "var(--font-inter), 'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
              }}
            >
              {showSubmitButton ? (isSubmitting ? 'Отправка...' : 'Получить план') : 'Продолжить'}
            </button>
          )}
        </div>
      </div>
    );
  };

  const LifestyleHabits = () => {
    if (question?.type !== 'multi_choice' || !question?.options || !isLifestyleHabitsQuestion) return null;

    const getHabitIcon = (label: string) => {
      if (label.includes('Курю')) {
        return (
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="4" y="8" width="10" height="2" fill="#000000" />
            <rect x="14" y="7" width="2" height="4" rx="1" fill="#000000" />
          </svg>
        );
      }
      if (label.includes('алкоголь')) {
        return (
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M6 4H14V8L16 16H4L6 8V4Z" stroke="#000000" strokeWidth="1.5" fill="none" />
            <path d="M6 4H14" stroke="#000000" strokeWidth="1.5" />
            <path d="M4 16H16" stroke="#000000" strokeWidth="1.5" />
          </svg>
        );
      }
      if (label.includes('высыпаюсь')) {
        return (
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M8 3C8 3 6 5 6 10C6 15 8 17 8 17C4 16 2 13 2 10C2 7 4 4 8 3Z" fill="#000000" />
            <circle cx="13" cy="7" r="1" fill="#000000" />
            <circle cx="15" cy="10" r="1" fill="#000000" />
            <circle cx="13" cy="13" r="1" fill="#000000" />
          </svg>
        );
      }
      if (label.includes('стресс')) {
        return (
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M11 2L4 12H10L9 18L16 8H10L11 2Z" fill="#000000" />
          </svg>
        );
      }
      if (label.includes('сладкого')) {
        return (
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="10" cy="10" r="6" stroke="#000000" strokeWidth="1.5" fill="none" />
            <circle cx="10" cy="10" r="3" stroke="#000000" strokeWidth="1.5" fill="none" />
            <circle cx="7" cy="7" r="1" fill="#000000" />
            <circle cx="13" cy="7" r="1" fill="#000000" />
          </svg>
        );
      }
      if (label.includes('фастфуда')) {
        return (
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="4" y="6" width="12" height="2" fill="#000000" />
            <rect x="4" y="9" width="12" height="2" fill="#000000" />
            <rect x="4" y="12" width="12" height="2" fill="#000000" />
            <circle cx="6" cy="7" r="0.5" fill="#000000" />
            <circle cx="14" cy="7" r="0.5" fill="#000000" />
          </svg>
        );
      }
      if (label.includes('SPF')) {
        return (
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="10" cy="10" r="4" fill="#000000" />
            <line x1="10" y1="2" x2="10" y2="4" stroke="#000000" strokeWidth="1.5" />
            <line x1="10" y1="16" x2="10" y2="18" stroke="#000000" strokeWidth="1.5" />
            <line x1="2" y1="10" x2="4" y2="10" stroke="#000000" strokeWidth="1.5" />
            <line x1="16" y1="10" x2="18" y2="10" stroke="#000000" strokeWidth="1.5" />
            <line x1="4.93" y1="4.93" x2="6.34" y2="6.34" stroke="#000000" strokeWidth="1.5" />
            <line x1="13.66" y1="13.66" x2="15.07" y2="15.07" stroke="#000000" strokeWidth="1.5" />
            <line x1="15.07" y1="4.93" x2="13.66" y2="6.34" stroke="#000000" strokeWidth="1.5" />
            <line x1="6.34" y1="13.66" x2="4.93" y2="15.07" stroke="#000000" strokeWidth="1.5" />
          </svg>
        );
      }
      if (label.includes('нет таких привычек')) {
        return (
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M4 10L8 14L16 6" stroke="#000000" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        );
      }
      return null;
    };

    return (
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
                backgroundColor: '#FFFFFF',
                cursor: 'pointer',
                textAlign: 'left',
                fontSize: '16px',
                color: '#000000',
                transition: 'all 0.2s',
                fontFamily: "var(--font-inter), 'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
                display: 'flex',
                alignItems: 'center',
                gap: '16px',
              }}
            >
              <div
                style={{
                  width: '56px',
                  height: '56px',
                  borderRadius: '50%',
                  backgroundColor: '#D5FE61',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                {getHabitIcon(option.label)}
              </div>

              <span style={{ flex: 1 }}>{option.label}</span>

              <div
                style={{
                  width: '24px',
                  height: '24px',
                  borderRadius: '50%',
                  border: '2px solid #000000',
                  backgroundColor: isSelected ? '#000000' : 'transparent',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                {isSelected && (
                  <svg width="12" height="9" viewBox="0 0 12 9" fill="none">
                    <path d="M1 4.5L4.5 8L11 1.5" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </div>
            </button>
          );
        })}

        {/* Навигация */}
        {hasAnswer(question.id) ? (
          showSubmitButton ? (
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
                  opacity: isSubmitting ? 0.7 : 1,
                  transition: 'all 0.2s',
                  fontFamily: "var(--font-inter), 'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
                }}
              >
                {isSubmitting ? 'Отправка...' : 'Получить план'}
              </button>
              {renderSubmitOrContinueDisclaimer()}
            </div>
          ) : (
            <button
              onClick={onNext}
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
                fontFamily: "var(--font-inter), 'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
              }}
            >
              Продолжить
            </button>
          )
        ) : null}
      </div>
    );
  };

  const MultiChoiceDefault = () => {
    if (question?.type !== 'multi_choice' || !question?.options || useLimeStyle || isLifestyleHabitsQuestion) return null;

    return (
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

        {hasAnswer(question.id) ? (
          showSubmitButton ? (
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
                  opacity: isSubmitting ? 0.7 : 1,
                  transition: 'all 0.2s',
                  fontFamily: "var(--font-inter), 'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
                }}
              >
                {isSubmitting ? 'Отправка...' : 'Получить план'}
              </button>
              {renderSubmitOrContinueDisclaimer()}
            </div>
          ) : (
            <button
              onClick={onNext}
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
                fontFamily: "var(--font-inter), 'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
              }}
            >
              Продолжить
            </button>
          )
        ) : null}
      </div>
    );
  };

  return (
    <>
      {backButton}

      <div className="animate-fade-in">
        {/* Прогресс-бар (вне лайм-контейнера) */}
        {!useLimeStyle && <ProgressBar useLimeOffsets={false} />}

        {/* Заголовок (вне лайма) */}
        {!useLimeStyle && (
          <>
            <h2
              className="quiz-title"
              style={{
                fontFamily:
                  "var(--font-unbounded), 'Unbounded', -apple-system, BlinkMacSystemFont, sans-serif",
                fontSize: '24px',
                fontWeight: 700,
                color: '#000000',
                marginBottom: subtitle ? '4px' : '24px',
                marginTop: hideProgressBar ? '60px' : '0',
              }}
            >
              {renderTitle(title)}
            </h2>

            {subtitle && (
              <div
                style={{
                  fontFamily:
                    "var(--font-inter), 'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
                  fontSize: '14px',
                  fontWeight: 400,
                  color: '#9D9D9D',
                  marginBottom: '24px',
                  marginTop: '0',
                  lineHeight: '1.5',
                  whiteSpace: 'pre-line',
                }}
              >
                {subtitle}
              </div>
            )}
          </>
        )}

        {/* Лаймовый прогресс-бар (для лайм-экранов) */}
        {useLimeStyle && <ProgressBar useLimeOffsets />}

        {/* Рендеры */}
        <LimeStyle />
        <SingleChoiceDefault />
        <FreeText />
        <LifestyleHabits />
        <MultiChoiceDefault />
      </div>
    </>
  );
}
