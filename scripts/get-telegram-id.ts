// scripts/get-telegram-id.ts
// Временный скрипт для получения telegramId из initData
// 
// Инструкция:
// 1. Откройте админку через бота (команда /admin)
// 2. В консоли браузера выполните: console.log(window.Telegram?.WebApp?.initDataUnsafe?.user)
// 3. Скопируйте id из результата
// 4. Или используйте этот скрипт для добавления через initData

import { PrismaClient } from '@prisma/client';
import { validateTelegramInitData } from '../lib/telegram';

const prisma = new PrismaClient();
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

async function main() {
  console.log('🔍 Получение telegramId из initData\n');
  console.log('💡 Инструкция:');
  console.log('1. Откройте админку через бота (команда /admin)');
  console.log('2. В консоли браузера (F12) выполните:');
  console.log('   console.log(window.Telegram?.WebApp?.initDataUnsafe?.user)');
  console.log('3. Скопируйте id из результата (например: 123456789)');
  console.log('4. Запустите: npx tsx scripts/add-admin.ts <telegramId> <name>\n');
  
  // Альтернативный способ - через initData (если есть)
  const initData = process.argv[2];
  
  if (initData && TELEGRAM_BOT_TOKEN) {
    try {
      const validation = validateTelegramInitData(initData, TELEGRAM_BOT_TOKEN);
      if (validation.valid && validation.data?.user) {
        const userId = validation.data.user.id.toString();
        console.log(`✅ Найден telegramId: ${userId}`);
        console.log(`   Имя: ${validation.data.user.first_name}`);
        console.log(`   Username: ${validation.data.user.username || 'нет'}`);
        return userId;
      }
    } catch (error) {
      console.error('Ошибка валидации initData:', error);
    }
  }
  
  console.log('⚠️  initData не предоставлен или невалиден');
  console.log('   Используйте инструкцию выше для получения telegramId');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

