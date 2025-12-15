// lib/questionnaire-types.ts
// Общие типы для структуры анкеты (вопросы + группы вопросов)

export interface QuestionOption {
  id: number;
  value: string;
  label: string;
}

export interface Question {
  id: number;
  code: string;
  text: string;
  type: string;
  isRequired: boolean;
  options?: QuestionOption[];
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


