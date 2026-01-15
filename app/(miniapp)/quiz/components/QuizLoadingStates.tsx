// app/(miniapp)/quiz/components/QuizLoadingStates.tsx
// Компоненты состояний загрузки для страницы анкеты
// РЕФАКТОРИНГ: Вынесены из page.tsx для лучшей читаемости

'use client';

import React from 'react';

const containerStyle: React.CSSProperties = {
  padding: '20px',
  minHeight: '100vh',
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center',
  alignItems: 'center',
  background: 'linear-gradient(135deg, #F5FFFC 0%, #E8FBF7 100%)',
};

const textStyle: React.CSSProperties = {
  color: '#0A5F59',
  fontSize: '18px',
  textAlign: 'center',
};

/**
 * Экран загрузки вопросов
 */
export function LoadingQuestions(): React.ReactElement {
  return (
    <div style={containerStyle}>
      <div style={textStyle}>
        Загрузка вопросов...
      </div>
    </div>
  );
}

/**
 * Экран загрузки вопроса (после resume)
 */
export function LoadingQuestion(): React.ReactElement {
  return (
    <div style={{ padding: '20px', textAlign: 'center' }}>
      <div>Загрузка вопроса...</div>
    </div>
  );
}

/**
 * Экран ошибки: анкета не содержит вопросов
 */
export function EmptyQuestionnaire(): React.ReactElement {
  return (
    <div style={containerStyle}>
      <div style={{
        background: 'white',
        borderRadius: '24px',
        padding: '32px',
        boxShadow: '0 4px 24px rgba(10, 95, 89, 0.1)',
        maxWidth: '350px',
        textAlign: 'center',
      }}>
        <div style={{
          fontSize: '48px',
          marginBottom: '16px',
        }}>
          ⚠️
        </div>
        <div style={{
          fontSize: '18px',
          fontWeight: 600,
          color: '#0A5F59',
          marginBottom: '8px',
        }}>
          Анкета не содержит вопросов
        </div>
        <div style={{
          fontSize: '14px',
          color: '#6B7280',
        }}>
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
    <div style={containerStyle}>
      <div style={{
        background: 'white',
        borderRadius: '24px',
        padding: '32px',
        boxShadow: '0 4px 24px rgba(10, 95, 89, 0.1)',
        maxWidth: '350px',
        textAlign: 'center',
      }}>
        <div style={{
          fontSize: '48px',
          marginBottom: '16px',
        }}>
          🔍
        </div>
        <div style={{
          fontSize: '18px',
          fontWeight: 600,
          color: '#0A5F59',
          marginBottom: '8px',
        }}>
          Вопрос не найден
        </div>
        <div style={{
          fontSize: '14px',
          color: '#6B7280',
          marginBottom: '16px',
        }}>
          Индекс: {currentQuestionIndex} из {allQuestionsLength}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <button
            onClick={onRefresh}
            style={{
              padding: '12px 24px',
              background: '#0A5F59',
              color: 'white',
              border: 'none',
              borderRadius: '12px',
              fontSize: '16px',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            Обновить страницу
          </button>
          <button
            onClick={onStartOver}
            style={{
              padding: '12px 24px',
              background: 'transparent',
              color: '#0A5F59',
              border: '2px solid #0A5F59',
              borderRadius: '12px',
              fontSize: '16px',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            Начать заново
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Лоадер отправки ответов
 */
export function SubmittingLoader({ text = 'Анализируем ваши ответы...' }: { text?: string }): React.ReactElement {
  return (
    <div style={containerStyle}>
      <div style={{
        ...textStyle,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '16px',
      }}>
        <div style={{
          width: '40px',
          height: '40px',
          border: '4px solid #E8FBF7',
          borderTop: '4px solid #0A5F59',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
        }} />
        <div>{text}</div>
      </div>
      <style jsx>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
