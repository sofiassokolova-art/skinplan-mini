// app/(miniapp)/quiz/components/QuizResumeScreen.tsx
// Компонент экрана продолжения анкеты

'use client';

import { clientLogger } from '@/lib/client-logger';
import { QUIZ_CONFIG } from '@/lib/quiz/config/quizConfig';
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
}

export function QuizResumeScreen({
  savedProgress,
  questionnaire,
  answers,
  isRetakingQuiz,
  showRetakeScreen,
  onResume,
  onStartOver,
}: QuizResumeScreenProps) {
  // Получаем все вопросы с фильтрацией
  const allQuestionsRaw = questionnaire ? [
    ...(questionnaire.groups || []).flatMap((g) => g.questions || []),
    ...(questionnaire.questions || []),
  ] : [];
  
  // Используем единую функцию filterQuestions
  const allQuestions = filterQuestions({
    questions: allQuestionsRaw,
    answers,
    savedProgressAnswers: savedProgress?.answers,
    isRetakingQuiz,
    showRetakeScreen,
    logger: clientLogger,
  });

  // Вычисляем номер следующего неотвеченного вопроса (N+1)
  let displayQuestionNumber = savedProgress.questionIndex + 2; // Fallback: следующий после сохраненного (N+1)
  
  if (allQuestions.length > 0) {
    const answeredQuestionIds = Object.keys(savedProgress.answers || {}).map(id => Number(id));
    
    // Находим следующий неотвеченный вопрос
    const nextUnansweredQuestion = allQuestions.find((q) => {
      return !answeredQuestionIds.includes(q.id);
    });
    
    if (nextUnansweredQuestion) {
      const nextIndex = allQuestions.findIndex(q => q.id === nextUnansweredQuestion.id);
      if (nextIndex !== -1) {
        // Показываем номер следующего вопроса (индекс + 1, так как нумерация с 1)
        displayQuestionNumber = nextIndex + 1;
      }
    } else {
      // Если все вопросы отвечены, показываем последний вопрос
      displayQuestionNumber = allQuestions.length;
    }
  }

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
            onClick={onResume}
            style={{
              width: '100%',
              height: '56px',
              background: '#D5FE61',
              color: '#000000',
              border: 'none',
              borderRadius: '20px',
              fontFamily: "var(--font-inter), 'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
              fontWeight: 600,
              fontSize: '16px',
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
            }}
          >
            Продолжить с вопроса {displayQuestionNumber}
          </button>

          {/* Кнопка "Начать анкету заново" */}
          <button
            onClick={onStartOver}
            style={{
              width: '100%',
              height: '56px',
              background: 'transparent',
              color: '#000000',
              border: '2px solid #000000',
              borderRadius: '20px',
              fontFamily: "var(--font-inter), 'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
              fontWeight: 600,
              fontSize: '16px',
              cursor: 'pointer',
            }}
          >
            Начать анкету заново
          </button>
        </div>
      </div>
    </div>
  );
}
