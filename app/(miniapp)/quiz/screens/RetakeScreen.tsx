// app/(miniapp)/quiz/screens/RetakeScreen.tsx
// Экран выбора тем для перепрохождения анкеты

'use client';

import { PaymentGate } from '@/components/PaymentGate';
import { api } from '@/lib/api';
import { clientLogger } from '@/lib/client-logger';
import type { QuizTopic } from '@/lib/quiz-topics';

interface RetakeScreenProps {
  topics: QuizTopic[];
  hasFullRetakePayment: boolean;
  onTopicSelect: (topic: QuizTopic) => void;
  onFullRetake: () => void;
  onCancel: () => void;
}

export function RetakeScreen({
  topics,
  hasFullRetakePayment,
  onTopicSelect,
  onFullRetake,
  onCancel,
}: RetakeScreenProps) {
  return (
    <div style={{
      minHeight: '100vh',
      padding: '20px',
      background: 'linear-gradient(135deg, #F5FFFC 0%, #E8FBF7 100%)',
    }}>
      {/* Заголовок */}
      <div style={{
        textAlign: 'center',
        marginBottom: '32px',
      }}>
        <h1 style={{
          fontSize: '28px',
          fontWeight: 'bold',
          color: '#0A5F59',
          marginBottom: '12px',
        }}>
          Что хотите изменить?
        </h1>
        <p style={{
          fontSize: '16px',
          color: '#6B7280',
          lineHeight: '1.6',
        }}>
          Выберите тему, которую хотите обновить, или пройдите анкету полностью
        </p>
      </div>

      {/* Список тем — без PaymentGate: оплата показывается только после выбора темы на /quiz/update/[topicId] */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        marginBottom: '24px',
      }}>
        {topics.map((topic) => (
          <button
            key={topic.id}
            onClick={() => onTopicSelect(topic)}
            style={{
              padding: '20px',
              borderRadius: '16px',
              backgroundColor: 'white',
              border: '1px solid #E5E7EB',
              textAlign: 'left',
              cursor: 'pointer',
              transition: 'all 0.2s',
              boxShadow: '0 2px 4px rgba(0, 0, 0, 0.05)',
              width: '100%',
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
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{
                fontSize: '32px',
                width: '48px',
                height: '48px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
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
                }}>
                  {topic.description}
                </div>
              </div>
              <div style={{
                fontSize: '24px',
                color: '#9CA3AF',
              }}>
                →
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Кнопка полного перепрохождения */}
      {!hasFullRetakePayment ? (
        <PaymentGate
          price={99}
          productCode="retake_full"
          isRetaking={true}
          onPaymentComplete={async () => {
            // Обновляем состояние оплаты из API
            try {
              const entitlements = await api.getEntitlements();
              const hasRetakeFull = entitlements?.entitlements?.some(
                (e: any) => e.code === 'retake_full_access' && e.active === true
              ) || false;
              clientLogger.log('✅ Full retake payment completed, entitlements updated', { hasRetakeFull });
              if (hasRetakeFull) {
                onFullRetake();
              }
            } catch (err) {
              clientLogger.warn('⚠️ Failed to refresh entitlements after payment', err);
              // Fallback: сохраняем флаг в БД
              try {
                const { setPaymentFullRetakeCompleted } = await import('@/lib/user-preferences');
                await setPaymentFullRetakeCompleted(true);
                onFullRetake();
              } catch (err) {
                clientLogger.warn('Failed to save full retake payment flag:', err);
              }
            }
          }}
        >
          <div style={{ width: '100%', marginTop: '8px' }}>
            <button
              style={{
                width: '100%',
                padding: '16px',
                borderRadius: '16px',
                backgroundColor: 'rgba(255, 255, 255, 0.8)',
                border: '2px solid #0A5F59',
                color: '#0A5F59',
                fontSize: '16px',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#0A5F59';
                e.currentTarget.style.color = 'white';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.8)';
                e.currentTarget.style.color = '#0A5F59';
              }}
            >
              Пройти всю анкету заново (99 ₽)
            </button>
          </div>
        </PaymentGate>
      ) : (
        <button
          onClick={onFullRetake}
          style={{
            width: '100%',
            padding: '16px',
            borderRadius: '16px',
            backgroundColor: 'rgba(255, 255, 255, 0.8)',
            border: '2px solid #0A5F59',
            color: '#0A5F59',
            fontSize: '16px',
            fontWeight: '600',
            cursor: 'pointer',
            transition: 'all 0.2s',
            marginTop: '8px',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#0A5F59';
            e.currentTarget.style.color = 'white';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.8)';
            e.currentTarget.style.color = '#0A5F59';
          }}
        >
          Пройти всю анкету заново
        </button>
      )}

      {/* Кнопка отмены */}
      <div style={{ textAlign: 'center', marginTop: '24px' }}>
        <button
          onClick={onCancel}
          style={{
            padding: '12px 24px',
            borderRadius: '12px',
            backgroundColor: 'transparent',
            border: '1px solid #D1D5DB',
            color: '#6B7280',
            fontSize: '14px',
            cursor: 'pointer',
            transition: 'all 0.2s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = '#9CA3AF';
            e.currentTarget.style.color = '#111827';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = '#D1D5DB';
            e.currentTarget.style.color = '#6B7280';
          }}
        >
          Отмена
        </button>
      </div>
    </div>
  );
}

