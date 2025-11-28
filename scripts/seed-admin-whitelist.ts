// scripts/seed-admin-whitelist.ts
// Скрипт для добавления админа в whitelist

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding admin whitelist...');

  // Список админов для добавления
  const admins = [
    {
      phoneNumber: '+79124483696',
      telegramId: null,
      name: 'Main Admin',
      role: 'admin' as const,
    },
    {
      phoneNumber: null,
      telegramId: '863848012',
      name: 'Марьям',
      role: 'admin' as const,
    },
    {
      phoneNumber: null,
      telegramId: '287939646',
      name: 'Admin',
      role: 'admin' as const,
    },
  ];

  for (const adminData of admins) {
    const where = adminData.phoneNumber 
      ? { phoneNumber: adminData.phoneNumber }
      : { telegramId: adminData.telegramId! };

    const admin = await prisma.adminWhitelist.upsert({
      where,
      update: {
        isActive: true,
        role: adminData.role,
        name: adminData.name,
        phoneNumber: adminData.phoneNumber || undefined,
        telegramId: adminData.telegramId || undefined,
      },
      create: {
        phoneNumber: adminData.phoneNumber || undefined,
        telegramId: adminData.telegramId || undefined,
        name: adminData.name,
        role: adminData.role,
        isActive: true,
      },
    });

    console.log(`✅ Admin added/updated: ${adminData.name}`, {
      id: admin.id,
      telegramId: admin.telegramId,
      phoneNumber: admin.phoneNumber,
      role: admin.role,
    });
  }

  console.log('✅ Admin whitelist seeding completed!');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding admin whitelist:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

