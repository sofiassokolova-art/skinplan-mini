// scripts/check-user-plan-generation.ts
// Скрипт для проверки генерации плана пользователя

import { prisma } from '../lib/db';
import { selectCarePlanTemplate } from '../lib/care-plan-templates';
import { isStepAllowedForProfile, STEP_CATEGORY_RULES } from '../lib/step-category-rules';
import { createEmptySkinProfile } from '../lib/skinprofile-types';

const telegramId = 287939646;

async function checkPlanGeneration() {
  try {
    console.log(`\n🔍 Проверяю генерацию плана для пользователя ${telegramId}\n`);

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
        },
      },
    });

    if (!user || user.skinProfiles.length === 0) {
      console.error('❌ Пользователь или профиль не найден');
      return;
    }

    const profile = user.skinProfiles[0];
    const medicalMarkers = (profile.medicalMarkers as Record<string, any> | null) || {};

    console.log('📊 Профиль пользователя:');
    console.log(`   Тип кожи: ${profile.skinType}`);
    console.log(`   Уровень чувствительности: ${profile.sensitivityLevel}`);
    console.log(`   Возрастная группа: ${profile.ageGroup}`);
    console.log(`   Диагнозы: ${Array.isArray(medicalMarkers.diagnoses) ? medicalMarkers.diagnoses.join(', ') || 'нет' : 'нет'}`);
    console.log(`   Противопоказания: ${Array.isArray(medicalMarkers.contraindications) ? medicalMarkers.contraindications.join(', ') || 'нет' : 'нет'}`);

    // Определяем mainGoals из ответов
    const mainGoals: string[] = [];
    user.userAnswers.forEach(answer => {
      const code = answer.question?.code;
      if (code === 'skin_concerns' && Array.isArray(answer.answerValues)) {
        mainGoals.push(...answer.answerValues);
      }
    });

    console.log(`   Основные цели: ${mainGoals.length > 0 ? mainGoals.join(', ') : 'не указаны'}`);

    // Определяем routineComplexity
    let routineComplexity: 'minimal' | 'medium' | 'maximal' = 'medium';
    const careStepsAnswer = user.userAnswers.find(a => a.question?.code === 'care_steps');
    if (careStepsAnswer) {
      const steps = String(careStepsAnswer.answerValue || '');
      if (steps.includes('1') || steps.includes('2')) {
        routineComplexity = 'minimal';
      } else if (steps.includes('5') || steps.includes('6') || steps.includes('7')) {
        routineComplexity = 'maximal';
      }
    }

    console.log(`   Сложность рутины: ${routineComplexity}`);

    // Выбираем шаблон
    const carePlanProfileInput = {
      skinType: profile.skinType || 'normal',
      mainGoals: mainGoals.length > 0 ? mainGoals : ['maintenance'],
      sensitivityLevel: profile.sensitivityLevel || 'medium',
      routineComplexity,
    };

    console.log('\n📋 Входные данные для выбора шаблона:');
    console.log(JSON.stringify(carePlanProfileInput, null, 2));

    const template = selectCarePlanTemplate(carePlanProfileInput);
    console.log(`\n✅ Выбранный шаблон: ${template.id}`);
    console.log(`   Утро: ${template.morning.join(', ')}`);
    console.log(`   Вечер: ${template.evening.join(', ')}`);

    // Создаем stepProfile для проверки фильтрации
    // ИСПРАВЛЕНО: Преобразуем "combo" в "combination_oily" для совместимости с правилами
    let normalizedSkinType = profile.skinType;
    if (normalizedSkinType === 'combo') {
      normalizedSkinType = 'combination_oily'; // По умолчанию используем combination_oily
    }
    
    const stepProfile = {
      ...createEmptySkinProfile(),
      skinType: normalizedSkinType as any,
      sensitivity: profile.sensitivityLevel as any,
      diagnoses: Array.isArray(medicalMarkers.diagnoses) ? medicalMarkers.diagnoses : [],
      contraindications: Array.isArray(medicalMarkers.contraindications) ? medicalMarkers.contraindications : [],
      mainGoals: mainGoals,
    };
    
    console.log(`\n   ИСПРАВЛЕНО: Тип кожи "${profile.skinType}" преобразован в "${normalizedSkinType}" для проверки правил`);

    console.log('\n🔍 Проверка фильтрации шагов:');
    console.log(`   Тип кожи в stepProfile: ${stepProfile.skinType}`);
    console.log(`   Чувствительность: ${stepProfile.sensitivity}`);
    console.log(`   Диагнозы: ${stepProfile.diagnoses.join(', ') || 'нет'}`);
    console.log(`   Противопоказания: ${stepProfile.contraindications.join(', ') || 'нет'}`);

    console.log('\n   Утренние шаги из шаблона:');
    template.morning.forEach(step => {
      const isAllowed = isStepAllowedForProfile(step, stepProfile);
      const status = isAllowed ? '✅' : '❌ ОТФИЛЬТРОВАН';
      console.log(`     ${status} ${step}`);
      if (!isAllowed) {
        // Проверяем, почему отфильтрован
        const rule = STEP_CATEGORY_RULES[step];
        if (rule) {
          if (rule.skinTypesAllowed && !rule.skinTypesAllowed.includes(stepProfile.skinType || '')) {
            console.log(`        Причина: тип кожи ${stepProfile.skinType} не в списке разрешенных: ${rule.skinTypesAllowed.join(', ')}`);
          }
          if (rule.avoidDiagnoses && stepProfile.diagnoses.some(d => rule.avoidDiagnoses!.includes(d as any))) {
            console.log(`        Причина: диагнозы ${stepProfile.diagnoses.filter(d => rule.avoidDiagnoses!.includes(d as any)).join(', ')} в списке запрещенных`);
          }
          if (rule.avoidIfContraFromProfile && stepProfile.contraindications.some(c => rule.avoidIfContraFromProfile!.includes(c as any))) {
            console.log(`        Причина: противопоказания ${stepProfile.contraindications.filter(c => rule.avoidIfContraFromProfile!.includes(c as any)).join(', ')} в списке запрещенных`);
          }
          if (rule.avoidIfSensitivity && stepProfile.sensitivity && rule.avoidIfSensitivity.includes(stepProfile.sensitivity as any)) {
            console.log(`        Причина: уровень чувствительности ${stepProfile.sensitivity} в списке запрещенных`);
          }
        } else {
          console.log(`        Причина: правило для шага ${step} не найдено`);
        }
      }
    });

    console.log('\n   Вечерние шаги из шаблона:');
    template.evening.forEach(step => {
      const isAllowed = isStepAllowedForProfile(step, stepProfile);
      const status = isAllowed ? '✅' : '❌ ОТФИЛЬТРОВАН';
      console.log(`     ${status} ${step}`);
      if (!isAllowed) {
        // Проверяем, почему отфильтрован
        const rule = STEP_CATEGORY_RULES[step];
        if (rule) {
          if (rule.skinTypesAllowed && !rule.skinTypesAllowed.includes(stepProfile.skinType || '')) {
            console.log(`        Причина: тип кожи ${stepProfile.skinType} не в списке разрешенных: ${rule.skinTypesAllowed.join(', ')}`);
          }
          if (rule.avoidDiagnoses && stepProfile.diagnoses.some(d => rule.avoidDiagnoses!.includes(d as any))) {
            console.log(`        Причина: диагнозы ${stepProfile.diagnoses.filter(d => rule.avoidDiagnoses!.includes(d as any)).join(', ')} в списке запрещенных`);
          }
          if (rule.avoidIfContraFromProfile && stepProfile.contraindications.some(c => rule.avoidIfContraFromProfile!.includes(c as any))) {
            console.log(`        Причина: противопоказания ${stepProfile.contraindications.filter(c => rule.avoidIfContraFromProfile!.includes(c as any)).join(', ')} в списке запрещенных`);
          }
          if (rule.avoidIfSensitivity && stepProfile.sensitivity && rule.avoidIfSensitivity.includes(stepProfile.sensitivity as any)) {
            console.log(`        Причина: уровень чувствительности ${stepProfile.sensitivity} в списке запрещенных`);
          }
        } else {
          console.log(`        Причина: правило для шага ${step} не найдено`);
        }
      }
    });

    // Проверяем фактический план
    const plan = await prisma.plan28.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
    });

    if (plan && plan.planData) {
      const planData = plan.planData as any;
      const day1 = planData.days?.[0];
      
      console.log('\n📅 Фактический план (День 1):');
      console.log(`   Утро: ${day1?.morning?.length || 0} шагов`);
      if (day1?.morning) {
        day1.morning.forEach((step: any) => {
          console.log(`     - ${step.stepCategory}`);
        });
      }
      console.log(`   Вечер: ${day1?.evening?.length || 0} шагов`);
      if (day1?.evening) {
        day1.evening.forEach((step: any) => {
          console.log(`     - ${step.stepCategory}`);
        });
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

checkPlanGeneration();
