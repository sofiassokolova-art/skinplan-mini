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
import { GOAL_IMAGE_URLS } from '../image-assets';

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

const isDevEnv = process.env.NODE_ENV === 'development';
const devLog = (...args: any[]) => {
  if (isDevEnv) {
    console.log(...args);
  }
};

// Маппинг вопросов на шаги анкеты (соответствует stepNumber/stepLabel в info-screens.ts).
// Лейбл «Шаг N: название» рендерится над прогресс-баром вместо отдельного экрана.
const QUESTION_STEP_MAP: Record<string, { number: number; total: number; label: string }> = {
  // Шаг 1: Общая информация
  skin_goals: { number: 1, total: 4, label: 'Общая информация' },
  age:        { number: 1, total: 4, label: 'Общая информация' },
  gender:     { number: 1, total: 4, label: 'Общая информация' },
  // Шаг 2: Особенности кожи
  skin_type:        { number: 2, total: 4, label: 'Особенности кожи' },
  skin_concerns:    { number: 2, total: 4, label: 'Особенности кожи' },
  skin_sensitivity: { number: 2, total: 4, label: 'Особенности кожи' },
  seasonal_changes: { number: 2, total: 4, label: 'Особенности кожи' },
  fitzpatrick_type: { number: 2, total: 4, label: 'Особенности кожи' },
  // Шаг 3: Данные о здоровье
  medical_diagnoses:        { number: 3, total: 4, label: 'Данные о здоровье' },
  pregnancy_breastfeeding:  { number: 3, total: 4, label: 'Данные о здоровье' },
  allergies:                { number: 3, total: 4, label: 'Данные о здоровье' },
  has_avoid_ingredients:    { number: 3, total: 4, label: 'Данные о здоровье' },
  avoid_ingredients:        { number: 3, total: 4, label: 'Данные о здоровье' },
  retinoid_usage:           { number: 3, total: 4, label: 'Данные о здоровье' },
  retinoid_reaction:        { number: 3, total: 4, label: 'Данные о здоровье' },
  prescription_topical:     { number: 3, total: 4, label: 'Данные о здоровье' },
  oral_medications:         { number: 3, total: 4, label: 'Данные о здоровье' },
  // Шаг 4: Ваши предпочтения
  makeup_frequency: { number: 4, total: 4, label: 'Ваши предпочтения' },
  care_type:        { number: 4, total: 4, label: 'Ваши предпочтения' },
  care_steps:       { number: 4, total: 4, label: 'Ваши предпочтения' },
  budget:           { number: 4, total: 4, label: 'Ваши предпочтения' },
};

