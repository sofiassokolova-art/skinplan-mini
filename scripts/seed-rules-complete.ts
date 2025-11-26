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

  // Добавляем шаги в зависимости от активных ингредиентов
  const hasAcne = rule.heroActives.some(a => 
    a.includes('адапален') || a.includes('бензоила') || a.includes('азелаиновая') || a.includes('салициловая')
  );
  const hasPigmentation = rule.heroActives.some(a => 
    a.includes('транексамовая') || a.includes('Melasyl') || a.includes('витамин С') || a.includes('гидрохинон')
  );
  const hasAntiAging = rule.heroActives.some(a => 
    a.includes('ретинол') || a.includes('пептиды') || a.includes('бакучиол')
  );
  const hasHydration = rule.heroActives.some(a => 
    a.includes('гиалурон') || a.includes('глицерин') || a.includes('пантенол')
  );
  const hasBarrier = rule.heroActives.some(a => 
    a.includes('церамиды') || a.includes('липиды') || a.includes('масло ши') || a.includes('сквалан')
  );

  // Treatment/Serum для акне
  if (hasAcne) {
    stepsJson.treatment = {
      concerns: ['acne'],
      active_ingredients: rule.heroActives.filter(a => 
        a.includes('адапален') || a.includes('бензоила') || a.includes('азелаиновая') || a.includes('салициловая')
      ),
      max_items: 1,
    };
  }

  // Serum для пигментации
  if (hasPigmentation) {
    stepsJson.serum = {
      concerns: ['pigmentation'],
      active_ingredients: rule.heroActives.filter(a => 
        a.includes('транексамовая') || a.includes('Melasyl') || a.includes('витамин С') || a.includes('гидрохинон')
      ),
      max_items: 1,
    };
  }

  // Serum для anti-aging
  if (hasAntiAging) {
    stepsJson.serum = {
      concerns: ['wrinkles'],
      active_ingredients: rule.heroActives.filter(a => 
        a.includes('ретинол') || a.includes('пептиды') || a.includes('бакучиол')
      ),
      max_items: 1,
    };
  }

  // Toner для увлажнения
  if (hasHydration && !hasAntiAging && !hasPigmentation) {
    stepsJson.toner = {
      concerns: ['dehydration'],
      active_ingredients: rule.heroActives.filter(a => 
        a.includes('гиалурон') || a.includes('глицерин')
      ),
      max_items: 1,
    };
  }

  // Serum для увлажнения (если нет других serum)
  if (hasHydration && !stepsJson.serum) {
    stepsJson.serum = {
      concerns: ['dehydration'],
      active_ingredients: rule.heroActives.filter(a => 
        a.includes('гиалурон') || a.includes('пантенол')
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

