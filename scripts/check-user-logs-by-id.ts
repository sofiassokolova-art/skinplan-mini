// scripts/check-user-logs-by-id.ts
// Проверка логов для пользователя по userId

import { prisma } from '../lib/db';

const userId = process.argv[2] || 'cmieq8w2v0000js0480u0n0ax';

async function checkLogs() {
  console.log('🔍 Ищу логи для пользователя с userId:', userId);
  
  try {
    // Ищем пользователя
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, telegramId: true, firstName: true },
    });
    
    if (!user) {
      console.log('❌ Пользователь не найден');
      await prisma.$disconnect();
      return;
    }
    
    console.log('✅ Пользователь найден:', {
      userId: user.id,
      telegramId: user.telegramId,
      name: user.firstName,
    });
    
    // Получаем последние логи пользователя
    const logs = await prisma.clientLog.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    
    console.log(`\n📊 Найдено логов в БД: ${logs.length}`);
    
    if (logs.length === 0) {
      console.log('ℹ️ Логов в БД не найдено');
    } else {
      console.log('\n📋 Последние логи из БД:');
      logs.forEach((log, idx) => {
        const time = new Date(log.createdAt).toLocaleString('ru-RU');
        console.log(`\n${idx + 1}. [${time}] ${log.level.toUpperCase()}`);
        console.log(`   Message: ${log.message}`);
        if (log.context) {
          console.log(`   Context:`, JSON.stringify(log.context, null, 2));
        }
        if (log.url) {
          console.log(`   URL: ${log.url}`);
        }
      });
    }
    
    // Проверяем профиль
    const profiles = await prisma.skinProfile.findMany({
      where: { userId: user.id },
      orderBy: { version: 'desc' },
      take: 3,
    });
    
    if (profiles.length > 0) {
      console.log(`\n👤 Последние профили (${profiles.length}):`);
      profiles.forEach((profile, idx) => {
        const time = new Date(profile.createdAt).toLocaleString('ru-RU');
        console.log(`   ${idx + 1}. [${time}] Version: ${profile.version}, SkinType: ${profile.skinType}, Updated: ${new Date(profile.updatedAt).toLocaleString('ru-RU')}`);
      });
    } else {
      console.log('\n👤 Профили не найдены');
    }
    
    // Проверяем последние ответы
    const activeQuestionnaire = await prisma.questionnaire.findFirst({
      where: { isActive: true },
    });
    
    if (activeQuestionnaire) {
      const recentAnswers = await prisma.userAnswer.findMany({
        where: { 
          userId: user.id,
          questionnaireId: activeQuestionnaire.id,
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: {
          question: {
            select: { code: true, text: true },
          },
        },
      });
      
      if (recentAnswers.length > 0) {
        console.log(`\n📝 Последние ответы (${recentAnswers.length}):`);
        recentAnswers.forEach((answer, idx) => {
          const time = new Date(answer.createdAt).toLocaleString('ru-RU');
          console.log(`   ${idx + 1}. [${time}] ${answer.question.code}: ${answer.answerValue || JSON.stringify(answer.answerValues)}`);
        });
      } else {
        console.log('\n📝 Ответы не найдены');
      }
    }
    
    // Проверяем RecommendationSession
    const recentSessions = await prisma.recommendationSession.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });
    
    if (recentSessions.length > 0) {
      console.log(`\n💾 Последние RecommendationSession (${recentSessions.length}):`);
      recentSessions.forEach((session, idx) => {
        const time = new Date(session.createdAt).toLocaleString('ru-RU');
        const productsCount = Array.isArray(session.products) ? session.products.length : 0;
        console.log(`   ${idx + 1}. [${time}] ID: ${session.id}, Products: ${productsCount}, RuleID: ${session.ruleId}`);
      });
    } else {
      console.log('\n💾 RecommendationSession не найдены');
    }
    
  } catch (error: any) {
    console.error('❌ Ошибка:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

checkLogs()
  .then(() => {
    console.log('\n✅ Проверка завершена');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Ошибка:', error);
    process.exit(1);
  });
