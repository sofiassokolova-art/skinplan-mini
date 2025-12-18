// scripts/check-matching-values.ts
// Скрипт для проверки соответствия значений в БД и правилах

import { prisma } from '../lib/db';
import { STEP_CATEGORY_RULES } from '../lib/step-category-rules';

async function checkMatchingValues() {
  try {
    console.log('\n🔍 Проверка соответствия значений в БД и правилах\n');
    console.log('='.repeat(60));

    // Проверяем уникальные значения в БД
    console.log('\n📊 Значения в БД (SkinProfile):');
    
    const profiles = await prisma.skinProfile.findMany({
      select: {
        skinType: true,
        sensitivityLevel: true,
      },
      distinct: ['skinType', 'sensitivityLevel'],
    });

    const uniqueSkinTypes = new Set<string>();
    const uniqueSensitivityLevels = new Set<string>();

    profiles.forEach(p => {
      if (p.skinType) uniqueSkinTypes.add(p.skinType);
      if (p.sensitivityLevel) uniqueSensitivityLevels.add(p.sensitivityLevel);
    });

    console.log('   Типы кожи в БД:', Array.from(uniqueSkinTypes).sort().join(', '));
    console.log('   Уровни чувствительности в БД:', Array.from(uniqueSensitivityLevels).sort().join(', '));

    // Проверяем значения в правилах
    console.log('\n📋 Значения в правилах (STEP_CATEGORY_RULES):');
    
    const skinTypesInRules = new Set<string>();
    const sensitivityInRules = new Set<string>();

    Object.values(STEP_CATEGORY_RULES).forEach(rule => {
      if (rule.skinTypesAllowed) {
        rule.skinTypesAllowed.forEach(st => skinTypesInRules.add(st));
      }
      if (rule.avoidIfContra) {
        rule.avoidIfContra.forEach(contra => {
          if (contra.includes('sensitivity')) {
            sensitivityInRules.add(contra);
          }
        });
      }
    });

    console.log('   Типы кожи в правилах:', Array.from(skinTypesInRules).sort().join(', '));
    console.log('   Противопоказания с чувствительностью:', Array.from(sensitivityInRules).sort().join(', '));

    // Проверяем несоответствия
    console.log('\n❌ Несоответствия:');
    
    const dbSkinTypes = Array.from(uniqueSkinTypes);
    const rulesSkinTypes = Array.from(skinTypesInRules);
    
    const missingInRules = dbSkinTypes.filter(st => !rulesSkinTypes.includes(st));
    const missingInDb = rulesSkinTypes.filter(st => !dbSkinTypes.includes(st));

    if (missingInRules.length > 0) {
      console.log('   Типы кожи в БД, но НЕ в правилах:', missingInRules.join(', '));
    }
    if (missingInDb.length > 0) {
      console.log('   Типы кожи в правилах, но НЕ в БД:', missingInDb.join(', '));
    }

    // Проверяем соответствие "combo"
    console.log('\n🔍 Специальная проверка "combo":');
    console.log('   В БД: "combo"');
    console.log('   В правилах: "combination_dry", "combination_oily"');
    console.log('   Проблема: "combo" не распознается правилами!');

    // Проверяем соответствие sensitivity
    console.log('\n🔍 Проверка чувствительности:');
    console.log('   В БД: "low", "medium", "high"');
    console.log('   В правилах (avoidIfContra): "very_high_sensitivity"');
    console.log('   В SkinProfile типе: "low" | "medium" | "high" | "very_high"');
    console.log('   Проблема: "very_high" не сохраняется в БД!');

    // Проверяем шаблоны
    console.log('\n📋 Проверка шаблонов (care-plan-templates):');
    const { CARE_PLAN_TEMPLATES } = await import('../lib/care-plan-templates');
    const skinTypesInTemplates = new Set<string>();
    CARE_PLAN_TEMPLATES.forEach(template => {
      if (template.conditions.skinTypes) {
        template.conditions.skinTypes.forEach(st => skinTypesInTemplates.add(st));
      }
    });
    console.log('   Типы кожи в шаблонах:', Array.from(skinTypesInTemplates).sort().join(', '));

    // Проверяем несоответствия в шаблонах
    const missingInTemplates = dbSkinTypes.filter(st => !skinTypesInTemplates.has(st));
    if (missingInTemplates.length > 0) {
      console.log('   ⚠️ Типы кожи в БД, но НЕ в шаблонах:', missingInTemplates.join(', '));
    }

    console.log('\n✅ Проверка завершена\n');
  } catch (error: any) {
    console.error('❌ Ошибка:', error?.message);
    console.error(error?.stack);
  } finally {
    await prisma.$disconnect();
  }
}

checkMatchingValues();