// Вынесен на уровень модуля, чтобы не пересоздаваться при ре-рендере — иначе картинки на экране «Тип кожи» мигают
const LimeOptionCard = memo(function LimeOptionCard({
  option,
  index,
  isSelected,
  isMultiChoice: _isMultiChoice,
  isSkinTypeQuestion,
  isGoalsQuestion,
  imageUrl,
  onOptionClick
}: {
  option: any;
  index: number;
  isSelected: boolean;
  isMultiChoice: boolean;
  isSkinTypeQuestion: boolean;
  isGoalsQuestion?: boolean;
  imageUrl: string;
  onOptionClick: (option: any, index: number) => void | Promise<void>;
}) {
  const optionText = option.label || '';
  const optionParts = optionText.split('\n');
  let optionTitle = optionParts[0] || '';
  // Для типа кожи убираем префикс "Тип N —" или "Тип N -"
  if (isSkinTypeQuestion && optionTitle) {
    const stripped = optionTitle.replace(/^Тип\s*\d+\s*[—\-]\s*/i, '').trim();
    optionTitle = stripped || optionTitle;
  }
  const optionDescription = optionParts.slice(1).join('\n') || '';

  const isSkinType = isSkinTypeQuestion;
  const whitePadding = isSkinType ? 12 : 16;
  const descFontSize = isSkinType ? 13 : 12;
  const whitePaddingTop = isSkinType ? 8 : 16;

  // Для типа кожи — запрашиваем 2x для чёткости на retina, качество 90
  const imgW = isSkinType ? 1200 : 600;
  const imgH = isSkinType ? 280 : 140;

  const handleClick = useCallback(() => {
    onOptionClick(option, index);
  }, [onOptionClick, option, index]);

  return (
    <button
      onClick={handleClick}
      style={{
        padding: '0',
        borderRadius: '16px',
        border: isSelected ? '2px solid var(--canvas-white)' : 'none',
        backgroundColor: isSelected ? 'var(--accent)' : 'var(--canvas-white)',
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
          backgroundColor: '#e8e8e8',
          overflow: 'hidden',
          position: 'relative',
          ...(isSkinType ? { transform: 'translateZ(0)', backfaceVisibility: 'hidden' as const } : {}),
        }}
      >
        <Image
          key={imageUrl}
          src={imageUrl}
          alt={option.label}
          width={imgW}
          height={imgH}
          quality={isSkinType ? 90 : 75}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            display: 'block',
          }}
          sizes={isSkinType ? '(max-width: 768px) 100vw, 640px' : '(max-width: 768px) 100vw, 420px'}
          priority={isSkinType}
          loading={isGoalsQuestion ? 'eager' : undefined}
          fetchPriority={isGoalsQuestion && index < 2 ? 'high' : undefined}
        />
      </div>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          flex: 1,
          padding: `${whitePaddingTop}px ${whitePadding}px ${whitePadding}px`,
          backgroundColor: isSelected ? 'var(--accent)' : 'var(--canvas-white)',
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
              fontSize: isGoalsQuestion ? '14px' : '16px',
              fontWeight: isGoalsQuestion ? 400 : 600,
              color: 'var(--ink)',
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
                backgroundColor: isSelected ? 'var(--ink)' : 'var(--accent)',
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
                    stroke="var(--canvas-white)"
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
              fontSize: `${descFontSize}px`,
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
    border: '1px solid var(--ink)',
    backgroundColor: 'var(--canvas-white)',
    fontSize: '16px',
    color: 'var(--ink)',
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
            devLog('➡️ [QuizQuestion] FreeText: "Продолжить" clicked', {
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

  // Вопрос о целях (skin_goals)
  const isGoalsQuestion = question?.code === 'skin_goals';
  // Экран «Тип кожи» (skin_type)
  const isSkinTypeQuestion = question?.code === 'skin_type';
  // lifestyle_habits удалён из анкеты — спец-стиль больше не нужен.

  const [skinTypeContentRevealed, setSkinTypeContentRevealed] = useState(false);
  useEffect(() => {
    if (isSkinTypeQuestion) {
      const t = setTimeout(() => setSkinTypeContentRevealed(true), 80);
      return () => clearTimeout(t);
    } else {
      setSkinTypeContentRevealed(false);
    }
  }, [isSkinTypeQuestion]);

  // Специальный карточный layout (LimeStyle) оставляем только для «Тип кожи».
  // Для «На чём вы хотите сфокусироваться?» используем обычный белый фон + карточки без лайм-блока.
  const useLimeStyle = isSkinTypeQuestion;

  // Refs для стабильного колбэка LimeOptionCard — убирает мигание картинок на экране «Тип кожи»
  const questionRef = useRef(question);
  const answersRef = useRef(answers);
  const onAnswerRef = useRef(onAnswer);
  const onNextRef = useRef(onNext);
  questionRef.current = question;
  answersRef.current = answers;
  onAnswerRef.current = onAnswer;
  onNextRef.current = onNext;

  const handleLimeOptionClick = useCallback(async (option: any, _index: number) => {
    const q = questionRef.current;
    const ans = answersRef.current;
    const onA = onAnswerRef.current;
    const onN = onNextRef.current;
    if (!q?.options) return;
    const isMultiChoice = q.type === 'multi_choice';
    const currentAnswers = isMultiChoice
      ? ((ans[q.id] as string[]) || [])
      : ans[q.id] ? [ans[q.id] as string] : [];
    const isSelected = currentAnswers.includes(option.value);
    devLog('📝 [QuizQuestion] LimeStyle: option clicked', {
      questionId: q.id,
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
      if (q.id > 0) await onA(q.id, newAnswers);
    } else {
      if (!q.id || q.id <= 0) {
        console.error('❌ [QuizQuestion] Invalid question.id:', {
          questionId: q.id,
          questionCode: q.code,
          questionText: q.text?.substring(0, 50),
        });
        return;
      }
      await onA(q.id, option.value);
      devLog('➡️ [QuizQuestion] LimeStyle: calling onNext after single choice');
      setTimeout(() => onN(), 300);
    }
  }, []);

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
      // ИСПРАВЛЕНО: поддерживаем случай, когда скобки стоят перед вопросительным знаком
      // Например: "…ретиноиды (например, третиноин, адапален и др.)?"
      const bracketMatch = title.match(/^(.+?)\s*\((.+?)\)\s*\??$/);
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
  // Вопрос про имя: единый заголовок независимо от текста в БД
  let title = rawTitle || (question?.code?.toLowerCase() === 'user_name' ? 'Как мы можем к вам обращаться?' : '');
  if (question?.code?.toLowerCase() === 'user_name') title = 'Как мы можем к вам обращаться?';
  const isSkinSensitivityQuestion = question?.code === 'skin_sensitivity';
  if (isSkinSensitivityQuestion) title = 'Насколько ваша кожа склонна к раздражению?';
  // Вопрос о целях (skin_goals) — единая формулировка
  if (question?.code === 'skin_goals') title = 'На чём вы хотите сфокусироваться?';
  // Вопрос о типе кожи — единая формулировка
  if (question?.code === 'skin_type') title = 'Выберите ваш тип кожи';
  // Вопрос о беспокойствах в коже — единая формулировка
  const isSkinConcernsQuestion = question?.code === 'skin_concerns';
  if (isSkinConcernsQuestion) title = 'Что вас больше всего беспокоит в коже сейчас?';
  if (question?.code === 'allergies') title = 'Отмечались ли у вас аллергические реакции?';
  if (question?.code === 'avoid_ingredients') {
    title = (title || '').replace(/ингридиенты/gi, 'ингредиенты');
  }

  const subtitleForRender =
    isSkinConcernsQuestion && subtitle?.toLowerCase().includes('можно выбрать несколько')
      ? 'Можно выбрать несколько'
      : subtitle;

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

  // Отступ сверху: прогресс-бар ниже кнопки «Назад» (зона кнопки ~80px)
  const PROGRESS_BAR_TOP_OFFSET = '52px';

  // Целевой процент прогресса для текущего экрана
  const targetProgressPercent =
    allQuestionsLength > 0 ? ((currentQuestionIndex + 1) / allQuestionsLength) * 100 : 0;

  // Локальный процент для плавной анимации заполнения на каждом экране
  const [displayProgressPercent, setDisplayProgressPercent] = useState(0);
  useEffect(() => {
    setDisplayProgressPercent(targetProgressPercent);
  }, [targetProgressPercent]);

  // Лейбл шага для текущего вопроса (если есть в маппинге)
  const currentStep = question?.code ? QUESTION_STEP_MAP[question.code] : undefined;

  // Прогресс-бар в ширину контента (те же отступы 20px, что и у заголовка/вариантов)
  const ProgressBar = () => {
    if (hideProgressBar) return null;

    return (
      <div
        style={{
          marginBottom: '12px',
          marginTop: PROGRESS_BAR_TOP_OFFSET,
          width: '100%',
          maxWidth: useLimeStyle ? '640px' : undefined,
          marginLeft: useLimeStyle ? 'auto' : 0,
          marginRight: useLimeStyle ? 'auto' : 0,
          paddingLeft: useLimeStyle ? '20px' : 0,
          paddingRight: useLimeStyle ? '20px' : 0,
          boxSizing: 'border-box',
        }}
      >
        {/* Лейбл шага над прогресс-баром */}
        {currentStep && (
          <p
            style={{
              margin: '0 0 6px 0',
              fontFamily: "var(--font-inter), 'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
              fontSize: '12px',
              fontWeight: 500,
              color: '#888888',
              letterSpacing: '0.02em',
            }}
          >
            Шаг {currentStep.number}: {currentStep.label}
          </p>
        )}
        <div
          style={{
            width: '100%',
            height: '6px',
            backgroundColor: 'var(--ink)',
            borderRadius: '3px',
            overflow: 'hidden',
            position: 'relative',
            padding: '1px',
            boxSizing: 'border-box',
          }}
        >
          <div
            style={{
              width: `${displayProgressPercent}%`,
              height: '100%',
              backgroundColor: 'var(--accent)',
              borderRadius: '2px',
              transition: 'width 1s cubic-bezier(0.22, 1, 0.36, 1)',
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
        <Link href="/terms" style={{ color: 'var(--ink)', textDecoration: 'underline' }}>
          пользовательским соглашением
        </Link>
      </p>
    ) : null;
  };

  const SingleChoiceDefault = () => {
    if (question?.type !== 'single_choice' || !question?.options || isSkinTypeQuestion) return null;

    const sensitivityCircleColors = ['#F7FFD1', '#E9FF9C', 'var(--accent)', '#C1F24A'];

    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        maxWidth: '600px',
        margin: '0 auto',
        width: '100%'
      }}>
        {question.options.map((option, index) => {
          const isSelected = answers[question.id] === option.value;

          return (
            <button
              key={option.id}
              onClick={async () => {
                devLog('📝 [QuizQuestion] SingleChoice: answering', {
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
                devLog('➡️ [QuizQuestion] SingleChoice: calling onNext after delay');
                setTimeout(() => onNext(), 300);
              }}
              style={{
                padding: '16px',
                borderRadius: '16px',
                border: '1px solid var(--ink)',
                backgroundColor: isSelected ? '#F2F2F2' : 'var(--canvas-white)',
                cursor: 'pointer',
                textAlign: 'left',
                fontSize: '16px',
                color: 'var(--ink)',
                transition: 'all 0.2s',
                fontFamily:
                  "var(--font-inter), 'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
              }}
            >
              {isSkinSensitivityQuestion ? (
                <>
                  <div
                    style={{
                      width: '14px',
                      height: '14px',
                      borderRadius: '999px',
                      backgroundColor: sensitivityCircleColors[index] ?? 'var(--accent)',
                      flexShrink: 0,
                    }}
                  />
                  <span>{option.label}</span>
                </>
              ) : (
                option.label
              )}
            </button>
          );
        })}

        {/* Навигация */}
        {showSubmitButton && hasAnswer(question.id) ? (
          <div style={{ marginTop: '24px', paddingBottom: isSkinSensitivityQuestion ? '52px' : '100px' }}>
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
      let imageUrl = '/tone6.webp';

      if (isGoalsQuestion) {
        imageUrl = GOAL_IMAGE_URLS[index] || '/tone6.webp';
      } else if (isSkinTypeQuestion) {
        // Порядок строго соответствует options в seed-questionnaire-v2:
        // 0: Тип 1 — Сухая
        // 1: Тип 2 — Комбинированная (сухая)
        // 2: Тип 3 - Нормальная
        // 3: Тип 3 — Комбинированная (жирная)
        // 4: Тип 4 — Жирная
        const skinTypeImages: Record<number, string> = {
          0: '/dry.webp',
          1: '/dry (combi).webp',
          2: '/normal.webp',
          3: '/oily (combi).webp',
          4: '/oily.webp',
        };
        imageUrl = skinTypeImages[index] || '/normal.webp';
      }

      return imageUrl;
    };

    const content = (
      <>
        <div
          style={{
            maxWidth: '640px',
            margin: '0 auto',
            paddingLeft: '20px',
            paddingRight: '20px',
            boxSizing: 'border-box',
          }}
        >
          {/* Заголовок */}
          <h2
            style={{
              fontFamily:
                "var(--font-unbounded), 'Unbounded', -apple-system, BlinkMacSystemFont, sans-serif",
              fontSize: '20px',
              fontWeight: isSkinTypeQuestion ? 500 : 700,
              color: 'var(--ink)',
              marginBottom: subtitle ? '4px' : '20px',
              marginTop: '0',
            }}
          >
            {renderTitle(title)}
          </h2>

          {/* Подзаголовок */}
          {subtitleForRender && (
            <div
              style={{
                fontFamily:
                  "var(--font-inter), 'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
                fontSize: isSkinTypeQuestion ? '13px' : '14px',
                fontWeight: 400,
                color: '#9D9D9D',
                marginBottom: '20px',
                marginTop: '0',
                lineHeight: '1.5',
                whiteSpace: 'pre-line',
              }}
            >
              {subtitleForRender}
            </div>
          )}
        </div>

        <div
          style={{
            maxWidth: '640px',
            margin: '0 auto',
            paddingLeft: '20px',
            paddingRight: '20px',
            boxSizing: 'border-box',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
          }}
        >
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
                isGoalsQuestion={isGoalsQuestion}
                imageUrl={getImageUrl(index)}
                onOptionClick={handleLimeOptionClick}
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
      </>
    );

    if (isSkinTypeQuestion) {
      return (
        <div
          style={{
            opacity: skinTypeContentRevealed ? 1 : 0,
            transform: skinTypeContentRevealed ? 'translateY(0)' : 'translateY(14px)',
            transition: 'opacity 0.5s cubic-bezier(0.22, 1, 0.36, 1), transform 0.5s cubic-bezier(0.22, 1, 0.36, 1)',
          }}
        >
          {content}
        </div>
      );
    }
    return content;
  };

  // LifestyleHabits компонент удалён вместе с вопросом lifestyle_habits.

  const MultiChoiceDefault = () => {
    if (question?.type !== 'multi_choice' || !question?.options || useLimeStyle) return null;

    const sensitivityCircleColors = ['#F7FFD1', '#E9FF9C', 'var(--accent)', '#C1F24A'];
    const isSkinSensitivityForMulti = question?.code === 'skin_sensitivity';
    const isGoalsQuestionForMulti = question?.code === 'skin_goals';

    const fixIngredientTypo = (s: string) => (s || '').replace(/ингридиенты/gi, 'ингредиенты');
    const renderOptionLabel = (raw: string | undefined) => {
      const label = (raw || '').toString();
      const code = (question?.code || '').toLowerCase();

      if (code === 'avoid_ingredients') {
        return fixIngredientTypo(label);
      }

      // Для вопросов про рецептурные кремы/гели и пероральные препараты — текст в скобках делаем чуть меньше и серым
      const isPrescriptionTopical = code === 'prescription_topical';
      const isOralMeds = code === 'oral_medications' || code === 'oral_medication';

      if (isPrescriptionTopical || isOralMeds) {
        // Специальный кейс: «Нет, не принимал(а)» — показываем одной строкой, без разделения
        if (isOralMeds && /^нет,\s*не\s*принимал/iu.test(label)) {
          return label;
        }

        const match = label.match(/^(.*?)(\s*\(.+\))$/);
        if (!match) return label;
        const mainText = match[1].trim();
        const parenText = match[2];

        return (
          <span
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-start',
            }}
          >
            <span>{mainText}</span>
            <span
              style={{
                marginTop: '4px',
                fontSize: isSkinConcernsQuestion ? '13px' : '14px',
                color: '#6B7280',
              }}
            >
              {parenText}
            </span>
          </span>
        );
      }

      return label;
    };
    const optionsForDisplay =
      question?.code === 'avoid_ingredients'
        ? [...question.options].sort((a, b) => {
            const labelA = (a?.label ?? a).toString().toLowerCase();
            const labelB = (b?.label ?? b).toString().toLowerCase();
            const noSuchPhrase = 'такие ингредиенты отсутствуют';
            const noSuchTypo = 'такие ингридиенты отсутствуют';
            const isNoSuchA = labelA.includes(noSuchPhrase) || labelA.includes(noSuchTypo);
            const isNoSuchB = labelB.includes(noSuchPhrase) || labelB.includes(noSuchTypo);
            if (isNoSuchA && !isNoSuchB) return -1;
            if (!isNoSuchA && isNoSuchB) return 1;
            return 0;
          })
        : question.options;

    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: isSkinConcernsQuestion ? '10px' : '12px',
          maxWidth: '640px',
          margin: '0 auto',
        }}
      >
        {/* Для skin_goals рендерим варианты отдельно (как карточки с картинками), здесь только навигация */}
        {!isGoalsQuestionForMulti &&
          optionsForDisplay.map((option, index) => {
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
                  padding: isSkinConcernsQuestion ? '14px' : '16px',
                  borderRadius: '16px',
                  border: '1px solid var(--ink)',
                  backgroundColor: isSelected ? '#F2F2F2' : 'var(--canvas-white)',
                  cursor: 'pointer',
                  textAlign: 'left',
                  fontSize: isSkinConcernsQuestion ? '15px' : '16px',
                  color: 'var(--ink)',
                  transition: 'all 0.2s',
                  fontFamily: "var(--font-inter), 'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                }}
              >
                {isSkinSensitivityForMulti ? (
                  <>
                    <div
                      style={{
                        width: '14px',
                        height: '14px',
                        borderRadius: '999px',
                        backgroundColor: sensitivityCircleColors[index] ?? 'var(--accent)',
                        flexShrink: 0,
                      }}
                    />
                    <span>{renderOptionLabel(String(option.label ?? ''))}</span>
                  </>
                ) : (
                  renderOptionLabel(String(option.label ?? ''))
                )}
              </button>
            );
          })}

        {hasAnswer(question.id) ? (
          showSubmitButton ? (
            <div style={{ marginTop: '24px', paddingBottom: isSkinSensitivityQuestion ? '52px' : isSkinConcernsQuestion ? '76px' : '100px' }}>
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
          paddingLeft: useLimeStyle ? undefined : '20px',
          paddingRight: useLimeStyle ? undefined : '20px',
          paddingTop: isNameQuestion ? '52px' : undefined,
          paddingBottom: isNameQuestion
            ? '80px'
            : isSkinSensitivityQuestion
            ? '52px'
            : isSkinTypeQuestion
            ? '40px'
            : isGoalsQuestion
            ? '60px'
            : isSkinConcernsQuestion
            ? '76px'
            : '100px',
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
                fontSize: '20px',
                fontWeight: 700,
                color: 'var(--ink)',
                marginBottom: subtitle ? '4px' : '24px',
                marginTop: '0',
              }}
            >
              {renderTitle(title)}
            </h2>

            {subtitleForRender && (
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
              {subtitleForRender}
              </div>
            )}
          </>
        )}

        {/* Лаймовый прогресс-бар — та же ширина, что и на остальных вопросах */}
        {useLimeStyle && <ProgressBar />}

        {/* Рендеры */}
        {isSkinTypeQuestion && <LimeStyle />}

        {/* Экран «На чём вы хотите сфокусироваться?» — карточки с картинками без лаймового контейнера */}
        {isGoalsQuestion && !useLimeStyle && (
          <div
            style={{
              marginBottom: '24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}
          >
            {question.options?.map((option, index) => {
              const currentAnswers = ((answers[question.id] as string[]) || []);
              const isSelected = currentAnswers.includes(option.value);

              const imageUrl = GOAL_IMAGE_URLS[index] || '/tone6.webp';

              return (
                <LimeOptionCard
                  key={option.id}
                  option={option}
                  index={index}
                  isSelected={isSelected}
                  isMultiChoice={true}
                  isSkinTypeQuestion={false}
                  isGoalsQuestion={true}
                  imageUrl={imageUrl}
                  onOptionClick={async () => {
                    const newAnswers = isSelected
                      ? currentAnswers.filter((v) => v !== option.value)
                      : [...currentAnswers, option.value];
                    await onAnswer(question.id, newAnswers);
                  }}
                />
              );
            })}
          </div>
        )}

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
