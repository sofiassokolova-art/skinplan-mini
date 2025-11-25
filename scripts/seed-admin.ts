// scripts/seed-admin.ts
// Создание админа через Telegram (персональный аккаунт)

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function seedAdmin() {
  console.log('🌱 Creating admin user...');

  // Можно указать либо username, либо telegramId, либо оба
  const telegramUsername = 'sofiagguseynova'; // Без @, username из персонального Telegram аккаунта
  const telegramId = undefined; // Опционально: telegramId из персонального Telegram аккаунта

  // Ищем существующего админа
  let admin = telegramUsername 
    ? await prisma.admin.findUnique({
        where: { telegramUsername },
      })
    : null;

  if (!admin && telegramId) {
    admin = await prisma.admin.findUnique({
      where: { telegramId },
    });
  }

  if (admin) {
    // Обновляем существующего админа
    admin = await prisma.admin.update({
      where: { id: admin.id },
      data: {
        telegramUsername: telegramUsername || admin.telegramUsername,
        telegramId: telegramId || admin.telegramId,
        role: 'admin',
      },
    });
    console.log('✅ Admin updated:');
  } else {
    // Создаем нового админа
    admin = await prisma.admin.create({
      data: {
        telegramUsername: telegramUsername || undefined,
        telegramId: telegramId || undefined,
        role: 'admin',
      },
    });
    console.log('✅ Admin created:');
  }

  console.log('   Telegram username:', admin.telegramUsername ? `@${admin.telegramUsername}` : '(не указан)');
  console.log('   Telegram ID:', admin.telegramId || '(не указан)');
  console.log('   Role:', admin.role);
  console.log('');
  console.log('   📝 Авторизация:');
  console.log('      - Откройте: https://skinplan-mini.vercel.app/admin/login');
  console.log('      - Нажмите "Войти через Telegram"');
  console.log('      - Выберите ваш персональный Telegram аккаунт');
  console.log('      - Система проверит ваш username или telegramId');
}

seedAdmin()
  .catch((e) => {
    console.error('❌ Error seeding admin:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

