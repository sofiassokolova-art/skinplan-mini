// scripts/check-plan-logs-yesterday.ts
// Проверка логов генерации плана за вчера

import { prisma } from '../lib/db';

async function checkPlanLogsYesterday() {
  console.log('🔍 Проверяю логи генерации плана за вчера...\n');
  
  try {
    // Получаем начало вчерашнего дня
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);
    
    const today = new Date();
    today.setDate(today.getDate() - 1);
    today.setHours(23, 59, 59, 999);
    
    console.log(`📅 Период: ${yesterday.toLocaleString('ru-RU')} - ${today.toLocaleString('ru-RU')}\n`);
    
    // Ищем логи, связанные с генерацией плана
    const planLogs = await prisma.clientLog.findMany({
      where: {
        createdAt: {
          gte: yesterday,
          lte: today,
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
      take: 500,
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
    
    console.log(`📊 Найдено логов генерации плана за вчера: ${planLogs.length}\n`);
    
    if (planLogs.length === 0) {
      console.log('⚠️ Логов генерации плана за вчера не найдено');
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
      
      // Анализируем успешные генерации плана
      const successfulGenerations = planLogs.filter(log => 
        log.message.includes('Plan generated successfully') ||
        log.message.includes('plan generated successfully') ||
        (log.message.includes('Plan generated') && log.level !== 'error')
      );
      
      console.log(`\n✅ Успешных генераций плана: ${successfulGenerations.length}`);
      
      // Анализируем ошибки
      const errorLogs = planLogs.filter(log => log.level === 'error');
      console.log(`❌ Ошибок при генерации плана: ${errorLogs.length}`);
      
      // Показываем логи по пользователям с ключевыми событиями
      console.log('\n📋 Логи по пользователям (ключевые события):');
      Object.entries(byUser).forEach(([userId, data]) => {
        const userLogs = data.logs;
        const hasSuccess = userLogs.some(log => 
          log.message.includes('Plan generated successfully') ||
          log.message.includes('plan generated successfully')
        );
        const hasError = userLogs.some(log => log.level === 'error');
        const hasSubmit = userLogs.some(log => 
          log.message.includes('submitAnswers') ||
          log.message.includes('Answers submitted')
        );
        
        if (hasSuccess || hasError || hasSubmit) {
          console.log(`\n   👤 ${data.user?.firstName || 'Unknown'} (${data.user?.telegramId || 'N/A'})`);
          console.log(`      Всего логов: ${userLogs.length}`);
          console.log(`      ✅ Успешная генерация: ${hasSuccess ? 'Да' : 'Нет'}`);
          console.log(`      ❌ Ошибки: ${hasError ? 'Да' : 'Нет'}`);
          console.log(`      📝 Отправка ответов: ${hasSubmit ? 'Да' : 'Нет'}`);
          
          // Показываем ключевые события
          const keyEvents = userLogs.filter(log => 
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
              console.log(`         ${idx + 1}. [${time}] ${log.level.toUpperCase()}: ${log.message.substring(0, 100)}`);
            });
          }
        }
      });
      
      // Показываем все ошибки
      if (errorLogs.length > 0) {
        console.log(`\n\n❌ Все ошибки при генерации плана за вчера:`);
        errorLogs.forEach((log, idx) => {
          const time = new Date(log.createdAt).toLocaleString('ru-RU');
          console.log(`\n   ${idx + 1}. [${time}] ${log.message}`);
          console.log(`      User: ${log.user?.firstName || 'Unknown'} (${log.user?.telegramId || 'N/A'})`);
          if (log.context) {
            try {
              const context = typeof log.context === 'string' 
                ? JSON.parse(log.context) 
                : log.context;
              const contextStr = JSON.stringify(context, null, 2);
              if (contextStr.length > 500) {
                console.log(`      Context: ${contextStr.substring(0, 500)}...`);
              } else {
                console.log(`      Context: ${contextStr}`);
              }
            } catch (e) {
              console.log(`      Context: ${String(log.context).substring(0, 300)}`);
            }
          }
        });
      } else {
        console.log('\n\n✅ Ошибок при генерации плана за вчера не найдено');
      }
    }
    
    // Проверяем созданные планы за вчера
    console.log('\n\n📊 Проверяю созданные планы за вчера...');
    
    const plansYesterday = await prisma.plan28.findMany({
      where: {
        createdAt: {
          gte: yesterday,
          lte: today,
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
    
    console.log(`   Найдено планов за вчера: ${plansYesterday.length}`);
    
    if (plansYesterday.length > 0) {
      console.log('\n   Детали планов:');
      plansYesterday.forEach((plan, idx) => {
        const planData = plan.planData as any;
        const daysCount = planData?.days?.length || 0;
        console.log(`\n   ${idx + 1}. План ID: ${plan.id}`);
        console.log(`      User: ${plan.user?.firstName || 'Unknown'} (${plan.user?.telegramId || 'N/A'})`);
        console.log(`      Версия профиля: ${plan.profileVersion}`);
        console.log(`      Тип кожи: ${plan.skinProfile?.skinType || 'N/A'}`);
        console.log(`      Дней в плане: ${daysCount}`);
        console.log(`      Создан: ${plan.createdAt.toLocaleString('ru-RU')}`);
        
        if (daysCount > 0 && planData.days[0]) {
          const day1 = planData.days[0];
          const morningSteps = day1.morning?.length || 0;
          const eveningSteps = day1.evening?.length || 0;
          console.log(`      День 1 - Утро: ${morningSteps} шагов, Вечер: ${eveningSteps} шагов`);
        }
      });
    }
    
    // Проверяем RecommendationSession за вчера
    console.log('\n\n💾 Проверяю RecommendationSession за вчера...');
    
    const sessionsYesterday = await prisma.recommendationSession.findMany({
      where: {
        createdAt: {
          gte: yesterday,
          lte: today,
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
    
    console.log(`   Найдено сессий за вчера: ${sessionsYesterday.length}`);
    
    if (sessionsYesterday.length > 0) {
      sessionsYesterday.forEach((session, idx) => {
        const productsCount = Array.isArray(session.products) ? session.products.length : 0;
        console.log(`\n   ${idx + 1}. Session ID: ${session.id}`);
        console.log(`      User: ${session.user?.firstName || 'Unknown'} (${session.user?.telegramId || 'N/A'})`);
        console.log(`      Products: ${productsCount}`);
        console.log(`      RuleID: ${session.ruleId || 'N/A'}`);
        console.log(`      Создан: ${session.createdAt.toLocaleString('ru-RU')}`);
      });
    }
    
    // Анализ: проверяем, все ли планы имеют соответствующие логи
    console.log('\n\n🔍 Анализ согласованности данных:');
    
    if (plansYesterday.length > 0) {
      const planUserIds = new Set(plansYesterday.map(p => p.userId));
      const logUserIds = new Set(planLogs.map(l => l.userId).filter(Boolean));
      
      const usersWithPlanButNoLogs = Array.from(planUserIds).filter(id => !logUserIds.has(id));
      const usersWithLogsButNoPlan = Array.from(logUserIds).filter(id => !planUserIds.has(id));
      
      if (usersWithPlanButNoLogs.length > 0) {
        console.log(`   ⚠️ Пользователей с планом, но без логов: ${usersWithPlanButNoLogs.length}`);
      }
      if (usersWithLogsButNoPlan.length > 0) {
        console.log(`   ⚠️ Пользователей с логами, но без плана: ${usersWithLogsButNoPlan.length}`);
      }
      if (usersWithPlanButNoLogs.length === 0 && usersWithLogsButNoPlan.length === 0) {
        console.log(`   ✅ Все планы имеют соответствующие логи`);
      }
    }
    
  } catch (error: any) {
    console.error('❌ Ошибка:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

checkPlanLogsYesterday()
  .then(() => {
    console.log('\n✅ Проверка завершена');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Ошибка:', error);
    process.exit(1);
  });
