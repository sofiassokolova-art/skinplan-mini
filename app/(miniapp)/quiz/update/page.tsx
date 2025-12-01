// app/(miniapp)/quiz/update/page.tsx
// Страница выбора темы для частичного обновления анкеты

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getAllTopics } from '@/lib/quiz-topics';
import type { QuizTopic } from '@/lib/quiz-topics';

export default function QuizUpdatePage() {
  const router = useRouter();
  const [topics, setTopics] = useState<QuizTopic[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Загружаем темы
    const allTopics = getAllTopics();
    setTopics(allTopics);
    setLoading(false);
  }, []);

  const handleTopicSelect = (topic: QuizTopic) => {
    // Переходим к мини-анкете для выбранной темы
    router.push(`/quiz/update/${topic.id}`);
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

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #F5FFFC 0%, #E8FBF7 100%)',
      padding: '20px',
      paddingBottom: '100px',
    }}>
      {/* Header */}
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{
          fontSize: '28px',
          fontWeight: 'bold',
          color: '#0A5F59',
          marginBottom: '8px',
        }}>
          Обновить анкету
        </h1>
        <p style={{
          fontSize: '16px',
          color: '#6B7280',
          lineHeight: '1.6',
        }}>
          Выберите раздел, который вы хотите обновить
        </p>
      </div>

      {/* Список тем */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {topics.map((topic) => (
          <button
            key={topic.id}
            onClick={() => handleTopicSelect(topic)}
            style={{
              padding: '20px',
              borderRadius: '16px',
              backgroundColor: 'white',
              border: '1px solid #E5E7EB',
              textAlign: 'left',
              cursor: 'pointer',
              transition: 'all 0.2s',
              boxShadow: '0 2px 4px rgba(0, 0, 0, 0.05)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = '#0A5F59';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(10, 95, 89, 0.15)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = '#E5E7EB';
              e.currentTarget.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.05)';
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
              <div style={{
                fontSize: '32px',
                lineHeight: '1',
              }}>
                {topic.icon || '📝'}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{
                  fontSize: '18px',
                  fontWeight: '600',
                  color: '#111827',
                  marginBottom: '4px',
                }}>
                  {topic.title}
                </div>
                <div style={{
                  fontSize: '14px',
                  color: '#6B7280',
                  marginBottom: '8px',
                }}>
                  {topic.description}
                </div>
                <div style={{
                  fontSize: '12px',
                  color: '#9CA3AF',
                }}>
                  {topic.questionIds.length} вопросов
                  {topic.triggersPlanRebuild && (
                    <span style={{ marginLeft: '8px', color: '#0A5F59', fontWeight: '500' }}>
                      • Обновит план
                    </span>
                  )}
                </div>
              </div>
              <div style={{
                fontSize: '20px',
                color: '#9CA3AF',
              }}>
                →
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Кнопка "Назад" */}
      <div style={{ marginTop: '32px' }}>
        <button
          onClick={() => router.back()}
          style={{
            width: '100%',
            padding: '16px',
            borderRadius: '12px',
            backgroundColor: '#F3F4F6',
            border: 'none',
            color: '#6B7280',
            fontSize: '16px',
            fontWeight: '500',
            cursor: 'pointer',
            transition: 'all 0.2s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#E5E7EB';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = '#F3F4F6';
          }}
        >
          Назад
        </button>
      </div>
    </div>
  );
}

