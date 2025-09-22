/**
 * Тестовый скрипт для потока диагностики развития ребенка
 * Запуск: node test-child-development.js
 */

import { testChildDevelopmentFlow } from './src/lib/child-development-flow.ts';

async function main() {
  console.log('👶 Тестирование потока диагностики развития ребенка\n');
  console.log('⚠️  ВНИМАНИЕ: Работаем в тестовом режиме!\n');
  
  try {
    // Запускаем тест потока
    await testChildDevelopmentFlow();
    
    console.log('\n🎉 Тестирование потока завершено успешно!');
    console.log('✅ Поток готов к интеграции с BotHelp');
    console.log('🔒 Помните: это тестовая среда, не продакшн!');
    
  } catch (error) {
    console.error('❌ Ошибка при тестировании потока:', error);
    process.exit(1);
  }
}

// Запускаем тесты
main();
