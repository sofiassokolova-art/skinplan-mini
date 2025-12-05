// scripts/test-100-users.ts
// Скрипт для создания 100 тестовых пользователей и проверки работы системы

import { PrismaClient } from '@prisma/client';
import { createSkinProfile } from '@/lib/profile-calculator';
import { getProductsForStep } from '@/lib/product-selection';

const prisma = new PrismaClient();

interface TestResult {
  userId: string;
  success: boolean;
  errors: string[];
  profileCreated: boolean;
  recommendationSessionCreated: boolean;
  productsCount: number;
  ruleMatched: boolean;
  duration: number;
}

async function createTestUser(index: number) {
  const telegramId = `test-user-${index}-${Date.now()}`;
  return await prisma.user.upsert({
    where: { telegramId },
    update: {},
    create: {
      telegramId,
      firstName: `Test${index}`,
      lastName: `User${index}`,
    },
  });
}

async function createTestAnswers(userId: string, questionnaireId: number) {
  // Получаем вопросы из анкеты
  const questionnaire = await prisma.questionnaire.findUnique({
    where: { id: questionnaireId },
    include: {
      questions: {
        include: {
          answerOptions: {
            orderBy: { position: 'asc' },
          },
        },
      },
      questionGroups: {
        include: {
          questions: {
            include: {
              answerOptions: {
                orderBy: { position: 'asc' },
              },
            },
          },
        },
      },
    },
  });

  if (!questionnaire) {
    throw new Error(`Questionnaire ${questionnaireId} not found`);
  }

  const allQuestions = [
    ...questionnaire.questions,
    ...questionnaire.questionGroups.flatMap(g => g.questions),
  ];

  const answers = [];

  // Случайно выбираем ответы для каждого вопроса
  for (const question of allQuestions) {
    if (question.answerOptions.length === 0) continue;

    // Для multi_choice выбираем несколько ответов
    if (question.type === 'multi_choice') {
      const selectedOptions = question.answerOptions
        .slice(0, Math.min(2, question.answerOptions.length))
        .map(opt => opt.value || opt.label)
        .filter(Boolean);
      
      if (selectedOptions.length > 0) {
        answers.push({
          userId,
          questionnaireId,
          questionId: question.id,
          answerValues: selectedOptions,
        });
      }
    } else {
      // Для single_choice выбираем один ответ
      const selectedOption = question.answerOptions[0];
      if (selectedOption) {
        answers.push({
          userId,
          questionnaireId,
          questionId: question.id,
          answerValue: selectedOption.value || selectedOption.label,
        });
      }
    }
  }

  // Создаем ответы в БД
  const createdAnswers = await Promise.all(
    answers.map(answer => 
      prisma.userAnswer.create({
        data: answer,
        include: {
          question: {
            include: {
              answerOptions: true,
            },
          },
        },
      })
    )
  );

  return createdAnswers;
}

