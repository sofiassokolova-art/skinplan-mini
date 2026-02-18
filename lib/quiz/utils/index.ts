// lib/quiz/utils/index.ts
// Централизованный экспорт всех утилит для анкеты

export { calculateCurrentQuestion } from './calculateCurrentQuestion';
export type { CalculateCurrentQuestionParams } from './calculateCurrentQuestion';

export { calculateIsShowingInitialInfoScreen } from './calculateIsShowingInitialInfoScreen';
export type { CalculateIsShowingInitialInfoScreenParams } from './calculateIsShowingInitialInfoScreen';

export { calculateCorrectedQuestionIndex } from './calculateCorrectedQuestionIndex';
export type { CalculateCorrectedQuestionIndexParams, CorrectedQuestionIndexResult } from './calculateCorrectedQuestionIndex';

