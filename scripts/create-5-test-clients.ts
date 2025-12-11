// scripts/create-5-test-clients.ts
// Создание 5 тестовых клиентов: отправка ответов и генерация планов

import { prisma } from '../lib/db';
import { logger } from '../lib/logger';

interface TestUser {
  name: string;
  telegramId: string;
  answers: Record<string, any>;
}

const TEST_USERS: TestUser[] = [
  {
    name: 'Анна - Жирная кожа + акне (высокий уровень)',
    telegramId: `test_client_${Date.now()}_1`,
    answers: {
      age: '18–24',
      skin_type: 'Тип 4 — Жирная',
      acne_level: '4', // Высокий уровень акне
      concerns: ['Акне', 'Расширенные поры', 'Черные точки'],
      sensitivity: 'Низкий уровень',
      budget: 'Средний сегмент',
      makeup_frequency: 'Ежедневно',
    },
  },
  {
    name: 'Мария - Сухая кожа + высокая чувствительность',
    telegramId: `test_client_${Date.now()}_2`,
    answers: {
      age: '25–34',
      skin_type: 'Тип 1 — Сухая',
      acne_level: '0',
      concerns: ['Сухость и стянутость', 'Чувствительность', 'Покраснения'],
      sensitivity: 'Очень высокий уровень',
      budget: 'Премиум сегмент',
      makeup_frequency: 'Редко',
    },
  },
  {
    name: 'Елена - Комбинированная кожа + пигментация',
    telegramId: `test_client_${Date.now()}_3`,
    answers: {
      age: '35–44',
      skin_type: 'Тип 3 — Комбинированная (жирная)',
      acne_level: '0',
      concerns: ['Пигментация', 'Темные пятна', 'Неровный тон'],
      sensitivity: 'Средний уровень',
      budget: 'Средний сегмент',
      makeup_frequency: 'Иногда',
    },
  },
  {
    name: 'Ольга - Нормальная кожа + морщины',
    telegramId: `test_client_${Date.now()}_4`,
    answers: {
      age: '35–44',
      skin_type: 'Тип 2 — Нормальная', // Нормальная кожа - низкие баллы по oiliness и dehydration
      acne_level: '0',
      concerns: ['Морщины', 'Мелкие морщинки'], // Только морщины, без сухости
      sensitivity: 'Низкий уровень',
      budget: 'Премиум сегмент',
      makeup_frequency: 'Иногда',
    },
  },
  {
    name: 'София - Чувствительная кожа + розацеа',
    telegramId: `test_client_${Date.now()}_5`,
    answers: {
      age: '25–34',
      skin_type: 'Тип 1 — Сухая',
      acne_level: '0',
      concerns: ['Чувствительность', 'Покраснения', 'Розацеа'],
      sensitivity: 'Очень высокий уровень',
      budget: 'Премиум сегмент',
      makeup_frequency: 'Редко',
    },
  },
];

