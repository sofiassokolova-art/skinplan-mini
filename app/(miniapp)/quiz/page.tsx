// app/(miniapp)/quiz/page.tsx
// Страница анкеты - базовая структура для миграции

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTelegram } from '@/lib/telegram-client';
import { api } from '@/lib/api';

interface Question {
  id: number;
  code: string;
  text: string;
  type: string;
  isRequired: boolean;
  options?: Array<{
    id: number;
    value: string;
    label: string;
  }>;
}

interface Questionnaire {
  id: number;
  name: string;
  version: number;
  groups: Array<{
    id: number;
    title: string;
    questions: Question[];
  }>;
  questions: Question[];
}

// Информационные экраны перед вопросами
const INFO_SCREENS = [
  {
    id: 'welcome',
    title: 'Подбери уход для своей кожи со SkinIQ',
    subtitle: 'Персональный план ухода уровня косметолога-дерматолога',
    image: '/quiz_welocme_image.png',
    ctaText: 'Продолжить',
  },
];

export default function QuizPage() {
  const router = useRouter();
  const { initialize, isAvailable } = useTelegram();
  const [questionnaire, setQuestionnaire] = useState<Questionnaire | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentInfoScreenIndex, setCurrentInfoScreenIndex] = useState(0);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string | string[]>>({});

  useEffect(() => {
    initialize();
    loadQuestionnaire();
  }, []);

  const loadQuestionnaire = async () => {
    try {
      const data = await api.getActiveQuestionnaire();
      setQuestionnaire(data as Questionnaire);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка загрузки анкеты');
    } finally {
      setLoading(false);
    }
  };

  const handleAnswer = (questionId: number, value: string | string[]) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  };

  const handleNext = () => {
    if (!questionnaire) return;

    // Если мы на информационных экранах, переходим к следующему или к вопросам
    if (currentInfoScreenIndex < INFO_SCREENS.length - 1) {
      setCurrentInfoScreenIndex(currentInfoScreenIndex + 1);
      return;
    }

    if (currentInfoScreenIndex === INFO_SCREENS.length - 1) {
      // Переходим к первому вопросу
      setCurrentInfoScreenIndex(INFO_SCREENS.length);
      return;
    }

    const allQuestions = [
      ...questionnaire.groups.flatMap((g) => g.questions),
      ...questionnaire.questions,
    ];

    if (currentQuestionIndex < allQuestions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    } else {
      // Завершение анкеты
      submitAnswers();
    }
  };

  const handleBack = () => {
    if (!questionnaire) return;

    // Если мы на первом информационном экране, возвращаемся на главную
    if (currentInfoScreenIndex === 0) {
      router.push('/');
      return;
    }

    // Если мы на первом вопросе, возвращаемся к последнему информационному экрану
    if (currentInfoScreenIndex === INFO_SCREENS.length && currentQuestionIndex === 0) {
      setCurrentInfoScreenIndex(INFO_SCREENS.length - 1);
      return;
    }

    // Если мы на информационных экранах, переходим к предыдущему
    if (currentInfoScreenIndex > 0 && currentInfoScreenIndex < INFO_SCREENS.length) {
      setCurrentInfoScreenIndex(currentInfoScreenIndex - 1);
      return;
    }

    // Если мы на вопросах, переходим к предыдущему
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1);
    }
  };

  const submitAnswers = async () => {
    if (!questionnaire) return;

    try {
      const answerArray = Object.entries(answers).map(([questionId, value]) => {
        const isArray = Array.isArray(value);
        return {
          questionId: parseInt(questionId),
          answerValue: isArray ? undefined : (value as string),
          answerValues: isArray ? (value as string[]) : undefined,
        };
      });

      const result = await api.submitAnswers(questionnaire.id, answerArray);
      
      // Перенаправление на инсайты после успешного завершения
      router.push('/insights');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка сохранения ответов');
    }
  };

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        flexDirection: 'column',
        gap: '16px'
      }}>
        <div>Загрузка анкеты...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '20px' }}>
        <h1>Ошибка</h1>
        <p>{error}</p>
        <button onClick={() => router.push('/')}>Вернуться на главную</button>
      </div>
    );
  }

  if (!questionnaire) {
    return (
      <div style={{ padding: '20px' }}>
        <h1>Анкета не найдена</h1>
        <p>Активная анкета не найдена. Обратитесь к администратору.</p>
      </div>
    );
  }

  // Получаем все вопросы
  const allQuestions = [
    ...questionnaire.groups.flatMap((g) => g.questions),
    ...questionnaire.questions,
  ];

  // Проверяем, показываем ли мы информационный экран или вопрос
  const isShowingInfoScreen = currentInfoScreenIndex < INFO_SCREENS.length;
  const currentInfoScreen = isShowingInfoScreen ? INFO_SCREENS[currentInfoScreenIndex] : null;
  const currentQuestion = !isShowingInfoScreen ? allQuestions[currentQuestionIndex] : null;

  // Если мы на информационном экране
  if (isShowingInfoScreen && currentInfoScreen) {
    return (
      <div style={{ 
        padding: '20px',
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #F5FFFC 0%, #E8FBF7 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <div style={{
          width: '88%',
          maxWidth: '420px',
          backgroundColor: 'rgba(255, 255, 255, 0.58)',
          backdropFilter: 'blur(26px)',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          borderRadius: '44px',
          padding: '36px 28px 32px 28px',
          boxShadow: '0 16px 48px rgba(0, 0, 0, 0.12), 0 8px 24px rgba(0, 0, 0, 0.08)',
        }}>
          {currentInfoScreen.image && (
            <div style={{
              width: '100%',
              height: '320px',
              borderRadius: '32px 32px 0 0',
              overflow: 'hidden',
              marginBottom: '24px',
            }}>
              <img
                src={currentInfoScreen.image}
                alt={currentInfoScreen.title}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                }}
              />
            </div>
          )}
          
          <h1 style={{
            fontFamily: "'Satoshi', 'Manrope', -apple-system, BlinkMacSystemFont, sans-serif",
            fontWeight: 700,
            fontSize: '36px',
            lineHeight: '42px',
            color: '#0A5F59',
            margin: '0 0 16px 0',
            textAlign: 'center',
          }}>
            {currentInfoScreen.title}
          </h1>

          {currentInfoScreen.subtitle && (
            <p style={{
              fontFamily: "'Manrope', -apple-system, BlinkMacSystemFont, sans-serif",
              fontWeight: 400,
              fontSize: '18px',
              lineHeight: '1.5',
              color: '#475467',
              margin: '0 0 28px 0',
              textAlign: 'center',
            }}>
              {currentInfoScreen.subtitle}
            </p>
          )}

          <button
            onClick={handleNext}
            style={{
              width: '100%',
              height: '64px',
              background: '#0A5F59',
              color: 'white',
              border: 'none',
              borderRadius: '32px',
              fontFamily: "'Manrope', -apple-system, BlinkMacSystemFont, sans-serif",
              fontWeight: 500,
              fontSize: '19px',
              boxShadow: '0 8px 24px rgba(10, 95, 89, 0.3), 0 4px 12px rgba(10, 95, 89, 0.2)',
              cursor: 'pointer',
            }}
          >
            {currentInfoScreen.ctaText || 'Продолжить'} →
          </button>
        </div>
      </div>
    );
  }

  if (!currentQuestion) {
    return (
      <div style={{ padding: '20px' }}>
        <h1>Анкета завершена</h1>
        <button onClick={submitAnswers}>Отправить ответы</button>
      </div>
    );
  }

  return (
    <div style={{ 
      padding: '20px',
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #F5FFFC 0%, #E8FBF7 100%)'
    }}>
      <div style={{
        backgroundColor: 'rgba(255, 255, 255, 0.56)',
        backdropFilter: 'blur(28px)',
        borderRadius: '24px',
        padding: '24px',
        maxWidth: '600px',
        margin: '0 auto',
      }}>
        {/* Кнопка "Назад" - скрыта на первом вопросе */}
        {(currentQuestionIndex > 0 || currentInfoScreenIndex > 0) && (
          <button
            onClick={handleBack}
            style={{
              marginBottom: '16px',
              padding: '8px 16px',
              borderRadius: '12px',
              border: '1px solid rgba(10, 95, 89, 0.2)',
              backgroundColor: 'rgba(255, 255, 255, 0.5)',
              color: '#0A5F59',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 500,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(10, 95, 89, 0.1)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.5)';
            }}
          >
            <span>←</span>
            <span>Назад</span>
          </button>
        )}

        <div style={{ marginBottom: '16px', color: '#0A5F59', fontSize: '14px' }}>
          Вопрос {currentQuestionIndex + 1} из {allQuestions.length}
        </div>

        <h2 style={{ 
          fontSize: '24px', 
          fontWeight: 'bold', 
          color: '#0A5F59',
          marginBottom: '24px'
        }}>
          {currentQuestion.text}
        </h2>

        {currentQuestion.type === 'single_choice' && currentQuestion.options && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {currentQuestion.options.map((option) => (
              <button
                key={option.id}
                onClick={() => {
                  handleAnswer(currentQuestion.id, option.value);
                  setTimeout(handleNext, 300);
                }}
                style={{
                  padding: '16px',
                  borderRadius: '16px',
                  border: '1px solid rgba(10, 95, 89, 0.2)',
                  backgroundColor: answers[currentQuestion.id] === option.value
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
            ))}
          </div>
        )}

        {currentQuestion.type === 'multi_choice' && currentQuestion.options && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {currentQuestion.options.map((option) => {
              const currentAnswers = (answers[currentQuestion.id] as string[]) || [];
              const isSelected = currentAnswers.includes(option.value);
              
              return (
                <button
                  key={option.id}
                  onClick={() => {
                    const newAnswers = isSelected
                      ? currentAnswers.filter((v) => v !== option.value)
                      : [...currentAnswers, option.value];
                    handleAnswer(currentQuestion.id, newAnswers);
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
            <button
              onClick={handleNext}
              disabled={!answers[currentQuestion.id] || (Array.isArray(answers[currentQuestion.id]) && (answers[currentQuestion.id] as string[]).length === 0)}
              style={{
                marginTop: '24px',
                padding: '16px',
                borderRadius: '16px',
                backgroundColor: '#0A5F59',
                color: 'white',
                border: 'none',
                cursor: 'pointer',
                fontSize: '16px',
                fontWeight: 'bold',
                opacity: (!answers[currentQuestion.id] || (Array.isArray(answers[currentQuestion.id]) && (answers[currentQuestion.id] as string[]).length === 0)) ? 0.5 : 1,
              }}
            >
              Далее
            </button>
          </div>
        )}
      </div>
    </div>
  );
}