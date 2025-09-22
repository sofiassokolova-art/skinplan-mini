/**
 * Тестовый скрипт для проверки BotHelp API
 * Запуск: node test-bothelp.js
 */

// Импортируем тестовые функции
import { runBotTests, testSkinPlanIntegration } from './src/lib/bothelp-test.ts';

async function main() {
  console.log('🤖 Тестирование BotHelp API для SkinPlan\n');
  console.log('⚠️  ВНИМАНИЕ: Работаем в тестовом режиме!\n');
  
  try {
    // Запускаем базовые тесты API
    await runBotTests();
    
    console.log('\n' + '='.repeat(50) + '\n');
    
    // Тестируем интеграцию с SkinPlan
    await testSkinPlanIntegration();
    
    console.log('\n🎉 Все тесты завершены успешно!');
    console.log('✅ API готов к интеграции с SkinPlan');
    console.log('🔒 Помните: это тестовая среда, не продакшн!');
    
  } catch (error) {
    console.error('❌ Ошибка при тестировании:', error);
    process.exit(1);
  }
}

// Запускаем тесты
main();
