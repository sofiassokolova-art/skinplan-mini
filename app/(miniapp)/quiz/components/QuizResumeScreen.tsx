// app/(miniapp)/quiz/components/QuizResumeScreen.tsx
// Компонент экрана продолжения анкеты

'use client';

import { useState, useRef, useMemo, useEffect } from 'react';
import { clientLogger } from '@/lib/client-logger';
import { filterQuestions } from '@/lib/quiz/filterQuestions';
import type { Questionnaire, SavedProgress } from '@/lib/quiz/types';

interface QuizResumeScreenProps {
  savedProgress: SavedProgress;
  questionnaire: Questionnaire | null;
  answers: Record<number, string | string[]>;
  isRetakingQuiz: boolean;
  showRetakeScreen: boolean;
  onResume: () => void;
  onStartOver: () => Promise<void>;
  isBusy?: boolean; // ИСПРАВЛЕНО: Блокирует кнопки во время загрузки/инициализации
}

export function QuizResumeScreen({
  savedProgress,
  questionnaire,
  answers,
  isRetakingQuiz,
  showRetakeScreen,
  onResume,
  onStartOver,
  isBusy = false,
}: QuizResumeScreenProps) {
  // Все хуки должны вызываться безусловно — до любых ранних return (Rules of Hooks)
  const [clickedButton, setClickedButton] = useState<'resume' | 'startOver' | null>(null);
  const resumeInProgressRef = useRef(false);
  
  const handleResume = () => {
    // Защита от двойного клика
    if (resumeInProgressRef.current || isBusy || clickedButton) {
      return;
    }
    
    resumeInProgressRef.current = true;
    setClickedButton('resume');
    
    try {
      onResume();
    } catch (error) {
      clientLogger.error('❌ Ошибка при возобновлении анкеты:', error);
      // Сбрасываем флаг при ошибке
      resumeInProgressRef.current = false;
      setClickedButton(null);
    }
  };
  
  const handleStartOver = async () => {
    // Защита от двойного клика
    if (resumeInProgressRef.current || isBusy || clickedButton) {
      return;
    }
    
    resumeInProgressRef.current = true;
    setClickedButton('startOver');
    
    try {
      await onStartOver();
    } catch (error) {
      clientLogger.error('❌ Ошибка при начале заново:', error);
      // Сбрасываем флаг при ошибке
      resumeInProgressRef.current = false;
      setClickedButton(null);
    }
  };
  
  const isDisabled = isBusy || !!clickedButton;
  
  // ИСПРАВЛЕНО: Используем useState для предотвращения гидратационных ошибок
  // На сервере всегда null, на клиенте вычисляется после монтирования
  const [displayQuestionNumber, setDisplayQuestionNumber] = useState<number | null>(null);
  const [isMounted, setIsMounted] = useState(false);
  
  // ИСПРАВЛЕНО: Вычисляем номер вопроса только на клиенте после монтирования
  useEffect(() => {
    setIsMounted(true);
  }, []);
  
  // Вычисляем номер вопроса в нумерации ОТФИЛЬТРОВАННОГО списка (то, что видит пользователь).
  // savedProgress.questionIndex намеренно НЕ используем: сервер считает его по полному списку,
  // а здесь нумерация после filterQuestions — индексы не совпадают и старая логика всегда
  // возвращала последний вопрос.
  const computedQuestionNumber = useMemo(() => {
    try {
      if (!questionnaire || !savedProgress) return null;

      const allQuestionsRaw = [
        ...(questionnaire.groups || []).flatMap((g) => g?.questions || []),
        ...(questionnaire.questions || []),
      ];
      if (allQuestionsRaw.length === 0) return null;

      let allQuestions: any[] = [];
      try {
        allQuestions = filterQuestions({
          questions: allQuestionsRaw,
          answers: answers || {},
          savedProgressAnswers: savedProgress?.answers || {},
          isRetakingQuiz,
          showRetakeScreen,
          logger: clientLogger,
        });
      } catch (filterError) {
        clientLogger.error('❌ Ошибка при фильтрации вопросов в QuizResumeScreen:', filterError);
        return null;
      }

      if (allQuestions.length === 0) return null;

      const visibleIds = new Set(
        allQuestions
          .map((q) => q?.id)
          .filter((id): id is number => typeof id === 'number')
      );

      const visibleAnsweredIds = new Set(
        Object.keys(savedProgress?.answers || {})
          .map((id) => Number(id))
          .filter((id) => !Number.isNaN(id) && visibleIds.has(id))
      );

      const firstUnansweredIndex = allQuestions.findIndex(
        (q) => q && typeof q.id === 'number' && !visibleAnsweredIds.has(q.id)
      );

      if (firstUnansweredIndex >= 0) {
        return firstUnansweredIndex + 1;
      }

      // Все видимые вопросы отвечены — показываем последний
      return allQuestions.length;
    } catch (error) {
      clientLogger.error('❌ Ошибка при вычислении номера вопроса в QuizResumeScreen:', error);
      return null;
    }
  }, [questionnaire, savedProgress, answers, isRetakingQuiz, showRetakeScreen]);
  
  // ИСПРАВЛЕНО: Обновляем displayQuestionNumber только на клиенте после монтирования
  // ИСПРАВЛЕНО: Добавлена обработка ошибок при обновлении состояния
  useEffect(() => {
    if (isMounted) {
      try {
        setDisplayQuestionNumber(computedQuestionNumber);
      } catch (error) {
        clientLogger.error('❌ Ошибка при обновлении displayQuestionNumber:', error);
        setDisplayQuestionNumber(null);
      }
    }
  }, [isMounted, computedQuestionNumber]);

  // Ранний return ПОСЛЕ всех хуков — иначе нарушаются Rules of Hooks
  if (!savedProgress) {
    clientLogger.warn('⚠️ QuizResumeScreen: savedProgress is missing');
    return (
      <div style={{ 
        padding: '20px',
        minHeight: '100vh',
        background: '#FFFFFF',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <p style={{ color: '#000000', textAlign: 'center' }}>Загрузка...</p>
      </div>
    );
  }

  // ИСПРАВЛЕНО: Рендерим одинаковый контент на сервере и клиенте для избежания гидратационных ошибок
  // Используем suppressHydrationWarning только для динамических частей (номер вопроса)
  // ИСПРАВЛЕНО: Безопасное вычисление текста кнопки
  const buttonText = (() => {
    try {
      if (displayQuestionNumber === null) {
        return 'Загрузка...';
      }
      // ИСПРАВЛЕНО: Проверяем, что displayQuestionNumber - валидное число
      const questionNum = typeof displayQuestionNumber === 'number' && !isNaN(displayQuestionNumber) 
        ? displayQuestionNumber 
        : null;
      return questionNum !== null ? `Продолжить с вопроса ${questionNum}` : 'Загрузка...';
    } catch (error) {
      clientLogger.error('❌ Ошибка при вычислении текста кнопки:', error);
      return 'Загрузка...';
    }
  })();
  
  return (
    <div style={{ 
      padding: '20px',
      minHeight: '100vh',
      background: '#FFFFFF',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      <div 
        className="animate-fade-in"
        style={{
          width: '100%',
          maxWidth: '360px',
          padding: '0 20px',
        }}
      >
        {/* Заголовок */}
        <h1 style={{
          fontFamily: "var(--font-unbounded), 'Unbounded', -apple-system, BlinkMacSystemFont, sans-serif",
          fontWeight: 700,
          fontSize: '28px',
          lineHeight: '120%',
          color: '#000000',
          margin: '0 0 16px 0',
          textAlign: 'center',
        }}>
          Вы не завершили анкету
        </h1>

        {/* Подзаголовок */}
        <p style={{
          fontFamily: "var(--font-inter), 'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
          fontWeight: 400,
          fontSize: '16px',
          lineHeight: '140%',
          color: '#000000',
          margin: '0 0 40px 0',
          textAlign: 'center',
        }}>
          Мы сохранили ваш прогресс — продолжите с того же места или начните заново
        </p>

        {/* Кнопки */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
        }}>
          {/* Кнопка "Продолжить с вопроса N" */}
          <button
            onClick={handleResume}
            disabled={isDisabled || displayQuestionNumber === null}
            style={{
              width: '100%',
              height: 52,
              background: isDisabled || displayQuestionNumber === null ? '#E0E0E0' : '#D5FE61',
              color: isDisabled || displayQuestionNumber === null ? '#9D9D9D' : '#000000',
              border: 'none',
              borderRadius: 0,
              fontFamily: "var(--font-inter), 'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
              fontWeight: 400,
              fontSize: 'clamp(14px, 4vw, 16px)',
              textTransform: 'uppercase',
              cursor: isDisabled || displayQuestionNumber === null ? 'not-allowed' : 'pointer',
              boxShadow: 'none',
              opacity: isDisabled || displayQuestionNumber === null ? 0.6 : 1,
              transition: 'transform 0.2s',
            }}
            suppressHydrationWarning
          >
            {buttonText}
          </button>

          {/* Кнопка "Начать анкету заново" */}
          <button
            onClick={handleStartOver}
            disabled={isDisabled}
            style={{
              width: '100%',
              height: 52,
              background: '#FFFFFF',
              color: isDisabled ? '#9D9D9D' : '#000000',
              border: '1px solid #000000',
              borderRadius: 0,
              fontFamily: "var(--font-inter), 'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
              fontWeight: 400,
              fontSize: 'clamp(14px, 4vw, 16px)',
              textTransform: 'uppercase',
              cursor: isDisabled ? 'not-allowed' : 'pointer',
              opacity: isDisabled ? 0.6 : 1,
              transition: 'transform 0.2s',
            }}
          >
            Начать анкету заново
          </button>
        </div>
      </div>
    </div>
  );
}
