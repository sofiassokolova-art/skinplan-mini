// lib/env-check.ts
// Валидация обязательных переменных окружения при старте приложения

const REQUIRED_ENV_VARS = {
  // Критичные для работы приложения
  DATABASE_URL: 'Строка подключения к базе данных',
  TELEGRAM_BOT_TOKEN: 'Токен Telegram бота',
  
  // Для кэширования (опционально, но желательно)
  KV_REST_API_URL: 'Vercel KV REST API URL',
  KV_REST_API_TOKEN: 'Vercel KV REST API Token',
} as const;

const OPTIONAL_ENV_VARS = {
  JWT_SECRET: 'Секретный ключ для JWT (используется дефолт, если не установлен)',
  UPSTASH_REDIS_REST_URL: 'Upstash Redis URL (опционально, для rate limiting)',
  UPSTASH_REDIS_REST_TOKEN: 'Upstash Redis Token (опционально, для rate limiting)',
  SENTRY_DSN: 'Sentry DSN для мониторинга ошибок',
} as const;

export function validateEnv(): { valid: boolean; missing: string[]; warnings: string[] } {
  const missing: string[] = [];
  const warnings: string[] = [];

  // Проверяем обязательные переменные
  for (const [key, description] of Object.entries(REQUIRED_ENV_VARS)) {
    if (!process.env[key]) {
      missing.push(`${key} - ${description}`);
    }
  }

  // Предупреждения для опциональных, но важных переменных
  if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) {
    warnings.push('KV_REST_API_URL и KV_REST_API_TOKEN не установлены - кэширование будет отключено');
  }

  if (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'your-secret-key-change-in-production') {
    warnings.push('JWT_SECRET не установлен или использует дефолтное значение - это небезопасно для production');
  }

  return {
    valid: missing.length === 0,
    missing,
    warnings,
  };
}

export function logEnvStatus(): void {
  const { valid, missing, warnings } = validateEnv();

  if (!valid) {
    console.error('❌ Отсутствуют обязательные переменные окружения:');
    missing.forEach((msg) => console.error(`  - ${msg}`));
    console.error('\n⚠️ Приложение может работать некорректно!\n');
  }

  if (warnings.length > 0) {
    console.warn('⚠️ Предупреждения о переменных окружения:');
    warnings.forEach((msg) => console.warn(`  - ${msg}`));
    console.warn('');
  }

  if (valid && warnings.length === 0) {
    console.log('✅ Все переменные окружения настроены корректно\n');
  }
}

// Автоматически проверяем при импорте модуля (только на сервере)
if (typeof window === 'undefined' && process.env.NODE_ENV !== 'test') {
  logEnvStatus();
}

