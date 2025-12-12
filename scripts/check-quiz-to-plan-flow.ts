// scripts/check-quiz-to-plan-flow.ts
// Проверка всего flow от анкеты до плана для выявления потенциальных проблем

import { prisma } from '../lib/db';
import { logger } from '../lib/logger';

async function checkQuizToPlanFlow(telegramId?: string) {
  try {
    console.log('\n🔍 Проверка flow от анкеты до плана\n');
    console.log('='.repeat(60));

    // Находим пользователя
    const user = telegramId
      ? await prisma.user.findUnique({ where: { telegramId } })
      : await prisma.user.findFirst({ orderBy: { createdAt: 'desc' } });

    if (!user) {
      console.log('❌ Пользователь не найден');
      return;
    }

    console.log(`\n👤 Пользователь: ${user.telegramId} (${user.id})`);

    // 1. Проверяем активную анкету
    console.log('\n📋 1. Проверка активной анкеты:');
    const activeQuestionnaire = await prisma.questionnaire.findFirst({
      where: { isActive: true },
    });
    if (!activeQuestionnaire) {
      console.log('   ❌ Нет активной анкеты!');
      return;
    }
    console.log(`   ✅ Активная анкета: ${activeQuestionnaire.name} (v${activeQuestionnaire.version})`);

    // 2. Проверяем ответы пользователя
    console.log('\n📝 2. Проверка ответов пользователя:');
    const userAnswers = await prisma.userAnswer.findMany({
      where: {
        userId: user.id,
        questionnaireId: activeQuestionnaire.id,
      },
      include: {
        question: {
          include: {
            answerOptions: true,
          },
        },
      },
      orderBy: {
        question: {
          position: 'asc',
        },
      },
    });

    console.log(`   Всего ответов: ${userAnswers.length}`);
    if (userAnswers.length === 0) {
      console.log('   ❌ Нет ответов пользователя!');
      return;
    }

    // Проверяем обязательные вопросы
    const requiredQuestions = await prisma.question.findMany({
      where: {
        questionnaireId: activeQuestionnaire.id,
        isRequired: true,
      },
    });

    const answeredQuestionIds = new Set(userAnswers.map(a => a.questionId));
    const missingRequired = requiredQuestions.filter(q => !answeredQuestionIds.has(q.id));

    if (missingRequired.length > 0) {
      console.log(`   ⚠️  Отсутствуют ответы на ${missingRequired.length} обязательных вопросов:`);
      missingRequired.forEach(q => {
        console.log(`      - ${q.code} (${q.text.substring(0, 50)}...)`);
      });
    } else {
      console.log('   ✅ Все обязательные вопросы отвечены');
    }

    // 3. Проверяем SkinProfile
    console.log('\n👤 3. Проверка SkinProfile:');
    const profile = await prisma.skinProfile.findFirst({
      where: { userId: user.id },
      orderBy: { version: 'desc' },
    });

    if (!profile) {
      console.log('   ❌ SkinProfile не найден!');
      return;
    }

    console.log(`   ✅ SkinProfile найден (версия ${profile.version})`);
    console.log(`   Тип кожи: ${profile.skinType || 'не указан'}`);
    console.log(`   Чувствительность: ${profile.sensitivityLevel || 'не указана'}`);
    console.log(`   Уровень акне: ${profile.acneLevel ?? 'не указан'}`);
    console.log(`   Обезвоживание: ${profile.dehydrationLevel ?? 'не указано'}`);

    // Проверяем medicalMarkers
    const medicalMarkers = profile.medicalMarkers as Record<string, any> | null;
    if (medicalMarkers) {
      console.log(`   Medical markers:`);
      if (medicalMarkers.mainGoals) {
        console.log(`      - mainGoals: ${JSON.stringify(medicalMarkers.mainGoals)}`);
      }
      if (medicalMarkers.diagnoses) {
        console.log(`      - diagnoses: ${JSON.stringify(medicalMarkers.diagnoses)}`);
      }
      if (medicalMarkers.contraindications) {
        console.log(`      - contraindications: ${JSON.stringify(medicalMarkers.contraindications)}`);
      }
    }

    // 4. Проверяем RecommendationSession
    console.log('\n🎯 4. Проверка RecommendationSession:');
    const recommendationSession = await prisma.recommendationSession.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      include: {
        rule: true,
      },
    });

    if (!recommendationSession) {
      console.log('   ❌ RecommendationSession не найден!');
      console.log('   ⚠️  Это может означать, что правило не было найдено или не было создано');
    } else {
      console.log(`   ✅ RecommendationSession найден`);
      console.log(`   Правило: ${recommendationSession.rule.name} (ID: ${recommendationSession.ruleId})`);
      console.log(`   Создан: ${recommendationSession.createdAt.toISOString()}`);
    }

    // 5. Проверяем Plan28
    console.log('\n📅 5. Проверка Plan28:');
    const plan28 = await prisma.plan28.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
    });

    if (!plan28) {
      console.log('   ❌ Plan28 не найден!');
      console.log('   ⚠️  План не был сгенерирован');
    } else {
      console.log(`   ✅ Plan28 найден`);
      console.log(`   Создан: ${plan28.createdAt.toISOString()}`);
      
      const planData = plan28.plan28 as any;
      if (planData) {
        console.log(`   Структура plan28:`, Object.keys(planData));
        
        if (planData.days) {
          const daysCount = Array.isArray(planData.days) ? planData.days.length : 0;
          console.log(`   Дней в плане: ${daysCount}`);
          
          if (daysCount > 0) {
            const firstDay = planData.days[0];
            if (firstDay) {
              const morningSteps = firstDay.morning?.length || 0;
              const eveningSteps = firstDay.evening?.length || 0;
              console.log(`   Шагов в первый день: утро ${morningSteps}, вечер ${eveningSteps}`);
            }
          } else {
            console.log('   ⚠️  План пустой (нет дней)!');
          }
        } else if (planData.weeks) {
          const weeksCount = Array.isArray(planData.weeks) ? planData.weeks.length : 0;
          console.log(`   Недель в плане: ${weeksCount}`);
          if (weeksCount > 0) {
            const firstWeek = planData.weeks[0];
            if (firstWeek && firstWeek.days) {
              const daysInWeek = Array.isArray(firstWeek.days) ? firstWeek.days.length : 0;
              console.log(`   Дней в первой неделе: ${daysInWeek}`);
            }
          }
        } else {
          console.log('   ⚠️  Структура плана некорректна (нет days и weeks)!');
          console.log(`   Доступные ключи: ${Object.keys(planData).join(', ')}`);
        }
      } else {
        console.log('   ⚠️  plan28.plan28 пустой или null!');
      }
    }

    // 6. Проверяем соответствие значений
    console.log('\n🔄 6. Проверка соответствия значений:');
    
    // Проверяем, что тип кожи в профиле может быть нормализован
    if (profile.skinType) {
      const { normalizeSkinTypeForRules } = await import('../lib/skin-type-normalizer');
      const normalized = normalizeSkinTypeForRules(profile.skinType);
      if (normalized !== profile.skinType) {
        console.log(`   ⚠️  Тип кожи "${profile.skinType}" будет нормализован в "${normalized}" для правил`);
      } else {
        console.log(`   ✅ Тип кожи "${profile.skinType}" соответствует правилам`);
      }
    }

    // Проверяем, что значения в RecommendationSession соответствуют профилю
    if (recommendationSession) {
      const ruleConditions = recommendationSession.rule.conditionsJson as any;
      console.log(`   Условия правила:`);
      
      // ИСПРАВЛЕНО: Вычисляем skin scores для проверки
      const { calculateSkinAxes } = await import('../lib/skin-analysis-engine');
      const { normalizeSkinTypeForRules, normalizeSensitivityForRules } = await import('../lib/skin-type-normalizer');
      
      // Получаем ответы для вычисления scores
      const userAnswersForScores = await prisma.userAnswer.findMany({
        where: {
          userId: user.id,
          questionnaireId: activeQuestionnaire.id,
        },
        include: {
          question: true,
        },
      });
      
      // Формируем QuestionnaireAnswers
      const questionnaireAnswers: any = {
        skinType: profile.skinType || 'normal',
        age: profile.ageGroup || '25-34',
        concerns: [],
        diagnoses: [],
        allergies: [],
        sensitivityLevel: profile.sensitivityLevel || 'low',
        acneLevel: profile.acneLevel || 0,
      };
      
      for (const answer of userAnswersForScores) {
        const code = answer.question?.code || '';
        if (code === 'skin_concerns' && Array.isArray(answer.answerValues)) {
          questionnaireAnswers.concerns = answer.answerValues as string[];
        } else if (code === 'diagnoses' && Array.isArray(answer.answerValues)) {
          questionnaireAnswers.diagnoses = answer.answerValues as string[];
        } else if (code === 'allergies' && Array.isArray(answer.answerValues)) {
          questionnaireAnswers.allergies = answer.answerValues as string[];
        }
      }
      
      const skinScores = calculateSkinAxes(questionnaireAnswers);
      const normalizedSkinType = normalizeSkinTypeForRules(profile.skinType, { userId: user.id });
      const normalizedSensitivity = normalizeSensitivityForRules(profile.sensitivityLevel);
      
      // Создаем profileWithScores как в API
      const profileWithScores: any = {
        ...profile,
        inflammation: skinScores.find(s => s.axis === 'inflammation')?.value || 0,
        oiliness: skinScores.find(s => s.axis === 'oiliness')?.value || 0,
        hydration: skinScores.find(s => s.axis === 'hydration')?.value || 0,
        barrier: skinScores.find(s => s.axis === 'barrier')?.value || 0,
        pigmentation: skinScores.find(s => s.axis === 'pigmentation')?.value || 0,
        photoaging: skinScores.find(s => s.axis === 'photoaging')?.value || 0,
        skin_type: normalizedSkinType,
        skinType: normalizedSkinType,
        sensitivity_level: normalizedSensitivity,
        sensitivity: normalizedSensitivity,
        age_group: profile.ageGroup,
        age: profile.ageGroup,
        medicalMarkers,
      };
      
      Object.entries(ruleConditions).forEach(([key, value]) => {
        const profileValue = profileWithScores[key];
        const matches = checkConditionMatch(profileValue, value);
        const status = matches ? '✅' : '❌';
        console.log(`      ${status} ${key}: правило требует ${JSON.stringify(value)}, в профиле: ${JSON.stringify(profileValue)}`);
      });
    }

    // 7. Проверяем временные метки
    console.log('\n⏰ 7. Проверка временных меток:');
    if (userAnswers.length > 0) {
      const lastAnswer = userAnswers[userAnswers.length - 1];
      console.log(`   Последний ответ: ${lastAnswer.createdAt.toISOString()}`);
    }
    if (profile) {
      console.log(`   Профиль создан: ${profile.createdAt.toISOString()}`);
      console.log(`   Профиль обновлен: ${profile.updatedAt.toISOString()}`);
    }
    if (recommendationSession) {
      console.log(`   Сессия создана: ${recommendationSession.createdAt.toISOString()}`);
    }
    if (plan28) {
      console.log(`   План создан: ${plan28.createdAt.toISOString()}`);
    }

    // Проверяем порядок создания
    if (profile && recommendationSession) {
      if (recommendationSession.createdAt < profile.createdAt) {
        console.log('   ⚠️  RecommendationSession создан ДО профиля! Это может быть проблемой.');
      }
    }
    if (recommendationSession && plan28) {
      if (plan28.createdAt < recommendationSession.createdAt) {
        console.log('   ⚠️  Plan28 создан ДО RecommendationSession! Это может быть проблемой.');
      }
    }

    console.log('\n✅ Проверка завершена\n');
  } catch (error: any) {
    console.error('❌ Ошибка:', error?.message);
    console.error(error?.stack);
  } finally {
    await prisma.$disconnect();
  }
}

function checkConditionMatch(profileValue: any, condition: any): boolean {
  if (Array.isArray(condition)) {
    return condition.includes(profileValue);
  } else if (typeof condition === 'object' && condition !== null) {
    if ('gte' in condition && typeof profileValue === 'number') {
      return profileValue >= (condition.gte as number);
    }
    if ('lte' in condition && typeof profileValue === 'number') {
      return profileValue <= (condition.lte as number);
    }
    if ('hasSome' in condition && Array.isArray(condition.hasSome)) {
      const profileArray = Array.isArray(profileValue) ? profileValue : [];
      return condition.hasSome.some((item: any) => profileArray.includes(item));
    }
    if ('in' in condition && Array.isArray(condition.in)) {
      return condition.in.includes(profileValue);
    }
  } else if (condition === profileValue) {
    return true;
  }
  return false;
}

const telegramId = process.argv[2];
checkQuizToPlanFlow(telegramId);
