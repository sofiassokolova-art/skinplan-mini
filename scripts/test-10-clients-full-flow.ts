// scripts/test-10-clients-full-flow.ts
// Полный тест flow от ответов до генерации плана и оплаты для 10 клиентов

import { PrismaClient } from '@prisma/client';
import { generate28DayPlan } from '@/lib/plan-generator';

const prisma = new PrismaClient();

interface TestUser {
  name: string;
  telegramId: string;
  answers: Record<string, any>;
}

// 10 различных профилей пользователей
const TEST_USERS: TestUser[] = [
  {
    name: 'Анна - Жирная кожа + акне',
    telegramId: 'test_full_flow_1',
    answers: {
      age: '25–34',
      skin_type: 'Тип 4 — Жирная',
      acne_level: '3',
      concerns: ['Акне', 'Расширенные поры'],
      sensitivity: 'Низкий уровень',
      budget: 'Средний сегмент',
      makeup_frequency: 'Ежедневно',
    },
  },
  {
    name: 'Мария - Сухая чувствительная',
    telegramId: 'test_full_flow_2',
    answers: {
      age: '25–34',
      skin_type: 'Тип 1 — Сухая',
      acne_level: '0',
      concerns: ['Сухость и стянутость', 'Чувствительность'],
      sensitivity: 'Высокий уровень',
      budget: 'Премиум сегмент',
      makeup_frequency: 'Редко',
    },
  },
  {
    name: 'Елена - Комбинированная + пигментация',
    telegramId: 'test_full_flow_3',
    answers: {
      age: '35–44',
      skin_type: 'Тип 3 — Комбинированная (жирная)',
      acne_level: '1',
      concerns: ['Пигментация', 'Темные пятна'],
      sensitivity: 'Средний уровень',
      budget: 'Средний сегмент',
      makeup_frequency: 'Иногда',
    },
  },
  {
    name: 'Ольга - Нормальная + первые морщины',
    telegramId: 'test_full_flow_4',
    answers: {
      age: '35–44',
      skin_type: 'Тип 2 — Нормальная',
      acne_level: '0',
      concerns: ['Морщины', 'Мелкие морщинки'],
      sensitivity: 'Низкий уровень',
      budget: 'Премиум сегмент',
      makeup_frequency: 'Иногда',
    },
  },
  {
    name: 'София - Чувствительная + обезвоженность',
    telegramId: 'test_full_flow_5',
    answers: {
      age: '25–34',
      skin_type: 'Тип 1 — Сухая',
      acne_level: '0',
      concerns: ['Обезвоженность', 'Чувствительность'],
      sensitivity: 'Очень высокий уровень',
      budget: 'Бюджетный сегмент',
      makeup_frequency: 'Редко',
    },
  },
  {
    name: 'Дарья - Жирная + розацеа',
    telegramId: 'test_full_flow_6',
    answers: {
      age: '30–39',
      skin_type: 'Тип 4 — Жирная',
      acne_level: '1',
      concerns: ['Покраснения', 'Розацеа'],
      sensitivity: 'Высокий уровень',
      budget: 'Средний сегмент',
      makeup_frequency: 'Ежедневно',
    },
  },
  {
    name: 'Виктория - Комбинированная + акне',
    telegramId: 'test_full_flow_7',
    answers: {
      age: '18–24',
      skin_type: 'Тип 3 — Комбинированная (жирная)',
      acne_level: '4',
      concerns: ['Акне', 'Воспаления'],
      sensitivity: 'Средний уровень',
      budget: 'Бюджетный сегмент',
      makeup_frequency: 'Ежедневно',
    },
  },
  {
    name: 'Алиса - Сухая + возрастные изменения',
    telegramId: 'test_full_flow_8',
    answers: {
      age: '45–54',
      skin_type: 'Тип 1 — Сухая',
      acne_level: '0',
      concerns: ['Морщины', 'Потеря упругости'],
      sensitivity: 'Средний уровень',
      budget: 'Премиум сегмент',
      makeup_frequency: 'Иногда',
    },
  },
  {
    name: 'Полина - Нормальная + пигментация',
    telegramId: 'test_full_flow_9',
    answers: {
      age: '25–34',
      skin_type: 'Тип 2 — Нормальная',
      acne_level: '0',
      concerns: ['Пигментация', 'Неровный тон'],
      sensitivity: 'Низкий уровень',
      budget: 'Средний сегмент',
      makeup_frequency: 'Иногда',
    },
  },
  {
    name: 'Ксения - Комбинированная + обезвоженность',
    telegramId: 'test_full_flow_10',
    answers: {
      age: '25–34',
      skin_type: 'Тип 3 — Комбинированная (сухая)',
      acne_level: '0',
      concerns: ['Обезвоживание', 'Сухость'],
      sensitivity: 'Средний уровень',
      budget: 'Средний сегмент',
      makeup_frequency: 'Ежедневно',
    },
  },
];

