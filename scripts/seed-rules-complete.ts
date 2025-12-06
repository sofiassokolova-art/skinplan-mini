// scripts/seed-rules-complete.ts
// Seed-скрипт для 68 профессиональных правил рекомендаций 2025

import { PrismaClient } from '@prisma/client';
import { RECOMMENDATION_RULES } from '../lib/recommendation-rules-complete-2025';

const prisma = new PrismaClient();

/**
 * Конвертирует новые правила в формат Prisma RecommendationRule
 */
function convertRuleToPrismaFormat(rule: typeof RECOMMENDATION_RULES[0]) {
  // Базовая структура условий
  const conditions: any = {};
  
  // Обрабатываем условия из правила
  Object.entries(rule.conditions).forEach(([key, value]) => {
    if (typeof value === 'object' && value !== null) {
      // Обработка объектов с операторами (gte, lte, in, hasSome)
      if ('gte' in value || 'lte' in value) {
        conditions[key] = value;
      } else if ('in' in value && Array.isArray(value.in)) {
        conditions[key] = { in: value.in };
      } else if ('hasSome' in value && Array.isArray(value.hasSome)) {
        conditions[key] = { hasSome: value.hasSome };
      } else {
        conditions[key] = value;
      }
    } else {
      conditions[key] = value;
    }
  });

  // Создаем stepsJson на основе heroActives
  // Базовая структура шагов для всех правил
  const stepsJson: any = {
    cleanser: {
      category: ['cleanser'],
      max_items: 1,
    },
    spf: {
      category: ['spf'],
      max_items: 1,
    },
  };

  // Собираем ингредиенты по категориям
  const acneIngredients: string[] = [];
  const pigmentationIngredients: string[] = [];
  const antiAgingIngredients: string[] = [];
  const hydrationIngredients: string[] = [];
  const barrierIngredients: string[] = [];
  const serumIngredients: string[] = []; // Для ниацинамида, цинка и других универсальных ингредиентов
  
  for (const active of rule.heroActives) {
    // Пропускаем null/undefined значения
    if (!active || typeof active !== 'string') continue;
    const lower = active.toLowerCase();
    
    // Акне ингредиенты (идут в treatment)
    if (lower.includes('адапален') || lower.includes('бензоила') || 
        lower.includes('азелаиновая') || lower.includes('салициловая') ||
        lower.includes('lha') || lower.includes('гликолевая')) {
      acneIngredients.push(active);
    }
    // Пигментация ингредиенты (идут в serum)
    else if (lower.includes('транексамовая') || lower.includes('melasyl') || 
             lower.includes('витамин с') || lower.includes('гидрохинон')) {
      pigmentationIngredients.push(active);
    }
    // Anti-aging ингредиенты (идут в serum)
    else if (lower.includes('ретинол') || lower.includes('пептиды') || 
             lower.includes('бакучиол')) {
      antiAgingIngredients.push(active);
    }
    // Увлажнение ингредиенты
    else if (lower.includes('гиалурон') || lower.includes('глицерин') || 
             lower.includes('пантенол') || lower.includes('сквалан')) {
      hydrationIngredients.push(active);
    }
    // Барьер ингредиенты (идут в moisturizer)
    else if (lower.includes('церамиды') || lower.includes('липиды') || 
             lower.includes('масло ши') || lower.includes('центелла')) {
      barrierIngredients.push(active);
    }
    // Универсальные ингредиенты для serum (ниацинамид, цинк и т.д.)
    else if (lower.includes('ниацинамид') || lower.includes('цинк') ||
             lower.includes('антиоксидант') || lower.includes('мадекассосид')) {
      serumIngredients.push(active);
    }
  }

  // Treatment для акне
  if (acneIngredients.length > 0) {
    stepsJson.treatment = {
      concerns: ['acne'],
      active_ingredients: acneIngredients,
      max_items: 1,
    };
  }

  // Serum - приоритет: пигментация > anti-aging > увлажнение > универсальные
  const serumConcerns: string[] = [];
  const serumActives: string[] = [];
  
  if (pigmentationIngredients.length > 0) {
    serumConcerns.push('pigmentation');
    serumActives.push(...pigmentationIngredients);
  }
  if (antiAgingIngredients.length > 0) {
    serumConcerns.push('wrinkles');
    serumActives.push(...antiAgingIngredients);
  }
  if (hydrationIngredients.length > 0 && serumActives.length === 0) {
    serumConcerns.push('dehydration');
    serumActives.push(...hydrationIngredients);
  }
  // Добавляем универсальные ингредиенты (ниацинамид, цинк) в serum
  if (serumIngredients.length > 0) {
    serumActives.push(...serumIngredients);
    // Если нет других concerns, добавляем concerns на основе контекста
    if (serumConcerns.length === 0) {
      if (acneIngredients.length > 0) {
        serumConcerns.push('acne');
      } else {
        serumConcerns.push('maintenance');
      }
    }
  }
  
  if (serumActives.length > 0) {
    stepsJson.serum = {
      concerns: serumConcerns.length > 0 ? serumConcerns : ['maintenance'],
      active_ingredients: serumActives,
      max_items: 1,
    };
  }

  // Toner для увлажнения (только если нет serum с увлажнением)
  if (hydrationIngredients.length > 0 && !stepsJson.serum) {
    stepsJson.toner = {
      concerns: ['dehydration'],
      active_ingredients: hydrationIngredients.filter(a => 
        a.toLowerCase().includes('гиалурон') || a.toLowerCase().includes('глицерин')
      ),
      max_items: 1,
    };
  }

  // Moisturizer всегда присутствует
  stepsJson.moisturizer = {
    category: ['cream'],
    max_items: 1,
  };

  // Добавляем фильтры для avoid
  if (rule.avoid && rule.avoid.length > 0) {
    Object.keys(stepsJson).forEach(step => {
      if (!stepsJson[step].avoidIf) {
        stepsJson[step].avoidIf = [];
      }
      stepsJson[step].avoidIf.push(...rule.avoid!);
    });
  }

  return {
    name: rule.name,
    conditionsJson: conditions,
    stepsJson,
    priority: rule.priority,
    isActive: true,
  };
}

async function seedRulesComplete() {
  console.log('🌱 Seeding 68 professional recommendation rules (2025)...');

  let created = 0;
  let updated = 0;

  for (const rule of RECOMMENDATION_RULES) {
    try {
      const prismaRule = convertRuleToPrismaFormat(rule);
      
      // Проверяем существование по id или name
      const existing = await prisma.recommendationRule.findFirst({
        where: {
          OR: [
            { name: prismaRule.name },
            // Можно добавить проверку по conditionsJson, но это сложнее
          ],
        },
      });

      if (existing) {
        await prisma.recommendationRule.update({
          where: { id: existing.id },
          data: prismaRule,
        });
        updated++;
        console.log(`  ✅ Updated: ${rule.name} (priority: ${rule.priority})`);
      } else {
        await prisma.recommendationRule.create({
          data: prismaRule,
        });
        created++;
        console.log(`  ✅ Created: ${rule.name} (priority: ${rule.priority})`);
      }
    } catch (error: any) {
      console.error(`  ❌ Error processing rule "${rule.name}":`, error.message);
    }
  }

  console.log(`\n✅ Rules seeding complete!`);
  console.log(`   Created: ${created}`);
  console.log(`   Updated: ${updated}`);
  console.log(`   Total: ${RECOMMENDATION_RULES.length}`);
}

seedRulesComplete()
  .catch((e) => {
    console.error('❌ Error seeding rules:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

