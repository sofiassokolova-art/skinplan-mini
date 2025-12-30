// lib/quiz/quiz-state-machine.ts
// ИСПРАВЛЕНО: Finite State Machine для управления состоянием анкеты
// Заменяет множественные boolean флаги на единую FSM

// Импорты React удалены - хук useQuizStateMachine вынесен в отдельный файл

export type QuizState =
  | 'LOADING'           // Загрузка анкеты
  | 'INTRO'             // Информационные экраны перед вопросами
  | 'RESUME'            // Экран "Продолжить анкету"
  | 'QUESTIONS'         // Прохождение вопросов
  | 'RETAKE_SELECT'     // Экран выбора тем для перепрохождения
  | 'SUBMITTING'        // Отправка ответов
  | 'RECALCULATING'     // ИСПРАВЛЕНО: Пересчёт профиля и рекомендаций
  | 'REBUILDING_PLAN'   // ИСПРАВЛЕНО: Пересборка плана
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
  | 'PLAN_INVALIDATED'  // ИСПРАВЛЕНО: План инвалидирован, нужно пересобрать
  | 'PLAN_REBUILT'      // ИСПРАВЛЕНО: План успешно пересобран
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
  { from: 'SUBMITTING', event: 'SUBMIT_SUCCESS', to: 'RECALCULATING' }, // ИСПРАВЛЕНО: После успешной отправки переходим в RECALCULATING
  { from: 'SUBMITTING', event: 'SUBMIT_ERROR', to: 'QUESTIONS' },
  
  // Recalculating (профиль и рекомендации)
  { from: 'RECALCULATING', event: 'PLAN_INVALIDATED', to: 'REBUILDING_PLAN' }, // ИСПРАВЛЕНО: Если план нужно пересобрать
  { from: 'RECALCULATING', event: 'PLAN_REBUILT', to: 'DONE' }, // ИСПРАВЛЕНО: Если план не нужно пересобирать или уже пересобран
  { from: 'RECALCULATING', event: 'SUBMIT_ERROR', to: 'QUESTIONS' },
  
  // Rebuilding Plan
  { from: 'REBUILDING_PLAN', event: 'PLAN_REBUILT', to: 'DONE' }, // ИСПРАВЛЕНО: План пересобран, завершаем
  { from: 'REBUILDING_PLAN', event: 'SUBMIT_ERROR', to: 'QUESTIONS' },
  
  // Reset
  { from: 'DONE', event: 'RESET', to: 'LOADING' },
  { from: 'QUESTIONS', event: 'RESET', to: 'LOADING' },
  { from: 'RECALCULATING', event: 'RESET', to: 'LOADING' },
  { from: 'REBUILDING_PLAN', event: 'RESET', to: 'LOADING' },
];

// ИСПРАВЛЕНО: Добавляем хранение questionnaire в State Machine
// Это гарантирует, что questionnaire не будет случайно сброшен
type Questionnaire = any; // Используем any, так как тип может отличаться в разных местах

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
      console.warn('⚠️ Attempted to set questionnaire to null when it is already loaded. Ignoring.');
      return;
    }
    
    const oldQuestionnaire = this.questionnaire;
    this.questionnaire = questionnaire;
    
    // Уведомляем слушателей об изменении questionnaire
    this.questionnaireListeners.forEach(listener => listener(this.questionnaire));
    
    if (oldQuestionnaire !== questionnaire) {
      console.log(`Questionnaire ${questionnaire ? 'set' : 'cleared'}:`, 
        questionnaire ? `ID ${questionnaire.id}` : 'null');
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

