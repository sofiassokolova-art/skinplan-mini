// scripts/seed-admin-whitelist.ts
// Скрипт для добавления админа в whitelist

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding admin whitelist...');

  // Добавляем номер телефона в whitelist
  const admin = await prisma.adminWhitelist.upsert({
    where: { phoneNumber: '+79124483696' },
    update: {
      isActive: true,
      role: 'admin',
      name: 'Main Admin',
    },
    create: {
      phoneNumber: '+79124483696',
      name: 'Main Admin',
      role: 'admin',
      isActive: true,
    },
  });

  console.log('✅ Admin whitelist seeded:', admin);
}

main()
  .catch((e) => {
    console.error('❌ Error seeding admin whitelist:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

