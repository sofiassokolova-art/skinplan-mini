// scripts/check-answers-in-db.ts
// Проверка сохранения ответов в БД

import { prisma } from '../lib/db';

async function checkAnswersInDB() {
  try {
    console.log('\n🔍 Проверка сохранения ответов в БД\n');
    console.log('='.repeat(60));

    // 1. Проверяем активную анкету
    const activeQuestionnaire = await prisma.questionnaire.findFirst({
      where: { isActive: true },
      select: { id: true, name: true },
    });

    if (!activeQuestionnaire) {
      console.log('❌ Активная анкета не найдена');
      return;
    }

    console.log(`✅ Активная анкета: ID=${activeQuestionnaire.id}, Name="${activeQuestionnaire.name}"`);

    // 2. Проверяем все ответы для активной анкеты
    const allAnswers = await prisma.userAnswer.findMany({
      where: {
        questionnaireId: activeQuestionnaire.id,
      },
      include: {
        question: {
          select: {
            id: true,
            code: true,
            text: true,
          },
        },
        user: {
          select: {
            id: true,
            telegramId: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 50, // Последние 50 ответов
    });

    console.log(`\n📊 Всего ответов в БД для активной анкеты: ${allAnswers.length}`);

    if (allAnswers.length === 0) {
      console.log('⚠️  В БД нет ответов для активной анкеты');
      console.log('   Это может означать, что:');
      console.log('   1. Пользователи еще не отвечали на вопросы');
      console.log('   2. Ответы не сохраняются из-за отсутствия initData');
      console.log('   3. Есть проблема с API сохранения');
      return;
    }

    // 3. Группируем по пользователям
    const answersByUser = allAnswers.reduce((acc, answer) => {
      const userId = answer.userId;
      if (!acc[userId]) {
        acc[userId] = {
          user: answer.user,
          answers: [],
        };
      }
      acc[userId].answers.push(answer);
      return acc;
    }, {} as Record<string, { user: any; answers: typeof allAnswers }>);

    console.log(`\n👥 Ответы по пользователям:`);
    Object.entries(answersByUser).forEach(([userId, data]) => {
      console.log(`   User ID: ${userId}`);
      console.log(`   Telegram ID: ${data.user?.telegramId || 'N/A'}`);
      console.log(`   Количество ответов: ${data.answers.length}`);
      console.log(`   Вопросы:`);
      data.answers.forEach((answer, index) => {
        console.log(`     ${index + 1}. ${answer.question?.code || 'N/A'} (ID: ${answer.questionId})`);
        console.log(`        Answer: ${answer.answerValue || JSON.stringify(answer.answerValues) || 'null'}`);
        console.log(`        Created: ${answer.createdAt}`);
      });
      console.log('');
    });

    // 4. Проверяем последние ответы (за последний час)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentAnswers = allAnswers.filter(a => a.createdAt >= oneHourAgo);

    console.log(`\n⏰ Ответы за последний час: ${recentAnswers.length}`);
    if (recentAnswers.length > 0) {
      recentAnswers.forEach((answer, index) => {
        console.log(`   ${index + 1}. User: ${answer.userId}, Question: ${answer.question?.code || answer.questionId}, Created: ${answer.createdAt}`);
      });
    }

    // 5. Проверяем статистику по вопросам
    const answersByQuestion = allAnswers.reduce((acc, answer) => {
      const questionCode = answer.question?.code || `question_${answer.questionId}`;
      if (!acc[questionCode]) {
        acc[questionCode] = {
          questionId: answer.questionId,
          count: 0,
          uniqueUsers: new Set<string>(),
        };
      }
      acc[questionCode].count++;
      acc[questionCode].uniqueUsers.add(answer.userId);
      return acc;
    }, {} as Record<string, { questionId: number; count: number; uniqueUsers: Set<string> }>);

    console.log(`\n📈 Статистика по вопросам:`);
    Object.entries(answersByQuestion).forEach(([code, stats]) => {
      console.log(`   ${code} (ID: ${stats.questionId}):`);
      console.log(`      Всего ответов: ${stats.count}`);
      console.log(`      Уникальных пользователей: ${stats.uniqueUsers.size}`);
    });

  } catch (error) {
    console.error('\n❌ Ошибка при проверке ответов в БД:', error);
    if (error instanceof Error) {
      console.error('   Message:', error.message);
      console.error('   Stack:', error.stack?.substring(0, 500));
    }
  } finally {
    await prisma.$disconnect();
  }
}

checkAnswersInDB();

