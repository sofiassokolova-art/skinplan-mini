// lib/quiz/types.ts
// Централизованные типы для quiz
// Единый источник истины для всех типов, связанных с анкетой

/**
 * Типы вопросов анкеты
 */
export type QuestionType = 
  | 'single_choice'
  | 'multi_choice'
  | 'scale'
  | 'free_text'
  | 'tinder'
  | 'initial_info'
  | 'single' // Для обратной совместимости
  | 'multi' // Для обратной совместимости
  | 'input' // Для обратной совместимости
  | 'slider' // Для обратной совместимости
  | 'date'; // Для обратной совместимости

/**
 * Опция ответа на вопрос
 */
export interface QuestionOption {
  id: number;
  value: string;
  label: string;
}

/**
 * Вопрос анкеты
 */
export interface Question {
  id: number;
  code: string;
  text: string;
  type: QuestionType | string; // string для обратной совместимости
  isRequired: boolean;
  options?: QuestionOption[];
  min?: number;
  max?: number;
  step?: number;
  placeholder?: string;
  position?: number;
  groupId?: number;
}

/**
 * Группа вопросов
 */
export interface QuestionGroup {
  id: number;
  title: string;
  position?: number;
  questions: Question[];
}

/**
 * Анкета
 */
export interface Questionnaire {
  id: number;
  name: string;
  version: number;
  isActive?: boolean;
  groups: QuestionGroup[];
  questions: Question[];
  metadata?: {
    preferences?: {
      hasPlanProgress?: boolean;
      isRetakingQuiz?: boolean;
      fullRetakeFromHome?: boolean;
      paymentRetakingCompleted?: boolean;
      paymentFullRetakeCompleted?: boolean;
    };
  };
}

/**
 * Сохраненный прогресс анкеты
 */
export interface SavedProgress {
  answers: Record<number, string | string[]>;
  questionIndex: number;
  infoScreenIndex: number;
  timestamp?: number;
}

/**
 * Состояние анкеты
 */
export interface QuizState {
  questionnaire: Questionnaire | null;
  currentQuestionIndex: number;
  currentInfoScreenIndex: number;
  answers: Record<number, string | string[]>;
  savedProgress: SavedProgress | null;
  loading: boolean;
  error: string | null;
  isRetakingQuiz: boolean;
  showRetakeScreen: boolean;
  hasResumed: boolean;
}

/**
 * Типы для навигации по анкете
 */
export type QuizView =
  | 'loading'
  | 'info'
  | 'question'
  | 'resume'
  | 'retake'
  | 'submitting'
  | 'error';

export type FinalizingStep = 'answers' | 'plan' | 'done';

