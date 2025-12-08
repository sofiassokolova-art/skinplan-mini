// app/(miniapp)/quiz/update/[topicId]/page.tsx
// Страница мини-анкеты для выбранной темы

'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { getTopicById } from '@/lib/quiz-topics';
import { api } from '@/lib/api';
import toast from 'react-hot-toast';
import { logger } from '@/lib/logger';
import { clientLogger } from '@/lib/client-logger';

export default function QuizTopicPage() {
  const router = useRouter();
  const params = useParams();
  const topicId = params?.topicId as string;
  
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [questions, setQuestions] = useState<any[]>([]);
  const [answers, setAnswers] = useState<Record<number, any>>({});
  const [topic, setTopic] = useState<any>(null);

  useEffect(() => {
    loadTopicAndQuestions();
  }, [topicId]);

  const loadTopicAndQuestions = async () => {
    try {
      setLoading(true);
      
      // Получаем тему
      const topicData = getTopicById(topicId);
      if (!topicData) {
        toast.error('Тема не найдена');
        router.push('/quiz/update');
        return;
      }
      setTopic(topicData);

      // Загружаем вопросы анкеты
      const questionnaire = await api.getQuestionnaire() as any;
      if (!questionnaire) {
        toast.error('Анкета не найдена');
        setLoading(false);
        return;
      }

      // Получаем все вопросы из групп и отдельные вопросы
      // Нормализуем структуру: API возвращает 'options', а компонент ожидает 'answerOptions'
      const normalizeQuestion = (q: any) => ({
        ...q,
        answerOptions: q.answerOptions || q.options || [], // Поддержка обоих форматов
      });
      
      const allQuestions = [
        ...(questionnaire.groups?.flatMap((g: any) => (g.questions || []).map(normalizeQuestion)) || []),
        ...(questionnaire.questions || []).map(normalizeQuestion),
      ];

      if (!Array.isArray(allQuestions) || allQuestions.length === 0) {
        toast.error('Вопросы не найдены в анкете');
        setLoading(false);
        return;
      }

      // Фильтруем вопросы по теме
      // Приоритет: сначала по коду (более надежно), потом по ID
      const topicQuestions = allQuestions.filter((q: any) => {
        if (!q || !q.id) return false;
        
        // Приоритет 1: Проверяем по коду (более надежно, т.к. коды не меняются)
        if (topicData.questionCodes && q.code) {
          const normalizedCode = q.code.toUpperCase().trim();
          const matchingCode = topicData.questionCodes.some(code => 
            normalizedCode === code.toUpperCase().trim() ||
            normalizedCode.includes(code.toUpperCase().trim()) ||
            code.toUpperCase().trim().includes(normalizedCode)
          );
          if (matchingCode) {
            return true;
          }
        }
        
        // Приоритет 2: Проверяем по ID (если коды не совпали)
        if (topicData.questionIds && topicData.questionIds.includes(q.id)) {
          return true;
        }
        
        return false;
      });

      if (topicQuestions.length === 0) {
        console.error('No questions found for topic', {
          topicId,
          topicTitle: topicData.title,
          topicQuestionCodes: topicData.questionCodes,
          topicQuestionIds: topicData.questionIds,
          allQuestionsCount: allQuestions.length,
          allQuestionCodes: allQuestions.map((q: any) => ({ id: q.id, code: q.code, text: q.text?.substring(0, 50) })),
        });
        toast.error('Вопросы для выбранной темы не найдены. Проверьте консоль для подробностей.');
        setLoading(false);
        return;
      }

      clientLogger.log('Questions found for topic', {
        topicId,
        topicTitle: topicData.title,
        foundCount: topicQuestions.length,
        questions: topicQuestions.map((q: any) => ({ id: q.id, code: q.code, text: q.text?.substring(0, 50) })),
      });

      // Загружаем текущие ответы пользователя для предзаполнения
      let answersMap: Record<number, any> = {};
      try {
        const currentAnswers = await api.getUserAnswers() as any;
        
        if (Array.isArray(currentAnswers) && currentAnswers.length > 0) {
          currentAnswers.forEach((answer: any) => {
            if (answer && answer.questionId && topicQuestions.some((q: any) => q.id === answer.questionId)) {
              answersMap[answer.questionId] = answer.answerValue || answer.answerValues;
            }
          });
        }
      } catch (answerError: any) {
        // Если не удалось загрузить ответы - это не критично, просто не предзаполняем
        clientLogger.warn('Could not load previous answers (non-critical):', answerError);
      }

      setQuestions(topicQuestions);
      setAnswers(answersMap);
    } catch (err: any) {
      console.error('Error loading topic questions:', err);
      console.error('Error details:', {
        message: err?.message,
        stack: err?.stack,
        topicId,
      });
      
      // Более информативное сообщение об ошибке
      let errorMessage = 'Ошибка загрузки вопросов';
      if (err?.message?.includes('401') || err?.message?.includes('Unauthorized')) {
        errorMessage = 'Ошибка авторизации. Пожалуйста, обновите страницу.';
      } else if (err?.message) {
        errorMessage = err.message;
      }
      
      toast.error(errorMessage);
      
      // Если критическая ошибка, возвращаемся назад
      if (err?.message?.includes('401') || err?.message?.includes('Unauthorized')) {
        setTimeout(() => {
          router.push('/quiz/update');
        }, 2000);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleAnswerChange = (questionId: number, value: any) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: value,
    }));
  };

  const handleSubmit = async () => {
    try {
      setSubmitting(true);

      // Преобразуем ответы в формат для API
      const answersArray = Object.entries(answers).map(([questionId, value]) => ({
        questionId: Number(questionId),
        value: Array.isArray(value) ? undefined : value,
        values: Array.isArray(value) ? value : undefined,
      }));

      // Отправляем на сервер
      const response = await fetch('/api/questionnaire/partial-update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Telegram-Init-Data': window.Telegram?.WebApp?.initData || '',
        },
        body: JSON.stringify({
          topicId,
          answers: answersArray,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Ошибка обновления');
      }

      const result = await response.json();

      // Переходим на страницу результата
      router.push(`/quiz/update/result?topicId=${topicId}&needsRebuild=${result.needsPlanRebuild}`);
    } catch (err: any) {
      logger.error('Error submitting answers', err, { topicId });
      console.error('Error submitting answers:', err);
      
      let errorMessage = 'Не удалось обновить профиль';
      if (err?.message?.includes('401') || err?.message?.includes('Unauthorized')) {
        errorMessage = 'Ошибка авторизации. Пожалуйста, обновите страницу.';
      } else if (err?.message) {
        errorMessage = err.message;
      }
      
      toast.error(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #F5FFFC 0%, #E8FBF7 100%)',
      }}>
        <div style={{ color: '#0A5F59', fontSize: '16px' }}>Загрузка...</div>
      </div>
    );
  }

  if (!topic || questions.length === 0) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #F5FFFC 0%, #E8FBF7 100%)',
      }}>
        <div style={{ color: '#DC2626', fontSize: '16px' }}>Тема или вопросы не найдены</div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #F5FFFC 0%, #E8FBF7 100%)',
      padding: '20px',
      paddingBottom: '100px',
    }}>
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <button
          onClick={() => router.back()}
          style={{
            marginBottom: '16px',
            padding: '8px 16px',
            borderRadius: '12px',
            backgroundColor: 'white',
            border: '1px solid #E5E7EB',
            color: '#6B7280',
            fontSize: '14px',
            cursor: 'pointer',
          }}
        >
          ← Назад
        </button>
        <h1 style={{
          fontSize: '24px',
          fontWeight: 'bold',
          color: '#0A5F59',
          marginBottom: '8px',
        }}>
          {topic.icon} {topic.title}
        </h1>
        <p style={{
          fontSize: '14px',
          color: '#6B7280',
        }}>
          {topic.description}
        </p>
      </div>

      {/* Вопросы */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginBottom: '32px' }}>
        {questions.map((question) => {
          const currentAnswer = answers[question.id];
          
          return (
            <div
              key={question.id}
              style={{
                backgroundColor: 'white',
                borderRadius: '16px',
                padding: '20px',
                boxShadow: '0 2px 4px rgba(0, 0, 0, 0.05)',
              }}
            >
              <div style={{
                fontSize: '16px',
                fontWeight: '600',
                color: '#111827',
                marginBottom: '16px',
              }}>
                {question.text}
              </div>

              {/* Варианты ответов */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {question.answerOptions && Array.isArray(question.answerOptions) && question.answerOptions.length > 0 ? (
                  question.answerOptions.map((option: any) => {
                  const isSelected = question.type === 'multi_choice'
                    ? Array.isArray(currentAnswer) && currentAnswer.includes(option.value)
                    : currentAnswer === option.value;

                  return (
                    <button
                      key={option.id}
                      onClick={() => {
                        if (question.type === 'multi_choice') {
                          const current = Array.isArray(currentAnswer) ? currentAnswer : [];
                          const newValue = isSelected
                            ? current.filter((v: any) => v !== option.value)
                            : [...current, option.value];
                          handleAnswerChange(question.id, newValue);
                        } else {
                          handleAnswerChange(question.id, option.value);
                        }
                      }}
                      style={{
                        padding: '12px 16px',
                        borderRadius: '12px',
                        backgroundColor: isSelected ? '#F0FDF4' : '#F9FAFB',
                        border: `2px solid ${isSelected ? '#10B981' : '#E5E7EB'}`,
                        color: isSelected ? '#065F46' : '#374151',
                        fontSize: '14px',
                        textAlign: 'left',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                      }}
                    >
                      {option.label}
                    </button>
                  );
                })
                ) : (
                  <div style={{
                    padding: '12px',
                    borderRadius: '12px',
                    backgroundColor: '#FEF2F2',
                    border: '1px solid #FCA5A5',
                    color: '#991B1B',
                    fontSize: '14px',
                    textAlign: 'center',
                  }}>
                    Варианты ответов не найдены для этого вопроса
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Кнопка отправки */}
      <button
        onClick={handleSubmit}
        disabled={submitting}
        style={{
          width: '100%',
          padding: '16px',
          borderRadius: '16px',
          backgroundColor: submitting ? '#9CA3AF' : '#0A5F59',
          border: 'none',
          color: 'white',
          fontSize: '16px',
          fontWeight: '600',
          cursor: submitting ? 'not-allowed' : 'pointer',
          transition: 'all 0.2s',
        }}
      >
        {submitting ? 'Сохранение...' : 'Готово'}
      </button>
    </div>
  );
}

