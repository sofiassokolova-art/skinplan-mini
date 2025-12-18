// scripts/test-5-clients.ts
// Тестирование 5 клиентов: проверка что они отправили ответы и получили план без ошибок

import { prisma } from '../lib/db';
import { getCachedPlan } from '../lib/cache';
import { logger } from '../lib/logger';

interface TestResult {
  userId: string;
  telegramId: string;
  firstName: string | null;
  lastName: string | null;
  hasAnswers: boolean;
  answersCount: number;
  hasProfile: boolean;
  profileVersion: number | null;
  profileData: {
    skinType: string | null;
    acneLevel: number | null;
    sensitivityLevel: string | null;
  } | null;
  hasPlanInDB: boolean;
  hasPlanInCache: boolean;
  planDaysCount: number;
  planProductsCount: number;
  errors: string[];
  warnings: string[];
}

async function testClient(userId: string): Promise<TestResult> {
  const result: TestResult = {
    userId,
    telegramId: '',
    firstName: null,
    lastName: null,
    hasAnswers: false,
    answersCount: 0,
    hasProfile: false,
    profileVersion: null,
    profileData: null,
    hasPlanInDB: false,
    hasPlanInCache: false,
    planDaysCount: 0,
    planProductsCount: 0,
    errors: [],
    warnings: [],
  };

  try {
    // 1. Получаем пользователя
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        telegramId: true,
        firstName: true,
        lastName: true,
      },
    });

    if (!user) {
      result.errors.push('Пользователь не найден');
      return result;
    }

    result.telegramId = user.telegramId;
    result.firstName = user.firstName;
    result.lastName = user.lastName;

    // 2. Проверяем ответы на анкету
    const activeQuestionnaire = await prisma.questionnaire.findFirst({
      where: { isActive: true },
    });

    if (activeQuestionnaire) {
      const answers = await prisma.userAnswer.findMany({
        where: {
          userId: user.id,
          questionnaireId: activeQuestionnaire.id,
        },
      });

      result.hasAnswers = answers.length > 0;
      result.answersCount = answers.length;

      if (!result.hasAnswers) {
        result.errors.push('Нет ответов на анкету');
      } else if (result.answersCount < 5) {
        result.warnings.push(`Мало ответов: ${result.answersCount} (ожидается больше)`);
      }
    } else {
      result.warnings.push('Активная анкета не найдена');
    }

    // 3. Проверяем профиль кожи
    const profile = await prisma.skinProfile.findFirst({
      where: { userId: user.id },
      orderBy: { version: 'desc' },
    });

    if (profile) {
      result.hasProfile = true;
      result.profileVersion = profile.version;
      result.profileData = {
        skinType: profile.skinType,
        acneLevel: profile.acneLevel,
        sensitivityLevel: profile.sensitivityLevel,
      };

      if (!profile.skinType) {
        result.errors.push('Профиль создан, но тип кожи не определен');
      }
    } else {
      result.errors.push('Профиль кожи не найден');
    }

    // 4. Проверяем план в БД (Plan28)
    if (profile) {
      const plan28 = await prisma.plan28.findFirst({
        where: {
          userId: user.id,
          profileVersion: profile.version,
        },
      });

      if (plan28) {
        result.hasPlanInDB = true;
        const planData = plan28.planData as any;
        if (planData?.days) {
          result.planDaysCount = Array.isArray(planData.days) ? planData.days.length : 0;
          
          // Подсчитываем продукты
          const productIds = new Set<number>();
          if (Array.isArray(planData.days)) {
            for (const day of planData.days) {
              if (day.morning) {
                for (const step of day.morning) {
                  if (step.productId) productIds.add(step.productId);
                }
              }
              if (day.evening) {
                for (const step of day.evening) {
                  if (step.productId) productIds.add(step.productId);
                }
              }
              if (day.weekly) {
                for (const step of day.weekly) {
                  if (step.productId) productIds.add(step.productId);
                }
              }
            }
          }
          result.planProductsCount = productIds.size;
        }

        if (result.planDaysCount === 0) {
          result.errors.push('План в БД пустой: нет дней');
        }
        if (result.planDaysCount !== 28 && result.planDaysCount > 0) {
          result.warnings.push(`План содержит ${result.planDaysCount} дней вместо 28`);
        }
        if (result.planProductsCount === 0) {
          result.errors.push('План в БД пустой: нет продуктов');
        }
      } else {
        result.warnings.push('План не найден в БД (Plan28)');
      }

      // 5. Проверяем план в кэше (только если кэш доступен)
      try {
        const cachedPlan = await getCachedPlan(user.id, profile.version);
        if (cachedPlan && cachedPlan.plan28) {
          result.hasPlanInCache = true;
          
          if (!result.hasPlanInDB) {
            result.warnings.push('План есть в кэше, но отсутствует в БД');
          }

          const plan28 = cachedPlan.plan28;
          if (plan28.days) {
            const cachedDaysCount = Array.isArray(plan28.days) ? plan28.days.length : 0;
            if (cachedDaysCount !== result.planDaysCount && result.hasPlanInDB) {
              result.warnings.push(
                `Несоответствие: план в кэше имеет ${cachedDaysCount} дней, в БД - ${result.planDaysCount}`
              );
            }
          }
        } else {
          if (!result.hasPlanInDB) {
            result.errors.push('План не найден ни в кэше, ни в БД');
          } else {
            // Не предупреждаем об отсутствии в кэше, если кэш недоступен
            // Это нормально, если кэш не настроен
          }
        }
      } catch (cacheError: any) {
        // Игнорируем ошибки кэша, если это просто отсутствие переменных окружения
        const errorMessage = cacheError.message || String(cacheError);
        if (!errorMessage.includes('missing environment variables') && 
            !errorMessage.includes('Cache not available')) {
          result.warnings.push(`Ошибка проверки кэша: ${errorMessage}`);
        }
        // Если кэш недоступен, это не критично - план может быть только в БД
      }
    }

  } catch (error: any) {
    result.errors.push(`Критическая ошибка: ${error.message}`);
    logger.error('Error testing client', { userId, error });
  }

  return result;
}

