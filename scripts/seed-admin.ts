// scripts/seed-admin.ts
// Создание первого админа через Telegram

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function seedAdmin() {
  console.log('🌱 Creating admin user...');

  const telegramUsername = 'sofiagguseynova'; // Без @

  const admin = await prisma.admin.upsert({
    where: { telegramUsername },
    update: {
      role: 'admin',
    },
    create: {
      telegramUsername,
      role: 'admin',
    },
  });

  console.log('✅ Admin created:');
  console.log('   Telegram username: @' + admin.telegramUsername);
  console.log('   Role:', admin.role);
  console.log('   ⚠️  ВАЖНО: Авторизация только через Telegram!');
}

seedAdmin()
  .catch((e) => {
    console.error('❌ Error seeding admin:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

