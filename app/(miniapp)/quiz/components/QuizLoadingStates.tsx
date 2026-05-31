// app/(miniapp)/quiz/components/QuizLoadingStates.tsx
// Компоненты состояний загрузки для страницы анкеты
// РЕФАКТОРИНГ P2: Используем CSS-классы вместо inline-стилей

'use client';

import React from 'react';
import { QuizInitialLoader } from './QuizInitialLoader';

/**
 * Экран загрузки вопросов
 */
export function LoadingQuestions(): React.ReactElement {
  return <QuizInitialLoader />;
}

/**
 * Экран загрузки вопроса (после resume)
 */
export function LoadingQuestion(): React.ReactElement {
  return <QuizInitialLoader />;
}

/**
 * Экран ошибки: анкета не содержит вопросов
 */
export function EmptyQuestionnaire(): React.ReactElement {
  return (
    <div className="page-container center-content">
      <div className="card-lg max-w-[350px] text-center shadow-card">
        <div className="text-5xl mb-4">⚠️</div>
        <div className="text-lg font-semibold text-primary mb-2">
          Анкета не содержит вопросов
        </div>
        <div className="text-sm text-muted">
          Пожалуйста, обратитесь в поддержку
        </div>
      </div>
    </div>
  );
}

/**
 * Экран ошибки: вопрос не найден
 */
export function QuestionNotFound({ 
  currentQuestionIndex, 
  allQuestionsLength,
  onRefresh,
  onStartOver,
}: { 
  currentQuestionIndex: number;
  allQuestionsLength: number;
  onRefresh: () => void;
  onStartOver: () => void;
}): React.ReactElement {
  return (
    <div className="page-container center-content">
      <div className="card-lg max-w-[350px] text-center shadow-card">
        <div className="text-5xl mb-4">🔍</div>
        <div className="text-lg font-semibold text-primary mb-2">
          Вопрос не найден
        </div>
        <div className="text-sm text-muted mb-4">
          Индекс: {currentQuestionIndex} из {allQuestionsLength}
        </div>
        <div className="flex flex-col gap-3">
          <button
            onClick={onRefresh}
            className="btn-primary"
          >
            Обновить страницу
          </button>
          <button
            onClick={onStartOver}
            className="btn-secondary border-2 border-[var(--color-primary)]"
            style={{ background: 'transparent' }}
          >
            Начать заново
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Лоадер отправки ответов — единый чёрно-серый стиль
 */
export function SubmittingLoader({ text = 'Анализируем ваши ответы...' }: { text?: string }): React.ReactElement {
  return <QuizInitialLoader message={text} subMessage="Это может занять до 1 минуты" />;
}
