// app/(miniapp)/quiz/update/result/page.tsx
// Страница результата обновления профиля

'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getTopicById } from '@/lib/quiz-topics';
import { CheckCircle } from 'lucide-react';
import { clientLogger } from '@/lib/client-logger';
import { MiniAppPageSkeleton } from '@/components/ui/SkeletonLoader';

function QuizUpdateResultContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const topicId = searchParams.get('topicId') || '';
  const needsRebuild = searchParams.get('needsRebuild') === 'true';

  const [topic, setTopic] = useState<any>(null);

  useEffect(() => {
    if (topicId) {
      const topicData = getTopicById(topicId);
      setTopic(topicData || null);
    }
    // Устанавливаем флаг о перепрохождении анкеты в БД
    const setRetakeFlag = async () => {
      try {
        const { setIsRetakingQuiz } = await import('@/lib/user-preferences');
        await setIsRetakingQuiz(true);
        // Оплата ретейка теперь проверяется на сервере через entitlement (retake_topic_access)
      } catch (err) {
        console.warn('Failed to set retake flag:', err);
      }
    };
    setRetakeFlag();
  }, [topicId]);

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #F5FFFC 0%, #E8FBF7 100%)',
      padding: '20px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '24px',
        padding: '32px',
        maxWidth: '500px',
        width: '100%',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
        textAlign: 'center',
      }}>
        {/* Иконка успеха */}
        <div style={{
          width: '80px',
          height: '80px',
          borderRadius: '50%',
          backgroundColor: '#D1FAE5',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 24px',
        }}>
          <CheckCircle size={48} color="#10B981" />
        </div>

        {/* Заголовок */}
        <h1 style={{
          fontSize: '28px',
          fontWeight: 'bold',
          color: '#0A5F59',
          marginBottom: '12px',
        }}>
          Профиль обновлён! 🎉
        </h1>

        {/* Текст */}
        <p style={{
          fontSize: '16px',
          color: '#6B7280',
          lineHeight: '1.6',
          marginBottom: '24px',
        }}>
          Мы учли ваши новые ответы и пересобрали рекомендации.
        </p>

        {/* Информация о пересборке плана */}
        {needsRebuild && (
          <div style={{
            padding: '16px',
            borderRadius: '12px',
            backgroundColor: '#FEF3C7',
            border: '1px solid #FCD34D',
            marginBottom: '24px',
          }}>
            <p style={{
              fontSize: '14px',
              color: '#92400E',
              fontWeight: '500',
            }}>
              Ваш план ухода был обновлён автоматически.
            </p>
          </div>
        )}

        {!needsRebuild && (
          <div style={{
            padding: '16px',
            borderRadius: '12px',
            backgroundColor: '#F0FDF4',
            border: '1px solid #86EFAC',
            marginBottom: '24px',
          }}>
            <p style={{
              fontSize: '14px',
              color: '#065F46',
            }}>
              Ваши рекомендации остались актуальными.
            </p>
          </div>
        )}

        {/* Кнопки */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <button
            onClick={() => router.push('/plan')}
            style={{
              width: '100%',
              padding: '16px',
              borderRadius: '16px',
              backgroundColor: '#0A5F59',
              border: 'none',
              color: 'white',
              fontSize: '16px',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#0C7A73';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#0A5F59';
            }}
          >
            Посмотреть обновлённый план
          </button>
          
          <button
            onClick={() => router.push('/home')}
            style={{
              width: '100%',
              padding: '16px',
              borderRadius: '16px',
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
            Продолжить использование
          </button>
        </div>
      </div>
    </div>
  );
}

export default function QuizUpdateResultPage() {
  return (
    <Suspense fallback={<MiniAppPageSkeleton background="linear-gradient(135deg, #F5FFFC 0%, #E8FBF7 100%)" rows={3} />}>
      <QuizUpdateResultContent />
    </Suspense>
  );
}
