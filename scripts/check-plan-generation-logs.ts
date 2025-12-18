// scripts/check-plan-generation-logs.ts
// Проверка логов генерации плана для пользователя

import { prisma } from '../lib/db';

const telegramId = process.argv[2] || '643160759';

async function checkPlanGenerationLogs() {
  console.log(`🔍 Проверяю логи генерации плана для пользователя: ${telegramId}\n`);
  
  try {
    // Находим пользователя
    const user = await prisma.user.findFirst({
      where: { telegramId },
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
    
    // Проверяем профиль
    const profiles = await prisma.skinProfile.findMany({
      where: { userId: user.id },
      orderBy: { version: 'desc' },
      take: 3,
    });
    
    console.log(`\n👤 Профили: ${profiles.length}`);
    if (profiles.length > 0) {
      profiles.forEach((p, idx) => {
        console.log(`   ${idx + 1}. Version ${p.version}, SkinType: ${p.skinType}, Created: ${p.createdAt.toLocaleString('ru-RU')}`);
      });
    } else {
      console.log('   ❌ Профили не найдены');
    }
    
    // Проверяем RecommendationSession
    const sessions = await prisma.recommendationSession.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 3,
    });
    
    console.log(`\n💾 RecommendationSessions: ${sessions.length}`);
    if (sessions.length > 0) {
      sessions.forEach((s, idx) => {
        const productsCount = Array.isArray(s.products) ? s.products.length : 0;
        console.log(`   ${idx + 1}. ID: ${s.id}, Products: ${productsCount}, RuleID: ${s.ruleId}, Created: ${s.createdAt.toLocaleString('ru-RU')}`);
      });
    } else {
      console.log('   ❌ RecommendationSessions не найдены');
    }
    
    // Проверяем план через Plan28
    const planProgress = await prisma.planProgress.findFirst({
      where: { userId: user.id },
      include: {
        plan28: {
          include: {
            days: {
              take: 1,
              orderBy: { day: 'asc' },
            },
          },
        },
      },
    }).catch(() => null);
    
    console.log(`\n📅 План:`);
    if (planProgress && planProgress.plan28) {
      const plan28 = planProgress.plan28;
      console.log(`   ✅ План найден! ID: ${plan28.id}`);
      console.log(`   Дней: ${plan28.days?.length || 0}`);
      console.log(`   Создан: ${plan28.createdAt.toLocaleString('ru-RU')}`);
      console.log(`   Обновлен: ${plan28.updatedAt.toLocaleString('ru-RU')}`);
    } else {
      console.log('   ❌ План не найден');
    }
    
    // Проверяем логи из БД
    const logs = await prisma.clientLog.findMany({
      where: { 
        userId: user.id,
        OR: [
          { message: { contains: 'plan', mode: 'insensitive' } },
          { message: { contains: 'Plan', mode: 'insensitive' } },
          { message: { contains: 'generate', mode: 'insensitive' } },
          { message: { contains: 'генерац', mode: 'insensitive' } },
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: 30,
    });
    
    console.log(`\n📋 Логи генерации плана (последние ${logs.length}):`);
    if (logs.length === 0) {
      console.log('   Логов не найдено');
    } else {
      logs.forEach((log, idx) => {
        const time = new Date(log.createdAt).toLocaleString('ru-RU');
        console.log(`\n   ${idx + 1}. [${time}] ${log.level.toUpperCase()}`);
        console.log(`      Message: ${log.message}`);
        if (log.context) {
          try {
            const context = typeof log.context === 'string' 
              ? JSON.parse(log.context) 
              : log.context;
            const contextStr = JSON.stringify(context, null, 2);
            if (contextStr.length > 300) {
              console.log(`      Context: ${contextStr.substring(0, 300)}...`);
            } else {
              console.log(`      Context: ${contextStr}`);
            }
          } catch (e) {
            console.log(`      Context: ${String(log.context).substring(0, 200)}`);
          }
        }
      });
    }
    
    // Проверяем последние ответы
    const activeQuestionnaire = await prisma.questionnaire.findFirst({
      where: { isActive: true },
    });
    
    if (activeQuestionnaire) {
      const allAnswers = await prisma.userAnswer.findMany({
        where: { 
          userId: user.id,
          questionnaireId: activeQuestionnaire.id,
        },
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: {
          question: {
            select: { code: true },
          },
        },
      });
      
      console.log(`\n📝 Последние ответы: ${allAnswers.length}`);
      if (allAnswers.length > 0) {
        console.log(`   Последний ответ: ${allAnswers[0].question.code} в ${allAnswers[0].createdAt.toLocaleString('ru-RU')}`);
      }
    }
    
  } catch (error: any) {
    console.error('❌ Ошибка:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

checkPlanGenerationLogs()
  .then(() => {
    console.log('\n✅ Проверка завершена');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Ошибка:', error);
    process.exit(1);
  });
