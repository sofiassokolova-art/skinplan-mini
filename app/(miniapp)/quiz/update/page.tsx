// app/(miniapp)/quiz/update/page.tsx
// Страница выбора темы для частичного обновления анкеты

'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getAllTopics } from '@/lib/quiz-topics';
import type { QuizTopic } from '@/lib/quiz-topics';

export default function QuizUpdatePage() {
  const router = useRouter();

  // getAllTopics() синхронная → можно без useEffect/loading
  const topics = useMemo<QuizTopic[]>(() => getAllTopics(), []);

  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const handleTopicSelect = (topicId: string) => {
    router.push(`/quiz/update/${topicId}`);
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #F5FFFC 0%, #E8FBF7 100%)',
        padding: '20px',
        paddingBottom: '100px',
      }}
    >
      {/* Header */}
      <div style={{ marginBottom: '32px' }}>
        <h1
          style={{
            fontSize: '28px',
            fontWeight: 'bold',
            color: '#0A5F59',
            marginBottom: '8px',
          }}
        >
          Обновить анкету
        </h1>
        <p
          style={{
            fontSize: '16px',
            color: '#6B7280',
            lineHeight: '1.6',
          }}
        >
          Выберите раздел, который вы хотите обновить
        </p>
      </div>

      {/* Список тем */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {topics.map((topic) => {
          const isHovered = hoveredId === topic.id;

          return (
            <button
              key={topic.id}
              type="button"
              onClick={() => handleTopicSelect(topic.id)}
              onMouseEnter={() => setHoveredId(topic.id)}
              onMouseLeave={() => setHoveredId(null)}
              style={{
                padding: '20px',
                borderRadius: '16px',
                backgroundColor: 'white',
                border: `1px solid ${isHovered ? '#0A5F59' : '#E5E7EB'}`,
                textAlign: 'left',
                cursor: 'pointer',
                transition: 'all 0.2s',
                boxShadow: isHovered
                  ? '0 4px 12px rgba(10, 95, 89, 0.15)'
                  : '0 2px 4px rgba(0, 0, 0, 0.05)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
                <div style={{ fontSize: '32px', lineHeight: '1' }}>{topic.icon || '📝'}</div>

                <div style={{ flex: 1 }}>
                  <div
                    style={{
                      fontSize: '18px',
                      fontWeight: '600',
                      color: '#111827',
                      marginBottom: '4px',
                    }}
                  >
                    {topic.title}
                  </div>

                  <div style={{ fontSize: '14px', color: '#6B7280', marginBottom: '8px' }}>
                    {topic.description}
                  </div>

                  <div style={{ fontSize: '12px', color: '#9CA3AF' }}>
                    {topic.questionCodes?.length ?? topic.questionIds.length} вопросов
                    {topic.triggersPlanRebuild && (
                      <span style={{ marginLeft: '8px', color: '#0A5F59', fontWeight: '500' }}>
                        • Обновит план
                      </span>
                    )}
                  </div>
                </div>

                <div style={{ fontSize: '20px', color: '#9CA3AF' }}>→</div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Кнопка "Назад" */}
      <div style={{ marginTop: '32px' }}>
        <button
          type="button"
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
          onMouseEnter={() => setHoveredId('__back__')}
          onMouseLeave={() => setHoveredId(null)}
        >
          Назад
        </button>
      </div>
    </div>
  );
}
