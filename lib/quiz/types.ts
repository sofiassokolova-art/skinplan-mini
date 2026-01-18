// lib/quiz/types.ts
// Типы для анкеты и связанных структур

export interface AnswerOption {
  id: number;
  value: string;
  label: string;
  position: number;
}

export interface Question {
  id: number;
  code: string;
  text: string;
  type: 'single_choice' | 'multi_choice' | 'scale' | 'free_text';
  position: number;
  isRequired: boolean;
  description: string | null;
  options: AnswerOption[];
  min?: number;
  max?: number;
}

export interface QuestionGroup {
  id: number;
  title: string;
  position: number;
  questions: Question[];
}

export interface QuestionnaireMeta {
  shouldRedirectToPlan: boolean;
  isCompleted: boolean;
  hasProfile: boolean;
  preferences: {
    hasPlanProgress: boolean;
    isRetakingQuiz: boolean;
    fullRetakeFromHome: boolean;
    paymentRetakingCompleted: boolean;
    paymentFullRetakeCompleted: boolean;
  };
}

export interface SavedProgress {
  answers: Record<number, string | string[]>;
  questionIndex: number;
  infoScreenIndex: number;
}

export interface Questionnaire {
  id: number;
  name: string;
  version: number;
  groups: QuestionGroup[];
  questions: Question[]; // вопросы без группы
  _meta?: QuestionnaireMeta;
}