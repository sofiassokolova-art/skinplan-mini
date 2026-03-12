// lib/quiz/quizSteps.ts
// Единый источник правды для порядка шагов анкеты: вопросы + инфо-экраны между ними.
// Используется в handleNext и handleBack для согласованной навигации без дублирования логики.

import type { Question } from '@/lib/quiz/types';
import {
  getInfoScreenAfterQuestion,
  walkInfoScreenChain,
  type InfoScreen,
} from '@/app/(miniapp)/quiz/info-screens';

export type QuizStep =
  | { type: 'question'; question: Question; questionIndex: number }
  | { type: 'info'; infoScreen: InfoScreen };

/**
 * Строит канонический список шагов: вопросы в порядке allQuestions,
 * после каждого вопроса — цепочка инфо-экранов (если есть showAfterQuestionCode).
 * Порядок совпадает с ожидаемым UX: после avoid_ingredients идут ai_showcase → habits_matter, затем makeup_frequency.
 */
export function getQuizSteps(allQuestions: Question[]): QuizStep[] {
  const steps: QuizStep[] = [];
  for (let i = 0; i < allQuestions.length; i++) {
    const question = allQuestions[i];
    steps.push({ type: 'question', question, questionIndex: i });
    const firstInfo = question?.code ? getInfoScreenAfterQuestion(question.code) : undefined;
    if (firstInfo) {
      const chain = walkInfoScreenChain(firstInfo);
      for (const infoScreen of chain) {
        steps.push({ type: 'info', infoScreen });
      }
    }
  }

  // ФИКС: Гарантируем канонический порядок для блока вокруг avoid_ingredients.
  // После вопроса avoid_ingredients должны идти инфо-экраны ai_showcase → habits_matter,
  // а уже затем вопросы про привычки (makeup_frequency, spf_frequency, sun_exposure, lifestyle_habits).
  const avoidIdx = steps.findIndex(
    (s) => s.type === 'question' && (s.question as any)?.code === 'avoid_ingredients'
  );
  const aiIdx = steps.findIndex(
    (s) => s.type === 'info' && (s.infoScreen as any)?.id === 'ai_showcase'
  );
  const habitsIdx = steps.findIndex(
    (s) => s.type === 'info' && (s.infoScreen as any)?.id === 'habits_matter'
  );

  if (avoidIdx !== -1 && aiIdx !== -1) {
    // Собираем цепочку инфо-экранов (ai_showcase, habits_matter), которые хотим вставить сразу после avoid_ingredients
    const infoChain: QuizStep[] = [];
    if (aiIdx !== -1) infoChain.push(steps[aiIdx]);
    if (habitsIdx !== -1) infoChain.push(steps[habitsIdx]);

    // Удаляем их из текущего положения (начиная с большего индекса, чтобы не сбивать позиции)
    const removeIndices = [aiIdx, habitsIdx].filter((i) => i !== -1).sort((a, b) => b - a);
    for (const idx of removeIndices) {
      steps.splice(idx, 1);
    }

    // Вставляем цепочку сразу после avoid_ingredients
    steps.splice(avoidIdx + 1, 0, ...infoChain);
  }

  return steps;
}

/**
 * Возвращает индекс текущего шага в steps по текущему состоянию (индекс вопроса и опциональный pending info).
 */
export function getCurrentStepIndex(
  steps: QuizStep[],
  currentQuestionIndex: number,
  pendingInfoScreen: InfoScreen | null
): number {
  if (pendingInfoScreen) {
    const idx = steps.findIndex(
      (s) => s.type === 'info' && s.infoScreen.id === pendingInfoScreen.id
    );
    if (idx >= 0) return idx;
  }
  const questionStepIdx = steps.findIndex(
    (s) => s.type === 'question' && s.questionIndex === currentQuestionIndex
  );
  if (questionStepIdx >= 0) return questionStepIdx;
  return Math.min(
    Math.max(0, currentQuestionIndex),
    steps.length - 1
  );
}

/**
 * Следующий шаг (или null, если текущий — последний).
 */
export function getNextStep(
  steps: QuizStep[],
  currentQuestionIndex: number,
  pendingInfoScreen: InfoScreen | null
): QuizStep | null {
  const idx = getCurrentStepIndex(steps, currentQuestionIndex, pendingInfoScreen);
  if (idx < 0 || idx >= steps.length - 1) return null;
  return steps[idx + 1] ?? null;
}

/**
 * Предыдущий шаг (или null, если текущий — первый).
 */
export function getPrevStep(
  steps: QuizStep[],
  currentQuestionIndex: number,
  pendingInfoScreen: InfoScreen | null
): QuizStep | null {
  const idx = getCurrentStepIndex(steps, currentQuestionIndex, pendingInfoScreen);
  if (idx <= 0) return null;
  return steps[idx - 1] ?? null;
}
