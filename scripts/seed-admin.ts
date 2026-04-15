// scripts/seed-admin.ts
// Создание админа с email и паролем

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function seedAdmin() {
  console.log('🌱 Creating admin user...');

  // Настройки админа
  const email = 'admin@skiniq.app'; // Email админа
  const password = 'admin123'; // Пароль (ИЗМЕНИТЕ НА БОЛЕЕ БЕЗОПАСНЫЙ!)
  const role = 'admin';

  // Хешируем пароль
  const passwordHash = await bcrypt.hash(password, 10);

  const admin = await prisma.admin.upsert({
    where: { email },
    update: {
      passwordHash,
      role,
    },
    create: {
      email,
      passwordHash,
      role,
    },
  });

  console.log('✅ Admin created/updated:');
  console.log('   Email:', admin.email);
  console.log('   Role:', admin.role);
  console.log('   ID:', admin.id);
  console.log('');
  console.log('📝 Данные для входа:');
  console.log('   Email:', email);
  console.log('   Password:', password);
  console.log('');
  console.log('⚠️  ВАЖНО: Измените пароль после первого входа!');
  console.log('');
  console.log('🌐 Вход:');
  console.log('   Откройте: https://skinplan-mini.pages.dev/admin/login');
}

seedAdmin()
  .catch((e) => {
    console.error('❌ Error seeding admin:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
