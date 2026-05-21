// app/(miniapp)/quiz/components/QuizQuestion.tsx
// Компонент для рендеринга вопроса анкеты
// ОБНОВЛЕНО: Новые стили - белый фон, черный текст, черный прогресс-бар с лаймовым прогрессом

'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState, useCallback, useRef, useEffect, useMemo, memo } from 'react';
import { BackButtonFixed } from '@/components/BackButtonFixed';
import { FixedContinueButton } from '@/components/quiz/buttons';
import type { Question } from '@/lib/quiz/types';

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

// Вынесен на уровень модуля, чтобы не пересоздаваться при ре-рендере — иначе картинки на экране «Тип кожи» мигают
const LimeOptionCard = memo(function LimeOptionCard({
  option,
  index,
  isSelected,
  isMultiChoice: _isMultiChoice,
  isSkinTypeQuestion,
  imageUrl,
  onOptionClick
}: {
  option: any;
  index: number;
  isSelected: boolean;
  isMultiChoice: boolean;
  isSkinTypeQuestion: boolean;
  imageUrl: string;
  onOptionClick: () => void;
}) {
  const optionText = option.label || '';
  const optionParts = optionText.split('\n');
  const optionTitle = optionParts[0] || '';
  const optionDescription = optionParts.slice(1).join('\n') || '';

  return (
    <button
      onClick={onOptionClick}
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
          priority
        />
      </div>
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
          <span
            style={{
              fontSize: '14px',
              fontWeight: 400,
              color: '#6B7280',
              fontFamily:
                "var(--font-inter), 'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
              lineHeight: '1.4',
            }}
          >
            {optionDescription}
          </span>
        )}
      </div>
    </button>
  );
});

interface FreeTextProps {
  question: Question;
  answers: Record<number, string | string[]>;
  onAnswer: (questionId: number, value: string | string[]) => Promise<void>;
  onNext: () => void;
}

const FreeTextInput = memo(function FreeTextInput({ question, answers, onAnswer, onNext }: FreeTextProps) {
  const questionIdRef = useRef<number>(question.id);

  useEffect(() => {
    if (question?.id && question.id > 0) {
      questionIdRef.current = question.id;
    }
  }, [question?.id]);

  const initialValue = (answers[questionIdRef.current] as string) || '';
  const [localValue, setLocalValue] = useState(initialValue);
  const inputRef = useRef<HTMLInputElement>(null);
  const lastSyncedValueRef = useRef<string>(initialValue);
  const isDirtyRef = useRef<boolean>(false);
  const isTypingRef = useRef<boolean>(false);

  const currentAnswerValue = (answers[questionIdRef.current] as string) || '';

  useEffect(() => {
    if (!isDirtyRef.current && !isTypingRef.current && currentAnswerValue !== localValue) {
      lastSyncedValueRef.current = currentAnswerValue;
      setLocalValue(currentAnswerValue);
    }
  }, [currentAnswerValue, localValue]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    isTypingRef.current = true;
    isDirtyRef.current = true;
    setLocalValue(newValue);
  }, []);

  const syncIfNeeded = useCallback(async () => {
    const stableQuestionId = questionIdRef.current;
    const currentAnswer = (answers[stableQuestionId] as string) || '';
    if (!isDirtyRef.current || currentAnswer === localValue) {
      isDirtyRef.current = false;
      return;
    }
    if (stableQuestionId > 0) {
      lastSyncedValueRef.current = localValue;
      isDirtyRef.current = false;
      await onAnswer(stableQuestionId, localValue);
    } else {
      console.error('❌ [QuizQuestion] FreeText: Invalid questionId in sync', {
        questionId: stableQuestionId,
        currentQuestionId: question?.id,
      });
    }
  }, [answers, localValue, onAnswer, question?.id]);

  const handleBlur = useCallback(() => {
    isTypingRef.current = false;
    void syncIfNeeded();
  }, [syncIfNeeded]);

  const inputStyle = useMemo(() => ({
    padding: '16px',
    borderRadius: '16px',
    border: '1px solid #000000',
    backgroundColor: '#FFFFFF',
    fontSize: '16px',
    color: '#000000',
    fontFamily: "var(--font-inter), 'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    outline: 'none',
    transition: 'all 0.2s',
  }), []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <input
        ref={inputRef}
        type="text"
        value={localValue}
        onChange={handleChange}
        onBlur={handleBlur}
        placeholder="Введите ваше имя"
        style={inputStyle}
      />
      {String(localValue).trim().length > 0 && (
        <FixedContinueButton
          variant="black"
          ctaText="Продолжить"
          onClick={async () => {
            console.log('➡️ [QuizQuestion] FreeText: "Продолжить" clicked', {
              questionId: question.id,
              valueLength: localValue.length,
              valuePreview: localValue.substring(0, 50)
            });
            await syncIfNeeded();
            onNext();
          }}
        />
      )}
    </div>
  );
});

