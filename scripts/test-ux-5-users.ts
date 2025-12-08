// scripts/test-ux-5-users.ts
// Полный тест UX на 5 текстовых пользователях

import { prisma } from '../lib/db';
import { logger } from '../lib/logger';

interface TestUser {
  name: string;
  telegramId: string;
  answers: Record<string, any>;
  expectedProfile: {
    skinType: string;
    acneLevel?: number;
    sensitivityLevel?: string;
  };
}

const TEST_USERS: TestUser[] = [
  {
    name: 'Анна - Жирная кожа + акне',
    telegramId: 'test_user_1',
    answers: {
      age: '25–34', // Используем реальные значения из анкеты
      skin_type: 'Тип 4 — Жирная',
      acne_level: '3',
      concerns: ['Акне', 'Расширенные поры'],
      sensitivity: 'Низкий уровень',
      budget: 'Средний сегмент',
      makeup_frequency: 'Ежедневно',
    },
    expectedProfile: {
      skinType: 'oily',
      acneLevel: 3,
      sensitivityLevel: 'low',
    },
  },
  {
    name: 'Мария - Сухая чувствительная кожа',
    telegramId: 'test_user_2',
    answers: {
      age: '25–34',
      skin_type: 'Тип 1 — Сухая',
      acne_level: '0',
      concerns: ['Сухость и стянутость', 'Чувствительность'],
      sensitivity: 'Высокий уровень',
      budget: 'Премиум сегмент',
      makeup_frequency: 'Редко',
    },
    expectedProfile: {
      skinType: 'dry',
      acneLevel: 0,
      sensitivityLevel: 'high',
    },
  },
  {
    name: 'Елена - Комбинированная + пигментация',
    telegramId: 'test_user_3',
    answers: {
      age: '35–44',
      skin_type: 'Тип 3 — Комбинированная (жирная)',
      acne_level: '1',
      concerns: ['Пигментация', 'Темные пятна'],
      sensitivity: 'Средний уровень',
      budget: 'Средний сегмент',
      makeup_frequency: 'Иногда',
    },
    expectedProfile: {
      skinType: 'combo',
      acneLevel: 1,
      sensitivityLevel: 'medium',
    },
  },
  {
    name: 'Ольга - Нормальная кожа + первые морщины',
    telegramId: 'test_user_4',
    answers: {
      age: '35–44',
      skin_type: 'Тип 2 — Нормальная',
      acne_level: '0',
      concerns: ['Морщины', 'Мелкие морщинки'],
      sensitivity: 'Низкий уровень',
      budget: 'Премиум сегмент',
      makeup_frequency: 'Иногда',
    },
    expectedProfile: {
      skinType: 'normal',
      acneLevel: 0,
      sensitivityLevel: 'low',
    },
  },
  {
    name: 'София - Чувствительная + обезвоженность',
    telegramId: 'test_user_5',
    answers: {
      age: '25–34',
      skin_type: 'Тип 1 — Сухая', // Чувствительная часто идет вместе с сухой
      acne_level: '0',
      concerns: ['Обезвоженность', 'Чувствительность'],
      sensitivity: 'Очень высокий уровень',
      budget: 'Бюджетный сегмент',
      makeup_frequency: 'Редко',
    },
    expectedProfile: {
      skinType: 'sensitive',
      acneLevel: 0,
      sensitivityLevel: 'very_high',
    },
  },
];

async function getActiveQuestionnaire() {
  const questionnaire = await prisma.questionnaire.findFirst({
    where: { isActive: true },
    orderBy: { version: 'desc' },
  });
  
  if (!questionnaire) {
    throw new Error('No active questionnaire found');
  }
  
  return questionnaire;
}

async function getQuestions(questionnaireId: number) {
  const questions = await prisma.question.findMany({
    where: { questionnaireId },
    include: {
      answerOptions: {
        orderBy: { position: 'asc' },
      },
    },
    orderBy: { position: 'asc' },
  });
  
  return questions;
}

