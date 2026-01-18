// app/(miniapp)/quiz/components/QuizRetakeScreen.tsx
// Компонент экрана выбора тем для перепрохождения анкеты

'use client';

import { useRouter } from 'next/navigation';
import { PaymentGate } from '@/components/PaymentGate';
import { api } from '@/lib/api';
import { clientLogger } from '@/lib/client-logger';
import { getAllTopics } from '@/lib/quiz-topics';
import type { QuizTopic } from '@/lib/quiz-topics';
import * as userPreferences from '@/lib/user-preferences';
import { getInitialInfoScreens } from '../info-screens';
import type { Questionnaire } from '@/lib/quiz/types';

interface QuizRetakeScreenProps {
  questionnaire: Questionnaire | null;
  hasFullRetakePayment: boolean;
  setShowRetakeScreen: (show: boolean) => void;
  setIsRetakingQuiz: (isRetaking: boolean) => void;
  setIsStartingOver: (isStarting: boolean) => void;
  isStartingOverRef: React.MutableRefObject<boolean>;
  setAnswers: (answers: Record<number, string | string[]>) => void;
  setSavedProgress: (progress: any) => void;
  setShowResumeScreen: (show: boolean) => void;
  setHasResumed: (hasResumed: boolean) => void;
  hasResumedRef: React.MutableRefObject<boolean>;
  setAutoSubmitTriggered: (triggered: boolean) => void;
  autoSubmitTriggeredRef: React.MutableRefObject<boolean>;
  setError: (error: string | null) => void;
  setCurrentInfoScreenIndex: (index: number) => void;
  setCurrentQuestionIndex: (index: number) => void;
  setPendingInfoScreen: (screen: any) => void;
  setHasFullRetakePayment: (hasPayment: boolean) => void;
  onFullRetake?: () => Promise<void>;
}

export function QuizRetakeScreen({
  questionnaire,
  hasFullRetakePayment,
  setShowRetakeScreen,
  setIsRetakingQuiz,
  setIsStartingOver,
  isStartingOverRef,
  setAnswers,
  setSavedProgress,
  setShowResumeScreen,
  setHasResumed,
  hasResumedRef,
  setAutoSubmitTriggered,
  autoSubmitTriggeredRef,
  setError,
  setCurrentInfoScreenIndex,
  setCurrentQuestionIndex,
  setPendingInfoScreen,
  setHasFullRetakePayment,
  onFullRetake,
}: QuizRetakeScreenProps) {
  const router = useRouter();
  const retakeTopics = getAllTopics();

  const handleTopicSelect = (topic: QuizTopic) => {
    router.push(`/quiz/update/${topic.id}`);
  };

  // РЕФАКТОРИНГ: Используем переданный обработчик с обработкой ошибок
  const handleFullRetake = async () => {
    try {
      if (onFullRetake) {
        await onFullRetake();
        return;
      }

      // Fallback: старая логика (для обратной совместимости)
      if (!hasFullRetakePayment) {
        clientLogger.log('⚠️ Full retake payment not completed, showing payment gate');
        return;
      }

      clientLogger.log('✅ Full retake payment completed, starting full questionnaire reset');

      // Сбрасываем флаг оплаты после использования в БД
      try {
        await userPreferences.setPaymentFullRetakeCompleted(false);
        clientLogger.log('🔄 Full retake payment flag cleared');
      } catch (err) {
        clientLogger.warn('Failed to clear full retake payment flag:', err);
      }

      // Полное перепрохождение
      setShowRetakeScreen(false);
      setIsRetakingQuiz(true);
      setIsStartingOver(true);
      isStartingOverRef.current = true;

      // Полный сброс ответов и прогресса
      setAnswers({});
      setSavedProgress(null);
      // Убрано: setShowResumeScreen управляется только через resumeLocked
      setHasResumed(false);
      hasResumedRef.current = false;

    autoSubmitTriggeredRef.current = false;
    setAutoSubmitTriggered(false);
    setError(null);

    // Очищаем флаги перепрохождения в БД
    try {
      await userPreferences.setIsRetakingQuiz(false);
      await userPreferences.setFullRetakeFromHome(false);
    } catch (err) {
      clientLogger.warn('Failed to clear retake flags:', err);
    }

    // Начинаем анкету с самого начала
    if (questionnaire) {
      setCurrentInfoScreenIndex(0);
      setCurrentQuestionIndex(0);
      setPendingInfoScreen(null);
      clientLogger.log('✅ Full retake: answers and progress cleared, starting from first info screen');
    }
    } catch (error) {
      // Логируем ошибку и показываем пользователю
      clientLogger.error('❌ handleFullRetake failed in QuizRetakeScreen', {
        error: error instanceof Error ? error.message : String(error),
      });

      // Показываем ошибку пользователю
      setError('Не удалось начать полное перепрохождение анкеты. Попробуйте ещё раз.');
    }
  };

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

      {/* Список тем */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        marginBottom: '24px',
      }}>
        {retakeTopics.map((topic) => {
          const topicButton = (
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
          );
          
          return (
            <PaymentGate
              key={topic.id}
              price={49}
              productCode="retake_topic"
              isRetaking={true}
              onPaymentComplete={() => {
                clientLogger.log('✅ Retake topic payment completed, navigating to topic', { topicId: topic.id });
                router.push(`/quiz/update/${topic.id}`);
              }}
            >
              {topicButton}
            </PaymentGate>
          );
        })}
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
              setHasFullRetakePayment(hasRetakeFull);
              clientLogger.log('✅ Full retake payment completed, entitlements updated', { hasRetakeFull });
            } catch (err) {
              clientLogger.warn('⚠️ Failed to refresh entitlements after payment, using fallback', err);
              try {
                await userPreferences.setPaymentFullRetakeCompleted(true);
                setHasFullRetakePayment(true);
              } catch (err) {
                clientLogger.warn('Failed to save full retake payment flag:', err);
              }
            }
            
            // После оплаты разрешаем полное перепрохождение
            setShowRetakeScreen(false);
            setIsRetakingQuiz(true);
            if (questionnaire) {
              const initialInfoScreens = getInitialInfoScreens();
              setCurrentInfoScreenIndex(initialInfoScreens.length);
              setCurrentQuestionIndex(0);
              setPendingInfoScreen(null);
              clientLogger.log('✅ Full retake payment: Skipping all info screens, starting from first question');
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
          onClick={handleFullRetake}
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
          onClick={() => router.push('/plan')}
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
