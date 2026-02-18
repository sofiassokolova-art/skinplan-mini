// scripts/test-10-random-users.ts
// Автотест 10 пользователей с рандомными ответами для проверки генерации подходящих планов

import { PrismaClient } from '@prisma/client';
import { generate28DayPlan } from '../lib/plan-generator';
import { createSkinProfile } from '../lib/profile-calculator';

const prisma = new PrismaClient();

interface TestResult {
  userIndex: number;
  userId?: string;
  profileId?: string;
  profileVersion?: number;
  planId?: string;
  errors: string[];
  warnings: string[];
  answers: Record<string, any>;
  profile?: {
    skinType?: string;
    sensitivityLevel?: string;
    acneLevel?: number;
    concerns?: string[];
  };
  planValidation?: {
    hasPlan: boolean;
    daysCount: number;
    productsCount: number;
    concernsMatch: boolean;
    skinTypeMatch: boolean;
  };
  planProducts?: Set<number>; // Для сравнения планов
}

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

  const groups = await prisma.questionGroup.findMany({
    where: { questionnaireId },
    include: {
      questions: {
        include: {
          answerOptions: {
            orderBy: { position: 'asc' },
          },
        },
        orderBy: { position: 'asc' },
      },
    },
    orderBy: { position: 'asc' },
  });

  const allQuestions = [
    ...questions,
    ...groups.flatMap(g => g.questions),
  ];

  return allQuestions;
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
    await prisma.plan28.deleteMany({ where: { userId: existing.id } });
    await prisma.planProgress.deleteMany({ where: { userId: existing.id } });
    await prisma.payment.deleteMany({ where: { userId: existing.id } });
    // Удаляем через raw query, так как Prisma client может не иметь этих моделей
    try {
      await prisma.$executeRaw`DELETE FROM user_preferences WHERE user_id = ${existing.id}`;
    } catch (e) {
      // Игнорируем ошибки, если таблица не существует
    }
    try {
      await prisma.$executeRaw`DELETE FROM questionnaire_progress WHERE user_id = ${existing.id}`;
    } catch (e) {
      // Игнорируем ошибки, если таблица не существует
    }
    await prisma.user.delete({ where: { id: existing.id } });
  }

  // Создаем нового пользователя
  const user = await prisma.user.create({
    data: {
      telegramId,
      firstName: name,
    },
  });

  return user;
}

function getRandomElement<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

function getRandomElements<T>(array: T[], count: number): T[] {
  const shuffled = [...array].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, Math.min(count, array.length));
}

async function generateRandomAnswers(userId: string, questionnaireId: number, questions: any[]): Promise<Record<string, any>> {
  const answers: Record<string, any> = {};
  const questionMap: Record<string, any> = {};

  // Создаем карту вопросов по коду
  for (const question of questions) {
    if (question.code) {
      const codeLower = question.code.toLowerCase();
      questionMap[codeLower] = question;
      questionMap[question.code] = question;
    }
  }

  // Генерируем случайные ответы для каждого вопроса
  for (const question of questions) {
    if (question.answerOptions.length === 0) continue;

    const code = question.code?.toLowerCase() || '';

    // Специальная обработка для некоторых вопросов
    if (code.includes('pregnancy') || code.includes('breastfeeding')) {
      // Всегда "Нет" для беременности
      const noOption = question.answerOptions.find((opt: any) => 
        (opt.label || '').toLowerCase().includes('нет') ||
        (opt.value || '').toLowerCase().includes('нет')
      );
      if (noOption) {
        answers[question.code] = noOption.value || noOption.label;
      }
      continue;
    }

    // Для multi_choice выбираем случайное количество вариантов (1-3)
    if (question.type === 'multi_choice') {
      const selectedCount = Math.min(
        Math.floor(Math.random() * 3) + 1,
        question.answerOptions.length
      );
      const selectedOptions = getRandomElements(question.answerOptions, selectedCount);
      answers[question.code] = selectedOptions.map((opt: any) => opt.value || opt.label);
    } else {
      // Для single_choice выбираем случайный вариант
      const randomOption = getRandomElement(question.answerOptions) as any;
      answers[question.code] = randomOption.value || randomOption.label;
    }
  }

  return answers;
}

