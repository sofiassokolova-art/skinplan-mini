/**
 * Тестовый скрипт для webhook обработчика
 * Запуск: node test-webhook.js
 */

import { webhookHandler } from './src/lib/bothelp-webhook.ts';

async function main() {
  console.log('🔗 Тестирование webhook обработчика BotHelp\n');
  console.log('⚠️  ВНИМАНИЕ: Работаем в тестовом режиме!\n');
  
  try {
    // Запускаем тест webhook'а
    await webhookHandler.testWebhook();
    
    console.log('\n🎉 Тестирование webhook завершено успешно!');
    console.log('✅ Webhook готов к интеграции с BotHelp');
    console.log('🔒 Помните: это тестовая среда, не продакшн!');
    
  } catch (error) {
    console.error('❌ Ошибка при тестировании webhook:', error);
    process.exit(1);
  }
}

// Запускаем тесты
main();
