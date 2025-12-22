// lib/quiz/hooks/index.ts
// ИСПРАВЛЕНО: Экспорт всех хуков для анкеты
// Централизованный экспорт для удобства использования

export { useQuizState } from './useQuizState';
export { useQuizProgress } from './useQuizProgress';
export { useQuizAutoSubmit } from './useQuizAutoSubmit';
export { useQuizRetake } from './useQuizRetake';
export { useQuizInit } from './useQuizInit';
export { useResumeLogic } from './useResumeLogic';
