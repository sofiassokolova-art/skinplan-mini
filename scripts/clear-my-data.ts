// scripts/clear-my-data.ts
// Скрипт для очистки всех данных текущего пользователя
// Использование: npx tsx scripts/clear-my-data.ts <telegramId>

import { PrismaClient } from '@prisma/client';
import { invalidateAllUserCache } from '../lib/cache';

const prisma = new PrismaClient();

async function clearMyData(telegramId?: string) {
  console.log('🗑️  Очистка всех данных пользователя...\n');

  let userId: string | null = null;

  // Если telegramId не передан, пытаемся найти пользователя по другим признакам
  if (!telegramId) {
    // Ищем пользователя, который недавно был активен
    const recentUser = await prisma.user.findFirst({
      orderBy: { lastActive: 'desc' },
      select: { id: true, telegramId: true, firstName: true, lastName: true },
    });

    if (recentUser) {
      console.log(`📋 Найден пользователь: ${recentUser.firstName || ''} ${recentUser.lastName || ''} (${recentUser.telegramId})`);
      console.log('   Используйте: npx tsx scripts/clear-my-data.ts <telegramId> для указания конкретного пользователя\n');
      userId = recentUser.id;
    } else {
      console.error('❌ Пользователь не найден. Укажите telegramId:');
      console.error('   npx tsx scripts/clear-my-data.ts <telegramId>');
      process.exit(1);
    }
  } else {
    // Ищем пользователя по telegramId
    const user = await prisma.user.findUnique({
      where: { telegramId },
      select: { id: true, telegramId: true, firstName: true, lastName: true },
    });

    if (!user) {
      console.error(`❌ Пользователь с telegramId "${telegramId}" не найден`);
      process.exit(1);
    }

    console.log(`📋 Найден пользователь: ${user.firstName || ''} ${user.lastName || ''} (${user.telegramId})`);
    userId = user.id;
  }

  if (!userId) {
    console.error('❌ Не удалось определить userId');
    process.exit(1);
  }

  console.log(`\n🗑️  Удаляю все данные для пользователя ${userId}...\n`);

  // Очищаем кэш
  try {
    await invalidateAllUserCache(userId);
    console.log('   ✅ Кэш очищен');
  } catch (e: any) {
    console.warn('   ⚠️  Ошибка очистки кэша (не критично):', e?.message);
  }

  // Удаляем все данные пользователя
  const results: Record<string, number> = {};

  // RecommendationSession
  results.recommendationSessions = (await prisma.recommendationSession.deleteMany({
    where: { userId },
  })).count;
  console.log(`   ✅ RecommendationSession: ${results.recommendationSessions}`);

  // PlanProgress
  try {
    results.planProgress = (await prisma.planProgress.deleteMany({
      where: { userId },
    })).count;
    console.log(`   ✅ PlanProgress: ${results.planProgress}`);
  } catch (e: any) {
    console.warn('   ⚠️  PlanProgress не удален (не критично)');
  }

  // UserAnswer
  results.userAnswers = (await prisma.userAnswer.deleteMany({
    where: { userId },
  })).count;
  console.log(`   ✅ UserAnswer: ${results.userAnswers}`);

  // SkinProfile
  results.skinProfiles = (await prisma.skinProfile.deleteMany({
    where: { userId },
  })).count;
  console.log(`   ✅ SkinProfile: ${results.skinProfiles}`);

  // PlanFeedback
  try {
    results.planFeedback = (await prisma.planFeedback.deleteMany({
      where: { userId },
    })).count;
    console.log(`   ✅ PlanFeedback: ${results.planFeedback}`);
  } catch (e: any) {
    console.warn('   ⚠️  PlanFeedback не удален (не критично)');
  }

  // Wishlist
  try {
    results.wishlist = (await prisma.wishlist.deleteMany({
      where: { userId },
    })).count;
    console.log(`   ✅ Wishlist: ${results.wishlist}`);
  } catch (e: any) {
    console.warn('   ⚠️  Wishlist не удален (не критично)');
  }

  // Cart
  try {
    results.cart = (await prisma.cart.deleteMany({
      where: { userId },
    })).count;
    console.log(`   ✅ Cart: ${results.cart}`);
  } catch (e: any) {
    console.warn('   ⚠️  Cart не удален (не критично)');
  }

  // Plan28
  try {
    results.plan28 = (await prisma.plan28.deleteMany({
      where: { userId },
    })).count;
    console.log(`   ✅ Plan28: ${results.plan28}`);
  } catch (e: any) {
    console.warn('   ⚠️  PlanFeedback не удален (не критично)');
  }

  // ClientLog
  try {
    results.clientLogs = (await prisma.clientLog.deleteMany({
      where: { userId },
    })).count;
    console.log(`   ✅ ClientLog: ${results.clientLogs}`);
  } catch (e: any) {
    console.warn('   ⚠️  ClientLog не удален (не критично)');
  }

  // Проверяем, что все очищено
  const remainingProfile = await prisma.skinProfile.findFirst({
    where: { userId },
  });

  const remainingAnswers = await prisma.userAnswer.findFirst({
    where: { userId },
  });

  const remainingPlan = await prisma.plan28.findFirst({
    where: { userId },
  });

  if (remainingProfile || remainingAnswers || remainingPlan) {
    console.warn('\n⚠️  Внимание: некоторые данные могли остаться');
    if (remainingProfile) console.warn('   - SkinProfile все еще существует');
    if (remainingAnswers) console.warn('   - UserAnswer все еще существует');
    if (remainingPlan) console.warn('   - Plan28 все еще существует');
  } else {
    console.log('\n✅ Все данные успешно удалены!');
  }

  console.log('\n📊 Итоги:');
  console.log(JSON.stringify(results, null, 2));
}

const telegramId = process.argv[2];
clearMyData(telegramId)
  .catch((e) => {
    console.error('❌ Ошибка при очистке данных:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