async function submitAnswers(userId: string, questionnaireId: number, answers: Record<string, any>) {
  const questions = await getQuestions(questionnaireId);
  const questionMap: Record<string, any> = {};

  for (const question of questions) {
    if (question.code) {
      questionMap[question.code.toLowerCase()] = question;
      questionMap[question.code] = question;
    }
  }

  // Создаем ответы в БД
  const answerInputs: Array<{ questionId: number; answerValues?: any[]; answerValue?: any }> = [];
  for (const [code, value] of Object.entries(answers)) {
    const question = questionMap[code.toLowerCase()] || questionMap[code];
    if (!question) continue;

    if (Array.isArray(value)) {
      answerInputs.push({
        questionId: question.id,
        answerValues: value,
      });
    } else {
      answerInputs.push({
        questionId: question.id,
        answerValue: value,
      });
    }
  }

  // Сохраняем ответы
  for (const answerInput of answerInputs) {
    const question = questions.find(q => q.id === answerInput.questionId);
    if (!question) continue;

    if (answerInput.answerValues) {
      await prisma.userAnswer.upsert({
        where: {
          userId_questionnaireId_questionId: {
            userId,
            questionnaireId,
            questionId: question.id,
          },
        },
        update: {
          answerValues: answerInput.answerValues,
        },
        create: {
          userId,
          questionnaireId,
          questionId: question.id,
          answerValues: answerInput.answerValues,
        },
      });
    } else if (answerInput.answerValue) {
      await prisma.userAnswer.upsert({
        where: {
          userId_questionnaireId_questionId: {
            userId,
            questionnaireId,
            questionId: question.id,
          },
        },
        update: {
          answerValue: answerInput.answerValue,
        },
        create: {
          userId,
          questionnaireId,
          questionId: question.id,
          answerValue: answerInput.answerValue,
        },
      });
    }
  }

  // Получаем все ответы для создания профиля
  const allAnswers = await prisma.userAnswer.findMany({
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

  // Преобразуем ответы в формат для buildSkinProfileFromAnswers
  const formattedAnswers = allAnswers.map(answer => {
    let answerValue: string | null = null;
    let answerValues: any = null;
    let answerOptionLabels: string[] = [];

    if (answer.answerValue) {
      answerValue = answer.answerValue;
      const option = answer.question.answerOptions.find(opt => opt.value === answer.answerValue);
      if (option) {
        answerOptionLabels = [option.label];
      }
    }

    if (answer.answerValues) {
      answerValues = answer.answerValues;
      if (Array.isArray(answerValues)) {
        answerOptionLabels = answerValues.map((val: string) => {
          const option = answer.question.answerOptions.find(opt => opt.value === val);
          return option ? option.label : val;
        });
      }
    }

    return {
      questionId: answer.questionId,
      questionCode: answer.question.code || undefined,
      answerValue,
      answerValues,
      answerOptionLabels,
      question: answer.question,
    };
  });

  // Создаем профиль через API логику (используем createSkinProfile для Prisma-совместимого формата)
  const profileData = createSkinProfile(
    userId,
    questionnaireId,
    allAnswers.map(answer => ({
      questionId: answer.questionId,
      answerValue: answer.answerValue,
      answerValues: answer.answerValues,
      question: {
        code: answer.question.code || '',
        answerOptions: answer.question.answerOptions.map(opt => ({
          value: opt.value,
          scoreJson: opt.scoreJson,
        })),
      },
    })),
    1
  );

  // Сохраняем профиль в БД
  const profile = await prisma.skinProfile.create({
    data: {
      userId,
      version: 1,
      skinType: profileData.skinType || null,
      sensitivityLevel: profileData.sensitivityLevel || null,
      dehydrationLevel: profileData.dehydrationLevel || null,
      acneLevel: profileData.acneLevel || null,
      rosaceaRisk: profileData.rosaceaRisk || null,
      pigmentationRisk: profileData.pigmentationRisk || null,
      ageGroup: profileData.ageGroup || null,
      hasPregnancy: profileData.hasPregnancy || false,
      medicalMarkers: profileData.medicalMarkers || undefined,
      notes: profileData.notes || null,
    },
  });

  return profile;
}

async function generatePlan(userId: string) {
  try {
    const plan = await generate28DayPlan(userId);
    return { success: true, plan };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || String(error),
    };
  }
}

function validatePlan(plan: any, answers: Record<string, any>, profile: any): {
  validation: {
    hasPlan: boolean;
    daysCount: number;
    productsCount: number;
    concernsMatch: boolean;
    skinTypeMatch: boolean;
  };
  productIds: Set<number>;
} {
  const validation = {
    hasPlan: false,
    daysCount: 0,
    productsCount: 0,
    concernsMatch: false,
    skinTypeMatch: false,
  };

  if (!plan || !plan.plan28) {
    return { validation, productIds: new Set<number>() };
  }

  validation.hasPlan = true;
  validation.daysCount = plan.plan28.days?.length || 0;

  // Собираем все уникальные продукты из плана
  const productIds = new Set<number>();
  if (plan.plan28.days) {
    for (const day of plan.plan28.days) {
      if (day.morning) {
        for (const step of day.morning) {
          if (step.productId) productIds.add(Number(step.productId));
          if (step.alternatives) {
            step.alternatives.forEach((id: any) => productIds.add(Number(id)));
          }
        }
      }
      if (day.evening) {
        for (const step of day.evening) {
          if (step.productId) productIds.add(Number(step.productId));
          if (step.alternatives) {
            step.alternatives.forEach((id: any) => productIds.add(Number(id)));
          }
        }
      }
      if (day.weekly) {
        for (const step of day.weekly) {
          if (step.productId) productIds.add(Number(step.productId));
          if (step.alternatives) {
            step.alternatives.forEach((id: any) => productIds.add(Number(id)));
          }
        }
      }
    }
  }
  validation.productsCount = productIds.size;
  
  // Возвращаем также Set продуктов для сравнения
  return { validation, productIds };

  // Проверяем соответствие concerns (упрощенная проверка)
  // Если в ответах есть concerns, проверяем, что план содержит соответствующие ингредиенты
  const concerns = answers['skin_concerns'] || answers['concerns'] || [];
  if (Array.isArray(concerns) && concerns.length > 0) {
    // Базовая проверка: план должен содержать продукты
    validation.concernsMatch = validation.productsCount > 0;
  } else {
    validation.concernsMatch = true; // Если concerns нет, считаем что соответствует
  }

  // Проверяем соответствие типа кожи (упрощенная проверка)
  const skinType = answers['skin_type'] || profile?.skinType;
  if (skinType) {
    // Базовая проверка: план должен быть создан
    validation.skinTypeMatch = validation.hasPlan && validation.daysCount === 28;
  } else {
    validation.skinTypeMatch = true; // Если типа кожи нет, считаем что соответствует
  }

  // Возвращаем объект с полями validation и productIds, как требует типизация
  return { validation, productIds };
}

async function testRandomUser(userIndex: number, questionnaireId: number): Promise<TestResult> {
  const result: TestResult = {
    userIndex,
    errors: [],
    warnings: [],
    answers: {},
  };

  try {
    // 1. Создаем пользователя
    const telegramId = `test_random_${userIndex}_${Date.now()}`;
    const name = `Тестовый пользователь ${userIndex}`;
    const user = await createTestUser(telegramId, name);
    result.userId = user.id;
    console.log(`\n👤 Пользователь ${userIndex}: ${name} (ID: ${user.id})`);

    // 2. Получаем вопросы
    const questions = await getQuestions(questionnaireId);
    console.log(`   📋 Вопросов в анкете: ${questions.length}`);

    // 3. Генерируем случайные ответы
    console.log(`   🎲 Генерация случайных ответов...`);
    const answers = await generateRandomAnswers(user.id, questionnaireId, questions);
    result.answers = answers;
    console.log(`   ✅ Сгенерировано ответов: ${Object.keys(answers).length}`);

    // 4. Отправляем ответы и создаем профиль
    console.log(`   📤 Отправка ответов и создание профиля...`);
    const profile = await submitAnswers(user.id, questionnaireId, answers);
    result.profileId = profile.id;
    result.profileVersion = profile.version;
    result.profile = {
      skinType: profile.skinType || undefined,
      sensitivityLevel: profile.sensitivityLevel || undefined,
      acneLevel: profile.acneLevel || undefined,
    };
    console.log(`   ✅ Профиль создан: ID ${profile.id}, версия ${profile.version}`);
    console.log(`   📊 Тип кожи: ${profile.skinType || 'не определен'}, Акне: ${profile.acneLevel || 0}, Чувствительность: ${profile.sensitivityLevel || 'не определена'}`);

    if (!profile.skinType) {
      result.warnings.push('Профиль создан, но тип кожи не определен');
    }

    // 5. Генерируем план
    console.log(`   🔄 Генерация плана...`);
    const planStartTime = Date.now();
    const planResult = await Promise.race([
      generatePlan(user.id),
      new Promise<{ success: false; error: string }>((resolve) => 
        setTimeout(() => resolve({ success: false, error: 'Таймаут генерации плана (60 секунд)' }), 60000)
      ),
    ]);
    const planDuration = Date.now() - planStartTime;
    console.log(`   ⏱️  Генерация плана заняла: ${(planDuration / 1000).toFixed(1)}с`);
    
    if (!planResult.success) {
      result.errors.push(`Ошибка генерации плана: ${planResult.error}`);
      console.log(`   ❌ Ошибка генерации плана: ${planResult.error}`);
      return result;
    }

    const plan = planResult.plan;
    if (!plan || !plan.plan28) {
      result.errors.push('План не был создан или не содержит plan28');
      console.log(`   ❌ План не был создан`);
      return result;
    }

    result.planId = plan.plan28.id || 'unknown';
    console.log(`   ✅ План создан: ID ${result.planId}`);

    // 6. Валидируем план
    console.log(`   ✔️  Валидация плана...`);
    const { validation, productIds } = validatePlan(plan, answers, profile);
    result.planValidation = validation;
    result.planProducts = productIds;
    console.log(`   📊 Валидация:`);
    console.log(`      - План создан: ${validation.hasPlan}`);
    console.log(`      - Дней в плане: ${validation.daysCount}`);
    console.log(`      - Уникальных продуктов: ${validation.productsCount}`);
    console.log(`      - Соответствие concerns: ${validation.concernsMatch}`);
    console.log(`      - Соответствие типа кожи: ${validation.skinTypeMatch}`);

    if (!validation.hasPlan) {
      result.errors.push('План не был создан');
    }
    if (validation.daysCount !== 28) {
      result.warnings.push(`План содержит ${validation.daysCount} дней вместо 28`);
    }
    if (validation.productsCount === 0) {
      result.errors.push('План не содержит продуктов');
    }
    if (!validation.concernsMatch) {
      result.warnings.push('План может не соответствовать выбранным проблемам кожи');
    }
    if (!validation.skinTypeMatch) {
      result.warnings.push('План может не соответствовать типу кожи');
    }

    console.log(`   ✅ Тест завершен успешно`);
  } catch (error: any) {
    result.errors.push(`Критическая ошибка: ${error.message || String(error)}`);
    console.error(`   ❌ Критическая ошибка:`, error);
  }

  return result;
}

async function runTests() {
  console.log('🧪 Автотест 10 пользователей с рандомными ответами\n');
  console.log('='.repeat(80));

  try {
    const questionnaire = await getActiveQuestionnaire();
    console.log(`📋 Используем анкету: ID ${questionnaire.id}, версия ${questionnaire.version}\n`);

    const results: TestResult[] = [];

    // Запускаем тесты для 10 пользователей
    for (let i = 1; i <= 10; i++) {
      const result = await testRandomUser(i, questionnaire.id);
      results.push(result);
    }

    // Выводим итоговую статистику
    console.log('\n' + '='.repeat(80));
    console.log('📊 ИТОГОВАЯ СТАТИСТИКА');
    console.log('='.repeat(80));

    const successful = results.filter(r => r.errors.length === 0);
    const withWarnings = results.filter(r => r.warnings.length > 0);
    const failed = results.filter(r => r.errors.length > 0);

    console.log(`\n✅ Успешных тестов: ${successful.length}/10`);
    console.log(`⚠️  Тестов с предупреждениями: ${withWarnings.length}/10`);
    console.log(`❌ Провалившихся тестов: ${failed.length}/10`);

    if (successful.length > 0) {
      console.log(`\n✅ Успешные тесты:`);
      successful.forEach(r => {
        console.log(`   Пользователь ${r.userIndex}: План создан, ${r.planValidation?.productsCount || 0} продуктов`);
      });
    }

    if (withWarnings.length > 0) {
      console.log(`\n⚠️  Тесты с предупреждениями:`);
      withWarnings.forEach(r => {
        console.log(`   Пользователь ${r.userIndex}: ${r.warnings.join(', ')}`);
      });
    }

    if (failed.length > 0) {
      console.log(`\n❌ Провалившиеся тесты:`);
      failed.forEach(r => {
        console.log(`   Пользователь ${r.userIndex}: ${r.errors.join(', ')}`);
      });
    }

    // Статистика по планам
    const plansCreated = results.filter(r => r.planValidation?.hasPlan).length;
    const plansWithProducts = results.filter(
      r => typeof r.planValidation?.productsCount === 'number' && r.planValidation.productsCount > 0
    );
    const avgProducts = plansWithProducts.length > 0
      ? plansWithProducts.reduce((sum, r) => sum + (r.planValidation!.productsCount || 0), 0) / plansWithProducts.length
      : 0;

    console.log(`\n📈 Статистика по планам:`);
    console.log(`   Планов создано: ${plansCreated}/10`);
    if (avgProducts > 0) {
      console.log(`   Среднее количество продуктов: ${avgProducts.toFixed(1)}`);
    }

    // Проверяем, что все планы подходят
    const allPlansValid = results.every(r => 
      r.planValidation?.hasPlan && 
      r.planValidation?.daysCount === 28 &&
      r.planValidation?.productsCount > 0
    );

    if (allPlansValid) {
      console.log(`\n✅ Все планы успешно созданы и валидны!`);
    } else {
      console.log(`\n⚠️  Некоторые планы имеют проблемы`);
    }

    // Проверяем уникальность планов
    console.log(`\n🔍 Анализ уникальности планов:`);
    const planComparisons: Array<{ user1: number; user2: number; similarity: number; commonProducts: number[] }> = [];
    
    for (let i = 0; i < results.length; i++) {
      for (let j = i + 1; j < results.length; j++) {
        const plan1 = results[i].planProducts;
        const plan2 = results[j].planProducts;
        
        if (plan1 && plan2 && plan1.size > 0 && plan2.size > 0) {
          // Вычисляем пересечение продуктов
          const commonProducts = Array.from(plan1).filter(id => plan2.has(id));
          const unionSize = new Set([...plan1, ...plan2]).size;
          const similarity = unionSize > 0 ? (commonProducts.length / unionSize) * 100 : 0;
          
          planComparisons.push({
            user1: results[i].userIndex,
            user2: results[j].userIndex,
            similarity: Math.round(similarity * 10) / 10,
            commonProducts: commonProducts.sort((a, b) => a - b),
          });
        }
      }
    }

    // Группируем по уровням схожести
    const identical = planComparisons.filter(c => c.similarity >= 90);
    const verySimilar = planComparisons.filter(c => c.similarity >= 70 && c.similarity < 90);
    const similar = planComparisons.filter(c => c.similarity >= 50 && c.similarity < 70);
    const different = planComparisons.filter(c => c.similarity < 50);

    console.log(`   Идентичные планы (≥90% схожести): ${identical.length}`);
    if (identical.length > 0) {
      identical.forEach(c => {
        console.log(`      ⚠️  Пользователь ${c.user1} и ${c.user2}: ${c.similarity}% схожести (${c.commonProducts.length} общих продуктов)`);
      });
    }

    console.log(`   Очень похожие планы (70-90%): ${verySimilar.length}`);
    if (verySimilar.length > 0) {
      verySimilar.slice(0, 5).forEach(c => {
        console.log(`      Пользователь ${c.user1} и ${c.user2}: ${c.similarity}% схожести`);
      });
    }

    console.log(`   Похожие планы (50-70%): ${similar.length}`);
    console.log(`   Разные планы (<50%): ${different.length}`);

    // Проверяем уникальность по типам кожи
    const plansBySkinType: Record<string, number[]> = {};
    results.forEach(r => {
      if (r.profile?.skinType) {
        const skinType = r.profile.skinType;
        if (!plansBySkinType[skinType]) {
          plansBySkinType[skinType] = [];
        }
        plansBySkinType[skinType].push(r.userIndex);
      }
    });

    console.log(`\n📊 Распределение по типам кожи:`);
    Object.entries(plansBySkinType).forEach(([skinType, users]) => {
      console.log(`   ${skinType}: ${users.length} пользователей (${users.join(', ')})`);
    });

    // Итоговый вывод
    const uniquePlans = results.length - identical.length;
    console.log(`\n🎯 Итог:`);
    console.log(`   Всего планов: ${results.length}`);
    console.log(`   Уникальных планов: ${uniquePlans} (${Math.round((uniquePlans / results.length) * 100)}%)`);
    if (identical.length > 0) {
      console.log(`   ⚠️  Найдено ${identical.length} пар идентичных планов`);
    } else {
      console.log(`   ✅ Все планы уникальны!`);
    }

  } catch (error: any) {
    console.error('❌ Критическая ошибка при запуске тестов:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runTests();