interface TestResult {
  user: TestUser;
  userId?: string;
  profileId?: string;
  profileVersion?: number;
  planId?: string;
  paymentId?: string;
  errors: string[];
  warnings: string[];
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
    await prisma.plan28.deleteMany({ where: { userId: existing.id } });
    await prisma.planProgress.deleteMany({ where: { userId: existing.id } });
    await prisma.payment.deleteMany({ where: { userId: existing.id } });
    await prisma.entitlement.deleteMany({ where: { userId: existing.id } });
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

  // Сохраняем ответы
  const savedAnswers: any[] = [];
  for (const [key, mapping] of Object.entries(answerMapping)) {
    const question = questionMap[mapping.questionCode];
    if (!question) {
      continue;
    }

    const isMultiChoice = question.type === 'multi_choice';

    if (isMultiChoice && Array.isArray(mapping.value)) {
      const selectedOptions: string[] = [];
      for (const option of question.answerOptions) {
        if (mapping.value.some((v: string) => option.label.toLowerCase().includes(v.toLowerCase()))) {
          selectedOptions.push(option.value);
        }
      }

      if (selectedOptions.length > 0) {
        await prisma.userAnswer.upsert({
          where: {
            userId_questionnaireId_questionId: {
              userId,
              questionnaireId,
              questionId: question.id,
            },
          },
          create: {
            userId,
            questionnaireId,
            questionId: question.id,
            answerValues: selectedOptions as any,
          },
          update: {
            answerValues: selectedOptions as any,
          },
        });
        savedAnswers.push({ questionId: question.id, answerValues: selectedOptions });
      }
    } else {
      // Для single_choice ищем вариант ответа
      let selectedValue: string | null = null;
      for (const option of question.answerOptions) {
        if (option.label === mapping.value || option.value === mapping.value) {
          selectedValue = option.value;
          break;
        }
      }

      if (selectedValue) {
        await prisma.userAnswer.upsert({
          where: {
            userId_questionnaireId_questionId: {
              userId,
              questionnaireId,
              questionId: question.id,
            },
          },
          create: {
            userId,
            questionnaireId,
            questionId: question.id,
            answerValue: selectedValue,
          },
          update: {
            answerValue: selectedValue,
          },
        });
        savedAnswers.push({ questionId: question.id, answerValue: selectedValue });
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

  // Преобразуем ответы в формат для buildSkinProfileFromAnswers
  const formattedAnswers = fullAnswers.map(answer => {
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
    };
  });

  // Создаем профиль через API логику
  const { buildSkinProfileFromAnswers } = await import('@/lib/skinprofile-rules-engine');
  const profileData = buildSkinProfileFromAnswers(formattedAnswers);

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
      medicalMarkers: profileData.medicalMarkers || null,
      notes: profileData.notes || null,
    },
  });

  // Обновляем currentProfileId у пользователя
  await prisma.user.update({
    where: { id: userId },
    data: { currentProfileId: profile.id },
  });

  return profile;
}

async function generatePlan(userId: string) {
  try {
    const plan = await generate28DayPlan(userId);
    
    // Сохраняем план в БД (как в API route)
    const profile = await prisma.skinProfile.findFirst({
      where: { userId },
      orderBy: { version: 'desc' },
    });
    
    if (profile && plan.plan28) {
      // Удаляем существующий план для этой версии профиля, если есть
      await prisma.plan28.deleteMany({
        where: {
          userId,
          profileVersion: profile.version,
        },
      });
      
      // Создаем новый план
      const savedPlan = await prisma.plan28.create({
        data: {
          userId,
          skinProfileId: profile.id,
          profileVersion: profile.version,
          planData: plan.plan28 as any,
        },
      });
      
      return { ...plan, savedPlanId: savedPlan.id };
    }
    
    return plan;
  } catch (error: any) {
    throw new Error(`Plan generation failed: ${error.message}`);
  }
}

async function createPayment(userId: string) {
  // Создаем тестовый платеж
  const payment = await prisma.payment.create({
    data: {
      userId,
      productCode: 'plan_access',
      amount: 19900, // 199 рублей в копейках
      currency: 'RUB',
      provider: 'test',
      providerPaymentId: `test_${Date.now()}_${userId}`,
      status: 'succeeded',
      idempotencyKey: `test_${userId}_${Date.now()}`,
    },
  });

  // Создаем entitlement
  await prisma.entitlement.upsert({
    where: {
      userId_code: {
        userId,
        code: 'paid_access',
      },
    },
    create: {
      userId,
      code: 'paid_access',
      active: true,
      lastPaymentId: payment.id,
    },
    update: {
      active: true,
      lastPaymentId: payment.id,
    },
  });

  return payment;
}

