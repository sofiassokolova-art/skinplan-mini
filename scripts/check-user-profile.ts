// scripts/check-user-profile.ts
// Скрипт для проверки профиля пользователя и его RecommendationSession

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkUserProfile() {
  try {
    const args = process.argv.slice(2);
    if (args.length === 0) {
      console.log('Использование: tsx scripts/check-user-profile.ts <telegramId или userId>');
      process.exit(1);
    }

    const userIdOrTelegramId = args[0];
    console.log(`\n🔍 Проверка профиля для: ${userIdOrTelegramId}\n`);

    // Пробуем найти пользователя
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { id: userIdOrTelegramId },
          { telegramId: userIdOrTelegramId },
        ],
      },
      include: {
        skinProfiles: {
          orderBy: { version: 'desc' },
          take: 5,
        },
        recommendationSessions: {
          orderBy: { createdAt: 'desc' },
          take: 5,
          include: {
            rule: {
              select: {
                id: true,
                name: true,
                conditionsJson: true,
              },
            },
          },
        },
      },
    });

    if (!user) {
      console.log('❌ Пользователь не найден');
      process.exit(1);
    }

    console.log(`\n👤 Пользователь: ${user.firstName} ${user.lastName || ''} (@${user.username || 'нет'})`);
    console.log(`   ID: ${user.id}`);
    console.log(`   Telegram ID: ${user.telegramId}`);
    console.log(`   Создан: ${user.createdAt.toLocaleString('ru-RU')}`);
    console.log(`   Обновлен: ${user.updatedAt.toLocaleString('ru-RU')}`);

    console.log(`\n📊 Профили кожи (последние 5):`);
    if (user.skinProfiles.length === 0) {
      console.log('   ❌ Профили не найдены');
    } else {
      user.skinProfiles.forEach((profile, index) => {
        console.log(`\n   ${index + 1}. Версия ${profile.version} (ID: ${profile.id})`);
        console.log(`      Тип кожи: ${profile.skinType || 'не указан'}`);
        console.log(`      Чувствительность: ${profile.sensitivityLevel || 'не указана'}`);
        console.log(`      Уровень акне: ${profile.acneLevel ?? 'не указан'}`);
        console.log(`      Обезвоженность: ${profile.dehydrationLevel ?? 'не указана'}`);
        console.log(`      Риск розацеа: ${profile.rosaceaRisk || 'не указан'}`);
        console.log(`      Риск пигментации: ${profile.pigmentationRisk || 'не указан'}`);
        console.log(`      Возрастная группа: ${profile.ageGroup || 'не указана'}`);
        console.log(`      Создан: ${profile.createdAt.toLocaleString('ru-RU')}`);
        console.log(`      Обновлен: ${profile.updatedAt.toLocaleString('ru-RU')}`);
        if (profile.notes) {
          console.log(`      Заметки: ${profile.notes.substring(0, 100)}...`);
        }
      });
    }

    console.log(`\n🛍️ Recommendation Sessions (последние 5):`);
    if (user.recommendationSessions.length === 0) {
      console.log('   ❌ Сессии рекомендаций не найдены');
    } else {
      user.recommendationSessions.forEach((session, index) => {
        console.log(`\n   ${index + 1}. Сессия (ID: ${session.id})`);
        console.log(`      Profile ID: ${session.profileId}`);
        console.log(`      Rule ID: ${session.ruleId || 'нет (fallback)'}`);
        if (session.rule) {
          console.log(`      Правило: ${session.rule.name}`);
          console.log(`      Условия: ${JSON.stringify(session.rule.conditionsJson, null, 2).substring(0, 200)}...`);
        }
        console.log(`      Количество продуктов: ${session.products.length}`);
        console.log(`      Продукты: ${session.products.slice(0, 10).join(', ')}${session.products.length > 10 ? '...' : ''}`);
        console.log(`      Создана: ${session.createdAt.toLocaleString('ru-RU')}`);
      });
    }

    // Проверяем последние ответы на анкету
    console.log(`\n📝 Последние ответы на анкету (последние 10):`);
    const recentAnswers = await prisma.userAnswer.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: {
        question: {
          select: {
            code: true,
            text: true,
          },
        },
      },
    });

    if (recentAnswers.length === 0) {
      console.log('   ❌ Ответы не найдены');
    } else {
      recentAnswers.forEach((answer, index) => {
        console.log(`\n   ${index + 1}. Вопрос: ${answer.question.text.substring(0, 50)}...`);
        console.log(`      Код: ${answer.question.code}`);
        console.log(`      Ответ: ${answer.answerValue || JSON.stringify(answer.answerValues)}`);
        console.log(`      Время: ${answer.createdAt.toLocaleString('ru-RU')}`);
      });
    }

    // Проверяем последний план
    console.log(`\n📅 Последний план:`);
    const planProgress = await prisma.planProgress.findUnique({
      where: { userId: user.id },
    });

    if (!planProgress) {
      console.log('   ❌ План не найден');
    } else {
      const plan28 = await prisma.plan28.findUnique({
        where: { id: planProgress.plan28Id },
        include: {
          days: {
            take: 1,
            orderBy: { day: 'asc' },
          },
        },
      });

      if (!plan28) {
        console.log('   ❌ План28 не найден');
      } else {
        console.log(`   План ID: ${plan28.id}`);
        console.log(`   Создан: ${plan28.createdAt.toLocaleString('ru-RU')}`);
        console.log(`   Обновлен: ${plan28.updatedAt.toLocaleString('ru-RU')}`);
        if (plan28.days.length > 0) {
          const firstDay = plan28.days[0];
          const morningSteps = (firstDay.morningSteps as any) || [];
          const eveningSteps = (firstDay.eveningSteps as any) || [];
          console.log(`   День 1 - Утро: ${morningSteps.length} шагов`);
          console.log(`   День 1 - Вечер: ${eveningSteps.length} шагов`);
          console.log(`   Утренние шаги: ${JSON.stringify(morningSteps.map((s: any) => s.step).slice(0, 5))}`);
          console.log(`   Вечерние шаги: ${JSON.stringify(eveningSteps.map((s: any) => s.step).slice(0, 5))}`);
        }
      }
    }

  } catch (error) {
    console.error('❌ Ошибка при проверке профиля:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkUserProfile();

