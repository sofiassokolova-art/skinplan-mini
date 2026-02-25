// scripts/reset-user-by-telegram-id.ts
// Сброс всех данных пользователя по telegramId до состояния нового пользователя
// Использование: npx tsx scripts/reset-user-by-telegram-id.ts <telegramId> [--keep-payment]
// --keep-payment: не удалять Payment и Entitlement (пройти как новый, но не платить снова)

import { prisma } from '../lib/db';
import { invalidateAllUserCache } from '../lib/cache';

async function resetUserByTelegramId(telegramId: string, keepPayment: boolean) {
  console.log(`\n🔄 Сброс данных пользователя с telegramId: ${telegramId}${keepPayment ? ' (оплата сохраняется)' : ''}\n`);

  try {
    // 1. Находим пользователя
    const user = await prisma.user.findUnique({
      where: { telegramId },
      select: { id: true, telegramId: true, firstName: true, lastName: true },
    });

    if (!user) {
      console.error(`❌ Пользователь с telegramId ${telegramId} не найден`);
      process.exit(1);
    }

    console.log(`✅ Найден пользователь: ${user.firstName || ''} ${user.lastName || ''} (ID: ${user.id})\n`);

    // 2. Очищаем кэш
    try {
      await invalidateAllUserCache(user.id);
      console.log('   ✅ Кэш очищен');
    } catch (e: any) {
      console.warn('   ⚠️  Ошибка очистки кэша (не критично):', e?.message);
    }

    // 3. Удаляем все данные пользователя
    console.log('\n🗑️  Удаляю данные пользователя...\n');

    const results: Record<string, number> = {};

    // RecommendationSession
    results.recommendationSessions = (await prisma.recommendationSession.deleteMany({
      where: { userId: user.id },
    })).count;
    console.log(`   ✅ RecommendationSession: ${results.recommendationSessions}`);

    // PlanProgress
    try {
      results.planProgress = (await prisma.planProgress.deleteMany({
        where: { userId: user.id },
      })).count;
      console.log(`   ✅ PlanProgress: ${results.planProgress}`);
    } catch (e: any) {
      console.warn('   ⚠️  PlanProgress не удален (не критично)');
    }

    // UserAnswer
    results.userAnswers = (await prisma.userAnswer.deleteMany({
      where: { userId: user.id },
    })).count;
    console.log(`   ✅ UserAnswer: ${results.userAnswers}`);

    // SkinProfile
    results.skinProfiles = (await prisma.skinProfile.deleteMany({
      where: { userId: user.id },
    })).count;
    console.log(`   ✅ SkinProfile: ${results.skinProfiles}`);

    // PlanFeedback
    try {
      results.planFeedback = (await prisma.planFeedback.deleteMany({
        where: { userId: user.id },
      })).count;
      console.log(`   ✅ PlanFeedback: ${results.planFeedback}`);
    } catch (e: any) {
      console.warn('   ⚠️  PlanFeedback не удален (не критично)');
    }

    // Wishlist
    try {
      results.wishlist = (await prisma.wishlist.deleteMany({
        where: { userId: user.id },
      })).count;
      console.log(`   ✅ Wishlist: ${results.wishlist}`);
    } catch (e: any) {
      console.warn('   ⚠️  Wishlist не удален (не критично)');
    }

    // Cart
    try {
      results.cart = (await prisma.cart.deleteMany({
        where: { userId: user.id },
      })).count;
      console.log(`   ✅ Cart: ${results.cart}`);
    } catch (e: any) {
      console.warn('   ⚠️  Cart не удален (не критично)');
    }

    // Plan28
    try {
      results.plan28 = (await prisma.plan28.deleteMany({
        where: { userId: user.id },
      })).count;
      console.log(`   ✅ Plan28: ${results.plan28}`);
    } catch (e: any) {
      console.warn('   ⚠️  Plan28 не удален (не критично)');
    }

    // ClientLog
    try {
      results.clientLogs = (await prisma.clientLog.deleteMany({
        where: { userId: user.id },
      })).count;
      console.log(`   ✅ ClientLog: ${results.clientLogs}`);
    } catch (e: any) {
      console.warn('   ⚠️  ClientLog не удален (не критично)');
    }

    // QuestionnaireSubmission
    try {
      results.questionnaireSubmissions = (await prisma.questionnaireSubmission.deleteMany({
        where: { userId: user.id },
      })).count;
      console.log(`   ✅ QuestionnaireSubmission: ${results.questionnaireSubmissions}`);
    } catch (e: any) {
      console.warn('   ⚠️  QuestionnaireSubmission не удален (не критично)');
    }

    // QuestionnaireProgress
    try {
      results.questionnaireProgress = (await prisma.questionnaireProgress.deleteMany({
        where: { userId: user.id },
      })).count;
      console.log(`   ✅ QuestionnaireProgress: ${results.questionnaireProgress}`);
    } catch (e: any) {
      console.warn('   ⚠️  QuestionnaireProgress не удален (не критично)');
    }

    // Payment — пропускаем при --keep-payment
    if (!keepPayment) {
      try {
        results.payments = (await prisma.payment.deleteMany({
          where: { userId: user.id },
        })).count;
        console.log(`   ✅ Payment: ${results.payments}`);
      } catch (e: any) {
        console.warn('   ⚠️  Payment не удален (не критично)');
      }
    } else {
      console.log('   ⏭️  Payment: не удаляю (--keep-payment)');
    }

    // Entitlement — пропускаем при --keep-payment
    if (!keepPayment) {
      try {
        results.entitlements = (await prisma.entitlement.deleteMany({
          where: { userId: user.id },
        })).count;
        console.log(`   ✅ Entitlement: ${results.entitlements}`);
      } catch (e: any) {
        console.warn('   ⚠️  Entitlement не удален (не критично)');
      }
    } else {
      console.log('   ⏭️  Entitlement: не удаляю (--keep-payment)');
    }

    // ProductReplacement
    try {
      results.productReplacements = (await prisma.productReplacement.deleteMany({
        where: { userId: user.id },
      })).count;
      console.log(`   ✅ ProductReplacement: ${results.productReplacements}`);
    } catch (e: any) {
      console.warn('   ⚠️  ProductReplacement не удален (не критично)');
    }

    // WishlistFeedback
    try {
      results.wishlistFeedback = (await prisma.wishlistFeedback.deleteMany({
        where: { userId: user.id },
      })).count;
      console.log(`   ✅ WishlistFeedback: ${results.wishlistFeedback}`);
    } catch (e: any) {
      console.warn('   ⚠️  WishlistFeedback не удален (не критично)');
    }

    // 4. Сбрасываем UserPreferences
    console.log('\n🔄 Сбрасываю UserPreferences...\n');
    try {
      await prisma.userPreferences.upsert({
        where: { userId: user.id },
        update: {
          isRetakingQuiz: false,
          fullRetakeFromHome: false,
          paymentRetakingCompleted: false,
          paymentFullRetakeCompleted: false,
          hasPlanProgress: false,
          routineProducts: null,
          planFeedbackSent: false,
          serviceFeedbackSent: false,
          lastPlanFeedbackDate: null,
          lastServiceFeedbackDate: null,
          extra: null,
        },
        create: {
          userId: user.id,
          isRetakingQuiz: false,
          fullRetakeFromHome: false,
          paymentRetakingCompleted: false,
          paymentFullRetakeCompleted: false,
          hasPlanProgress: false,
          routineProducts: null,
          planFeedbackSent: false,
          serviceFeedbackSent: false,
          lastPlanFeedbackDate: null,
          lastServiceFeedbackDate: null,
          extra: null,
        },
      });
      console.log('   ✅ UserPreferences сброшены');
    } catch (e: any) {
      console.warn('   ⚠️  Ошибка сброса UserPreferences (не критично):', e?.message);
    }

    // 5. Очищаем теги пользователя
    console.log('\n🔄 Очищаю теги пользователя...\n');
    try {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          tags: {
            set: [],
          },
          currentProfileId: null,
        },
      });
      console.log('   ✅ Теги пользователя очищены');
    } catch (e: any) {
      console.warn('   ⚠️  Ошибка очистки тегов (не критично):', e?.message);
    }

    console.log('\n✅ Сброс данных пользователя завершен!\n');
    console.log('📊 Результаты:');
    Object.entries(results).forEach(([key, value]) => {
      console.log(`   - ${key}: ${value}`);
    });
    console.log('\n🎉 Пользователь теперь как новый!\n');
  } catch (error: any) {
    console.error('\n❌ Ошибка при сбросе данных:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Запускаем скрипт
const args = process.argv.slice(2);
const telegramId = args.find((a) => a !== '--keep-payment') || '643160759';
const keepPayment = args.includes('--keep-payment');
resetUserByTelegramId(telegramId, keepPayment);
