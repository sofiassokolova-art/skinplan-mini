// scripts/add-admin.ts
// Быстрое добавление админа в whitelist
// 
// Использование:
// npx tsx scripts/add-admin.ts <telegramId> <name>
// 
// Пример:
// npx tsx scripts/add-admin.ts 123456789 "София"

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const telegramId = process.argv[2];
  const name = process.argv[3] || 'Admin';

  if (!telegramId) {
    console.error('❌ Ошибка: не указан telegramId');
    console.log('\n💡 Использование:');
    console.log('   npx tsx scripts/add-admin.ts <telegramId> <name>');
    console.log('\n💡 Как получить telegramId:');
    console.log('   1. Попросите админа написать @userinfobot');
    console.log('   2. Бот пришлет его id (число, например: 123456789)');
    console.log('   3. Используйте этот id в команде выше\n');
    process.exit(1);
  }

  console.log(`🌱 Добавляем админа в whitelist...`);
  console.log(`   Telegram ID: ${telegramId}`);
  console.log(`   Имя: ${name}\n`);

  try {
    const admin = await prisma.adminWhitelist.upsert({
      where: { telegramId },
      update: {
        name,
        role: 'admin',
        isActive: true,
      },
      create: {
        telegramId,
        name,
        role: 'admin',
        isActive: true,
      },
    });

    console.log('✅ Админ успешно добавлен в whitelist!');
    console.log(`   ID: ${admin.id}`);
    console.log(`   Telegram ID: ${admin.telegramId}`);
    console.log(`   Имя: ${admin.name}`);
    console.log(`   Роль: ${admin.role}`);
    console.log(`   Активен: ${admin.isActive ? 'Да' : 'Нет'}\n`);
    console.log('🎉 Теперь можно использовать команду /admin в боте!');
  } catch (error: any) {
    console.error('❌ Ошибка при добавлении админа:', error.message);
    process.exit(1);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