async function processUser(index: number, questionnaireId: number): Promise<TestResult> {
  const startTime = Date.now();
  const result: TestResult = {
    userId: '',
    success: false,
    errors: [],
    profileCreated: false,
    recommendationSessionCreated: false,
    productsCount: 0,
    ruleMatched: false,
    duration: 0,
  };

  try {
    // 1. Создаем пользователя
    const user = await createTestUser(index);
    result.userId = user.id;

    // 2. Создаем ответы
    const answers = await createTestAnswers(user.id, questionnaireId);
    if (answers.length === 0) {
      result.errors.push('No answers created');
      return result;
    }

    // 3. Получаем полные ответы с вопросами
    const fullAnswers = await prisma.userAnswer.findMany({
      where: {
        userId: user.id,
        questionnaireId,
      },
      include: {
        question: {
          include: {
            answerOptions: true,
          },
        },
      },
    });

    // 4. Получаем анкету
    const questionnaire = await prisma.questionnaire.findUnique({
      where: { id: questionnaireId },
    });

    if (!questionnaire) {
      result.errors.push('Questionnaire not found');
      return result;
    }

    // 5. Генерируем профиль
    const profileData = createSkinProfile(
      user.id,
      questionnaireId,
      fullAnswers,
      questionnaire.version
    );

    // Извлекаем diagnoses и concerns из ответов
    const diagnosesAnswer = fullAnswers.find(a => 
      a.question.code === 'diagnoses' || 
      a.question.code === 'DIAGNOSES'
    );
    const concernsAnswer = fullAnswers.find(a => 
      a.question.code === 'skin_concerns' || 
      a.question.code === 'current_concerns'
    );
    
    const extractedData: any = {};
    if (diagnosesAnswer && Array.isArray(diagnosesAnswer.answerValues)) {
      extractedData.diagnoses = diagnosesAnswer.answerValues;
    }
    if (concernsAnswer && Array.isArray(concernsAnswer.answerValues)) {
      extractedData.mainGoals = concernsAnswer.answerValues;
    }

    const mergedMarkers = {
      ...(profileData.medicalMarkers ? (profileData.medicalMarkers as any) : {}),
      ...extractedData,
    };

    // 6. Сохраняем профиль
    const profile = await prisma.skinProfile.create({
      data: {
        userId: user.id,
        version: questionnaire.version,
        ...profileData,
        medicalMarkers: Object.keys(mergedMarkers).length > 0 ? mergedMarkers : null,
      },
    });

    result.profileCreated = true;

    // 7. Получаем активные правила
    const rules = await prisma.recommendationRule.findMany({
      where: { isActive: true },
      orderBy: { priority: 'desc' },
    });

    if (rules.length === 0) {
      result.errors.push('No active rules found');
      return result;
    }

    // 8. Находим подходящее правило
    let matchedRule: any = null;
    
    for (const rule of rules) {
      const conditions = rule.conditionsJson as any;
      let matches = true;

      for (const [key, condition] of Object.entries(conditions)) {
        let profileValue: any;
        
        if (key === 'diagnoses') {
          profileValue = (profile.medicalMarkers as any)?.diagnoses || [];
        } else {
          profileValue = (profile as any)[key];
        }

        if (Array.isArray(condition)) {
          if (!condition.includes(profileValue)) {
            matches = false;
            break;
          }
        } else if (typeof condition === 'object' && condition !== null) {
          const conditionObj = condition as Record<string, unknown>;
          
          if ('hasSome' in conditionObj && Array.isArray(conditionObj.hasSome)) {
            const hasSomeArray = conditionObj.hasSome as any[];
            const profileArray = Array.isArray(profileValue) ? profileValue : [];
            const hasMatch = hasSomeArray.some(item => profileArray.includes(item));
            if (!hasMatch) {
              matches = false;
              break;
            }
            continue;
          }
        }
      }

      if (matches) {
        matchedRule = rule;
        break;
      }
    }

    if (!matchedRule) {
      result.errors.push('No matching rule found');
      return result;
    }

    result.ruleMatched = true;

    // 9. Получаем бюджет пользователя
    const budgetAnswer = fullAnswers.find(a => a.question?.code === 'budget');
    const userBudget = budgetAnswer?.answerValue || 'любой';
    
    const budgetMapping: Record<string, string> = {
      'budget': 'mass',
      'medium': 'mid',
      'premium': 'premium',
      'any': null as any,
      'любой': null as any,
    };
    
    const userPriceSegment = budgetMapping[userBudget] || null;

    // 10. Подбираем продукты используя основную логику
    const stepsJson = matchedRule.stepsJson as any;
    const productIds: number[] = [];

    for (const [stepName, stepConfig] of Object.entries(stepsJson)) {
      const step = stepConfig as any;
      
      const stepWithBudget = {
        ...step,
        budget: step.budget || (userPriceSegment ? 
          (userPriceSegment === 'mass' ? 'бюджетный' : 
           userPriceSegment === 'mid' ? 'средний' : 
           userPriceSegment === 'premium' ? 'премиум' : 'любой') : 'любой'),
      };
      
      // ВАЖНО: Используем основную логику подбора продуктов
      const products = await getProductsForStep(stepWithBudget, userPriceSegment);
      productIds.push(...products.map(p => p.id));
    }

    result.productsCount = productIds.length;

    if (productIds.length === 0) {
      result.errors.push('No products selected');
      return result;
    }

    // 11. Создаем RecommendationSession
    await prisma.recommendationSession.create({
      data: {
        userId: user.id,
        profileId: profile.id,
        ruleId: matchedRule.id,
        products: productIds,
      },
    });

    result.recommendationSessionCreated = true;
    result.success = true;

  } catch (error: any) {
    result.errors.push(error?.message || String(error));
  } finally {
    result.duration = Date.now() - startTime;
  }

  return result;
}