async function createTestUser(telegramId: string, name: string) {
  // Удаляем существующего пользователя если есть
  const existing = await prisma.user.findUnique({
    where: { telegramId },
  });
  
  if (existing) {
    // Удаляем связанные данные
    await prisma.userAnswer.deleteMany({ where: { userId: existing.id } });
    await prisma.skinProfile.deleteMany({ where: { userId: existing.id } });
    await prisma.recommendationSession.deleteMany({ where: { userId: existing.id } });
    await prisma.planProgress.deleteMany({ where: { userId: existing.id } });
    await prisma.user.delete({ where: { id: existing.id } });
  }
  
  // Создаем нового пользователя
  const user = await prisma.user.create({
    data: {
      telegramId,
      firstName: name.split(' - ')[0],
      lastName: 'Test',
    },
  });
  
  return user;
}

async function submitAnswers(userId: string, questionnaireId: number, answers: Record<string, any>) {
  const questions = await getQuestions(questionnaireId);
  
  // Создаем мапу вопросов по коду
  const questionMap: Record<string, any> = {};
  for (const question of questions) {
    if (question.code) {
      questionMap[question.code.toLowerCase()] = question;
    }
  }
  
  // Маппинг наших упрощенных ответов на реальные коды вопросов и значения
  const answerMapping: Record<string, { questionCode: string; value: any }> = {
    age: { questionCode: 'age', value: answers.age },
    skin_type: { questionCode: 'skin_type', value: answers.skin_type },
    acne_level: { questionCode: 'skin_concerns', value: answers.acne_level ? ['acne'] : [] },
    concerns: { questionCode: 'skin_concerns', value: Array.isArray(answers.concerns) ? answers.concerns : [answers.concerns] },
    sensitivity: { questionCode: 'skin_sensitivity', value: answers.sensitivity },
    budget: { questionCode: 'budget', value: answers.budget },
    makeup_frequency: { questionCode: 'makeup_frequency', value: answers.makeup_frequency },
  };
  
  // Сохраняем ответы, используя правильные коды и значения
  for (const [key, mapping] of Object.entries(answerMapping)) {
    const question = questionMap[mapping.questionCode];
    if (!question) {
      console.warn(`⚠️  Вопрос с кодом "${mapping.questionCode}" не найден`);
      continue;
    }
    
    // Для multi_choice используем answerValues, для single_choice - answerValue
    const isMultiChoice = question.type === 'multi_choice';
    
    if (isMultiChoice && Array.isArray(mapping.value)) {
      // Находим варианты ответов по значениям
      const selectedOptions: string[] = [];
      for (const val of mapping.value) {
        const option = question.answerOptions.find((opt: any) => {
          const optValue = (opt.value || '').toLowerCase();
          const optLabel = (opt.label || '').toLowerCase();
          const searchVal = String(val).toLowerCase();
          
          return optValue === searchVal || 
                 optLabel === searchVal ||
                 optValue.includes(searchVal) ||
                 optLabel.includes(searchVal) ||
                 searchVal.includes(optValue) ||
                 searchVal.includes(optLabel);
        });
        
        if (option) {
          selectedOptions.push(option.value || option.label);
        }
      }
      
      if (selectedOptions.length > 0) {
        await prisma.userAnswer.create({
          data: {
            userId,
            questionnaireId,
            questionId: question.id,
            answerValues: selectedOptions,
          },
        });
      }
    } else if (!isMultiChoice && mapping.value) {
      // Находим вариант ответа
      const option = question.answerOptions.find((opt: any) => {
        const optValue = (opt.value || '').toLowerCase();
        const optLabel = (opt.label || '').toLowerCase();
        const searchVal = String(mapping.value).toLowerCase();
        
        return optValue === searchVal || 
               optLabel === searchVal ||
               optValue.includes(searchVal) ||
               optLabel.includes(searchVal) ||
               searchVal.includes(optValue) ||
               searchVal.includes(optLabel);
      });
      
      if (option) {
        await prisma.userAnswer.create({
          data: {
            userId,
            questionnaireId,
            questionId: question.id,
            answerValue: option.value || option.label,
          },
        });
      }
    }
  }
  
  // Добавляем обязательные ответы для всех вопросов
  for (const question of questions) {
    const existingAnswer = await prisma.userAnswer.findFirst({
      where: {
        userId,
        questionnaireId,
        questionId: question.id,
      },
    });
    
    if (!existingAnswer && question.answerOptions.length > 0) {
      // Берем первый вариант по умолчанию
      const defaultOption = question.answerOptions[0];
      if (question.type === 'multi_choice') {
        await prisma.userAnswer.create({
          data: {
            userId,
            questionnaireId,
            questionId: question.id,
            answerValues: [defaultOption.value || defaultOption.label],
          },
        });
      } else {
        await prisma.userAnswer.create({
          data: {
            userId,
            questionnaireId,
            questionId: question.id,
            answerValue: defaultOption.value || defaultOption.label,
          },
        });
      }
    }
  }
  
  // Получаем полные ответы для создания профиля
  const fullAnswers = await prisma.userAnswer.findMany({
    where: {
      userId,
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
  
  // Получаем анкету
  const questionnaire = await prisma.questionnaire.findUnique({
    where: { id: questionnaireId },
  });
  
  if (!questionnaire) {
    throw new Error('Questionnaire not found');
  }
  
  // Создаем профиль используя createSkinProfile
  const { createSkinProfile } = await import('../lib/profile-calculator');
  const profileData = createSkinProfile(
    userId,
    questionnaireId,
    fullAnswers,
    questionnaire.version
  );
  
  // Извлекаем дополнительные данные из ответов
  const diagnosesAnswer = fullAnswers.find(a => 
    a.question?.code?.toLowerCase() === 'diagnoses'
  );
  const concernsAnswer = fullAnswers.find(a => 
    a.question?.code?.toLowerCase() === 'concerns' ||
    a.question?.code?.toLowerCase() === 'skin_concerns'
  );
  
  const medicalMarkers: any = {};
  if (diagnosesAnswer && Array.isArray(diagnosesAnswer.answerValues)) {
    medicalMarkers.diagnoses = diagnosesAnswer.answerValues;
  }
  if (concernsAnswer && Array.isArray(concernsAnswer.answerValues)) {
    medicalMarkers.mainGoals = concernsAnswer.answerValues;
  }
  
  // Сохраняем профиль в БД
  const existingProfile = await prisma.skinProfile.findFirst({
    where: { userId },
    orderBy: { version: 'desc' },
  });
  
  const newVersion = existingProfile ? existingProfile.version + 1 : 1;
  
  const profile = await prisma.skinProfile.create({
    data: {
      userId,
      version: newVersion,
      skinType: profileData.skinType,
      sensitivityLevel: profileData.sensitivityLevel,
      acneLevel: profileData.acneLevel,
      dehydrationLevel: profileData.dehydrationLevel,
      rosaceaRisk: profileData.rosaceaRisk,
      pigmentationRisk: profileData.pigmentationRisk,
      ageGroup: profileData.ageGroup,
      hasPregnancy: profileData.hasPregnancy,
      medicalMarkers: Object.keys(medicalMarkers).length > 0 ? medicalMarkers : null,
      notes: profileData.notes,
    },
  });
  
  return profile;
}

async function testPlanGeneration(userId: string) {
  try {
    const { generate28DayPlan } = await import('../lib/plan-generator');
    const plan = await generate28DayPlan(userId);
    
    return {
      success: true,
      plan: {
        hasPlan28: !!plan.plan28,
        plan28DaysCount: plan.plan28?.days?.length || 0,
        hasWeeks: !!plan.weeks,
        weeksCount: plan.weeks?.length || 0,
        productsCount: plan.products?.length || 0,
      },
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message,
    };
  }
}

async function testRecommendations(userId: string) {
  try {
    const profile = await prisma.skinProfile.findFirst({
      where: { userId },
      orderBy: { version: 'desc' },
    });
    
    if (!profile) {
      return { success: false, error: 'No profile found' };
    }
    
    const session = await prisma.recommendationSession.findFirst({
      where: { userId, profileId: profile.id },
      orderBy: { createdAt: 'desc' },
    });
    
    if (!session) {
      return { success: false, error: 'No recommendation session found' };
    }
    
    const products = Array.isArray(session.products) ? session.products : [];
    
    return {
      success: true,
      productsCount: products.length,
      productIds: products,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message,
    };
  }
}

async function runUXTest() {
  console.log('🧪 Начинаем полный тест UX на 5 пользователях...\n');
  
  const questionnaire = await getActiveQuestionnaire();
  console.log(`📋 Используем анкету: ID ${questionnaire.id}, версия ${questionnaire.version}\n`);
  
  const results: Array<{
    user: TestUser;
    profile?: any;
    recommendations?: any;
    plan?: any;
    errors: string[];
  }> = [];
  
  for (let i = 0; i < TEST_USERS.length; i++) {
    const testUser = TEST_USERS[i];
    console.log(`\n${'='.repeat(60)}`);
    console.log(`👤 Пользователь ${i + 1}/5: ${testUser.name}`);
    console.log(`${'='.repeat(60)}\n`);
    
    const userResult: any = {
      user: testUser,
      errors: [],
    };
    
    try {
      // 1. Создаем пользователя
      console.log('1️⃣  Создание пользователя...');
      const user = await createTestUser(testUser.telegramId, testUser.name);
      console.log(`   ✅ Пользователь создан: ID ${user.id}\n`);
      
      // 2. Отправляем ответы анкеты (симулируем POST /api/questionnaire/answers)
      console.log('2️⃣  Отправка ответов анкеты...');
      
      // Симулируем создание RecommendationSession через логику из route.ts
      // Сначала создаем ответы
      const profile = await submitAnswers(user.id, questionnaire.id, testUser.answers);
      console.log(`   ✅ Профиль создан: ID ${profile.id}, версия ${profile.version}`);
      console.log(`   📊 Тип кожи: ${profile.skinType}, Акне: ${profile.acneLevel}, Чувствительность: ${profile.sensitivityLevel}\n`);
      
      // Проверяем, что профиль создан (тип кожи вычисляется из score_json, поэтому может отличаться)
      if (!profile.skinType) {
        userResult.errors.push('Профиль создан, но тип кожи не определен');
      }
      
      userResult.profile = {
        id: profile.id,
        version: profile.version,
        skinType: profile.skinType,
        acneLevel: profile.acneLevel,
        sensitivityLevel: profile.sensitivityLevel,
      };
      
      // Симулируем создание RecommendationSession (логика из route.ts)
      console.log('2.5️⃣  Создание RecommendationSession...');
      try {
        // Находим подходящее правило
        const rules = await prisma.recommendationRule.findMany({
          where: { isActive: true },
          orderBy: { priority: 'desc' },
        });
        
        let matchedRule = null;
        for (const rule of rules) {
          const conditions = rule.conditionsJson as any;
          let matches = true;
          
          if (conditions.skinType) {
            const ruleSkinType = Array.isArray(conditions.skinType) 
              ? conditions.skinType 
              : [conditions.skinType];
            if (!ruleSkinType.includes(profile.skinType)) matches = false;
          }
          
          if (conditions.acneLevel && matches) {
            const acneCondition = conditions.acneLevel;
            if (acneCondition.gte && profile.acneLevel < acneCondition.gte) matches = false;
            if (acneCondition.lte && profile.acneLevel > acneCondition.lte) matches = false;
          }
          
          if (matches) {
            matchedRule = rule;
            break;
          }
        }
        
        if (matchedRule) {
          // Получаем продукты для шагов правила
          const stepsJson = matchedRule.stepsJson as any;
          const { getProductsForStep } = await import('../lib/product-selection');
          const productIdsSet = new Set<number>();
          
          for (const [stepName, stepConfig] of Object.entries(stepsJson)) {
            const step = stepConfig as any;
            const stepWithBudget = {
              ...step,
              max_items: step.max_items || 3,
            };
            
            const products = await getProductsForStep(stepWithBudget);
            products.forEach(p => productIdsSet.add(p.id));
          }
          
          const productIds = Array.from(productIdsSet);
          
          if (productIds.length > 0) {
            await prisma.recommendationSession.create({
              data: {
                userId: user.id,
                profileId: profile.id,
                ruleId: matchedRule.id,
                products: productIds,
              },
            });
            console.log(`   ✅ RecommendationSession создана: ${productIds.length} продуктов\n`);
          }
        }
      } catch (error: any) {
        console.log(`   ⚠️  Ошибка создания RecommendationSession: ${error.message}\n`);
      }
      
      // 3. Проверяем рекомендации
      console.log('3️⃣  Проверка рекомендаций...');
      const recommendations = await testRecommendations(user.id);
      if (recommendations.success) {
        console.log(`   ✅ Рекомендации найдены: ${recommendations.productsCount} продуктов`);
        console.log(`   📦 Product IDs: ${recommendations.productIds.slice(0, 5).join(', ')}${recommendations.productIds.length > 5 ? '...' : ''}\n`);
        userResult.recommendations = recommendations;
      } else {
        console.log(`   ❌ Ошибка рекомендаций: ${recommendations.error}\n`);
        userResult.errors.push(`Рекомендации: ${recommendations.error}`);
      }
      
      // 4. Генерируем план
      console.log('4️⃣  Генерация плана...');
      const plan = await testPlanGeneration(user.id);
      if (plan.success) {
        console.log(`   ✅ План сгенерирован:`);
        console.log(`      - Plan28 дней: ${plan.plan.plan28DaysCount}`);
        console.log(`      - Недель: ${plan.plan.weeksCount}`);
        console.log(`      - Продуктов: ${plan.plan.productsCount}\n`);
        userResult.plan = plan.plan;
        
        if (plan.plan.plan28DaysCount === 0) {
          userResult.errors.push('План пустой: нет дней в plan28');
        }
        if (plan.plan.productsCount === 0) {
          userResult.errors.push('План пустой: нет продуктов');
        }
      } else {
        console.log(`   ❌ Ошибка генерации плана: ${plan.error}\n`);
        userResult.errors.push(`Генерация плана: ${plan.error}`);
      }
      
    } catch (error: any) {
      console.error(`   ❌ Критическая ошибка: ${error.message}\n`);
      userResult.errors.push(`Критическая ошибка: ${error.message}`);
    }
    
    results.push(userResult);
  }
  
  // Итоговый отчет
  console.log('\n' + '='.repeat(60));
  console.log('📊 ИТОГОВЫЙ ОТЧЕТ');
  console.log('='.repeat(60) + '\n');
  
  let successCount = 0;
  let errorCount = 0;
  
  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    const hasErrors = result.errors.length > 0;
    
    if (hasErrors) {
      errorCount++;
      console.log(`❌ ${i + 1}. ${result.user.name}`);
      result.errors.forEach(err => console.log(`   - ${err}`));
    } else {
      successCount++;
      console.log(`✅ ${i + 1}. ${result.user.name}`);
      console.log(`   Профиль: ${result.profile?.skinType || 'не определен'}, акне ${result.profile?.acneLevel ?? 'не определен'}, чувствительность ${result.profile?.sensitivityLevel || 'не определена'}`);
      console.log(`   Рекомендации: ${result.recommendations?.productsCount || 0} продуктов`);
      console.log(`   План: ${result.plan?.plan28DaysCount || 0} дней, ${result.plan?.productsCount || 0} продуктов`);
      if (result.plan?.plan28DaysCount === 0) {
        console.log(`   ⚠️  ВНИМАНИЕ: План пустой (0 дней)`);
      }
      if (result.plan?.productsCount === 0) {
        console.log(`   ⚠️  ВНИМАНИЕ: В плане нет продуктов`);
      }
    }
    console.log('');
  }
  
  console.log('='.repeat(60));
  console.log(`✅ Успешно: ${successCount}/${results.length}`);
  console.log(`❌ С ошибками: ${errorCount}/${results.length}`);
  console.log('='.repeat(60));
  
  return {
    success: errorCount === 0,
    results,
    summary: {
      total: results.length,
      success: successCount,
      errors: errorCount,
    },
  };
}

runUXTest()
  .then((result) => {
    if (result.success) {
      console.log('\n🎉 Все тесты пройдены успешно!');
      process.exit(0);
    } else {
      console.log('\n⚠️  Некоторые тесты завершились с ошибками');
      process.exit(1);
    }
  })
  .catch((error) => {
    console.error('\n❌ Критическая ошибка:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
