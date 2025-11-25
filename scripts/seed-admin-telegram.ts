// scripts/seed-admin-telegram.ts
// Добавление админа в вайт-лист по Telegram username или ID

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function seedAdminTelegram() {
  console.log('🌱 Adding admin to whitelist...');

  // Можно указать telegramId, telegramUsername или оба
  // Примеры:
  // - По username: { telegramUsername: 'sofiagguseynova' }
  // - По ID: { telegramId: '123456789' }
  // - По обоим: { telegramId: '123456789', telegramUsername: 'sofiagguseynova' }

  const telegramUsername = 'sofiagguseynova'; // Замените на нужный username
  const telegramId = null; // Опционально: укажите Telegram ID, если знаете
  
  // Если указан username, можно попробовать найти ID через Bot API
  // Но для простоты оставляем null - ID обновится при первой авторизации

  const admin = await prisma.admin.upsert({
    where: { 
      telegramUsername: telegramUsername || undefined,
    },
    update: {
      telegramUsername: telegramUsername || undefined,
      telegramId: telegramId || undefined,
      role: 'admin',
    },
    create: {
      telegramUsername: telegramUsername || undefined,
      telegramId: telegramId || undefined,
      role: 'admin',
    },
  });

  console.log('✅ Admin added/updated to whitelist:');
  console.log('   ID:', admin.id);
  console.log('   Telegram Username:', admin.telegramUsername || 'не указан');
  console.log('   Telegram ID:', admin.telegramId || 'не указан (обновится при первой авторизации)');
  console.log('   Role:', admin.role);
  console.log('');
  console.log('📝 Теперь этот пользователь может войти в админ-панель через Telegram Mini App');
  console.log('   Откройте /admin/login через Telegram Mini App');
}

seedAdminTelegram()
  .catch((e) => {
    console.error('❌ Error seeding admin:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

