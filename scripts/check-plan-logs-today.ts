// scripts/check-plan-logs-today.ts
// Проверка логов генерации плана за сегодня

import { prisma } from '../lib/db';

async function checkPlanLogsToday() {
  console.log('🔍 Проверяю логи генерации плана за сегодня...\n');
  
  try {
    // Получаем начало сегодняшнего дня
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    console.log(`📅 Период: ${today.toLocaleString('ru-RU')} - ${tomorrow.toLocaleString('ru-RU')}\n`);
    
    // Ищем логи, связанные с генерацией плана
    const planLogs = await prisma.clientLog.findMany({
      where: {
        createdAt: {
          gte: today,
          lt: tomorrow,
        },
        OR: [
          { message: { contains: 'Plan generated', mode: 'insensitive' } },
          { message: { contains: 'Plan generation', mode: 'insensitive' } },
          { message: { contains: 'plan generated successfully', mode: 'insensitive' } },
          { message: { contains: 'plan generation failed', mode: 'insensitive' } },
          { message: { contains: 'submitAnswers', mode: 'insensitive' } },
          { message: { contains: 'Answers submitted', mode: 'insensitive' } },
          { message: { contains: 'profile created', mode: 'insensitive' } },
          { message: { contains: 'generatePlan', mode: 'insensitive' } },
          { message: { contains: 'генерац', mode: 'insensitive' } },
          { message: { contains: 'план', mode: 'insensitive' } },
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: {
        user: {
          select: {
            telegramId: true,
            firstName: true,
            id: true,
          },
        },
      },
    });
    
    console.log(`📊 Найдено логов генерации плана за сегодня: ${planLogs.length}\n`);
    
    if (planLogs.length === 0) {
      console.log('⚠️ Логов генерации плана за сегодня не найдено');
    } else {
      // Группируем по уровням
      const byLevel = planLogs.reduce((acc, log) => {
        acc[log.level] = (acc[log.level] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      
      console.log('📈 Распределение по уровням:');
      Object.entries(byLevel).forEach(([level, count]) => {
        console.log(`   ${level.toUpperCase()}: ${count}`);
      });
      
      // Группируем по пользователям
      const byUser = planLogs.reduce((acc, log) => {
        const userId = log.userId || 'unknown';
        if (!acc[userId]) {
          acc[userId] = {
            user: log.user,
            logs: [],
          };
        }
        acc[userId].logs.push(log);
        return acc;
      }, {} as Record<string, { user: any; logs: any[] }>);
      
      console.log(`\n👥 Уникальных пользователей: ${Object.keys(byUser).length}`);
      
      // Показываем логи по пользователям
      console.log('\n📋 Логи по пользователям:');
      Object.entries(byUser).forEach(([userId, data]) => {
        console.log(`\n   👤 ${data.user?.firstName || 'Unknown'} (${data.user?.telegramId || 'N/A'})`);
        console.log(`      Логов: ${data.logs.length}`);
        
        // Показываем ключевые события
        const keyEvents = data.logs.filter(log => 
          log.message.includes('Plan generated') ||
          log.message.includes('Plan generation failed') ||
          log.message.includes('Answers submitted') ||
          log.message.includes('profile created') ||
          log.level === 'error'
        );
        
        if (keyEvents.length > 0) {
          console.log(`      Ключевые события:`);
          keyEvents.forEach((log, idx) => {
            const time = new Date(log.createdAt).toLocaleString('ru-RU');
            console.log(`         ${idx + 1}. [${time}] ${log.level.toUpperCase()}: ${log.message}`);
          });
        }
      });
      
      // Показываем все логи в хронологическом порядке
      console.log('\n\n📋 Все логи в хронологическом порядке:');
      planLogs.forEach((log, idx) => {
        const time = new Date(log.createdAt).toLocaleString('ru-RU');
        console.log(`\n${idx + 1}. [${time}] ${log.level.toUpperCase()}`);
        console.log(`   User: ${log.user?.firstName || 'Unknown'} (${log.user?.telegramId || 'N/A'})`);
        console.log(`   Message: ${log.message}`);
        if (log.context) {
          try {
            const context = typeof log.context === 'string' 
              ? JSON.parse(log.context) 
              : log.context;
            const contextStr = JSON.stringify(context, null, 2);
            if (contextStr.length > 300) {
              console.log(`   Context: ${contextStr.substring(0, 300)}...`);
            } else {
              console.log(`   Context: ${contextStr}`);
            }
          } catch (e) {
            console.log(`   Context: ${String(log.context).substring(0, 200)}`);
          }
        }
        if (log.url) {
          console.log(`   URL: ${log.url}`);
        }
      });
      
      // Проверяем ошибки
      const errorLogs = planLogs.filter(log => log.level === 'error');
      if (errorLogs.length > 0) {
        console.log(`\n\n❌ Найдено ${errorLogs.length} ошибок при генерации плана:`);
        errorLogs.forEach((log, idx) => {
          const time = new Date(log.createdAt).toLocaleString('ru-RU');
          console.log(`\n   ${idx + 1}. [${time}] ${log.message}`);
          console.log(`      User: ${log.user?.firstName || 'Unknown'} (${log.user?.telegramId || 'N/A'})`);
          if (log.context) {
            try {
              const context = typeof log.context === 'string' 
                ? JSON.parse(log.context) 
                : log.context;
              console.log(`      Context:`, JSON.stringify(context, null, 2).substring(0, 500));
            } catch (e) {
              console.log(`      Context: ${String(log.context).substring(0, 300)}`);
            }
          }
        });
      } else {
        console.log('\n\n✅ Ошибок при генерации плана не найдено');
      }
    }
    
    // Также проверяем серверные логи через Plan28 и RecommendationSession
    console.log('\n\n📊 Проверяю созданные планы за сегодня...');
    
    const plansToday = await prisma.plan28.findMany({
      where: {
        createdAt: {
          gte: today,
          lt: tomorrow,
        },
      },
      include: {
        user: {
          select: {
            telegramId: true,
            firstName: true,
          },
        },
        skinProfile: {
          select: {
            version: true,
            skinType: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    
    console.log(`   Найдено планов за сегодня: ${plansToday.length}`);
    
    if (plansToday.length > 0) {
      plansToday.forEach((plan, idx) => {
        const planData = plan.planData as any;
        const daysCount = planData?.days?.length || 0;
        console.log(`\n   ${idx + 1}. План ID: ${plan.id}`);
        console.log(`      User: ${plan.user?.firstName || 'Unknown'} (${plan.user?.telegramId || 'N/A'})`);
        console.log(`      Версия профиля: ${plan.profileVersion}`);
        console.log(`      Тип кожи: ${plan.skinProfile?.skinType || 'N/A'}`);
        console.log(`      Дней в плане: ${daysCount}`);
        console.log(`      Создан: ${plan.createdAt.toLocaleString('ru-RU')}`);
      });
    }
    
    // Проверяем RecommendationSession за сегодня
    console.log('\n\n💾 Проверяю RecommendationSession за сегодня...');
    
    const sessionsToday = await prisma.recommendationSession.findMany({
      where: {
        createdAt: {
          gte: today,
          lt: tomorrow,
        },
      },
      include: {
        user: {
          select: {
            telegramId: true,
            firstName: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    
    console.log(`   Найдено сессий за сегодня: ${sessionsToday.length}`);
    
    if (sessionsToday.length > 0) {
      sessionsToday.forEach((session, idx) => {
        const productsCount = Array.isArray(session.products) ? session.products.length : 0;
        console.log(`\n   ${idx + 1}. Session ID: ${session.id}`);
        console.log(`      User: ${session.user?.firstName || 'Unknown'} (${session.user?.telegramId || 'N/A'})`);
        console.log(`      Products: ${productsCount}`);
        console.log(`      RuleID: ${session.ruleId || 'N/A'}`);
        console.log(`      Создан: ${session.createdAt.toLocaleString('ru-RU')}`);
      });
    }
    
  } catch (error: any) {
    console.error('❌ Ошибка:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

checkPlanLogsToday()
  .then(() => {
    console.log('\n✅ Проверка завершена');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Ошибка:', error);
    process.exit(1);
  });

