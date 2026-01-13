// app/(miniapp)/quiz/components/QuizQuestion.tsx
// Компонент для рендеринга вопроса анкеты
// Вынесен из page.tsx для упрощения основного компонента

'use client';

import Link from 'next/link';
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

  return (
    <>
      {/* Кнопка "Назад" */}
      {showBackButton && (
        <div style={{
          position: 'fixed',
          top: 'clamp(20px, 4vh, 40px)',
          left: 'clamp(19px, 5vw, 24px)',
          zIndex: 100,
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}>
          <button
            onClick={onBack}
            style={{
              width: '34px',
              height: '34px',
              borderRadius: '10px',
              background: '#D5FE61',
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              padding: 0,
            }}
          >
            <svg
              width="7"
              height="14"
              viewBox="0 0 7 14"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              style={{ transform: 'rotate(180deg)' }}
            >
              <path
                d="M1 1L6 7L1 13"
                stroke="#000000"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
          <span style={{
            fontFamily: "var(--font-inter), 'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
            fontWeight: 400,
            fontStyle: 'normal',
            fontSize: '14px',
            lineHeight: '34px',
            letterSpacing: '0px',
            textAlign: 'center',
            color: '#000000',
          }}>
            Назад
          </span>
        </div>
      )}

      {/* Прогресс-бар */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{
          width: '100%',
          height: '6px',
          backgroundColor: 'rgba(10, 95, 89, 0.1)',
          borderRadius: '3px',
          overflow: 'hidden',
          position: 'relative',
        }}>
          <div style={{
            width: `${allQuestionsLength > 0 ? ((currentQuestionIndex + 1) / allQuestionsLength) * 100 : 0}%`,
            height: '100%',
            backgroundColor: '#0A5F59',
            borderRadius: '3px',
            transition: 'width 0.3s ease',
            boxShadow: '0 2px 8px rgba(10, 95, 89, 0.3)',
          }} />
        </div>
      </div>

      {/* Заголовок вопроса */}
      <h2 className="quiz-title" style={{ 
        fontFamily: "'Unbounded', -apple-system, BlinkMacSystemFont, sans-serif",
        fontSize: '24px', 
        fontWeight: 'bold', 
        color: '#0A5F59',
        marginBottom: '24px'
      }}>
        {question?.text || ''}
      </h2>

      {/* Single Choice */}
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
                  border: '1px solid rgba(10, 95, 89, 0.2)',
                  backgroundColor: isSelected
                    ? 'rgba(10, 95, 89, 0.1)'
                    : 'rgba(255, 255, 255, 0.5)',
                  cursor: 'pointer',
                  textAlign: 'left',
                  fontSize: '16px',
                  color: '#0A5F59',
                  transition: 'all 0.2s',
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
                  borderRadius: '16px',
                  backgroundColor: '#0A5F59',
                  color: 'white',
                  border: 'none',
                  cursor: isSubmitting ? 'not-allowed' : 'pointer',
                  fontSize: '18px',
                  fontWeight: 'bold',
                  boxShadow: '0 8px 24px rgba(10, 95, 89, 0.3), 0 4px 12px rgba(10, 95, 89, 0.2)',
                  transition: 'all 0.2s',
                  opacity: isSubmitting ? 0.7 : 1,
                }}
              >
                {isSubmitting ? 'Отправка...' : 'Получить план →'}
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
                      color: '#0A5F59',
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
                  borderRadius: '16px',
                  backgroundColor: '#0A5F59',
                  color: 'white',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '16px',
                  fontWeight: 'bold',
                  opacity: !answers[question.id] ? 0.5 : 1,
                }}
              >
                Далее
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
              border: '1px solid rgba(10, 95, 89, 0.2)',
              backgroundColor: 'rgba(255, 255, 255, 0.8)',
              fontSize: '16px',
              color: '#0A5F59',
              fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
              outline: 'none',
              transition: 'all 0.2s',
            }}
            onFocus={(e) => {
              e.target.style.borderColor = '#0A5F59';
              e.target.style.backgroundColor = 'rgba(255, 255, 255, 1)';
            }}
            onBlur={(e) => {
              e.target.style.borderColor = 'rgba(10, 95, 89, 0.2)';
              e.target.style.backgroundColor = 'rgba(255, 255, 255, 0.8)';
            }}
          />
          {answers[question.id] && String(answers[question.id]).trim().length > 0 && (
            <button
              onClick={onNext}
              style={{
                marginTop: '12px',
                width: '100%',
                padding: '16px',
                borderRadius: '16px',
                backgroundColor: '#0A5F59',
                color: 'white',
                border: 'none',
                cursor: 'pointer',
                fontSize: '16px',
                fontWeight: 'bold',
              }}
            >
              Далее
            </button>
          )}
        </div>
      )}

      {/* Multi Choice */}
      {question?.type === 'multi_choice' && question?.options && (
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
                  border: '1px solid rgba(10, 95, 89, 0.2)',
                  backgroundColor: isSelected
                    ? 'rgba(10, 95, 89, 0.1)'
                    : 'rgba(255, 255, 255, 0.5)',
                  cursor: 'pointer',
                  textAlign: 'left',
                  fontSize: '16px',
                  color: '#0A5F59',
                  transition: 'all 0.2s',
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
                  borderRadius: '16px',
                  backgroundColor: '#0A5F59',
                  color: 'white',
                  border: 'none',
                  cursor: (!answers[question.id] || (Array.isArray(answers[question.id]) && (answers[question.id] as string[]).length === 0) || isSubmitting) ? 'not-allowed' : 'pointer',
                  fontSize: '18px',
                  fontWeight: 'bold',
                  boxShadow: '0 8px 24px rgba(10, 95, 89, 0.3), 0 4px 12px rgba(10, 95, 89, 0.2)',
                  opacity: (!answers[question.id] || (Array.isArray(answers[question.id]) && (answers[question.id] as string[]).length === 0) || isSubmitting) ? 0.5 : 1,
                  transition: 'all 0.2s',
                }}
              >
                {isSubmitting ? 'Отправка...' : 'Получить план →'}
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
                      color: '#0A5F59',
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
                  borderRadius: '16px',
                  backgroundColor: '#0A5F59',
                  color: 'white',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '16px',
                  fontWeight: 'bold',
                  opacity: (!answers[question.id] || (Array.isArray(answers[question.id]) && (answers[question.id] as string[]).length === 0)) ? 0.5 : 1,
                }}
              >
                Далее
              </button>
            )
          )}
        </div>
      )}
    </>
  );
}

