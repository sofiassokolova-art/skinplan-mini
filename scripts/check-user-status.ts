// scripts/check-user-status.ts
// Проверка текущего статуса пользователя

import { prisma } from '../lib/db';

async function checkUserStatus(telegramId: string) {
  console.log(`🔍 Проверяю статус пользователя ${telegramId}...\n`);

  try {
    // Находим пользователя
    const user = await prisma.user.findUnique({
      where: { telegramId },
      select: { 
        id: true, 
        telegramId: true, 
        firstName: true, 
        lastName: true, 
        username: true,
      },
    });

    if (!user) {
      console.error(`❌ Пользователь с telegramId ${telegramId} не найден`);
      process.exit(1);
    }

    const userName = user.firstName || user.username || user.telegramId;
    console.log(`✅ Пользователь: ${userName} (${user.id})\n`);

    // Проверяем профиль
    const profiles = await prisma.skinProfile.findMany({
      where: { userId: user.id },
      orderBy: { version: 'desc' },
      select: {
        id: true,
        version: true,
        skinType: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    console.log(`📋 Профили (${profiles.length}):`);
    if (profiles.length === 0) {
      console.log('   ❌ Профилей нет');
    } else {
      profiles.forEach((p, i) => {
        console.log(`   ${i + 1}. Version ${p.version}, SkinType: ${p.skinType}, Updated: ${new Date(p.updatedAt).toLocaleString('ru-RU')}`);
      });
    }

    // Проверяем ответы (ВСЕ, не только последние 5)
    const allAnswers = await prisma.userAnswer.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      select: {
        question: { select: { code: true } },
        answerValue: true,
        answerValues: true,
        createdAt: true,
      },
    });

    console.log(`\n📝 Ответы на анкету (всего: ${allAnswers.length}):`);
    if (allAnswers.length === 0) {
      console.log('   ❌ Ответов нет');
    } else {
      // Показываем последние 10
      const recentAnswers = allAnswers.slice(0, 10);
      recentAnswers.forEach((a, i) => {
        const value = a.answerValue || (a.answerValues ? JSON.stringify(a.answerValues) : 'N/A');
        console.log(`   ${i + 1}. [${new Date(a.createdAt).toLocaleString('ru-RU')}] ${a.question?.code}: ${value}`);
      });
      if (allAnswers.length > 10) {
        console.log(`   ... и еще ${allAnswers.length - 10} ответов`);
      }
    }

    // Проверяем сессии рекомендаций
    const sessions = await prisma.recommendationSession.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        products: true,
        ruleId: true,
        createdAt: true,
      },
    });

    console.log(`\n💾 RecommendationSession (${sessions.length}):`);
    if (sessions.length === 0) {
      console.log('   ❌ Сессий нет');
    } else {
      sessions.forEach((s, i) => {
        const productCount = Array.isArray(s.products) ? s.products.length : 0;
        console.log(`   ${i + 1}. ID: ${s.id}, Products: ${productCount}, RuleID: ${s.ruleId || 'null'}, Created: ${new Date(s.createdAt).toLocaleString('ru-RU')}`);
      });
    }

    // Проверяем прогресс анкеты (если модель существует)
    try {
      let progress: any = null;
      if (prisma.questionnaireProgress) {
        progress = await prisma.questionnaireProgress.findFirst({
          where: { userId: user.id },
          select: {
            answers: true,
            questionIndex: true,
            infoScreenIndex: true,
            updatedAt: true,
          },
        });
      }

      console.log(`\n📊 Прогресс анкеты:`);
      if (!progress) {
        console.log('   ❌ Прогресса нет (модель может не существовать или данных нет)');
      } else {
        const answersCount = progress.answers && typeof progress.answers === 'object' ? Object.keys(progress.answers).length : 0;
        console.log(`   ✅ Есть прогресс: ${answersCount} ответов, вопрос ${progress.questionIndex}, инфо-экран ${progress.infoScreenIndex}`);
        console.log(`   Updated: ${new Date(progress.updatedAt).toLocaleString('ru-RU')}`);
      }
    } catch (err: any) {
      console.log(`\n📊 Прогресс анкеты:`);
      console.log(`   ℹ️ Не удалось проверить прогресс: ${err?.message || 'модель не существует'}`);
    }

    console.log('\n✅ Проверка завершена');

  } catch (error: any) {
    console.error('❌ Ошибка:', error?.message);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

const telegramId = process.argv[2];

if (!telegramId) {
  console.error('❌ Укажите telegramId пользователя');
  console.error('   Использование: npx tsx scripts/check-user-status.ts <telegramId>');
  process.exit(1);
}

checkUserStatus(telegramId)
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Ошибка:', error);
    process.exit(1);
  });
