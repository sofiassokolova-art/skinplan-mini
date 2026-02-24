#!/usr/bin/env npx tsx
// Добавляет email в список допущенных для входа в админку (AdminEmailWhitelist).
// Код доступа пользователь задаёт сам при первом входе на /admin/login.
//
// Использование: npx tsx scripts/add-admin-email.ts <email>
// Пример: npx tsx scripts/add-admin-email.ts admin@example.com

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const email = process.argv[2]?.trim()?.toLowerCase();
  if (!email) {
    console.error('Укажите email: npx tsx scripts/add-admin-email.ts <email>');
    process.exit(1);
  }

  const existing = await prisma.adminEmailWhitelist.findUnique({
    where: { email },
  });

  if (existing) {
    console.log(`Email ${email} уже в списке.`);
    process.exit(0);
  }

  await prisma.adminEmailWhitelist.create({
    data: { email },
  });

  console.log(`✅ Добавлен: ${email}`);
  console.log('   Пользователь может зайти на /admin/login и при первом входе задать свой код доступа.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
