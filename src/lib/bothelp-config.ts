/**
 * Конфигурация для BotHelp API
 * Разделение на тестовую и продакшн среду
 */

export interface BotHelpEnvironment {
  isTest: boolean;
  botId: string;
  secret: string;
  baseUrl: string;
  webhookUrl?: string;
}

// Тестовая среда
export const TEST_ENVIRONMENT: BotHelpEnvironment = {
  isTest: true,
  botId: '300658:b15c4f51bffd31f6667e50f37a20a025',
  secret: '300658:c5d3ccb085f4a1fb6dd0984da2514a52',
  baseUrl: 'https://api.bothelp.io', // или тестовый URL
  webhookUrl: 'https://your-test-domain.com/webhook/bothelp', // замените на ваш тестовый домен
};

// Продакшн среда (НЕ ИСПОЛЬЗУЙТЕ ПОКА!)
export const PRODUCTION_ENVIRONMENT: BotHelpEnvironment = {
  isTest: false,
  botId: 'PRODUCTION_BOT_ID', // Замените на продакшн ID
  secret: 'PRODUCTION_SECRET', // Замените на продакшн Secret
  baseUrl: 'https://api.bothelp.io',
  webhookUrl: 'https://your-production-domain.com/webhook/bothelp', // замените на продакшн домен
};

// Текущая среда (по умолчанию тестовая)
export const CURRENT_ENVIRONMENT: BotHelpEnvironment = TEST_ENVIRONMENT;

// Функция для переключения между средами
export function setEnvironment(isTest: boolean): BotHelpEnvironment {
  if (isTest) {
    console.log('🧪 Переключение на тестовую среду');
    return TEST_ENVIRONMENT;
  } else {
    console.log('⚠️ ВНИМАНИЕ: Переключение на продакшн среду!');
    console.log('🔒 Убедитесь, что вы готовы к работе с реальными пользователями!');
    return PRODUCTION_ENVIRONMENT;
  }
}

// Проверка безопасности
export function validateEnvironment(env: BotHelpEnvironment): boolean {
  if (!env.isTest) {
    // Проверки для продакшн среды
    if (env.botId === 'PRODUCTION_BOT_ID' || env.secret === 'PRODUCTION_SECRET') {
      console.error('❌ ОШИБКА: Не настроены продакшн credentials!');
      return false;
    }
    
    if (env.webhookUrl?.includes('your-production-domain.com')) {
      console.error('❌ ОШИБКА: Не настроен продакшн webhook URL!');
      return false;
    }
  }
  
  return true;
}

// Получение текущей конфигурации с проверкой
export function getCurrentConfig(): BotHelpEnvironment {
  const config = CURRENT_ENVIRONMENT;
  
  if (!validateEnvironment(config)) {
    console.warn('⚠️ Проблемы с конфигурацией, используем тестовую среду');
    return TEST_ENVIRONMENT;
  }
  
  return config;
}

// Логирование конфигурации (безопасно)
export function logConfig(env: BotHelpEnvironment): void {
  console.log('📋 Конфигурация BotHelp:');
  console.log(`   Режим: ${env.isTest ? '🧪 Тестовый' : '🚀 Продакшн'}`);
  console.log(`   Bot ID: ${env.botId.substring(0, 10)}...`);
  console.log(`   Secret: ${env.secret.substring(0, 10)}...`);
  console.log(`   Base URL: ${env.baseUrl}`);
  if (env.webhookUrl) {
    console.log(`   Webhook: ${env.webhookUrl}`);
  }
}

// Переменные окружения (для .env файла)
export const ENV_VARIABLES = {
  BOTHELP_BOT_ID: 'BOTHELP_BOT_ID',
  BOTHELP_SECRET: 'BOTHELP_SECRET',
  BOTHELP_BASE_URL: 'BOTHELP_BASE_URL',
  BOTHELP_WEBHOOK_URL: 'BOTHELP_WEBHOOK_URL',
  BOTHELP_TEST_MODE: 'BOTHELP_TEST_MODE',
};

// Функция для загрузки конфигурации из переменных окружения
export function loadConfigFromEnv(): BotHelpEnvironment {
  const isTest = process.env[ENV_VARIABLES.BOTHELP_TEST_MODE] !== 'false';
  
  return {
    isTest,
    botId: process.env[ENV_VARIABLES.BOTHELP_BOT_ID] || TEST_ENVIRONMENT.botId,
    secret: process.env[ENV_VARIABLES.BOTHELP_SECRET] || TEST_ENVIRONMENT.secret,
    baseUrl: process.env[ENV_VARIABLES.BOTHELP_BASE_URL] || TEST_ENVIRONMENT.baseUrl,
    webhookUrl: process.env[ENV_VARIABLES.BOTHELP_WEBHOOK_URL] || TEST_ENVIRONMENT.webhookUrl,
  };
}

// Пример .env файла
export const ENV_EXAMPLE = `
# BotHelp Configuration
BOTHELP_BOT_ID=300658:b15c4f51bffd31f6667e50f37a20a025
BOTHELP_SECRET=300658:c5d3ccb085f4a1fb6dd0984da2514a52
BOTHELP_BASE_URL=https://api.bothelp.io
BOTHELP_WEBHOOK_URL=https://your-domain.com/webhook/bothelp
BOTHELP_TEST_MODE=true
`;

export default {
  TEST_ENVIRONMENT,
  PRODUCTION_ENVIRONMENT,
  CURRENT_ENVIRONMENT,
  setEnvironment,
  validateEnvironment,
  getCurrentConfig,
  logConfig,
  loadConfigFromEnv,
  ENV_VARIABLES,
  ENV_EXAMPLE
};


