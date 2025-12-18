// scripts/regenerate-user-plan.ts
// Скрипт для перезаписи плана пользователя

import { PrismaClient } from '@prisma/client';
import { invalidateCache } from '../lib/cache';

const prisma = new PrismaClient();

async function regenerateUserPlan() {
  const userIdentifier = process.argv[2] || '643160759';
  
  console.log(`\n🔄 Перезапись плана для пользователя ${userIdentifier}\n`);
  
  try {
    // Пробуем найти по ID или telegramId
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { id: userIdentifier },
          { telegramId: userIdentifier },
        ],
      },
    });

    if (!user) {
      console.error(`❌ Пользователь с ID ${userId} не найден`);
      process.exit(1);
    }

    console.log(`✅ Пользователь найден: ${user.firstName} ${user.lastName || ''} (ID: ${user.id})\n`);

    // Получаем последний профиль для версии
    const profile = await prisma.skinProfile.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
    });

    if (!profile) {
      console.error(`❌ Профиль кожи не найден для пользователя ${userId}`);
      process.exit(1);
    }

    console.log(`✅ Профиль найден: версия ${profile.version}, тип кожи: ${profile.skinType}\n`);

    // 1. Удаляем сессии рекомендаций
    console.log('📋 Удаляю сессии рекомендаций...');
    const sessionsDeleted = await prisma.recommendationSession.deleteMany({
      where: { userId: user.id },
    });
    console.log(`   ✅ Удалено сессий: ${sessionsDeleted.count}`);

    // 2. Удаляем прогресс плана
    console.log('📋 Удаляю прогресс плана...');
    const progressDeleted = await prisma.planProgress.deleteMany({
      where: { userId: user.id },
    });
    console.log(`   ✅ Удалено записей прогресса: ${progressDeleted.count}`);

    // 3. Инвалидируем кэш
    console.log('📋 Инвалидирую кэш...');
    try {
      await invalidateCache(user.id, profile.version);
      console.log(`   ✅ Кэш инвалидирован для версии ${profile.version}`);
    } catch (cacheError) {
      console.warn(`   ⚠️  Ошибка при инвалидации кэша:`, cacheError);
    }

    console.log(`\n✅ План готов к перегенерации!`);
    console.log(`   План будет автоматически перегенерирован при следующем запросе пользователя.`);
    console.log(`   Или можно вызвать API: GET /api/plan/generate\n`);

    await prisma.$disconnect();
  } catch (error: any) {
    console.error('❌ Ошибка при перезаписи плана:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

regenerateUserPlan();

