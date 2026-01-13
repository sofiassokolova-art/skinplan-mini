// lib/quiz/handlers/handleAnswer.ts
// Вынесена функция handleAnswer из quiz/page.tsx для улучшения читаемости и поддержки

import { clientLogger } from '@/lib/client-logger';
import type { Question } from '@/lib/quiz/types';

export interface HandleAnswerParams {
  questionId: number;
  value: string | string[];
  currentQuestion: Question | null;
  answers: Record<number, string | string[]>;
  setAnswers: React.Dispatch<React.SetStateAction<Record<number, string | string[]>>>;
  saveProgress: (answers: Record<number, string | string[]>, questionIndex: number, infoScreenIndex: number) => Promise<void>;
  currentQuestionIndex: number;
  currentInfoScreenIndex: number;
  addDebugLog?: (message: string, context?: any) => void;
}

export async function handleAnswer({
  questionId,
  value,
  currentQuestion,
  answers,
  setAnswers,
  saveProgress,
  currentQuestionIndex,
  currentInfoScreenIndex,
  addDebugLog,
}: HandleAnswerParams): Promise<void> {
  if (addDebugLog) {
    addDebugLog('💾 handleAnswer called', { 
      questionId, 
      questionIdType: typeof questionId,
      value,
      currentQuestion: currentQuestion?.id,
      currentQuestionIndex,
    });
  }
  
  // Обновляем ответы
  setAnswers((prev) => {
    const newAnswers = { ...prev, [questionId]: value };
    
    // Сохраняем прогресс асинхронно (не блокируем обновление UI)
    saveProgress(newAnswers, currentQuestionIndex, currentInfoScreenIndex).catch((err) => {
      clientLogger.warn('⚠️ Ошибка при сохранении прогресса в handleAnswer:', err);
    });
    
    return newAnswers;
  });
  
  if (addDebugLog) {
    addDebugLog('✅ handleAnswer completed', { 
      questionId, 
      value,
      newAnswersCount: Object.keys({ ...answers, [questionId]: value }).length,
    });
  }
}

