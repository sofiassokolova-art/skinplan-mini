// scripts/seed-admin.ts
// Создание админа с email и паролем из переменных окружения

import { createScriptPrisma } from './lib/prisma';
import bcrypt from 'bcryptjs';

const prisma = createScriptPrisma();

async function seedAdmin() {
  console.log('🌱 Creating admin user...');

  // Настройки админа
  const email = process.env.ADMIN_SEED_EMAIL || 'admin@skiniq.app';
  const password = process.env.ADMIN_SEED_PASSWORD;
  const role = 'admin';

  if (!password || password.length < 12) {
    throw new Error('Set ADMIN_SEED_PASSWORD to a unique password with at least 12 characters before running seed:admin.');
  }

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
  console.log('   Password: set from ADMIN_SEED_PASSWORD (not printed)');
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
