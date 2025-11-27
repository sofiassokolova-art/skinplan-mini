// scripts/seed-admins.ts
// Скрипт для добавления админов в whitelist
//
// Инструкция:
// 1. Попросите админа написать @userinfobot в Telegram
// 2. Бот пришлет его telegramId (число, например: 123456789)
// 3. Замените null на реальный telegramId ниже
// 4. Запустите: npx tsx scripts/seed-admins.ts

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Добавляем админов в whitelist...');
  console.log('💡 Чтобы получить telegramId: попросите админа написать @userinfobot\n');

  // Список админов
  // ⚠️ ВАЖНО: Замените null на реальные telegramId перед запуском!
  const admins = [
    {
      // @sofiagguseynova
      telegramId: null as string | null, // TODO: Получить через @userinfobot
      name: 'София',
      role: 'admin' as const,
    },
    {
      // @MA_Shishov
      telegramId: null as string | null, // TODO: Получить через @userinfobot
      name: 'Максим',
      role: 'admin' as const,
    },
    {
      // @gde_maryam
      telegramId: null as string | null, // TODO: Получить через @userinfobot
      name: 'Марьям',
      role: 'admin' as const,
    },
  ];

  let addedCount = 0;
  let skippedCount = 0;

  for (const admin of admins) {
    if (!admin.telegramId) {
      console.log(`⚠️  Пропускаем ${admin.name} - нет telegramId (получите через @userinfobot)`);
      skippedCount++;
      continue;
    }

    try {
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

      console.log(`✅ Добавлен админ: ${admin.name} (telegramId: ${admin.telegramId})`);
      addedCount++;
    } catch (error: any) {
      console.error(`❌ Ошибка при добавлении ${admin.name}:`, error.message);
    }
  }

  console.log(`\n📊 Результат: добавлено ${addedCount}, пропущено ${skippedCount}`);
  
  if (skippedCount > 0) {
    console.log('\n💡 Чтобы добавить пропущенных админов:');
    console.log('   1. Попросите их написать @userinfobot');
    console.log('   2. Замените null на их telegramId в этом файле');
    console.log('   3. Запустите скрипт снова');
  }
  
  console.log('\n✅ Готово!');
}

main()
  .catch((e) => {
    console.error('Ошибка:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

