// scripts/enhance-rules-with-missing-steps.ts
// Скрипт для добавления недостающих обязательных шагов (toner, serum) в правила рекомендаций

import { prisma } from '../lib/db';

interface RuleStep {
  category?: string[];
  concerns?: string[];
  skin_types?: string[];
  is_non_comedogenic?: boolean;
  is_fragrance_free?: boolean;
  budget?: 'бюджетный' | 'средний' | 'премиум' | 'любой';
  is_natural?: boolean;
  active_ingredients?: string[];
  max_items?: number;
}

interface RuleCondition {
  [key: string]: string[] | { gte?: number; lte?: number } | string;
}

async function enhanceRulesWithMissingSteps() {
  console.log('🔍 Начинаем обновление правил рекомендаций...\n');

  // Получаем все активные правила
  const rules = await prisma.recommendationRule.findMany({
    where: { isActive: true },
    select: {
      id: true,
      name: true,
      conditionsJson: true,
      stepsJson: true,
    },
  });

  console.log(`📋 Найдено активных правил: ${rules.length}\n`);

  let updatedCount = 0;
  let skippedCount = 0;

  for (const rule of rules) {
    const conditions = rule.conditionsJson as RuleCondition;
    const stepsJson = rule.stepsJson as Record<string, RuleStep>;
    const existingSteps = Object.keys(stepsJson);
    
    // Проверяем, какие обязательные шаги отсутствуют
    const requiredSteps = ['cleanser', 'toner', 'serum', 'moisturizer', 'spf'];
    const missingSteps: string[] = [];
    
    for (const requiredStep of requiredSteps) {
      const hasStep = existingSteps.some(step => 
        step === requiredStep || 
        step.startsWith(requiredStep + '_') ||
        step.includes(requiredStep)
      );
      
      if (!hasStep) {
        missingSteps.push(requiredStep);
      }
    }

    if (missingSteps.length === 0) {
      console.log(`✅ "${rule.name}" (ID: ${rule.id}) - все шаги присутствуют`);
      skippedCount++;
      continue;
    }

    console.log(`🔄 "${rule.name}" (ID: ${rule.id})`);
    console.log(`   Отсутствуют: ${missingSteps.join(', ')}`);

    // Создаем обновленный stepsJson
    const updatedStepsJson: Record<string, RuleStep> = { ...stepsJson };

    // Определяем тип кожи из условий
    const skinType = Array.isArray(conditions.skinType) 
      ? conditions.skinType[0] 
      : (conditions.skinType as string);
    
    const acneLevel = (conditions.acneLevel as { gte?: number; lte?: number }) || {};
    const ageGroup = Array.isArray(conditions.ageGroup) ? conditions.ageGroup : [];
    const concerns = conditions.concerns as string[] || [];

    // Добавляем недостающие шаги с дерматологической логикой
    for (const missingStep of missingSteps) {
      let stepConfig: RuleStep = {
        max_items: 3,
      };

      // Базовые настройки для каждого шага
      switch (missingStep) {
        case 'cleanser':
          stepConfig = {
            category: ['cleanser'],
            skin_types: skinType ? [skinType] : undefined,
            max_items: 3,
          };
          if (skinType === 'oily' || skinType === 'combo') {
            stepConfig.concerns = ['acne'];
            stepConfig.is_non_comedogenic = true;
          } else if (skinType === 'sensitive' || conditions.sensitivityLevel === 'high') {
            stepConfig.is_fragrance_free = true;
          }
          break;

        case 'toner':
          stepConfig = {
            category: ['toner'],
            skin_types: skinType ? [skinType] : undefined,
            max_items: 3,
          };
          if (skinType === 'oily' || skinType === 'combo') {
            stepConfig.active_ingredients = ['salicylic_acid', 'niacinamide'];
            stepConfig.concerns = ['acne'];
          } else if (skinType === 'dry' || conditions.sensitivityLevel === 'high') {
            stepConfig.active_ingredients = ['hyaluronic_acid'];
            stepConfig.is_fragrance_free = true;
            stepConfig.concerns = ['hydration'];
          } else {
            stepConfig.active_ingredients = ['hyaluronic_acid', 'niacinamide'];
            stepConfig.concerns = ['hydration'];
          }
          break;

        case 'serum':
          stepConfig = {
            category: ['serum'],
            skin_types: skinType ? [skinType] : undefined,
            max_items: 4,
          };
          
          // Дерматологическая логика подбора serum по проблемам
          if (acneLevel.gte && acneLevel.gte >= 2) {
            // Акне средней/тяжелой степени
            stepConfig.active_ingredients = ['niacinamide', 'salicylic_acid'];
            stepConfig.concerns = ['acne'];
            stepConfig.is_non_comedogenic = true;
          } else if (concerns.includes('pigmentation') || concerns.includes('dark_spots')) {
            // Пигментация
            stepConfig.active_ingredients = ['vitamin_c', 'niacinamide'];
            stepConfig.concerns = ['pigmentation'];
          } else if (concerns.includes('wrinkles') || concerns.includes('fine_lines') || 
                     (ageGroup.length > 0 && ageGroup.some((ag: string) => ag.includes('35') || ag.includes('40')))) {
            // Морщины / возрастные изменения
            stepConfig.active_ingredients = ['retinol', 'peptides'];
            stepConfig.concerns = ['anti_aging'];
          } else {
            // Базовая гидратация
            stepConfig.active_ingredients = ['hyaluronic_acid', 'niacinamide'];
            stepConfig.concerns = ['hydration'];
          }
          break;

        case 'moisturizer':
          stepConfig = {
            category: ['moisturizer'],
            skin_types: skinType ? [skinType] : undefined,
            max_items: 3,
          };
          if (skinType === 'oily' || skinType === 'combo') {
            stepConfig.concerns = ['acne'];
            stepConfig.is_non_comedogenic = true;
          } else if (skinType === 'dry') {
            stepConfig.concerns = ['hydration'];
          }
          if (conditions.sensitivityLevel === 'high') {
            stepConfig.is_fragrance_free = true;
          }
          break;

        case 'spf':
          stepConfig = {
            category: ['spf'],
            max_items: 2,
          };
          if (skinType === 'oily' || skinType === 'combo') {
            stepConfig.concerns = ['acne'];
            stepConfig.is_non_comedogenic = true;
          }
          break;
      }

      updatedStepsJson[missingStep] = stepConfig;
      console.log(`   ✅ Добавлен шаг: ${missingStep}`, {
        active_ingredients: stepConfig.active_ingredients,
        concerns: stepConfig.concerns,
      });
    }

    // Обновляем правило в БД
    try {
      await prisma.recommendationRule.update({
        where: { id: rule.id },
        data: {
          stepsJson: updatedStepsJson,
        },
      });

      console.log(`   ✅ Правило обновлено\n`);
      updatedCount++;
    } catch (error: any) {
      console.error(`   ❌ Ошибка при обновлении правила: ${error.message}\n`);
    }
  }

  console.log('\n📊 Итоги:');
  console.log(`   ✅ Обновлено правил: ${updatedCount}`);
  console.log(`   ⏭️  Пропущено правил: ${skippedCount}`);
  console.log(`   📋 Всего правил: ${rules.length}`);
}

enhanceRulesWithMissingSteps()
  .then(() => {
    console.log('\n✅ Готово!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Ошибка:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