export const QuizQuestion = memo(function QuizQuestion({
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
  // ИСПРАВЛЕНО: Валидация question.id - не должен быть 0 или undefined
  // НО: не блокируем рендеринг, если вопрос существует, но id может быть временно 0
  // Вместо этого логируем предупреждение и продолжаем работу
  if (!question) {
    console.error('❌ [QuizQuestion] Question is null or undefined');
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <p>Ошибка: вопрос не найден</p>
      </div>
    );
  }
  
  if (question.id <= 0) {
    console.warn('⚠️ [QuizQuestion] Question ID is invalid (<= 0), but continuing:', {
      questionId: question.id,
      questionCode: question.code,
      questionType: question.type,
    });
    // НЕ блокируем рендеринг - продолжаем, но не будем сохранять ответ с невалидным ID
  }

  const isDevEnv = process.env.NODE_ENV === 'development';
  const devLog = (...args: any[]) => {
    if (isDevEnv) {
      // eslint-disable-next-line no-console
      console.log(...args);
    }
  };

  devLog('❓ [QuizQuestion] rendering question', {
    questionId: question?.id,
    questionCode: question?.code,
    questionType: question?.type,
    currentQuestionIndex,
    allQuestionsLength,
    answersCount: Object.keys(answers).length,
    isRetakingQuiz,
    isSubmitting,
    showBackButton,
    hasAnswer: question ? !!answers[question.id] : false,
    questionText: question?.text?.substring(0, 100)
  });

  const isLastQuestion = currentQuestionIndex === allQuestionsLength - 1;
  // ИСПРАВЛЕНО: Не показываем кнопку "Получить план" для вопроса budget
  // После budget показывается инфо-экран, а не отправка ответов
  const showSubmitButton = isLastQuestion && question?.code !== 'budget';

  // Первый вопрос (имя): код в API может быть USER_NAME или user_name
  const isNameQuestion = question?.code?.toLowerCase() === 'user_name' || question?.type === 'free_text';
  const hideProgressBar = isNameQuestion;

  // Вопрос о целях (skin_goals) - лаймовый стиль с карточками
  const isGoalsQuestion = question?.code === 'skin_goals';
  // Лаймовый стиль для skin_type
  const isSkinTypeQuestion = question?.code === 'skin_type';
  // lifestyle_habits удалён из анкеты — спец-стиль больше не нужен.

  // Для skin_type используем лаймовый стиль независимо от типа вопроса
  const useLimeStyle = (isGoalsQuestion && question?.type === 'multi_choice') || isSkinTypeQuestion;

  const questionText = question?.text || '';

  devLog('🎨 [QuizQuestion] question styles determined', {
    isNameQuestion,
    hideProgressBar,
    isGoalsQuestion,
    isSkinTypeQuestion,
    useLimeStyle,
    isLastQuestion,
    showSubmitButton
  });

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

  const { title: rawTitle, subtitle } = splitTitleSubtitle(questionText);
  // Вопрос про имя: если в БД пустой text — показываем заголовок по умолчанию (код может быть USER_NAME или user_name)
  const title = rawTitle || (question?.code?.toLowerCase() === 'user_name' ? 'Как к вам обращаться?' : '');

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

  // Отступ сверху: прогресс-бар не должен накладываться на кнопку «Назад» (зона кнопки ~80px, контент с 48px)
  const PROGRESS_BAR_TOP_OFFSET = '44px';

  // Ширина прогресс-бара совпадает с контейнером вариантов ответов (640px с padding 20px → полоса 600px)
  const ProgressBar = () => {
    if (hideProgressBar) return null;

    return (
      <div
        style={{
          marginBottom: '24px',
          marginTop: PROGRESS_BAR_TOP_OFFSET,
          width: '100%',
          maxWidth: '640px',
          marginLeft: 'auto',
          marginRight: 'auto',
          paddingLeft: '20px',
          paddingRight: '20px',
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

  // Кнопка "Назад" в фиксированном контейнере (портал в body)
  const backButton = <BackButtonFixed show={showBackButton} onClick={onBack} />;

  const hasAnswer = (qid: number) => {
    const v = answers[qid];
    if (!v) return false;
    if (Array.isArray(v)) return v.length > 0;
    return String(v).trim().length > 0;
  };

  const renderSubmitOrContinueDisclaimer = () => {
    // Не показываем disclaimer для вопроса budget
    if (question?.code === 'budget') {
      return null;
    }
    return !isRetakingQuiz ? (
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
    ) : null;
  };

  const SingleChoiceDefault = () => {
    if (question?.type !== 'single_choice' || !question?.options || isSkinTypeQuestion) return null;

    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        maxWidth: '600px',
        margin: '0 auto',
        width: '100%'
      }}>
        {question.options.map((option) => {
          const isSelected = answers[question.id] === option.value;

          return (
            <button
              key={option.id}
              onClick={async () => {
                console.log('📝 [QuizQuestion] SingleChoice: answering', {
                  questionId: question.id,
                  optionValue: option.value,
                  optionLabel: option.label
                });
                // ИСПРАВЛЕНО: Валидация question.id перед вызовом onAnswer
                if (!question.id || question.id <= 0) {
                  console.error('❌ [QuizQuestion] Invalid question.id:', {
                    questionId: question.id,
                    questionCode: question.code,
                    questionText: question.text?.substring(0, 50),
                  });
                  return;
                }
                await onAnswer(question.id, option.value);
                console.log('➡️ [QuizQuestion] SingleChoice: calling onNext after delay');
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
          <div style={{ marginTop: '24px', paddingBottom: '100px' }}>
            {renderSubmitOrContinueDisclaimer()}
            <FixedContinueButton
              variant="black"
              ctaText="Получить план"
              loadingText="Отправка..."
              disabled={isSubmitting}
              onClick={onSubmit}
            />
          </div>
        ) : hasAnswer(question.id) && isRetakingQuiz ? (
          <FixedContinueButton
            variant="black"
            ctaText="Продолжить"
            onClick={onNext}
          />
        ) : null}
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

    // Чтобы лайм доходил до низа экрана: отступ сверху (padding 48px + прогресс-бар ~74px) ≈ 122px
    const limeMinHeight = (isGoalsQuestion || isSkinTypeQuestion) ? 'calc(100vh - 122px)' : 'auto';

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
          minHeight: limeMinHeight,
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

            return (
              <LimeOptionCard
                key={option.id}
                option={option}
                index={index}
                isSelected={isSelected}
                isMultiChoice={isMultiChoice}
                isSkinTypeQuestion={isSkinTypeQuestion}
                imageUrl={getImageUrl(index)}
                onOptionClick={async () => {
                  devLog('📝 [QuizQuestion] LimeStyle: option clicked', {
                    questionId: question.id,
                    optionValue: option.value,
                    optionLabel: option.label?.substring(0, 50),
                    isMultiChoice,
                    wasSelected: isSelected,
                  });

                  if (isMultiChoice) {
                    const newAnswers = isSelected
                      ? currentAnswers.filter((v) => v !== option.value)
                      : [...currentAnswers, option.value];
                    devLog('📝 [QuizQuestion] LimeStyle: multi-choice answer update', {
                      oldAnswers: currentAnswers,
                      newAnswers,
                      action: isSelected ? 'removed' : 'added',
                    });
                    // ИСПРАВЛЕНО: Валидация уже выполнена в начале компонента
                    if (question.id > 0) {
                      await onAnswer(question.id, newAnswers);
                    }
                  } else {
                    devLog('📝 [QuizQuestion] LimeStyle: single-choice answer');
                    // ИСПРАВЛЕНО: Валидация question.id перед вызовом onAnswer
                    if (!question.id || question.id <= 0) {
                      console.error('❌ [QuizQuestion] Invalid question.id:', {
                        questionId: question.id,
                        questionCode: question.code,
                        questionText: question.text?.substring(0, 50),
                      });
                      return;
                    }
                    await onAnswer(question.id, option.value);
                    devLog('➡️ [QuizQuestion] LimeStyle: calling onNext after single choice');
                    setTimeout(() => onNext(), 300);
                  }
                }}
              />
            );
          })}

          {/* Кнопка продолжить/получить план только для multi_choice */}
          {question?.type === 'multi_choice' && hasAnswer(question.id) && (
            <FixedContinueButton
              variant="black"
              ctaText={showSubmitButton ? 'Получить план' : 'Продолжить'}
              loadingText="Отправка..."
              disabled={isSubmitting}
              onClick={() => {
                if (showSubmitButton) {
                  onSubmit();
                } else {
                  onNext();
                }
              }}
            />
          )}
        </div>
      </div>
    );
  };

  // LifestyleHabits компонент удалён вместе с вопросом lifestyle_habits.

  const MultiChoiceDefault = () => {
    if (question?.type !== 'multi_choice' || !question?.options || useLimeStyle) return null;

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
            <div style={{ marginTop: '24px', paddingBottom: '100px' }}>
              {renderSubmitOrContinueDisclaimer()}
              <FixedContinueButton
                variant="black"
                ctaText="Получить план"
                loadingText="Отправка..."
                disabled={isSubmitting}
                onClick={onSubmit}
              />
            </div>
          ) : (
            <FixedContinueButton
              variant="black"
              ctaText="Продолжить"
              onClick={onNext}
            />
          )
        ) : null}
      </div>
    );
  };

  return (
    <>
      {backButton}

      <div
        className="animate-fade-in"
        style={{
          maxWidth: useLimeStyle ? '100%' : '640px',
          margin: useLimeStyle ? '0' : '0 auto',
          padding: useLimeStyle ? '0' : '0 20px',
          paddingBottom: '100px',
          boxSizing: 'border-box',
        }}
      >
        {/* Прогресс-бар (вне лайм-контейнера) */}
        {!useLimeStyle && <ProgressBar />}

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
                marginTop: '0',
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

        {/* Лаймовый прогресс-бар — та же ширина, что и на остальных вопросах */}
        {useLimeStyle && <ProgressBar />}

        {/* Рендеры */}
        <LimeStyle />
        <SingleChoiceDefault />
        {question?.type === 'free_text' && (
          <FreeTextInput
            question={question}
            answers={answers}
            onAnswer={onAnswer}
            onNext={onNext}
          />
        )}
        <MultiChoiceDefault />
      </div>
    </>
  );
});
