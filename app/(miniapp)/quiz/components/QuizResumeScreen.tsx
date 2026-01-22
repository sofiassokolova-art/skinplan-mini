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
  // ИСПРАВЛЕНО: Ранняя проверка на наличие savedProgress для предотвращения ошибок
  // ВАЖНО: Проверка должна быть ДО всех хуков, чтобы не нарушать правила хуков
  if (!savedProgress) {
    clientLogger.warn('⚠️ QuizResumeScreen: savedProgress is missing');
    // Возвращаем fallback UI вместо null для предотвращения ошибок рендеринга
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
  
  // ИСПРАВЛЕНО: Защита от двойного клика на мобильных устройствах
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
  
  // ИСПРАВЛЕНО: Мемоизируем вычисление номера вопроса, чтобы он не пересчитывался при каждом рендере
  // ИСПРАВЛЕНО: Не вычисляем номер вопроса, пока данные не готовы, чтобы избежать показа "вопрос 1"
  // ИСПРАВЛЕНО: Добавлена обработка ошибок для предотвращения краша компонента
  const computedQuestionNumber = useMemo(() => {
    try {
      // Если questionnaire еще не загружен, возвращаем null (будет показан placeholder)
      if (!questionnaire) {
        return null;
      }
      
      // ИСПРАВЛЕНО: Проверяем наличие savedProgress перед использованием
      if (!savedProgress) {
        return null;
      }
      
      // Получаем все вопросы с фильтрацией
      const allQuestionsRaw = [
        ...(questionnaire.groups || []).flatMap((g) => g?.questions || []),
        ...(questionnaire.questions || []),
      ];
      
      // Если нет вопросов, возвращаем null
      if (allQuestionsRaw.length === 0) {
        return null;
      }
      
      // Используем единую функцию filterQuestions
      // ИСПРАВЛЕНО: Добавлена дополнительная обработка ошибок при вызове filterQuestions
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
        // В случае ошибки фильтрации возвращаем null
        return null;
      }

      // Если после фильтрации нет вопросов, возвращаем null
      if (allQuestions.length === 0) {
        return null;
      }

      // ИСПРАВЛЕНО: Логика должна совпадать с resumeQuiz
      // Вычисляем номер следующего неотвеченного вопроса
      const answeredQuestionIds = Object.keys(savedProgress?.answers || {}).map(id => {
        const numId = Number(id);
        return isNaN(numId) ? null : numId;
      }).filter((id): id is number => id !== null);
      
      const savedQuestionIndex = (savedProgress?.questionIndex !== undefined && savedProgress.questionIndex !== null) 
        ? savedProgress.questionIndex 
        : 0;
      
      const lastQuestionIndex = allQuestions.length - 1;
      const answeredCount = answeredQuestionIds.length;
      const totalQuestions = allQuestions.length;
      
      // ИСПРАВЛЕНО: Если пользователь ответил на большинство вопросов (все или все кроме одного),
      // ВСЕГДА показываем последний вопрос, независимо от savedQuestionIndex
      // Это соответствует тому, что резюм-экран показывает "Продолжить с вопроса 22" (последний)
      const hasAnsweredMostQuestions = answeredCount >= totalQuestions - 1; // Ответили на все или все кроме одного
      
      if (hasAnsweredMostQuestions) {
        // Всегда показываем последний вопрос, если пользователь ответил на большинство вопросов
        return lastQuestionIndex + 1; // Номер последнего вопроса (индекс + 1)
      } else if (savedQuestionIndex >= lastQuestionIndex - 1) {
        // Пользователь был на последнем или предпоследнем вопросе - показываем последний
        return lastQuestionIndex + 1;
      } else {
        // Пользователь не был на последнем вопросе - ищем следующий неотвеченный вопрос
        const nextUnansweredQuestion = allQuestions.find((q, index) => {
          if (!q || !q.id) return false;
          return !answeredQuestionIds.includes(q.id) && index >= savedQuestionIndex;
        });
        
        if (nextUnansweredQuestion && nextUnansweredQuestion.id) {
          const nextIndex = allQuestions.findIndex(q => q?.id === nextUnansweredQuestion.id);
          if (nextIndex !== -1 && nextIndex >= 0) {
            return nextIndex + 1;
          }
        }
        
        // Если все вопросы после сохраненного индекса отвечены, проверяем, все ли вопросы отвечены
        const allQuestionsAnswered = allQuestions.every(q => q && q.id && answeredQuestionIds.includes(q.id));
        
        if (allQuestionsAnswered) {
          // Все вопросы отвечены - показываем последний вопрос
          return lastQuestionIndex + 1;
        } else {
          // Есть неотвеченные вопросы раньше - ищем первый неотвеченный с начала
          const firstUnansweredQuestion = allQuestions.find((q) => {
            return q && q.id && !answeredQuestionIds.includes(q.id);
          });
          
          if (firstUnansweredQuestion && firstUnansweredQuestion.id) {
            const firstIndex = allQuestions.findIndex(q => q?.id === firstUnansweredQuestion.id);
            if (firstIndex !== -1 && firstIndex >= 0) {
              return firstIndex + 1;
            }
          }
          
          // Если все вопросы отвечены, показываем последний
          return lastQuestionIndex + 1;
        }
      }
      
      return null;
    } catch (error) {
      // ИСПРАВЛЕНО: Обрабатываем ошибки при вычислении номера вопроса
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
              height: '56px',
              background: isDisabled || displayQuestionNumber === null ? '#E0E0E0' : '#D5FE61',
              color: isDisabled || displayQuestionNumber === null ? '#9D9D9D' : '#000000',
              border: 'none',
              borderRadius: '20px',
              fontFamily: "var(--font-inter), 'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
              fontWeight: 600,
              fontSize: '16px',
              cursor: isDisabled || displayQuestionNumber === null ? 'not-allowed' : 'pointer',
              boxShadow: isDisabled || displayQuestionNumber === null ? 'none' : '0 4px 12px rgba(0, 0, 0, 0.1)',
              opacity: isDisabled || displayQuestionNumber === null ? 0.6 : 1,
              transition: 'all 0.2s',
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
              height: '56px',
              background: 'transparent',
              color: isDisabled ? '#9D9D9D' : '#000000',
              border: `2px solid ${isDisabled ? '#9D9D9D' : '#000000'}`,
              borderRadius: '20px',
              fontFamily: "var(--font-inter), 'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
              fontWeight: 600,
              fontSize: '16px',
              cursor: isDisabled ? 'not-allowed' : 'pointer',
              opacity: isDisabled ? 0.6 : 1,
              transition: 'all 0.2s',
            }}
          >
            Начать анкету заново
          </button>
        </div>
      </div>
    </div>
  );
}
