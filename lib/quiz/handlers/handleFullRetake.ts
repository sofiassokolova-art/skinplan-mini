// lib/quiz/handlers/handleFullRetake.ts
// Обработчик полного перепрохождения анкеты

import { clientLogger } from '@/lib/client-logger';
import * as userPreferences from '@/lib/user-preferences';

interface HandleFullRetakeParams {
  hasFullRetakePayment: boolean;
  setShowRetakeScreen: (show: boolean) => void;
  setIsRetakingQuiz: (retaking: boolean) => void;
  setIsStartingOver: (starting: boolean) => void;
  isStartingOverRef: React.MutableRefObject<boolean>;
  setAnswers: (answers: Record<string, any>) => void;
  setSavedProgress: (progress: any) => void;
  setShowResumeScreen: (show: boolean) => void;
  setHasResumed: (resumed: boolean) => void;
  hasResumedRef: React.MutableRefObject<boolean>;
  autoSubmitTriggeredRef: React.MutableRefObject<boolean>;
  setAutoSubmitTriggered: (triggered: boolean) => void;
  setError: (error: string | null) => void;
  questionnaire: any;
  setCurrentInfoScreenIndex: (index: number) => void;
  setCurrentQuestionIndex: (index: number) => void;
  setPendingInfoScreen: (screen: any) => void;
}

/**
 * Обработчик полного перепрохождения анкеты
 */
export async function handleFullRetake({
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
  autoSubmitTriggeredRef,
  setAutoSubmitTriggered,
  setError,
  questionnaire,
  setCurrentInfoScreenIndex,
  setCurrentQuestionIndex,
  setPendingInfoScreen,
}: HandleFullRetakeParams): Promise<void> {
  if (!hasFullRetakePayment) {
    clientLogger.log('⚠️ Full retake payment not completed, showing payment gate');
    return;
  }

  clientLogger.log('✅ Full retake payment completed, starting full questionnaire reset');

  try {
    await userPreferences.setPaymentFullRetakeCompleted(false);
    clientLogger.log('🔄 Full retake payment flag cleared');
  } catch (err) {
    clientLogger.warn('Failed to clear full retake payment flag:', err);
  }

  setShowRetakeScreen(false);
  setIsRetakingQuiz(true);
  setIsStartingOver(true);
  isStartingOverRef.current = true;

  setAnswers({});
  setSavedProgress(null);
  // Убрано: setShowResumeScreen управляется только через resumeLocked
  setHasResumed(false);
  hasResumedRef.current = false;

  autoSubmitTriggeredRef.current = false;
  setAutoSubmitTriggered(false);
  setError(null);

  try {
    await userPreferences.setIsRetakingQuiz(false);
    await userPreferences.setFullRetakeFromHome(false);
  } catch (err) {
    clientLogger.warn('Failed to clear retake flags:', err);
  }

  if (questionnaire) {
    setCurrentInfoScreenIndex(0);
    setCurrentQuestionIndex(0);
    setPendingInfoScreen(null);
    clientLogger.log('✅ Full retake: answers and progress cleared, starting from first info screen');
  }
}
