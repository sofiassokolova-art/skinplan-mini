// scripts/setup-telegram-webhook.ts
// Скрипт для установки webhook для Telegram бота

// Загружаем переменные окружения из .env
// Используем динамический импорт для dotenv, если установлен

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_SECRET_TOKEN = process.env.TELEGRAM_SECRET_TOKEN;
const WEBHOOK_URL = process.env.TELEGRAM_WEBHOOK_URL || process.env.VERCEL_URL 
  ? `https://${process.env.VERCEL_URL}/api/telegram/webhook`
  : 'https://skinplan-mini.vercel.app/api/telegram/webhook';

async function setWebhook() {
  if (!TELEGRAM_BOT_TOKEN) {
    console.error('❌ TELEGRAM_BOT_TOKEN не найден в .env');
    process.exit(1);
  }

  const url = `${WEBHOOK_URL}${TELEGRAM_SECRET_TOKEN ? `?secret_token=${TELEGRAM_SECRET_TOKEN}` : ''}`;

  console.log('🔧 Устанавливаю webhook для Telegram бота...');
  console.log('📍 URL:', WEBHOOK_URL);

  try {
    const response = await fetch(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook?url=${encodeURIComponent(WEBHOOK_URL)}${TELEGRAM_SECRET_TOKEN ? `&secret_token=${TELEGRAM_SECRET_TOKEN}` : ''}`,
      { method: 'GET' }
    );

    const data = await response.json();

    if (data.ok) {
      console.log('✅ Webhook успешно установлен!');
      console.log('📋 Информация:', JSON.stringify(data, null, 2));
    } else {
      console.error('❌ Ошибка установки webhook:', data);
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Ошибка:', error);
    process.exit(1);
  }
}

setWebhook();

