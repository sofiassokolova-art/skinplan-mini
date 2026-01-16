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
  // ИСПРАВЛЕНО: Добавляем лаймовый стиль для skin_type (тип кожи)
  const isSkinTypeQuestion = question?.code === 'skin_type';
  // ИСПРАВЛЕНО: Добавляем специальный стиль для lifestyle_habits (привычки с иконками)
  const isLifestyleHabitsQuestion = question?.code === 'lifestyle_habits';
  // ИСПРАВЛЕНО: Для skin_type используем лаймовый стиль независимо от типа вопроса
  const useLimeStyle = (isGoalsQuestion && question?.type === 'multi_choice') || isSkinTypeQuestion;

  // Кнопка "Назад" - рендерим через портал, чтобы она была вне всех контейнеров
  // ИСПРАВЛЕНО: Используем position: fixed с правильным контекстом для предотвращения прокрутки
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
        transform: 'translateZ(0)', // Создаем новый слой для правильного позиционирования
        backfaceVisibility: 'hidden', // Оптимизация рендеринга
        WebkitTransform: 'translateZ(0)', // Для Safari
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
      {!useLimeStyle && (() => {
        // ИСПРАВЛЕНО: Разделяем текст вопроса на заголовок и подзаголовок
        const questionText = question?.text || '';
        
        // Сначала проверяем, есть ли перенос строки
        const textParts = questionText.split('\n');
        let title = textParts[0] || '';
        let subtitle = textParts.slice(1).join('\n') || '';
        
        // Если нет подзаголовка через перенос строки, проверяем текст в скобках
        if (!subtitle) {
          const bracketMatch = title.match(/^(.+?)\s*\((.+?)\)\s*$/);
          if (bracketMatch) {
            title = bracketMatch[1].trim();
            subtitle = `(${bracketMatch[2].trim()})`;
          }
        }
        
        // ИСПРАВЛЕНО: Для вопроса avoid_ingredients делаем слово "исключить" жирным
        const isAvoidIngredientsQuestion = question?.code === 'avoid_ingredients';
        const renderTitle = () => {
          if (isAvoidIngredientsQuestion && title.includes('исключить')) {
            const parts = title.split('исключить');
            return (
              <>
                {parts[0]}
                <strong>исключить</strong>
                {parts[1]}
              </>
            );
          }
          return title;
        };
        
        return (
          <>
            <h2 className="quiz-title" style={{ 
              fontFamily: "var(--font-unbounded), 'Unbounded', -apple-system, BlinkMacSystemFont, sans-serif",
              fontSize: '24px', 
              fontWeight: 700, 
              color: '#000000',
              marginBottom: subtitle ? '12px' : '24px',
              marginTop: hideProgressBar ? '60px' : '0',
            }}>
              {renderTitle()}
            </h2>
            {subtitle && (
              <div style={{
                fontFamily: "var(--font-inter), 'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
                fontSize: '16px',
                fontWeight: 400,
                color: '#9D9D9D',
                marginBottom: '24px',
                lineHeight: '1.5',
                whiteSpace: 'pre-line',
              }}>
                {subtitle}
              </div>
            )}
          </>
        );
      })()}

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

      {/* Lime Style (skin_goals, skin_type) - лаймовый контейнер с отступами */}
      {/* ИСПРАВЛЕНО: Для skin_type поддерживаем и single_choice, и multi_choice */}
      {question?.options && useLimeStyle && (() => {
        // ИСПРАВЛЕНО: Разделяем текст вопроса на заголовок и подзаголовок для skin_type
        const questionText = question?.text || '';
        const textParts = questionText.split('\n');
        let title = textParts[0] || '';
        let subtitle = textParts.slice(1).join('\n') || '';
        
        // Если нет подзаголовка через перенос строки, проверяем текст в скобках
        if (!subtitle) {
          const bracketMatch = title.match(/^(.+?)\s*\((.+?)\)\s*$/);
          if (bracketMatch) {
            title = bracketMatch[1].trim();
            subtitle = `(${bracketMatch[2].trim()})`;
          }
        }
        
        return (
          <div style={{ 
            backgroundColor: '#D5FE61',
            borderRadius: '24px',
            padding: '20px',
            marginTop: '0px',
            paddingTop: '20px',
            // ИСПРАВЛЕНО: Для skin_goals и skin_type делаем контейнер во всю ширину
            width: (isGoalsQuestion || isSkinTypeQuestion) ? '100%' : 'auto',
            marginLeft: (isGoalsQuestion || isSkinTypeQuestion) ? '0' : 'auto',
            marginRight: (isGoalsQuestion || isSkinTypeQuestion) ? '0' : 'auto',
          }}>
            {/* Заголовок внутри лаймового контейнера */}
            {/* ИСПРАВЛЕНО: Для вопроса avoid_ingredients делаем слово "исключить" жирным */}
            {(() => {
              const isAvoidIngredientsQuestion = question?.code === 'avoid_ingredients';
              const renderTitle = () => {
                if (isAvoidIngredientsQuestion && title.includes('исключить')) {
                  const parts = title.split('исключить');
                  return (
                    <>
                      {parts[0]}
                      <strong>исключить</strong>
                      {parts[1]}
                    </>
                  );
                }
                return title;
              };
              
              return (
                <h2 style={{ 
                  fontFamily: "var(--font-unbounded), 'Unbounded', -apple-system, BlinkMacSystemFont, sans-serif",
                  fontSize: '24px', 
                  fontWeight: 700, 
                  color: '#000000',
                  marginBottom: subtitle ? '12px' : '20px',
                  marginTop: '0',
                }}>
                  {renderTitle()}
                </h2>
              );
            })()}
            {/* Подзаголовок для skin_type */}
            {subtitle && (
              <div style={{
                fontFamily: "var(--font-inter), 'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
                fontSize: '16px',
                fontWeight: 400,
                color: '#9D9D9D',
                marginBottom: '20px',
                lineHeight: '1.5',
                whiteSpace: 'pre-line',
              }}>
                {subtitle}
              </div>
            )}

          <div style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            gap: '16px',
          }}>
            {(() => {
              // ИСПРАВЛЕНО: Определяем isMultiChoice один раз для всего блока
              const isMultiChoice = question?.type === 'multi_choice';
              
              return question.options.map((option, index) => {
                const currentAnswers = isMultiChoice 
                ? ((answers[question.id] as string[]) || [])
                : (answers[question.id] ? [answers[question.id] as string] : []);
              const isSelected = currentAnswers.includes(option.value);
              
              // ИСПРАВЛЕНО: Картинки для skin_goals и skin_type
              let imageUrl = '/tone6.jpeg'; // Дефолтная картинка
              
              if (isGoalsQuestion) {
                // Картинки для каждой опции skin_goals
                const goalImages: Record<number, string> = {
                  0: '/wrinkles6.jpeg',      // Сократить морщины и мелкие линии
                  1: '/acne6.jpeg',          // Избавиться от акне и высыпаний
                  2: '/pores6.jpeg',         // Сделать поры менее заметными
                  3: '/puff6.jpeg',          // Уменьшить отёчность лица
                  4: '/pigmentation6.jpeg',  // Выровнять тон и пигментацию
                  5: '/tone6.jpeg',          // Улучшить текстуру и гладкость кожи
                };
                imageUrl = goalImages[index] || '/tone6.jpeg';
              } else if (isSkinTypeQuestion) {
                // ИСПРАВЛЕНО: Рандомные картинки для skin_type (пока временные)
                const skinTypeImages: Record<number, string> = {
                  0: '/wrinkles6.jpeg',      // Тип 1 — Сухая
                  1: '/acne6.jpeg',          // Тип 2 — Комбинированная (сухая)
                  2: '/pores6.jpeg',         // Тип 3 — Нормальная
                  3: '/puff6.jpeg',          // Тип 3 — Комбинированная (жирная)
                  4: '/pigmentation6.jpeg',  // Тип 4 — Жирная
                };
                imageUrl = skinTypeImages[index] || '/tone6.jpeg';
              }
              
              return (
                <button
                  key={option.id}
                  onClick={async () => {
                    // ИСПРАВЛЕНО: Для single_choice выбираем один ответ, для multi_choice - несколько
                    if (isMultiChoice) {
                      const newAnswers = isSelected
                        ? currentAnswers.filter((v) => v !== option.value)
                        : [...currentAnswers, option.value];
                      await onAnswer(question.id, newAnswers);
                    } else {
                      // Для single_choice просто выбираем этот ответ и переходим дальше
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
                    flexDirection: 'column',
                    flex: 1,
                    padding: '16px',
                    backgroundColor: isSelected ? '#D5FE61' : '#FFFFFF',
                  }}>
                    {/* ИСПРАВЛЕНО: Для skin_type разделяем текст опции на заголовок и описание */}
                    {(() => {
                      const optionText = option.label || '';
                      const optionParts = optionText.split('\n');
                      const optionTitle = optionParts[0] || '';
                      const optionDescription = optionParts.slice(1).join('\n') || '';
                      
                      return (
                        <>
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            marginBottom: optionDescription ? '8px' : '0',
                          }}>
                            <span style={{
                              fontSize: '16px',
                              fontWeight: 500,
                              color: '#000000',
                              fontFamily: "var(--font-inter), 'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
                            }}>
                              {optionTitle}
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
                          {optionDescription && (
                            <div style={{
                              fontSize: '14px',
                              fontWeight: 400,
                              color: '#666666',
                              fontFamily: "var(--font-inter), 'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
                              lineHeight: '1.4',
                              whiteSpace: 'pre-line',
                            }}>
                              {optionDescription}
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </div>
                </button>
              );
              });
            })()}
            
            {/* Кнопка "Продолжить" - черная для skin_goals и skin_type (в отличие от остальных экранов) */}
            {/* ИСПРАВЛЕНО: Для single_choice кнопка не нужна (переход автоматический), для multi_choice показываем кнопку */}
            {question?.type === 'multi_choice' && answers[question.id] && (Array.isArray(answers[question.id]) ? (answers[question.id] as string[]).length > 0 : true) && (
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
        );
      })()}

      {/* Multi Choice - Lifestyle Habits Style (лаймовые кружки с иконками) */}
      {question?.type === 'multi_choice' && question?.options && isLifestyleHabitsQuestion && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {question.options.map((option) => {
            const currentAnswers = (answers[question.id] as string[]) || [];
            const isSelected = currentAnswers.includes(option.value);
            
            // Функция для получения иконки для каждой привычки
            const getHabitIcon = (label: string) => {
              if (label.includes('Курю')) {
                // Сигарета
                return (
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <rect x="4" y="8" width="10" height="2" fill="#000000"/>
                    <rect x="14" y="7" width="2" height="4" rx="1" fill="#000000"/>
                  </svg>
                );
              } else if (label.includes('алкоголь')) {
                // Бокал
                return (
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M6 4H14V8L16 16H4L6 8V4Z" stroke="#000000" strokeWidth="1.5" fill="none"/>
                    <path d="M6 4H14" stroke="#000000" strokeWidth="1.5"/>
                    <path d="M4 16H16" stroke="#000000" strokeWidth="1.5"/>
                  </svg>
                );
              } else if (label.includes('высыпаюсь')) {
                // Луна (сон)
                return (
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M8 3C8 3 6 5 6 10C6 15 8 17 8 17C4 16 2 13 2 10C2 7 4 4 8 3Z" fill="#000000"/>
                    <circle cx="13" cy="7" r="1" fill="#000000"/>
                    <circle cx="15" cy="10" r="1" fill="#000000"/>
                    <circle cx="13" cy="13" r="1" fill="#000000"/>
                  </svg>
                );
              } else if (label.includes('стресс')) {
                // Молния
                return (
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M11 2L4 12H10L9 18L16 8H10L11 2Z" fill="#000000"/>
                  </svg>
                );
              } else if (label.includes('сладкого')) {
                // Пончик
                return (
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="10" cy="10" r="6" stroke="#000000" strokeWidth="1.5" fill="none"/>
                    <circle cx="10" cy="10" r="3" stroke="#000000" strokeWidth="1.5" fill="none"/>
                    <circle cx="7" cy="7" r="1" fill="#000000"/>
                    <circle cx="13" cy="7" r="1" fill="#000000"/>
                  </svg>
                );
              } else if (label.includes('фастфуда')) {
                // Бургер
                return (
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <rect x="4" y="6" width="12" height="2" fill="#000000"/>
                    <rect x="4" y="9" width="12" height="2" fill="#000000"/>
                    <rect x="4" y="12" width="12" height="2" fill="#000000"/>
                    <circle cx="6" cy="7" r="0.5" fill="#000000"/>
                    <circle cx="14" cy="7" r="0.5" fill="#000000"/>
                  </svg>
                );
              } else if (label.includes('SPF')) {
                // Солнце
                return (
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="10" cy="10" r="4" fill="#000000"/>
                    <line x1="10" y1="2" x2="10" y2="4" stroke="#000000" strokeWidth="1.5"/>
                    <line x1="10" y1="16" x2="10" y2="18" stroke="#000000" strokeWidth="1.5"/>
                    <line x1="2" y1="10" x2="4" y2="10" stroke="#000000" strokeWidth="1.5"/>
                    <line x1="16" y1="10" x2="18" y2="10" stroke="#000000" strokeWidth="1.5"/>
                    <line x1="4.93" y1="4.93" x2="6.34" y2="6.34" stroke="#000000" strokeWidth="1.5"/>
                    <line x1="13.66" y1="13.66" x2="15.07" y2="15.07" stroke="#000000" strokeWidth="1.5"/>
                    <line x1="15.07" y1="4.93" x2="13.66" y2="6.34" stroke="#000000" strokeWidth="1.5"/>
                    <line x1="6.34" y1="13.66" x2="4.93" y2="15.07" stroke="#000000" strokeWidth="1.5"/>
                  </svg>
                );
              } else if (label.includes('нет таких привычек')) {
                // Галочка
                return (
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M4 10L8 14L16 6" stroke="#000000" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                );
              }
              return null;
            };
            
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
                {/* Лаймовый кружок с иконкой */}
                <div style={{
                  width: '56px',
                  height: '56px',
                  borderRadius: '50%',
                  backgroundColor: '#D5FE61',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  {getHabitIcon(option.label)}
                </div>
                {/* Текст */}
                <span style={{ flex: 1 }}>
                  {option.label}
                </span>
                {/* Чекбокс */}
                <div style={{
                  width: '24px',
                  height: '24px',
                  borderRadius: '50%',
                  border: '2px solid #000000',
                  backgroundColor: isSelected ? '#000000' : 'transparent',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  {isSelected && (
                    <svg width="12" height="9" viewBox="0 0 12 9" fill="none">
                      <path d="M1 4.5L4.5 8L11 1.5" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                </div>
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

      {/* Multi Choice - Default Style (белые кнопки с серой окантовкой, #F2F2F2 при выборе) */}
      {question?.type === 'multi_choice' && question?.options && !useLimeStyle && !isLifestyleHabitsQuestion && (
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