async function cleanupTestUsers() {
  const testUsers = await prisma.user.findMany({
    where: {
      telegramId: { startsWith: 'test-user-' },
    },
  });

  for (const user of testUsers) {
    await prisma.userAnswer.deleteMany({ where: { userId: user.id } });
    await prisma.skinProfile.deleteMany({ where: { userId: user.id } });
    await prisma.recommendationSession.deleteMany({ where: { userId: user.id } });
    await prisma.user.delete({ where: { id: user.id } });
  }

  console.log(`✅ Очищено ${testUsers.length} тестовых пользователей`);
}

async function main() {
  console.log('\n🚀 Начинаем тестирование 100 пользователей...\n');

  // Находим активную анкету
  const activeQuestionnaire = await prisma.questionnaire.findFirst({
    where: { isActive: true },
  });

  if (!activeQuestionnaire) {
    console.error('❌ Активная анкета не найдена. Запустите seed:questionnaire');
    process.exit(1);
  }

  console.log(`✅ Найдена активная анкета: ${activeQuestionnaire.name} (ID: ${activeQuestionnaire.id})\n`);

  // Очищаем старых тестовых пользователей
  await cleanupTestUsers();

  const results: TestResult[] = [];
  const startTime = Date.now();

  // Обрабатываем пользователей последовательно (чтобы не перегрузить БД)
  for (let i = 1; i <= 100; i++) {
    console.log(`📝 Обработка пользователя ${i}/100...`);
    const result = await processUser(i, activeQuestionnaire.id);
    results.push(result);

    if (result.success) {
      console.log(`   ✅ Успешно: профиль создан, ${result.productsCount} продуктов, правило: ${result.ruleMatched ? 'найдено' : 'не найдено'}`);
    } else {
      console.log(`   ❌ Ошибка: ${result.errors.join(', ')}`);
    }
  }

  const totalDuration = Date.now() - startTime;

  // Статистика
  console.log('\n📊 СТАТИСТИКА:\n');
  console.log(`Всего пользователей: ${results.length}`);
  console.log(`Успешно обработано: ${results.filter(r => r.success).length}`);
  console.log(`Ошибок: ${results.filter(r => !r.success).length}`);
  console.log(`Профилей создано: ${results.filter(r => r.profileCreated).length}`);
  console.log(`Сессий рекомендаций создано: ${results.filter(r => r.recommendationSessionCreated).length}`);
  console.log(`Правил найдено: ${results.filter(r => r.ruleMatched).length}`);
  
  const avgProducts = results
    .filter(r => r.productsCount > 0)
    .reduce((sum, r) => sum + r.productsCount, 0) / results.filter(r => r.productsCount > 0).length;
  console.log(`Среднее количество продуктов: ${avgProducts.toFixed(1)}`);
  
  const avgDuration = results.reduce((sum, r) => sum + r.duration, 0) / results.length;
  console.log(`Средняя длительность обработки: ${avgDuration.toFixed(0)}ms`);
  console.log(`Общая длительность: ${(totalDuration / 1000).toFixed(1)}s`);

  // Ошибки
  const errors = results.filter(r => !r.success);
  if (errors.length > 0) {
    console.log('\n❌ ОШИБКИ:\n');
    const errorTypes: Record<string, number> = {};
    errors.forEach(r => {
      r.errors.forEach(e => {
        errorTypes[e] = (errorTypes[e] || 0) + 1;
      });
    });
    
    for (const [error, count] of Object.entries(errorTypes)) {
      console.log(`   ${error}: ${count} раз`);
    }
  }

  // Распределение по количеству продуктов
  console.log('\n📦 РАСПРЕДЕЛЕНИЕ ПО КОЛИЧЕСТВУ ПРОДУКТОВ:\n');
  const productCounts: Record<number, number> = {};
  results.forEach(r => {
    const count = r.productsCount;
    productCounts[count] = (productCounts[count] || 0) + 1;
  });
  
  for (const [count, users] of Object.entries(productCounts).sort((a, b) => Number(a[0]) - Number(b[0]))) {
    console.log(`   ${count} продуктов: ${users} пользователей`);
  }

  console.log('\n✅ Тестирование завершено!\n');

  await prisma.$disconnect();
}

main().catch((error) => {
  console.error('❌ Критическая ошибка:', error);
  process.exit(1);
});