async function getActiveQuestionnaire() {
  const questionnaire = await prisma.questionnaire.findFirst({
    where: { isActive: true },
    orderBy: { version: 'desc' },
  });
  
  if (!questionnaire) {
    throw new Error('Активная анкета не найдена');
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
    await prisma.plan28.deleteMany({ where: { userId: existing.id } });
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

async function generatePlan(userId: string) {
  try {
    const { generate28DayPlan } = await import('../lib/plan-generator');
    const plan = await generate28DayPlan(userId);
    
    // Сохраняем план в БД (как в /api/plan/generate/route.ts)
    if (plan.plan28) {
      const profile = await prisma.skinProfile.findFirst({
        where: { userId },
        orderBy: { version: 'desc' },
        select: { id: true, version: true },
      });
      
      if (profile) {
        try {
          // Проверяем, существует ли уже план
          const existingPlan = await prisma.plan28.findUnique({
            where: {
              userId_profileVersion: {
                userId: userId,
                profileVersion: profile.version,
              },
            },
          });
          
          if (existingPlan) {
            await prisma.plan28.update({
              where: {
                userId_profileVersion: {
                  userId: userId,
                  profileVersion: profile.version,
                },
              },
              data: {
                planData: plan.plan28 as any,
                updatedAt: new Date(),
              },
            });
          } else {
            await prisma.plan28.create({
              data: {
                userId,
                skinProfileId: profile.id,
                profileVersion: profile.version,
                planData: plan.plan28 as any,
              },
            });
          }
          console.log(`   ✅ План сохранен в БД для версии профиля ${profile.version}`);
        } catch (dbError: any) {
          console.warn(`   ⚠️  Ошибка сохранения плана в БД: ${dbError.message}`);
          // Пробуем альтернативный способ
          try {
            await prisma.plan28.upsert({
              where: {
                userId_profileVersion: {
                  userId: userId,
                  profileVersion: profile.version,
                },
              },
              update: {
                planData: plan.plan28 as any,
              },
              create: {
                userId,
                skinProfileId: profile.id,
                profileVersion: profile.version,
                planData: plan.plan28 as any,
              },
            });
            console.log(`   ✅ План сохранен в БД (через upsert)`);
          } catch (upsertError: any) {
            console.error(`   ❌ Критическая ошибка сохранения плана: ${upsertError.message}`);
          }
        }
      }
    }
    
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

async function createTestClients() {
  console.log('🧪 Создание 5 тестовых клиентов: отправка ответов и генерация планов\n');
  console.log('='.repeat(80));
  
  const questionnaire = await getActiveQuestionnaire();
  console.log(`📋 Используем анкету: ID ${questionnaire.id}, версия ${questionnaire.version}\n`);
  
  const results: Array<{
    user: TestUser;
    userId?: string;
    profile?: any;
    plan?: any;
    errors: string[];
  }> = [];
  
  for (let i = 0; i < TEST_USERS.length; i++) {
    const testUser = TEST_USERS[i];
    console.log(`\n${'='.repeat(80)}`);
    console.log(`👤 Клиент ${i + 1}/5: ${testUser.name}`);
    console.log(`${'='.repeat(80)}\n`);
    
    const userResult: any = {
      user: testUser,
      errors: [],
    };
    
    try {
      // 1. Создаем пользователя
      console.log('1️⃣  Создание пользователя...');
      const user = await createTestUser(testUser.telegramId, testUser.name);
      console.log(`   ✅ Пользователь создан: ID ${user.id}, Telegram ID: ${user.telegramId}\n`);
      userResult.userId = user.id;
      
      // 2. Отправляем ответы анкеты и создаем профиль
      console.log('2️⃣  Отправка ответов анкеты и создание профиля...');
      const profile = await submitAnswers(user.id, questionnaire.id, testUser.answers);
      console.log(`   ✅ Профиль создан: ID ${profile.id}, версия ${profile.version}`);
      console.log(`   📊 Тип кожи: ${profile.skinType}, Акне: ${profile.acneLevel}, Чувствительность: ${profile.sensitivityLevel}\n`);
      
      userResult.profile = {
        id: profile.id,
        version: profile.version,
        skinType: profile.skinType,
        acneLevel: profile.acneLevel,
        sensitivityLevel: profile.sensitivityLevel,
      };
      
      if (!profile.skinType) {
        userResult.errors.push('Профиль создан, но тип кожи не определен');
      }
      
      // 3. Генерируем план
      console.log('3️⃣  Генерация плана...');
      const plan = await generatePlan(user.id);
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
  console.log('\n' + '='.repeat(80));
  console.log('📊 ИТОГОВЫЙ ОТЧЕТ');
  console.log('='.repeat(80) + '\n');
  
  let successCount = 0;
  let errorCount = 0;
  
  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    const hasErrors = result.errors.length > 0;
    
    if (hasErrors) {
      errorCount++;
      console.log(`❌ ${i + 1}. ${result.user.name}`);
      console.log(`   User ID: ${result.userId || 'не создан'}`);
      console.log(`   Telegram ID: ${result.user.telegramId}`);
      result.errors.forEach(err => console.log(`   - ${err}`));
    } else {
      successCount++;
      console.log(`✅ ${i + 1}. ${result.user.name}`);
      console.log(`   User ID: ${result.userId}`);
      console.log(`   Telegram ID: ${result.user.telegramId}`);
      console.log(`   Профиль: ${result.profile?.skinType || 'не определен'}, акне ${result.profile?.acneLevel ?? 'не определен'}, чувствительность ${result.profile?.sensitivityLevel || 'не определена'}`);
      console.log(`   План: ${result.plan?.plan28DaysCount || 0} дней, ${result.plan?.productsCount || 0} продуктов`);
    }
    console.log('');
  }
  
  console.log('='.repeat(80));
  console.log(`✅ Успешно: ${successCount}/${results.length}`);
  console.log(`❌ С ошибками: ${errorCount}/${results.length}`);
  console.log('='.repeat(80));
  
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

createTestClients()
  .then((result) => {
    if (result.success) {
      console.log('\n🎉 Все тестовые клиенты созданы успешно!');
      process.exit(0);
    } else {
      console.log('\n⚠️  Некоторые клиенты созданы с ошибками');
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