async function testFullFlow() {
  console.log('🧪 Полный тест flow от ответов до генерации плана и оплаты для 10 клиентов\n');
  console.log('='.repeat(80));

  const questionnaire = await getActiveQuestionnaire();
  console.log(`📋 Используем анкету: ID ${questionnaire.id}, версия ${questionnaire.version}\n`);

  const results: TestResult[] = [];

  for (let i = 0; i < TEST_USERS.length; i++) {
    const testUser = TEST_USERS[i];
    console.log(`\n${'='.repeat(80)}`);
    console.log(`👤 Клиент ${i + 1}/10: ${testUser.name}`);
    console.log(`${'='.repeat(80)}\n`);

    const result: TestResult = {
      user: testUser,
      errors: [],
      warnings: [],
    };

    try {
      // 1. Создание пользователя
      console.log('1️⃣  Создание пользователя...');
      const user = await createTestUser(testUser.telegramId, testUser.name);
      result.userId = user.id;
      console.log(`   ✅ Пользователь создан: ID ${user.id}`);

      // 2. Отправка ответов анкеты
      console.log('2️⃣  Отправка ответов анкеты...');
      const profile = await submitAnswers(user.id, questionnaire.id, testUser.answers);
      result.profileId = profile.id;
      result.profileVersion = profile.version;
      console.log(`   ✅ Профиль создан: ID ${profile.id}, версия ${profile.version}`);
      console.log(`   📊 Тип кожи: ${profile.skinType || 'не определен'}, Акне: ${profile.acneLevel || 0}, Чувствительность: ${profile.sensitivityLevel || 'не определена'}`);

      if (!profile.skinType) {
        result.warnings.push('Профиль создан, но тип кожи не определен');
      }

      // 3. Генерация плана
      console.log('3️⃣  Генерация плана...');
      const planResult = await generatePlan(user.id);
      
      if ((planResult as any).savedPlanId) {
        result.planId = (planResult as any).savedPlanId;
        console.log(`   ✅ План создан и сохранен: ID ${result.planId}`);
      } else {
        result.warnings.push('План сгенерирован, но не сохранен в БД');
        console.log(`   ⚠️  План сгенерирован, но не сохранен в БД`);
      }
      
      const plan28 = planResult.plan28;
      if (plan28) {
        console.log(`   📅 Дней в плане: ${plan28.days?.length || 0}`);

        // Проверяем наличие продуктов в плане
        const hasProducts = plan28.days?.some((day: any) => 
          (day.morning || []).some((step: any) => step.productId) ||
          (day.evening || []).some((step: any) => step.productId)
        );

        if (!hasProducts) {
          result.warnings.push('План создан, но не содержит продуктов');
        } else {
          console.log(`   ✅ План содержит продукты`);
        }
      } else {
        result.warnings.push('План сгенерирован, но plan28 отсутствует');
      }

      // 4. Создание платежа
      console.log('4️⃣  Создание платежа...');
      const payment = await createPayment(user.id);
      result.paymentId = payment.id;
      console.log(`   ✅ Платеж создан: ID ${payment.id}, статус: ${payment.status}`);

      // Проверяем entitlement
      const entitlement = await prisma.entitlement.findUnique({
        where: {
          userId_code: {
            userId: user.id,
            code: 'paid_access',
          },
        },
      });

      if (!entitlement || !entitlement.active) {
        result.errors.push('Entitlement не создан или не активен');
      } else {
        console.log(`   ✅ Entitlement активен`);
      }

      console.log(`\n   ✅ Все шаги выполнены успешно для ${testUser.name}`);

    } catch (error: any) {
      result.errors.push(error.message || String(error));
      console.error(`   ❌ Ошибка: ${error.message || String(error)}`);
    }

    results.push(result);
  }

  // Выводим итоговую статистику
  console.log(`\n${'='.repeat(80)}`);
  console.log('📊 ИТОГОВАЯ СТАТИСТИКА');
  console.log(`${'='.repeat(80)}\n`);

  const successful = results.filter(r => r.errors.length === 0);
  const withErrors = results.filter(r => r.errors.length > 0);
  const withWarnings = results.filter(r => r.warnings.length > 0);

  console.log(`✅ Успешно завершено: ${successful.length}/10`);
  console.log(`❌ С ошибками: ${withErrors.length}/10`);
  console.log(`⚠️  С предупреждениями: ${withWarnings.length}/10\n`);

  console.log('Детали по клиентам:\n');
  for (const result of results) {
    const icon = result.errors.length === 0 ? '✅' : '❌';
    console.log(`${icon} ${result.user.name}`);
    if (result.userId) {
      console.log(`   User ID: ${result.userId}`);
    }
    if (result.profileId) {
      console.log(`   Profile ID: ${result.profileId} (v${result.profileVersion})`);
    }
    if (result.planId) {
      console.log(`   Plan ID: ${result.planId}`);
    }
    if (result.paymentId) {
      console.log(`   Payment ID: ${result.paymentId}`);
    }
    if (result.errors.length > 0) {
      console.log(`   Ошибки: ${result.errors.join(', ')}`);
    }
    if (result.warnings.length > 0) {
      console.log(`   Предупреждения: ${result.warnings.join(', ')}`);
    }
    console.log('');
  }

  if (withErrors.length > 0) {
    console.log('❌ Некоторые тесты провалены. Проверьте ошибки выше.');
    process.exit(1);
  } else {
    console.log('🎉 Все тесты пройдены успешно! ✅');
    process.exit(0);
  }
}

testFullFlow()
  .catch((error) => {
    console.error('❌ Критическая ошибка:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
