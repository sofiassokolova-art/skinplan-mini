// scripts/check-user-quiz-state.ts
// Проверка состояния анкеты для конкретного пользователя

import { prisma } from '../lib/db';

const TELEGRAM_ID = '643160759';

async function checkUserQuizState() {
  console.log(`🔍 Проверяю состояние анкеты для пользователя ${TELEGRAM_ID}...\n`);

  try {
    // Находим пользователя
    const user = await prisma.user.findFirst({
      where: { telegramId: TELEGRAM_ID },
      include: {
        userPreferences: true,
        currentProfile: true,
        userAnswers: {
          orderBy: { createdAt: 'desc' },
          take: 20,
          include: {
            question: {
              select: { code: true, text: true },
            },
          },
        },
        plan28s: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        questionnaireProgress: {
          orderBy: { updatedAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!user) {
      console.log('❌ Пользователь не найден');
      return;
    }

    console.log('👤 Пользователь:');
    console.log(`   ID: ${user.id}`);
    console.log(`   Telegram ID: ${user.telegramId}`);
    console.log(`   Имя: ${user.firstName}`);
    console.log(`   Создан: ${user.createdAt.toLocaleString('ru-RU')}`);
    
    console.log('\n📋 Preferences:');
    if (user.userPreferences) {
      console.log(`   isRetakingQuiz: ${user.userPreferences.isRetakingQuiz}`);
      console.log(`   fullRetakeFromHome: ${user.userPreferences.fullRetakeFromHome}`);
      console.log(`   hasPlanProgress: ${user.userPreferences.hasPlanProgress}`);
      console.log(`   paymentRetakingCompleted: ${user.userPreferences.paymentRetakingCompleted}`);
      console.log(`   paymentFullRetakeCompleted: ${user.userPreferences.paymentFullRetakeCompleted}`);
      console.log(`   extra: ${JSON.stringify(user.userPreferences.extra)}`);
    } else {
      console.log('   ❌ Preferences не найдены');
    }

    console.log('\n🧬 Профиль кожи:');
    if (user.currentProfile) {
      const profile = user.currentProfile;
      console.log(`   ID: ${profile.id}`);
      console.log(`   Тип кожи: ${profile.skinType}`);
      console.log(`   Версия: ${profile.version}`);
      console.log(`   Создан: ${profile.createdAt.toLocaleString('ru-RU')}`);
    } else {
      console.log('   ❌ Профиль не найден');
    }

    console.log('\n📝 Ответы на анкету:');
    console.log(`   Всего ответов: ${user.userAnswers.length}`);
    if (user.userAnswers.length > 0) {
      console.log('   Последние ответы:');
      user.userAnswers.slice(0, 5).forEach((answer: any, idx: number) => {
        console.log(`   ${idx + 1}. [${answer.question?.code}] ${answer.answerValue || answer.answerValues?.join(', ')}`);
      });
    }

    console.log('\n📅 План 28:');
    if (user.plan28s.length > 0) {
      const plan = user.plan28s[0];
      console.log(`   ID: ${plan.id}`);
      console.log(`   Создан: ${plan.createdAt.toLocaleString('ru-RU')}`);
    } else {
      console.log('   ❌ План не найден');
    }

    console.log('\n🔄 Прогресс анкеты (questionnaireProgress):');
    if (user.questionnaireProgress.length > 0) {
      const progress = user.questionnaireProgress[0];
      console.log(`   ID: ${progress.id}`);
      console.log(`   questionIndex: ${progress.questionIndex}`);
      console.log(`   completed: ${progress.completed}`);
      console.log(`   answers: ${JSON.stringify(progress.answers).substring(0, 200)}...`);
      console.log(`   Обновлен: ${progress.updatedAt.toLocaleString('ru-RU')}`);
    } else {
      console.log('   ❌ Сохраненный прогресс анкеты не найден');
    }

    // Проверяем логи
    console.log('\n📜 Последние логи пользователя (связанные с quiz):');
    const logs = await prisma.clientLog.findMany({
      where: {
        userId: user.id,
        OR: [
          { message: { contains: 'quiz', mode: 'insensitive' } },
          { message: { contains: 'info', mode: 'insensitive' } },
          { message: { contains: 'screen', mode: 'insensitive' } },
          { message: { contains: 'init', mode: 'insensitive' } },
          { message: { contains: 'currentInfoScreenIndex', mode: 'insensitive' } },
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    if (logs.length > 0) {
      logs.forEach((log, idx) => {
        const time = log.createdAt.toLocaleString('ru-RU');
        console.log(`   ${idx + 1}. [${time}] ${log.level}: ${log.message.substring(0, 100)}`);
      });
    } else {
      console.log('   ❌ Логи не найдены');
    }

  } catch (error: any) {
    console.error('❌ Ошибка:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkUserQuizState()
  .then(() => {
    console.log('\n✅ Проверка завершена');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Ошибка:', error);
    process.exit(1);
  });
