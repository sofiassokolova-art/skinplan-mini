// scripts/update-rules-to-detailed-steps.ts
// Обновление правил рекомендаций для использования детальных шагов вместо базовых

import { prisma } from '../lib/db';

/**
 * Определяет детальный шаг на основе условий правила и базового шага
 */
function getDetailedStep(
  baseStep: string,
  conditions: any,
  stepConfig: any
): string {
  const skinType = conditions.skinType;
  const sensitivityLevel = conditions.sensitivityLevel;
  const acneLevel = conditions.acneLevel;
  const concerns = stepConfig?.concerns || [];
  const activeIngredients = stepConfig?.active_ingredients || [];

  switch (baseStep) {
    case 'cleanser':
      if (skinType === 'dry' || sensitivityLevel === 'high' || sensitivityLevel === 'very_high') {
        return 'cleanser_gentle';
      }
      if (skinType === 'oily' || concerns.includes('acne') || concerns.includes('oiliness')) {
        return 'cleanser_balancing';
      }
      return 'cleanser_gentle'; // default

    case 'toner':
      if (concerns.includes('sensitivity') || concerns.includes('redness') || sensitivityLevel === 'high') {
        return 'toner_soothing';
      }
      if (concerns.includes('dehydration') || skinType === 'dry') {
        return 'toner_hydrating';
      }
      return 'toner_hydrating'; // default

    case 'serum':
      if (concerns.includes('pigmentation') || activeIngredients.some((i: string) => 
        i.toLowerCase().includes('витамин с') || i.toLowerCase().includes('tranexamic'))) {
        return 'serum_vitc';
      }
      if (concerns.includes('acne') || concerns.includes('pores') || 
          activeIngredients.some((i: string) => i.toLowerCase().includes('ниацинамид'))) {
        return 'serum_niacinamide';
      }
      if (concerns.includes('redness') || concerns.includes('sensitivity')) {
        return 'serum_anti_redness';
      }
      if (concerns.includes('pigmentation') || concerns.includes('brightening')) {
        return 'serum_brightening_soft';
      }
      return 'serum_hydrating'; // default

    case 'treatment':
      // Акне
      if (concerns.includes('acne') || acneLevel >= 3) {
        if (activeIngredients.some((i: string) => 
          i.toLowerCase().includes('бензоила') || i.toLowerCase().includes('benzoyl'))) {
          return 'treatment_acne_bpo';
        }
        if (activeIngredients.some((i: string) => 
          i.toLowerCase().includes('азелаиновая') || i.toLowerCase().includes('azelaic'))) {
          return 'treatment_acne_azelaic';
        }
        return 'treatment_acne_azelaic'; // default для акне
      }
      // Пигментация
      if (concerns.includes('pigmentation') || concerns.includes('uneven_tone')) {
        return 'treatment_pigmentation';
      }
      // Морщины
      if (concerns.includes('wrinkles') || conditions.ageGroup?.some((a: string) => a.includes('35'))) {
        return 'treatment_antiage';
      }
      // Эксфолиация
      if (activeIngredients.some((i: string) => 
        i.toLowerCase().includes('гликолевая') || i.toLowerCase().includes('гликолевая') || 
        i.toLowerCase().includes('aha') || i.toLowerCase().includes('bha'))) {
        if (sensitivityLevel === 'low' || sensitivityLevel === 'medium') {
          return 'treatment_exfoliant_strong';
        }
        return 'treatment_exfoliant_mild';
      }
      // По умолчанию для treatment без специфики - не добавляем, пусть фильтруется по concerns
      return baseStep; // Возвращаем базовый, если не можем определить

    case 'moisturizer':
    case 'cream':
      if (skinType === 'oily' || concerns.includes('oiliness')) {
        return 'moisturizer_balancing';
      }
      if (skinType === 'dry' || concerns.includes('barrier') || concerns.includes('barrier_damage') || 
          sensitivityLevel === 'high') {
        return 'moisturizer_barrier';
      }
      if (concerns.includes('sensitivity') || concerns.includes('redness')) {
        return 'moisturizer_soothing';
      }
      return 'moisturizer_light'; // default

    case 'spf':
      if (skinType === 'oily' || concerns.includes('oiliness')) {
        return 'spf_50_oily';
      }
      if (sensitivityLevel === 'high' || sensitivityLevel === 'very_high' || 
          concerns.includes('sensitivity')) {
        return 'spf_50_sensitive';
      }
      return 'spf_50_face'; // default

    case 'mask':
      if (concerns.includes('clay') || skinType === 'oily') {
        return 'mask_clay';
      }
      if (concerns.includes('soothing') || concerns.includes('sensitivity')) {
        return 'mask_soothing';
      }
      if (concerns.includes('sleeping')) {
        return 'mask_sleeping';
      }
      return 'mask_hydrating'; // default

    default:
      return baseStep;
  }
}

async function updateRulesToDetailedSteps() {
  console.log('🔄 Обновление правил на детальные шаги...\n');

  const rules = await prisma.recommendationRule.findMany({
    where: { isActive: true },
    select: {
      id: true,
      name: true,
      conditionsJson: true,
      stepsJson: true,
    },
  });

  const basicSteps = ['cleanser', 'toner', 'serum', 'treatment', 'moisturizer', 'cream', 'spf', 'mask'];
  let updatedCount = 0;
  let skippedCount = 0;

  for (const rule of rules) {
    const stepsJson = rule.stepsJson as Record<string, any>;
    const conditions = rule.conditionsJson as any;
    let hasBasicSteps = false;
    const updatedStepsJson: Record<string, any> = {};

    // Проверяем, есть ли базовые шаги
    for (const [stepName, stepConfig] of Object.entries(stepsJson)) {
      if (basicSteps.includes(stepName)) {
        hasBasicSteps = true;
        const detailedStep = getDetailedStep(stepName, conditions, stepConfig);
        
        if (detailedStep !== stepName) {
          // Заменяем базовый шаг на детальный
          updatedStepsJson[detailedStep] = {
            ...stepConfig,
            // Оставляем category для обратной совместимости, но добавляем детальный шаг
          };
          console.log(`  ✅ "${rule.name}" (ID: ${rule.id}): ${stepName} → ${detailedStep}`);
        } else {
          // Если не смогли определить детальный шаг, оставляем как есть
          updatedStepsJson[stepName] = stepConfig;
          console.log(`  ⚠️  "${rule.name}" (ID: ${rule.id}): ${stepName} - не удалось определить детальный шаг`);
        }
      } else {
        // Уже детальный шаг или другой шаг - оставляем как есть
        updatedStepsJson[stepName] = stepConfig;
      }
    }

    if (hasBasicSteps) {
      try {
        await prisma.recommendationRule.update({
          where: { id: rule.id },
          data: {
            stepsJson: updatedStepsJson,
          },
        });
        updatedCount++;
      } catch (error: any) {
        console.error(`  ❌ Ошибка обновления правила "${rule.name}":`, error.message);
      }
    } else {
      skippedCount++;
    }
  }

  console.log(`\n✅ Обновление завершено!`);
  console.log(`   Обновлено правил: ${updatedCount}`);
  console.log(`   Пропущено правил (уже детальные): ${skippedCount}`);
  console.log(`   Всего правил: ${rules.length}`);
}

updateRulesToDetailedSteps()
  .catch((e) => {
    console.error('❌ Ошибка:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
