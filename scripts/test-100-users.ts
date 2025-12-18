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

async function createTestAnswers(userId: string, questionnaireId: number, userIndex: number) {
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

  // ВАЖНО: Создаем явные профили для разных пользователей
  // Это гарантирует, что разные пользователи попадут под разные правила
  // и получат разное количество продуктов
  
  // Вспомогательная функция для установки ответа
  function setAnswer(
    answersArray: any[],
    map: Record<string, any>,
    code: string,
    value: string | string[]
  ) {
    // Пробуем разные варианты кода (с разным регистром)
    const question = map[code] || map[code.toUpperCase()] || map[code.toLowerCase()];
    if (!question || question.answerOptions.length === 0) {
      console.warn(`⚠️  Вопрос с кодом "${code}" не найден`);
      return;
    }
    
    // Ищем нужный вариант ответа
    if (Array.isArray(value)) {
      // Для multi_choice ищем все варианты
      const selectedOptions = [];
      for (const val of value) {
        const option = question.answerOptions.find((opt: any) => {
          const optValue = (opt.value || '').toLowerCase();
          const optLabel = (opt.label || '').toLowerCase();
          const searchVal = val.toLowerCase();
          
          return optValue === searchVal || 
                 optLabel === searchVal ||
                 optValue.includes(searchVal) ||
                 optLabel.includes(searchVal) ||
                 searchVal.includes(optValue) ||
                 searchVal.includes(optLabel);
        });
        if (option) {
          selectedOptions.push(option.value || option.label);
        } else {
          console.warn(`⚠️  Вариант ответа "${val}" не найден для вопроса "${code}"`);
        }
      }
      if (selectedOptions.length > 0) {
        answersArray.push({
          userId,
          questionnaireId,
          questionId: question.id,
          answerValues: selectedOptions,
        });
      }
    } else {
      // Для single_choice ищем один вариант
      const selectedOption = question.answerOptions.find((opt: any) => {
        const optValue = (opt.value || '').toLowerCase();
        const optLabel = (opt.label || '').toLowerCase();
        const searchVal = value.toLowerCase();
        
        return optValue === searchVal || 
               optLabel === searchVal ||
               optValue.includes(searchVal) ||
               optLabel.includes(searchVal) ||
               searchVal.includes(optValue) ||
               searchVal.includes(optLabel);
      });
      if (selectedOption) {
        answersArray.push({
          userId,
          questionnaireId,
          questionId: question.id,
          answerValue: selectedOption.value || selectedOption.label,
        });
      } else {
        console.warn(`⚠️  Вариант ответа "${value}" не найден для вопроса "${code}"`);
        console.warn(`   Доступные варианты:`, question.answerOptions.map((o: any) => `${o.value || ''} / ${o.label || ''}`));
      }
    }
  }
  
  // Определяем профиль на основе userIndex (1-5 для теста)
  const profileType = ((userIndex - 1) % 5) + 1;
  
  // Находим нужные вопросы по коду (сохраняем все варианты регистра)
  const questionMap: Record<string, any> = {};
  for (const question of allQuestions) {
    if (question.code) {
      const codeLower = question.code.toLowerCase();
      const codeUpper = question.code.toUpperCase();
      questionMap[codeLower] = question;
      questionMap[codeUpper] = question;
      questionMap[question.code] = question; // Оригинальный регистр
    }
  }
  
  console.log(`📋 Создаю профиль ${profileType} для пользователя ${userIndex}`);

  // Профиль 1: Жирная кожа + акне (тяжелая форма) 18-30
  // Ожидается: правило "Акне 3–4 степени" (inflammation >= 85) = 4 продукта
  if (profileType === 1) {
    console.log('   Профиль 1: Жирная кожа + акне (тяжелая форма)');
    setAnswer(answers, questionMap, 'gender', 'Женский');
    setAnswer(answers, questionMap, 'age', '25–34');
    setAnswer(answers, questionMap, 'skin_type', 'Тип 4 — Жирная');
    setAnswer(answers, questionMap, 'skin_concerns', ['Акне']);
    setAnswer(answers, questionMap, 'skin_sensitivity', 'Низкий уровень'); // Низкая чувствительность для акне
    setAnswer(answers, questionMap, 'budget', 'Средний сегмент');
    setAnswer(answers, questionMap, 'pregnancy_breastfeeding', 'Нет');
    // НЕ указываем retinoid_usage, чтобы не попасть под правило "Повреждённый барьер"
  }
  // Профиль 2: Сухая кожа + высокая чувствительность (но БЕЗ повреждённого барьера)
  // Ожидается: правило для чувствительной кожи = 3 продукта (cleanser, moisturizer, spf)
  else if (profileType === 2) {
    console.log('   Профиль 2: Сухая кожа + высокая чувствительность (но барьер не повреждён)');
    setAnswer(answers, questionMap, 'gender', 'Женский');
    setAnswer(answers, questionMap, 'age', '25–34');
    setAnswer(answers, questionMap, 'skin_type', 'Тип 1 — Сухая');
    setAnswer(answers, questionMap, 'skin_sensitivity', 'Высокий уровень'); // Высокая чувствительность
    setAnswer(answers, questionMap, 'skin_concerns', ['Чувствительность']);
    setAnswer(answers, questionMap, 'budget', 'Средний сегмент');
    setAnswer(answers, questionMap, 'pregnancy_breastfeeding', 'Нет');
    setAnswer(answers, questionMap, 'retinoid_usage', 'Нет'); // НЕ использовали ретинол - барьер не повреждён
    setAnswer(answers, questionMap, 'retinoid_reaction', null); // Нет реакции на ретинол
  }
  // Профиль 3: Комбинированная кожа + расширенные поры
  // Ожидается: правило для комбинированной кожи = 4-5 продуктов
  else if (profileType === 3) {
    console.log('   Профиль 3: Комбинированная кожа + расширенные поры');
    setAnswer(answers, questionMap, 'gender', 'Женский');
    setAnswer(answers, questionMap, 'age', '25–34');
    setAnswer(answers, questionMap, 'skin_type', 'Тип 3 — Комбинированная (жирная)');
    setAnswer(answers, questionMap, 'skin_concerns', ['Расширенные поры']);
    setAnswer(answers, questionMap, 'skin_sensitivity', 'Низкий уровень');
    setAnswer(answers, questionMap, 'budget', 'Средний сегмент');
    setAnswer(answers, questionMap, 'pregnancy_breastfeeding', 'Нет');
    setAnswer(answers, questionMap, 'retinoid_usage', 'Нет');
  }
  // Профиль 4: Пигментация (35+)
  // Ожидается: правило для пигментации = 4 продукта
  else if (profileType === 4) {
    console.log('   Профиль 4: Пигментация (35+)');
    setAnswer(answers, questionMap, 'gender', 'Женский');
    setAnswer(answers, questionMap, 'age', '35–44');
    setAnswer(answers, questionMap, 'skin_type', 'Тип 3 - Нормальная');
    setAnswer(answers, questionMap, 'skin_concerns', ['Пигментация']);
    setAnswer(answers, questionMap, 'skin_sensitivity', 'Низкий уровень');
    setAnswer(answers, questionMap, 'budget', 'Средний сегмент');
    setAnswer(answers, questionMap, 'pregnancy_breastfeeding', 'Нет');
    setAnswer(answers, questionMap, 'retinoid_usage', 'Нет');
  }
  // Профиль 5: Обезвоженная кожа + темные круги под глазами
  // Ожидается: правило для обезвоженности = 5 продуктов
  else if (profileType === 5) {
    console.log('   Профиль 5: Обезвоженная кожа + темные круги');
    setAnswer(answers, questionMap, 'gender', 'Женский');
    setAnswer(answers, questionMap, 'age', '25–34');
    setAnswer(answers, questionMap, 'skin_type', 'Тип 1 — Сухая');
    setAnswer(answers, questionMap, 'skin_concerns', ['Сухость и стянутость', 'Круги под глазами']);
    setAnswer(answers, questionMap, 'skin_sensitivity', 'Низкий уровень');
    setAnswer(answers, questionMap, 'budget', 'Средний сегмент');
    setAnswer(answers, questionMap, 'pregnancy_breastfeeding', 'Нет');
    setAnswer(answers, questionMap, 'retinoid_usage', 'Нет');
  }
  
  // Для остальных вопросов используем дефолтные ответы
  // ВАЖНО: Для вопроса о беременности всегда выбираем "Нет", если он еще не был установлен
  for (const question of allQuestions) {
    if (question.answerOptions.length === 0) continue;
    
    // Пропускаем вопросы, на которые уже ответили
    const existingAnswer = answers.find(a => a.questionId === question.id);
    if (existingAnswer) continue;
    
    // Специальная обработка для вопроса о беременности - всегда "Нет"
    const isPregnancyQuestion = question.code && (
      question.code.toLowerCase().includes('pregnancy') ||
      question.code.toLowerCase().includes('breastfeeding') ||
      question.text?.toLowerCase().includes('беремен') ||
      question.text?.toLowerCase().includes('кормлю')
    );
    
    if (isPregnancyQuestion) {
      const noOption = question.answerOptions.find((opt: any) => 
        (opt.label || '').toLowerCase().includes('нет') ||
        (opt.value || '').toLowerCase().includes('нет') ||
        (opt.label || '').toLowerCase().includes('no')
      );
      if (noOption) {
        answers.push({
          userId,
          questionnaireId,
          questionId: question.id,
          answerValue: noOption.value || noOption.label,
        });
        continue;
      }
    }
    
    // Для multi_choice выбираем первый вариант
    if (question.type === 'multi_choice') {
      const firstOption = question.answerOptions[0];
      if (firstOption) {
        const value = firstOption.value || firstOption.label;
        if (value) {
          answers.push({
            userId,
            questionnaireId,
            questionId: question.id,
            answerValues: [value],
          });
        }
      }
    } else {
      // Для single_choice выбираем первый вариант
      const firstOption = question.answerOptions[0];
      if (firstOption) {
        answers.push({
          userId,
          questionnaireId,
          questionId: question.id,
          answerValue: firstOption.value || firstOption.label,
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

async function processUser(index: number, questionnaireId: number, userIndex?: number): Promise<TestResult> {
  // Используем userIndex для вариативности ответов, если не передан - используем index
  const answerVariationIndex = userIndex !== undefined ? userIndex : index;
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

    // 2. Создаем ответы с вариативностью
    const answers = await createTestAnswers(user.id, questionnaireId, answerVariationIndex);
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
    
    // Логируем профиль для первых 5 пользователей
    if (index <= 5) {
      console.log(`   📊 Профиль: skinType=${profileData.skinType}, hasPregnancy=${profileData.hasPregnancy}, ageGroup=${profileData.ageGroup}, acneLevel=${profileData.acneLevel}`);
    }

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
    
    // Логируем все правила для первых 5 пользователей
    if (index <= 5) {
      console.log(`   📋 Всего правил: ${rules.length}`);
      console.log(`   📋 Правила (первые 10):`, rules.slice(0, 10).map((r: any) => `${r.name} (приоритет: ${r.priority})`).join(', '));
    }
    
    for (const rule of rules) {
      const conditions = rule.conditionsJson as any;
      let matches = true;
      
      // Логируем проверку правила для первых 5 пользователей (только для правил с высоким приоритетом)
      if (index <= 5 && rule.priority >= 95) {
        console.log(`   🔍 Проверяю правило: ${rule.name} (приоритет: ${rule.priority})`);
      }

      for (const [key, condition] of Object.entries(conditions)) {
        let profileValue: any;
        
        if (key === 'diagnoses') {
          profileValue = (profile.medicalMarkers as any)?.diagnoses || [];
        } else if (key === 'pregnant' || key === 'hasPregnancy') {
          // Правило может проверять как 'pregnant', так и 'hasPregnancy'
          profileValue = (profile as any).hasPregnancy || (profile as any).pregnant || false;
        } else if (key === 'inflammation') {
          // Вычисляем inflammation из acneLevel и других параметров
          const acneLevel = (profile as any).acneLevel || 0;
          const hasAcneConcern = (profile.medicalMarkers as any)?.mainGoals?.includes('acne') || false;
          // Формула: acneLevel * 20 + (hasAcneConcern ? 50 : 0)
          profileValue = Math.min(100, acneLevel * 20 + (hasAcneConcern ? 50 : 0));
        } else if (key === 'barrier') {
          // Вычисляем barrier из sensitivityLevel и других параметров
          // Начальное значение 100, уменьшаем в зависимости от чувствительности
          let barrier = 100;
          const sensitivityLevel = (profile as any).sensitivityLevel || 'low';
          if (sensitivityLevel === 'high' || sensitivityLevel === 'very_high') {
            barrier -= 50; // Высокая чувствительность = низкий барьер
          } else if (sensitivityLevel === 'medium') {
            barrier -= 25;
          }
          // Если есть диагнозы, связанные с барьером, уменьшаем еще
          const diagnoses = (profile.medicalMarkers as any)?.diagnoses || [];
          if (diagnoses.some((d: string) => d.includes('атопический') || d.includes('atopic'))) {
            barrier -= 30;
          }
          profileValue = Math.max(0, Math.min(100, barrier));
        } else if (key === 'hydration') {
          // Вычисляем hydration из dehydrationLevel
          // dehydrationLevel: 0-5, где 5 = максимальная обезвоженность
          const dehydrationLevel = (profile as any).dehydrationLevel || 0;
          // Инвертируем: высокий dehydrationLevel = низкая hydration
          profileValue = Math.max(0, Math.min(100, 100 - (dehydrationLevel * 20)));
        } else if (key === 'oiliness') {
          // Вычисляем oiliness из skinType
          const skinType = (profile as any).skinType || 'normal';
          const oilinessMap: Record<string, number> = {
            'dry': 20,
            'normal': 50,
            'combo': 70,
            'oily': 85,
            'sensitive': 40,
          };
          profileValue = oilinessMap[skinType] || 50;
        } else if (key === 'pigmentation') {
          // Вычисляем pigmentation из pigmentationRisk
          const pigmentationRisk = (profile as any).pigmentationRisk || 'none';
          const riskMap: Record<string, number> = {
            'none': 20,
            'medium': 60,
            'high': 85,
          };
          profileValue = riskMap[pigmentationRisk] || 20;
        } else {
          profileValue = (profile as any)[key];
        }
        
        if (index <= 5 && rule.priority >= 95 && matches) {
          // Логируем только если правило еще может совпасть
        }

        if (Array.isArray(condition)) {
          if (!condition.includes(profileValue)) {
            matches = false;
            if (index <= 5 && rule.priority >= 95) {
              console.log(`      ❌ Не совпало: ${key} (${profileValue}) не входит в массив ${JSON.stringify(condition)}`);
            }
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
              if (index <= 5 && rule.priority >= 95) {
                console.log(`      ❌ Не совпало: ${key} не содержит ни одного из ${JSON.stringify(hasSomeArray)}`);
              }
              break;
            }
            continue;
          } else if ('gte' in conditionObj || 'lte' in conditionObj) {
            // Проверка диапазона (gte, lte)
            const numValue = typeof profileValue === 'number' ? profileValue : 0;
            if ('gte' in conditionObj && typeof conditionObj.gte === 'number') {
              if (numValue < conditionObj.gte) {
                matches = false;
                if (index <= 5 && rule.priority >= 95) {
                  console.log(`      ❌ Не совпало: ${key} (${numValue}) < ${conditionObj.gte}`);
                }
                break;
              }
            }
            if ('lte' in conditionObj && typeof conditionObj.lte === 'number') {
              if (numValue > conditionObj.lte) {
                matches = false;
                if (index <= 5 && rule.priority >= 95) {
                  console.log(`      ❌ Не совпало: ${key} (${numValue}) > ${conditionObj.lte}`);
                }
                break;
              }
            }
            continue;
          }
        } else if (typeof condition === 'boolean') {
          // ВАЖНО: Проверка булевого значения
          if (condition !== profileValue) {
            matches = false;
            if (index <= 5 && rule.priority >= 95) {
              console.log(`      ❌ Не совпало: ${key} (ожидалось ${condition}, получено ${profileValue})`);
            }
            break;
          }
        } else if (condition !== profileValue) {
          // Простое сравнение
          matches = false;
          if (index <= 5 && rule.priority >= 95) {
            console.log(`      ❌ Не совпало: ${key} (ожидалось ${condition}, получено ${profileValue})`);
          }
          break;
        }
      }

      if (matches) {
        matchedRule = rule;
        if (index <= 5) {
          console.log(`   ✅ Правило "${rule.name}" совпало!`);
        }
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

    // Логируем правило только для первых 5 пользователей (чтобы не засорять вывод)
    if (index <= 5) {
      console.log(`   📋 Правило: ${matchedRule.name || matchedRule.id}, шагов: ${Object.keys(stepsJson).length}`);
    }

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
      
      // Логируем детали только для первых 5 пользователей
      if (index <= 5) {
        console.log(`      - ${stepName}: ${products.length} продуктов (max_items: ${step.max_items || 3})`);
      }
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

  // Определяем количество пользователей из аргументов командной строки
  const userCount = process.argv[2] ? parseInt(process.argv[2]) : 100;
  
  // Обрабатываем пользователей последовательно (чтобы не перегрузить БД)
  for (let i = 1; i <= userCount; i++) {
    console.log(`📝 Обработка пользователя ${i}/${userCount}...`);
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

