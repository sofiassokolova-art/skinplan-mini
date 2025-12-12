// scripts/check-user-logs.ts
// Скрипт для проверки логов и профиля пользователя

import { prisma } from '../lib/db';
import { getRedis } from '../lib/redis';

const telegramId = 287939646;

async function checkUserLogs() {
  try {
    console.log(`\n🔍 Проверяю логи и профиль пользователя с telegramId: ${telegramId}\n`);

    // Находим пользователя
    const user = await prisma.user.findFirst({
      where: { telegramId: String(telegramId) },
      include: {
        skinProfiles: {
          orderBy: { version: 'desc' },
          take: 1,
        },
        userAnswers: {
          include: {
            question: {
              select: {
                code: true,
                text: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!user) {
      console.error('❌ Пользователь не найден');
      return;
    }

    console.log('✅ Пользователь найден:');
    console.log(`   ID: ${user.id}`);
    console.log(`   Telegram ID: ${user.telegramId}`);
    console.log(`   Имя: ${user.firstName || 'не указано'}`);
    console.log(`   Профилей: ${user.skinProfiles.length}`);

    // Проверяем последний профиль
    if (user.skinProfiles.length > 0) {
      const profile = user.skinProfiles[0];
      console.log('\n📊 Последний профиль:');
      console.log(`   Версия: ${profile.version}`);
      console.log(`   Тип кожи: ${profile.skinType || 'не указан'}`);
      console.log(`   Уровень чувствительности: ${profile.sensitivityLevel || 'не указан'}`);
      console.log(`   Уровень акне: ${profile.acneLevel || 'не указан'}`);
      console.log(`   Возрастная группа: ${profile.ageGroup || 'не указана'}`);
      
      if (profile.medicalMarkers) {
        const markers = profile.medicalMarkers as any;
        console.log(`   Диагнозы: ${Array.isArray(markers.diagnoses) ? markers.diagnoses.join(', ') || 'нет' : 'нет'}`);
        console.log(`   Противопоказания: ${Array.isArray(markers.contraindications) ? markers.contraindications.join(', ') || 'нет' : 'нет'}`);
      }
    }

    // Проверяем ответы
    console.log('\n📝 Ответы пользователя:');
    if (user.userAnswers.length > 0) {
      const answersByCode = new Map<string, any>();
      user.userAnswers.forEach(answer => {
        const code = answer.question?.code;
        if (code) {
          answersByCode.set(code, {
            value: answer.answerValue,
            values: answer.answerValues,
            question: answer.question?.text,
          });
        }
      });
      
      console.log(`   Всего ответов: ${user.userAnswers.length}`);
      console.log(`   Уникальных вопросов: ${answersByCode.size}`);
      
      // Показываем ключевые ответы
      const keyCodes = ['skin_type', 'sensitivity_level', 'acne_level', 'diagnoses', 'contraindications'];
      keyCodes.forEach(code => {
        const answer = answersByCode.get(code);
        if (answer) {
          console.log(`   ${code}: ${Array.isArray(answer.values) ? answer.values.join(', ') : answer.value || 'не указано'}`);
        }
      });
    } else {
      console.log('   ❌ Ответов нет');
    }

    // Проверяем план
    const plan = await prisma.plan28.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
    });

    if (plan && plan.planData) {
      const planData = plan.planData as any;
      console.log('\n📅 План:');
      console.log(`   Версия профиля: ${plan.profileVersion}`);
      console.log(`   Дней в плане: ${planData.days?.length || 0}`);
      
      if (planData.days && planData.days.length > 0) {
        const day1 = planData.days[0];
        console.log(`   День 1 - Утро: ${day1.morning?.length || 0} шагов`);
        console.log(`   День 1 - Вечер: ${day1.evening?.length || 0} шагов`);
        
        if (day1.morning) {
          console.log(`   Утренние шаги:`);
          day1.morning.forEach((step: any, idx: number) => {
            console.log(`     ${idx + 1}. ${step.stepCategory}${step.productId ? ` (продукт: ${step.productId})` : ' (без продукта)'}`);
          });
        }
        
        if (day1.evening) {
          console.log(`   Вечерние шаги:`);
          day1.evening.forEach((step: any, idx: number) => {
            console.log(`     ${idx + 1}. ${step.stepCategory}${step.productId ? ` (продукт: ${step.productId})` : ' (без продукта)'}`);
          });
        }
      }
    } else {
      console.log('\n📅 План не найден');
    }

    // Проверяем логи из БД
    console.log('\n📋 Логи из БД (последние 20):');
    const dbLogs = await prisma.clientLog.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    if (dbLogs.length > 0) {
      dbLogs.forEach((log, idx) => {
        console.log(`\n   ${idx + 1}. [${log.level}] ${log.message}`);
        if (log.context) {
          try {
            const context = typeof log.context === 'string' ? JSON.parse(log.context) : log.context;
            if (context.step || context.stepCategory) {
              console.log(`      Шаг: ${context.step || context.stepCategory}`);
            }
            if (context.skinType) {
              console.log(`      Тип кожи: ${context.skinType}`);
            }
            if (context.diagnoses) {
              console.log(`      Диагнозы: ${Array.isArray(context.diagnoses) ? context.diagnoses.join(', ') : context.diagnoses}`);
            }
            if (context.allowedMorningSteps || context.allowedEveningSteps) {
              console.log(`      Разрешенные шаги (утро): ${context.allowedMorningSteps?.length || 0}`);
              console.log(`      Разрешенные шаги (вечер): ${context.allowedEveningSteps?.length || 0}`);
            }
          } catch (e) {
            // Игнорируем ошибки парсинга
          }
        }
      });
    } else {
      console.log('   ❌ Логов в БД нет');
    }

    // Проверяем логи из KV (если доступны)
    console.log('\n📋 Попытка получить логи из KV...');
    const redis = getRedis();
    if (redis) {
      try {
        // Ищем ключи логов для этого пользователя
        const logKeys = await redis.keys(`client_logs:${user.id}:*`);
        if (logKeys.length > 0) {
          console.log(`   Найдено ${logKeys.length} логов в KV`);
          // Берем последние 10
          const recentKeys = logKeys.slice(0, 10);
          for (const key of recentKeys) {
            const logData = await redis.get(key);
            if (logData) {
              try {
                const log = typeof logData === 'string' ? JSON.parse(logData) : logData;
                if (log.message?.includes('Step filtered') || log.message?.includes('Only minimal steps')) {
                  console.log(`\n   [${log.level}] ${log.message}`);
                  if (log.context) {
                    console.log(`      Контекст:`, JSON.stringify(log.context, null, 2));
                  }
                }
              } catch (e) {
                // Игнорируем ошибки парсинга
              }
            }
          }
        } else {
          console.log('   ❌ Логов в KV нет');
        }
      } catch (kvError: any) {
        console.log(`   ⚠️ Ошибка при чтении из KV: ${kvError?.message}`);
      }
    } else {
      console.log('   ⚠️ KV недоступен');
    }

    console.log('\n✅ Проверка завершена\n');
  } catch (error: any) {
    console.error('❌ Ошибка:', error?.message);
    console.error(error?.stack);
  } finally {
    await prisma.$disconnect();
  }
}

checkUserLogs();