async function findTestClients(): Promise<string[]> {
  // Находим пользователей, которые:
  // 1. Имеют ответы на анкету
  // 2. Имеют профиль кожи
  // 3. Имеют план (Plan28) или хотя бы профиль

  const activeQuestionnaire = await prisma.questionnaire.findFirst({
    where: { isActive: true },
  });

  if (!activeQuestionnaire) {
    throw new Error('Активная анкета не найдена');
  }

  // Находим всех пользователей с профилями (это более надежный способ)
  const usersWithProfiles = await prisma.skinProfile.findMany({
    select: {
      userId: true,
      version: true,
    },
    orderBy: [
      { version: 'desc' },
      { createdAt: 'desc' },
    ],
    take: 50, // Берем больше, чтобы выбрать лучших
  });

  // Группируем по userId, берем последнюю версию
  const profileMap = new Map<string, number>();
  for (const profile of usersWithProfiles) {
    if (!profileMap.has(profile.userId) || profileMap.get(profile.userId)! < profile.version) {
      profileMap.set(profile.userId, profile.version);
    }
  }

  const usersWithProfilesList = Array.from(profileMap.keys());

  // Проверяем наличие ответов для этих пользователей
  const usersWithAnswers = await prisma.userAnswer.groupBy({
    by: ['userId'],
    where: {
      userId: { in: usersWithProfilesList },
      questionnaireId: activeQuestionnaire.id,
    },
    _count: {
      userId: true,
    },
  });

  const answersCountMap = new Map<string, number>();
  for (const answer of usersWithAnswers) {
    answersCountMap.set(answer.userId, answer._count.userId);
  }

  // Фильтруем только тех, у кого есть ответы (минимум 5)
  const usersWithEnoughAnswers = usersWithProfilesList.filter(
    (userId) => (answersCountMap.get(userId) || 0) >= 5
  );

  // Проверяем наличие планов
  const usersWithPlans = await prisma.plan28.findMany({
    where: {
      userId: { in: usersWithEnoughAnswers },
    },
    select: {
      userId: true,
      profileVersion: true,
    },
  });

  // Создаем мапу userId -> profileVersion -> hasPlan
  const planMap = new Map<string, Set<number>>();
  for (const plan of usersWithPlans) {
    if (!planMap.has(plan.userId)) {
      planMap.set(plan.userId, new Set());
    }
    planMap.get(plan.userId)!.add(plan.profileVersion);
  }

  // Приоритизируем пользователей:
  // 1. С планом в БД для последней версии профиля (приоритет 1)
  // 2. С профилем и ответами, но без плана (приоритет 2)
  const prioritizedUsers: Array<{ userId: string; priority: number; answersCount: number }> = [];

  for (const userId of usersWithEnoughAnswers) {
    const profileVersion = profileMap.get(userId)!;
    const hasPlan = planMap.get(userId)?.has(profileVersion) || false;
    const answersCount = answersCountMap.get(userId) || 0;
    
    prioritizedUsers.push({
      userId,
      priority: hasPlan ? 1 : 2, // Приоритет выше для тех, у кого есть план
      answersCount,
    });
  }

  // Сортируем по приоритету, затем по количеству ответов
  prioritizedUsers.sort((a, b) => {
    if (a.priority !== b.priority) {
      return a.priority - b.priority;
    }
    return b.answersCount - a.answersCount; // Больше ответов = лучше
  });

  // Берем первые 5
  const selectedUserIds = prioritizedUsers.slice(0, 5).map((u) => u.userId);

  // Если не нашли 5, добавляем пользователей с профилями, даже если у них меньше ответов
  if (selectedUserIds.length < 5) {
    const remainingUsers = usersWithProfilesList
      .filter((userId) => !selectedUserIds.includes(userId))
      .slice(0, 5 - selectedUserIds.length);
    selectedUserIds.push(...remainingUsers);
  }

  return selectedUserIds;
}

