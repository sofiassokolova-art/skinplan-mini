// lib/config/timeouts.ts
// Централизованная конфигурация таймаутов приложения
// РЕФАКТОРИНГ: Вынесены магические числа для лучшей поддерживаемости

/**
 * Таймауты для страницы плана
 */
export const PLAN_TIMEOUTS = {
  /** Максимальная длительность polling генерации плана */
  POLLING_MAX_DURATION: 120_000, // 2 минуты
  
  /** Интервал polling статуса плана */
  POLLING_INTERVAL: 1_500, // 1.5 секунды
  
  /** Абсолютный таймаут загрузки страницы плана */
  PAGE_ABSOLUTE: 35_000, // 35 секунд
  
  /** Таймаут генерации плана после которого загружаем план напрямую */
  GENERATION_TIMEOUT: 60_000, // 1 минута
  
  /** Минимальное время показа лоадера генерации */
  GENERATING_MIN_DISPLAY: 2_000, // 2 секунды
  
  /** Задержка перед повторной попыткой загрузки плана */
  RETRY_DELAY: 1_000, // 1 секунда
} as const;

/**
 * Таймауты для страницы анкеты (quiz)
 */
export const QUIZ_TIMEOUTS = {
  /** Абсолютный таймаут загрузки (forcing loading=false) */
  LOADING_ABSOLUTE: 15_000, // 15 секунд
  
  /** Таймаут ожидания Telegram WebApp */
  TELEGRAM_WAIT: 500, // 500ms
  
  /** Максимальное время ожидания Telegram WebApp */
  TELEGRAM_MAX_WAIT: 3_000, // 3 секунды
  
  /** Задержка дебаунса сохранения прогресса */
  SAVE_PROGRESS_DEBOUNCE: 500, // 500ms
  
  /** Задержка перед авто-сабмитом */
  AUTO_SUBMIT_DELAY: 500, // 500ms
  
  /** Задержка перед редиректом после сабмита */
  REDIRECT_DELAY: 100, // 100ms
} as const;

/**
 * Таймауты для API запросов
 */
export const API_TIMEOUTS = {
  /** Дефолтный таймаут для fetch запросов */
  DEFAULT_FETCH: 30_000, // 30 секунд
  
  /** Таймаут для отправки ответов анкеты */
  SUBMIT_ANSWERS: 60_000, // 1 минута
  
  /** Таймаут для генерации плана */
  GENERATE_PLAN: 120_000, // 2 минуты
  
  /** Таймаут для логирования */
  LOGGING: 5_000, // 5 секунд
} as const;

/**
 * TTL для кэширования
 */
export const CACHE_TTL = {
  /** Кэш preferences */
  PREFERENCES: 30_000, // 30 секунд
  
  /** Кэш анкеты */
  QUESTIONNAIRE: 600_000, // 10 минут
  
  /** Общий кэш API запросов */
  API_DEFAULT: 2_000, // 2 секунды
  
  /** Кэш профиля */
  PROFILE: 5_000, // 5 секунд
} as const;

/**
 * Таймауты для redirects
 */
export const REDIRECT_TIMEOUTS = {
  /** Сброс redirectInProgressRef после редиректа */
  RESET_FLAG: 1_000, // 1 секунда
  
  /** Задержка перед редиректом при ошибке */
  ERROR_DELAY: 3_000, // 3 секунды
} as const;
