// scripts/seed-admins.ts
// Скрипт для добавления админов в whitelist

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Добавляем админов в whitelist...');

  // Список админов (нужно будет получить их telegramId через @userinfobot)
  const admins = [
    {
      // @sofiagguseynova - нужно получить telegramId
      telegramId: null as string | null, // Заменить на реальный ID
      name: 'София',
      role: 'admin',
    },
    {
      // @MA_Shishov - нужно получить telegramId
      telegramId: null as string | null, // Заменить на реальный ID
      name: 'Максим',
      role: 'admin',
    },
    {
      // @gde_maryam - нужно получить telegramId
      telegramId: null as string | null, // Заменить на реальный ID
      name: 'Марьям',
      role: 'admin',
    },
  ];

  for (const admin of admins) {
    if (!admin.telegramId) {
      console.log(`⚠️  Пропускаем ${admin.name} - нет telegramId`);
      continue;
    }

    const entry = await prisma.adminWhitelist.upsert({
      where: { telegramId: admin.telegramId },
      update: {
        name: admin.name,
        role: admin.role,
        isActive: true,
      },
      create: {
        telegramId: admin.telegramId,
        name: admin.name,
        role: admin.role,
        isActive: true,
      },
    });

    console.log(`✅ Добавлен админ: ${admin.name} (${admin.telegramId})`);
  }

  console.log('✅ Готово!');
}

main()
  .catch((e) => {
    console.error('Ошибка:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

