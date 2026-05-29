// scripts/setup-telegram-webhook.ts
// Скрипт для установки webhook для Telegram бота

import 'dotenv/config';

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_SECRET_TOKEN = process.env.TELEGRAM_SECRET_TOKEN;
const WEBHOOK_URL = process.env.TELEGRAM_WEBHOOK_URL ||
  (process.env.CF_PAGES_URL
    ? `https://${process.env.CF_PAGES_URL}/api/telegram/webhook`
    : process.env.APP_URL
    ? `${process.env.APP_URL}/api/telegram/webhook`
    : (() => { throw new Error('Set TELEGRAM_WEBHOOK_URL or APP_URL in .env'); })());

async function setWebhook() {
  if (!TELEGRAM_BOT_TOKEN) {
    console.error('❌ TELEGRAM_BOT_TOKEN не найден в .env');
    console.error('💡 Добавьте TELEGRAM_BOT_TOKEN в .env файл');
    process.exit(1);
  }

  console.log('🔧 Устанавливаю webhook для Telegram бота...');
  console.log('📍 URL:', WEBHOOK_URL);
  if (TELEGRAM_SECRET_TOKEN) {
    console.log('🔐 Секретный токен: установлен');
  }

  try {
    const url = new URL('https://api.telegram.org/bot' + TELEGRAM_BOT_TOKEN + '/setWebhook');
    url.searchParams.set('url', WEBHOOK_URL);
    if (TELEGRAM_SECRET_TOKEN) {
      url.searchParams.set('secret_token', TELEGRAM_SECRET_TOKEN);
    }
    // Разрешаем только команды
    url.searchParams.set('allowed_updates', JSON.stringify(['message']));

    console.log('📡 Отправляю запрос:', url.toString().replace(TELEGRAM_BOT_TOKEN, '***'));

    const response = await fetch(url.toString(), { method: 'GET' });
    const data = await response.json();

    if (data.ok) {
      console.log('✅ Webhook успешно установлен!');
      console.log('📋 Информация:', JSON.stringify(data, null, 2));
      
      // Проверяем статус вебхука
      const checkUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getWebhookInfo`;
      const checkResponse = await fetch(checkUrl);
      const checkData = await checkResponse.json();
      
      if (checkData.ok) {
        console.log('\n📊 Статус вебхука:');
        console.log('   URL:', checkData.result.url);
        console.log('   Pending updates:', checkData.result.pending_update_count);
        console.log('   Last error:', checkData.result.last_error_message || 'нет');
      }
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

