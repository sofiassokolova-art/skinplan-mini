// lib/quiz/quiz-state-machine.ts
// ИСПРАВЛЕНО: Finite State Machine для управления состоянием анкеты
// Заменяет множественные boolean флаги на единую FSM

// Импорты React удалены - хук useQuizStateMachine вынесен в отдельный файл

import type { Questionnaire } from './types';

export type QuizState =
  | 'LOADING'           // Загрузка анкеты
  | 'INTRO'             // Информационные экраны перед вопросами
  | 'RESUME'            // Экран "Продолжить анкету"
  | 'QUESTIONS'         // Прохождение вопросов
  | 'RETAKE_SELECT'     // Экран выбора тем для перепрохождения
  | 'SUBMITTING'        // Отправка ответов и финализация
  | 'DONE';             // Анкета завершена

export type QuizEvent =
  | 'QUESTIONNAIRE_LOADED'
  | 'SHOW_RESUME'
  | 'RESUME_CLICKED'
  | 'START_QUIZ'
  | 'SHOW_RETAKE'
  | 'RETAKE_SELECTED'
  | 'FULL_RETAKE'
  | 'QUESTION_ANSWERED'
  | 'ALL_QUESTIONS_ANSWERED'
  | 'SUBMIT_STARTED'
  | 'SUBMIT_SUCCESS'
  | 'SUBMIT_ERROR'
  | 'RESET';

interface StateTransition {
  from: QuizState;
  event: QuizEvent;
  to: QuizState;
  guard?: () => boolean;
}

const transitions: StateTransition[] = [
  // Загрузка
  { from: 'LOADING', event: 'QUESTIONNAIRE_LOADED', to: 'INTRO' },
  { from: 'LOADING', event: 'SHOW_RESUME', to: 'RESUME' },
  { from: 'LOADING', event: 'SHOW_RETAKE', to: 'RETAKE_SELECT' },

  // Интро
  { from: 'INTRO', event: 'START_QUIZ', to: 'QUESTIONS' },
  { from: 'INTRO', event: 'SHOW_RESUME', to: 'RESUME' },

  // Resume
  { from: 'RESUME', event: 'RESUME_CLICKED', to: 'QUESTIONS' },
  { from: 'RESUME', event: 'START_QUIZ', to: 'QUESTIONS' },

  // Questions
  { from: 'QUESTIONS', event: 'QUESTION_ANSWERED', to: 'QUESTIONS' },
  { from: 'QUESTIONS', event: 'ALL_QUESTIONS_ANSWERED', to: 'SUBMITTING' },
  { from: 'QUESTIONS', event: 'SUBMIT_STARTED', to: 'SUBMITTING' },

  // Retake Select
  { from: 'RETAKE_SELECT', event: 'RETAKE_SELECTED', to: 'QUESTIONS' },
  { from: 'RETAKE_SELECT', event: 'FULL_RETAKE', to: 'QUESTIONS' },

  // Submitting
  { from: 'SUBMITTING', event: 'SUBMIT_SUCCESS', to: 'DONE' },
  { from: 'SUBMITTING', event: 'SUBMIT_ERROR', to: 'QUESTIONS' },

  // Reset
  { from: 'DONE', event: 'RESET', to: 'LOADING' },
  { from: 'QUESTIONS', event: 'RESET', to: 'LOADING' },
  { from: 'SUBMITTING', event: 'RESET', to: 'LOADING' },
];

// ИСПРАВЛЕНО: Добавляем хранение questionnaire в State Machine
// Это гарантирует, что questionnaire не будет случайно сброшен

export class QuizStateMachine {
  private state: QuizState = 'LOADING';
  private listeners: Set<(state: QuizState) => void> = new Set();
  // ИСПРАВЛЕНО: Храним questionnaire в State Machine для защиты от случайного сброса
  private questionnaire: Questionnaire | null = null;
  private questionnaireListeners: Set<(questionnaire: Questionnaire | null) => void> = new Set();

  constructor(initialState: QuizState = 'LOADING') {
    this.state = initialState;
  }

  getState(): QuizState {
    return this.state;
  }

  dispatch(event: QuizEvent): boolean {
    const transition = transitions.find(
      t => t.from === this.state && t.event === event && (!t.guard || t.guard())
    );

    if (!transition) {
      console.warn(`No transition found for event ${event} from state ${this.state}`);
      return false;
    }

    const oldState = this.state;
    this.state = transition.to;
    
    this.listeners.forEach(listener => listener(this.state));
    
    console.log(`State transition: ${oldState} --[${event}]--> ${this.state}`);
    
    return true;
  }

  subscribe(listener: (state: QuizState) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  canTransition(event: QuizEvent): boolean {
    return transitions.some(
      t => t.from === this.state && t.event === event && (!t.guard || t.guard())
    );
  }

  // ИСПРАВЛЕНО: Методы для управления questionnaire
  setQuestionnaire(questionnaire: Questionnaire | null): void {
    // КРИТИЧНО: Если questionnaire уже установлен, не позволяем установить null
    // Это защищает от случайного сброса после загрузки
    if (this.questionnaire !== null && questionnaire === null) {
      const currentId = this.questionnaire?.id;
      console.warn('⚠️ [State Machine] Attempted to set questionnaire to null when it is already loaded. Ignoring.', {
        currentQuestionnaireId: currentId,
        stackTrace: new Error().stack,
      });
      // ИСПРАВЛЕНО: Логируем в clientLogger для отправки в БД
      if (typeof window !== 'undefined' && (window as any).clientLogger) {
        (window as any).clientLogger.warn('⚠️ [State Machine] Attempted to set questionnaire to null when it is already loaded', {
          currentQuestionnaireId: currentId,
        });
      }
      return;
    }
    
    const oldQuestionnaire = this.questionnaire;
    this.questionnaire = questionnaire;
    
    // Уведомляем слушателей об изменении questionnaire
    this.questionnaireListeners.forEach(listener => listener(this.questionnaire));
    
    if (oldQuestionnaire !== questionnaire) {
      const logMessage = questionnaire 
        ? `[State Machine] Questionnaire set: ID ${questionnaire.id}` 
        : `[State Machine] Questionnaire cleared: null`;
      console.log(logMessage);
      
      // ИСПРАВЛЕНО: Логируем в clientLogger для отправки в БД
      if (typeof window !== 'undefined' && (window as any).clientLogger) {
        (window as any).clientLogger.log(logMessage, {
          questionnaireId: questionnaire?.id || null,
          previousQuestionnaireId: oldQuestionnaire?.id || null,
        });
      }
    }
  }

  getQuestionnaire(): Questionnaire | null {
    return this.questionnaire;
  }

  subscribeToQuestionnaire(listener: (questionnaire: Questionnaire | null) => void): () => void {
    this.questionnaireListeners.add(listener);
    // Вызываем сразу с текущим значением
    listener(this.questionnaire);
    return () => {
      this.questionnaireListeners.delete(listener);
    };
  }

  // ИСПРАВЛЕНО: Метод для сброса questionnaire (только при явном сбросе State Machine)
  resetQuestionnaire(): void {
    this.questionnaire = null;
    this.questionnaireListeners.forEach(listener => listener(null));
  }
}

// ИСПРАВЛЕНО: React hook useQuizStateMachine вынесен в lib/quiz/hooks/useQuizStateMachine.ts
// Используйте импорт: import { useQuizStateMachine } from '@/lib/quiz/hooks';

