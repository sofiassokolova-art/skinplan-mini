// lib/quiz/types.ts
// Улучшенная типизация для анкеты

export type QuestionType = 'single' | 'multi' | 'input' | 'tinder' | 'slider' | 'date';

export interface QuestionOption {
  id: number;
  value: string;
  label: string;
}

export interface Question {
  id: number;
  code: string;
  text: string;
  type: QuestionType; // ИСПРАВЛЕНО: строгая типизация вместо string
  isRequired: boolean;
  options?: QuestionOption[];
  min?: number;
  max?: number;
  step?: number;
  placeholder?: string;
}

export interface QuestionGroup {
  id: number;
  title: string;
  questions: Question[];
}

export interface Questionnaire {
  id: number;
  name: string;
  version: number;
  groups: QuestionGroup[];
  questions: Question[];
}

export interface SavedProgress {
  answers: Record<number, string | string[]>;
  questionIndex: number;
  infoScreenIndex: number;
}

export type QuizView =
  | 'loading'
  | 'info'
  | 'question'
  | 'resume'
  | 'retake'
  | 'submitting'
  | 'error';

export type FinalizingStep = 'answers' | 'plan' | 'done';

