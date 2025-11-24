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
  const { initialize, isAvailable, initData } = useTelegram();
  const [questionnaire, setQuestionnaire] = useState<Questionnaire | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentInfoScreenIndex, setCurrentInfoScreenIndex] = useState(0);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string | string[]>>({});
  const [showResumeScreen, setShowResumeScreen] = useState(false);
  const [savedProgress, setSavedProgress] = useState<{
    answers: Record<number, string | string[]>;
    questionIndex: number;
    infoScreenIndex: number;
  } | null>(null);

  useEffect(() => {
    initialize();
    loadQuestionnaire();
    loadSavedProgress();
  }, []);

  // Загружаем сохранённый прогресс
  const loadSavedProgress = () => {
    if (typeof window === 'undefined') return;
    
    const saved = localStorage.getItem('quiz_progress');
    if (saved) {
      try {
        const progress = JSON.parse(saved);
        setSavedProgress(progress);
        // Показываем экран продолжения только если есть сохранённые ответы
        if (progress.answers && Object.keys(progress.answers).length > 0) {
          setShowResumeScreen(true);
        }
      } catch (err) {
        console.error('Error loading saved progress:', err);
      }
    }
  };

  // Сохраняем прогресс в localStorage
  const saveProgress = (newAnswers?: Record<number, string | string[]>, newQuestionIndex?: number, newInfoScreenIndex?: number) => {
    if (typeof window === 'undefined') return;
    
    const progress = {
      answers: newAnswers || answers,
      questionIndex: newQuestionIndex !== undefined ? newQuestionIndex : currentQuestionIndex,
      infoScreenIndex: newInfoScreenIndex !== undefined ? newInfoScreenIndex : currentInfoScreenIndex,
      timestamp: Date.now(),
    };
    
    localStorage.setItem('quiz_progress', JSON.stringify(progress));
  };

  // Очищаем сохранённый прогресс
  const clearProgress = () => {
    if (typeof window === 'undefined') return;
    localStorage.removeItem('quiz_progress');
    setSavedProgress(null);
    setShowResumeScreen(false);
  };

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
    const newAnswers = { ...answers, [questionId]: value };
    setAnswers(newAnswers);
    // Сохраняем прогресс сразу
    saveProgress(newAnswers, currentQuestionIndex, currentInfoScreenIndex);
  };

  const handleNext = () => {
    if (!questionnaire) return;

    // Если мы на информационных экранах, переходим к следующему или к вопросам
    if (currentInfoScreenIndex < INFO_SCREENS.length - 1) {
      const newIndex = currentInfoScreenIndex + 1;
      setCurrentInfoScreenIndex(newIndex);
      // Сохраняем прогресс с новым индексом
      saveProgress(answers, currentQuestionIndex, newIndex);
      return;
    }

    if (currentInfoScreenIndex === INFO_SCREENS.length - 1) {
      // Переходим к первому вопросу
      const newInfoIndex = INFO_SCREENS.length;
      setCurrentInfoScreenIndex(newInfoIndex);
      saveProgress(answers, currentQuestionIndex, newInfoIndex);
      return;
    }

    const allQuestions = [
      ...questionnaire.groups.flatMap((g) => g.questions),
      ...questionnaire.questions,
    ];

    if (currentQuestionIndex < allQuestions.length - 1) {
      const newIndex = currentQuestionIndex + 1;
      setCurrentQuestionIndex(newIndex);
      // Сохраняем прогресс с новым индексом
      saveProgress(answers, newIndex, currentInfoScreenIndex);
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
      // Проверяем и обновляем токен перед отправкой
      let token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
      
      // Если токена нет, пытаемся авторизоваться через Telegram
      if (!token && initData) {
        try {
          const authResult = await api.authTelegram(initData);
          if (authResult.token) {
            token = authResult.token;
            console.log('✅ Авторизованы через Telegram перед отправкой ответов');
          }
        } catch (err) {
          console.warn('Ошибка авторизации через Telegram:', err);
        }
      }

      if (!token) {
        setError('Необходима авторизация. Пожалуйста, откройте приложение через Telegram.');
        return;
      }

      const answerArray = Object.entries(answers).map(([questionId, value]) => {
        const isArray = Array.isArray(value);
        return {
          questionId: parseInt(questionId),
          answerValue: isArray ? undefined : (value as string),
          answerValues: isArray ? (value as string[]) : undefined,
        };
      });

      const result = await api.submitAnswers(questionnaire.id, answerArray);
      
      // Очищаем сохранённый прогресс после успешной отправки
      clearProgress();
      
      // Перенаправление на инсайты после успешного завершения
      router.push('/insights');
    } catch (err: any) {
      console.error('Error submitting answers:', err);
      
      // Если ошибка авторизации, пытаемся обновить токен
      if (err?.message?.includes('Unauthorized') || err?.message?.includes('401')) {
        if (initData) {
          try {
            const authResult = await api.authTelegram(initData);
            if (authResult.token) {
              // Повторяем отправку после обновления токена
              setTimeout(() => submitAnswers(), 500);
              return;
            }
          } catch (authErr) {
            console.error('Error re-authenticating:', authErr);
          }
        }
        setError('Ошибка авторизации. Пожалуйста, обновите страницу и попробуйте снова.');
      } else {
        setError(err?.message || 'Ошибка сохранения ответов');
      }
    }
  };

  // Продолжить с сохранённого места
  const resumeQuiz = () => {
    if (!savedProgress) return;
    
    setAnswers(savedProgress.answers);
    setCurrentQuestionIndex(savedProgress.questionIndex);
    setCurrentInfoScreenIndex(savedProgress.infoScreenIndex);
    setShowResumeScreen(false);
  };

  // Начать заново
  const startOver = () => {
    clearProgress();
    setAnswers({});
    setCurrentQuestionIndex(0);
    setCurrentInfoScreenIndex(0);
    setShowResumeScreen(false);
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

  // Экран продолжения анкеты
  if (showResumeScreen && savedProgress) {
    const allQuestions = questionnaire ? [
      ...questionnaire.groups.flatMap((g) => g.questions),
      ...questionnaire.questions,
    ] : [];
    
    const answeredCount = Object.keys(savedProgress.answers).length;
    const totalQuestions = allQuestions.length;
    const progressPercent = totalQuestions > 0 ? Math.round((answeredCount / totalQuestions) * 100) : 0;

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
          <h1 style={{
            fontFamily: "'Satoshi', 'Manrope', -apple-system, BlinkMacSystemFont, sans-serif",
            fontWeight: 700,
            fontSize: '32px',
            lineHeight: '38px',
            color: '#0A5F59',
            margin: '0 0 16px 0',
            textAlign: 'center',
          }}>
            Вы не завершили анкету
          </h1>

          <p style={{
            fontFamily: "'Manrope', -apple-system, BlinkMacSystemFont, sans-serif",
            fontWeight: 400,
            fontSize: '18px',
            lineHeight: '1.5',
            color: '#475467',
            margin: '0 0 24px 0',
            textAlign: 'center',
          }}>
            Продолжите, чтобы получить персональный план ухода
          </p>

          {/* Прогресс */}
          <div style={{
            marginBottom: '28px',
            padding: '16px',
            backgroundColor: 'rgba(10, 95, 89, 0.08)',
            borderRadius: '16px',
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginBottom: '8px',
              fontSize: '14px',
              color: '#0A5F59',
              fontWeight: 600,
            }}>
              <span>Прогресс</span>
              <span>{answeredCount} из {totalQuestions} вопросов</span>
            </div>
            <div style={{
              width: '100%',
              height: '8px',
              backgroundColor: 'rgba(10, 95, 89, 0.2)',
              borderRadius: '4px',
              overflow: 'hidden',
            }}>
              <div style={{
                width: `${progressPercent}%`,
                height: '100%',
                backgroundColor: '#0A5F59',
                transition: 'width 0.3s ease',
              }} />
            </div>
          </div>

          {/* Выгоды */}
          <div style={{
            marginBottom: '28px',
            padding: '0',
          }}>
            <h3 style={{
              fontSize: '16px',
              fontWeight: 600,
              color: '#0A5F59',
              marginBottom: '12px',
            }}>
              Что вы получите:
            </h3>
            {[
              'Персональный план ухода на 12 недель',
              'Рекомендации от косметолога-дерматолога',
              'Точная диагностика типа и состояния кожи',
            ].map((benefit, index) => (
              <div key={index} style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '12px',
                marginBottom: index < 2 ? '12px' : '0',
              }}>
                <div style={{
                  width: '20px',
                  height: '20px',
                  borderRadius: '50%',
                  backgroundColor: '#0A5F59',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  marginTop: '2px',
                }}>
                  <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
                <span style={{
                  fontSize: '15px',
                  color: '#1F2A44',
                  lineHeight: '1.5',
                }}>
                  {benefit}
                </span>
              </div>
            ))}
          </div>

          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}>
            <button
              onClick={resumeQuiz}
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
              Продолжить с вопроса {savedProgress.questionIndex + 1} →
            </button>
            
            <button
              onClick={startOver}
              style={{
                width: '100%',
                height: '48px',
                background: 'transparent',
                color: '#0A5F59',
                border: '1px solid rgba(10, 95, 89, 0.3)',
                borderRadius: '24px',
                fontFamily: "'Manrope', -apple-system, BlinkMacSystemFont, sans-serif",
                fontWeight: 500,
                fontSize: '16px',
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