async function runTests() {
  console.log('🧪 Тестирование 5 клиентов: проверка ответов и планов\n');
  console.log('='.repeat(80));

  try {
    // Находим 5 клиентов для тестирования
    console.log('\n📋 Поиск клиентов для тестирования...\n');
    const userIds = await findTestClients();

    if (userIds.length === 0) {
      console.error('❌ Не найдено клиентов для тестирования');
      process.exit(1);
    }

    console.log(`✅ Найдено ${userIds.length} клиентов для тестирования\n`);

    const results: TestResult[] = [];

    // Тестируем каждого клиента
    for (let i = 0; i < userIds.length; i++) {
      const userId = userIds[i];
      console.log(`\n${'='.repeat(80)}`);
      console.log(`👤 Клиент ${i + 1}/${userIds.length}`);
      console.log(`${'='.repeat(80)}\n`);

      const result = await testClient(userId);
      results.push(result);

      // Выводим результаты для этого клиента
      console.log(`📝 Имя: ${result.firstName || ''} ${result.lastName || ''}`);
      console.log(`🆔 Telegram ID: ${result.telegramId}`);
      console.log(`🆔 User ID: ${result.userId}\n`);

      console.log('📊 Результаты проверки:');
      console.log(`   ✅ Ответы: ${result.hasAnswers ? `Да (${result.answersCount})` : 'Нет'}`);
      console.log(`   ✅ Профиль: ${result.hasProfile ? `Да (версия ${result.profileVersion})` : 'Нет'}`);
      if (result.profileData) {
        console.log(`      Тип кожи: ${result.profileData.skinType || 'не определен'}`);
        console.log(`      Акне: ${result.profileData.acneLevel ?? 'не определен'}`);
        console.log(`      Чувствительность: ${result.profileData.sensitivityLevel || 'не определена'}`);
      }
      console.log(`   ✅ План в БД: ${result.hasPlanInDB ? 'Да' : 'Нет'}`);
      console.log(`   ✅ План в кэше: ${result.hasPlanInCache ? 'Да' : 'Нет'}`);
      if (result.hasPlanInDB || result.hasPlanInCache) {
        console.log(`      Дней в плане: ${result.planDaysCount}`);
        console.log(`      Продуктов в плане: ${result.planProductsCount}`);
      }

      if (result.errors.length > 0) {
        console.log(`\n   ❌ Ошибки:`);
        result.errors.forEach((err) => console.log(`      - ${err}`));
      }

      if (result.warnings.length > 0) {
        console.log(`\n   ⚠️  Предупреждения:`);
        result.warnings.forEach((warn) => console.log(`      - ${warn}`));
      }

      if (result.errors.length === 0 && result.warnings.length === 0) {
        console.log(`\n   ✅ Все проверки пройдены успешно!`);
      }
    }

    // Итоговый отчет
    console.log('\n' + '='.repeat(80));
    console.log('📊 ИТОГОВЫЙ ОТЧЕТ');
    console.log('='.repeat(80) + '\n');

    let successCount = 0;
    let errorCount = 0;
    let warningCount = 0;

    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      const hasErrors = result.errors.length > 0;
      const hasWarnings = result.warnings.length > 0;

      if (hasErrors) {
        errorCount++;
        console.log(`❌ ${i + 1}. ${result.firstName || ''} ${result.lastName || ''} (${result.telegramId})`);
        result.errors.forEach((err) => console.log(`   - ${err}`));
      } else if (hasWarnings) {
        warningCount++;
        console.log(`⚠️  ${i + 1}. ${result.firstName || ''} ${result.lastName || ''} (${result.telegramId})`);
        result.warnings.forEach((warn) => console.log(`   - ${warn}`));
      } else {
        successCount++;
        console.log(`✅ ${i + 1}. ${result.firstName || ''} ${result.lastName || ''} (${result.telegramId})`);
        console.log(`   Ответы: ${result.answersCount}, Профиль: версия ${result.profileVersion}, План: ${result.planDaysCount} дней, ${result.planProductsCount} продуктов`);
      }
      console.log('');
    }

    console.log('='.repeat(80));
    console.log(`✅ Успешно: ${successCount}/${results.length}`);
    console.log(`⚠️  С предупреждениями: ${warningCount}/${results.length}`);
    console.log(`❌ С ошибками: ${errorCount}/${results.length}`);
    console.log('='.repeat(80));

    // Возвращаем код выхода
    if (errorCount > 0) {
      console.log('\n❌ Тестирование завершено с ошибками');
      process.exit(1);
    } else if (warningCount > 0) {
      console.log('\n⚠️  Тестирование завершено с предупреждениями');
      process.exit(0);
    } else {
      console.log('\n🎉 Все тесты пройдены успешно!');
      process.exit(0);
    }

  } catch (error: any) {
    console.error('\n❌ Критическая ошибка:', error);
    logger.error('Critical error in test-5-clients', { error });
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runTests();
