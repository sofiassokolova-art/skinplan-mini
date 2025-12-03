// lib/constants.ts
// Константы приложения

// Retry и таймауты
export const MAX_RETRY_ATTEMPTS = 3;
export const RETRY_DELAY_MS = 2000;
export const INIT_DATA_WAIT_MAX_ATTEMPTS = 20;
export const INIT_DATA_WAIT_INTERVAL_MS = 100;

// План ухода
export const PLAN_DAYS_TOTAL = 28;
export const PLAN_WEEKS_TOTAL = 4;
export const PLAN_DAYS_PER_WEEK = 7;

// Продукты
export const DEFAULT_MAX_PRODUCTS_PER_STEP = 3;
export const PRODUCT_SELECTION_MULTIPLIER = 2; // Берем в 2 раза больше для сортировки
export const MIN_PRODUCTS_FOR_STEP = 1;

// Кэширование
export const CACHE_TTL_DEFAULT = 3600; // 1 час
export const CACHE_TTL_PLAN = 86400; // 24 часа
export const CACHE_TTL_RECOMMENDATIONS = 3600; // 1 час
export const CACHE_TTL_SKIN_ISSUES = 3600; // 1 час

// Бюджетные сегменты
export const BUDGET_TIER_LOW = 2000;
export const BUDGET_TIER_MID = 5000;

// Telegram Bot API
export const TELEGRAM_RATE_LIMIT_MESSAGES_PER_SECOND = 30;
export const TELEGRAM_RANDOM_DELAY_MIN_MS = 50;
export const TELEGRAM_RANDOM_DELAY_MAX_MS = 100;
export const TELEGRAM_BROADCAST_UPDATE_INTERVAL = 10; // Обновлять счетчики каждые N сообщений

// Валидация
export const MIN_QUESTIONNAIRE_ANSWERS = 1;
export const MAX_DUPLICATE_SUBMISSION_WINDOW_MS = 5000; // 5 секунд

// Skin Issues Severity
export const SEVERITY_SCORE_LOW = 30;
export const SEVERITY_SCORE_MEDIUM = 55;
export const SEVERITY_SCORE_HIGH = 80;
export const SEVERITY_SCORE_CRITICAL = 90;

// Skin Profile
export const DEFAULT_ACNE_LEVEL = 0;
export const DEFAULT_SENSITIVITY_LEVEL = 'low';

