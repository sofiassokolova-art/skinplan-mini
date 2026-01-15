// lib/quiz/config/quizConfig.ts
// Централизованная конфигурация для quiz
// Убирает магические числа и строки, улучшает поддерживаемость

export const QUIZ_CONFIG = {
  // Таймауты (в миллисекундах)
  TIMEOUTS: {
    TELEGRAM_WAIT: 5000, // Ожидание инициализации Telegram WebApp
    PROGRESS_LOAD: 5000, // Таймаут загрузки прогресса
    QUESTIONNAIRE_LOAD: 10000, // Таймаут загрузки анкеты
    FALLBACK_LOADER: 10000, // Таймаут для fallback лоадера
    QUESTIONNAIRE_CACHE: 600000, // 10 минут кэш для анкеты в API клиенте
  },
  
  // Кэширование React Query (в миллисекундах)
  REACT_QUERY: {
    QUESTIONNAIRE_STALE_TIME: 10 * 60 * 1000, // 10 минут (анкета редко меняется)
    QUESTIONNAIRE_GC_TIME: 30 * 60 * 1000, // 30 минут в кэше
    PROGRESS_STALE_TIME: 2 * 60 * 1000, // 2 минуты
    PROGRESS_GC_TIME: 10 * 60 * 1000, // 10 минут в кэше
  },
  
  // SessionStorage keys
  STORAGE_KEYS: {
    CURRENT_INFO_SCREEN: 'quiz_currentInfoScreenIndex',
    CURRENT_QUESTION: 'quiz_currentQuestionIndex',
    INIT_CALLED: 'quiz_initCalled',
    JUST_SUBMITTED: 'quiz_just_submitted',
  },
  
  // Логирование
  LOGGING: {
    ENABLED: process.env.NODE_ENV === 'development',
    SEND_TO_SERVER: true,
    // Частые логи, которые не нужно отправлять на сервер в production
    FREQUENT_LOG_PATTERNS: [
      '🔍 Quiz page render - checking what to display',
      '📺 Рендерим начальный инфо-экран',
      '📊 allQuestions state updated',
      '💾 allQuestionsPrevRef updated',
      '🔍 isShowingInitialInfoScreen: вычисление',
      '⏸️ currentQuestion: null',
      '🔍 Состояние рендера анкеты',
    ],
  },
  
  // Валидация
  VALIDATION: {
    MIN_ANSWERS_FOR_PROGRESS_SCREEN: 2, // Минимум ответов для показа экрана прогресса (больше 1, т.к. 1 - это только имя)
    MIN_QUESTION_INDEX_FOR_PROGRESS_SCREEN: 2, // Минимум индекс вопроса для показа экрана прогресса
  },
  
  // Retry настройки
  RETRY: {
    QUESTIONNAIRE_MAX_ATTEMPTS: 2, // Максимум попыток для загрузки анкеты
    PROGRESS_MAX_ATTEMPTS: 1, // Максимум попыток для загрузки прогресса
    SAVE_PROGRESS_MAX_ATTEMPTS: 1, // Максимум попыток для сохранения прогресса
  },
} as const;

// Типы для конфигурации
export type QuizConfig = typeof QUIZ_CONFIG;

