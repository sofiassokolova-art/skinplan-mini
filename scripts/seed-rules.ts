// scripts/seed-rules.ts
// Скрипт для заполнения правил рекомендаций

import { createScriptPrisma } from './lib/prisma';

const prisma = createScriptPrisma();

async function seedRules() {
  console.log('🌱 Seeding recommendation rules...');

  const rules = [
    // Высокий приоритет - специфичные комбинации
    {
      name: 'Жирная кожа + акне (тяжелая форма) 18-30',
      conditionsJson: {
        skinType: 'oily',
        acneLevel: { gte: 3 },
        ageGroup: ['18_25', '26_30'],
      },
      stepsJson: {
        cleanser: {
          category: ['cleanser'],
          skin_types: ['oily'],
          concerns: ['acne'],
          max_items: 1,
        },
        treatment: {
          concerns: ['acne'],
          max_items: 2,
        },
        moisturizer: {
          category: ['cream'],
          skin_types: ['oily'],
          max_items: 1,
        },
        spf: {
          category: ['spf'],
          max_items: 1,
        },
      },
      priority: 15,
      isActive: true,
    },
    {
      name: 'Жирная кожа + акне (легкая/средняя форма) 18-30',
      conditionsJson: {
        skinType: 'oily',
        acneLevel: { gte: 1, lte: 2 },
        ageGroup: ['18_25', '26_30'],
      },
      stepsJson: {
        cleanser: {
          category: ['cleanser'],
          skin_types: ['oily'],
          concerns: ['acne'],
          max_items: 1,
        },
        treatment: {
          concerns: ['acne'],
          max_items: 1,
        },
        moisturizer: {
          category: ['cream'],
          skin_types: ['oily'],
          max_items: 1,
        },
        spf: {
          category: ['spf'],
          max_items: 1,
        },
      },
      priority: 12,
      isActive: true,
    },
    {
      name: 'Сухая кожа + высокая чувствительность',
      conditionsJson: {
        skinType: 'dry',
        sensitivityLevel: 'high',
      },
      stepsJson: {
        cleanser: {
          category: ['cleanser'],
          skin_types: ['dry', 'sensitive'],
          concerns: ['barrier'],
          max_items: 1,
        },
        moisturizer: {
          category: ['cream'],
          skin_types: ['dry', 'sensitive'],
          concerns: ['barrier'],
          max_items: 1,
        },
        spf: {
          category: ['spf'],
          max_items: 1,
        },
      },
      priority: 14,
      isActive: true,
    },
    {
      name: 'Сухая кожа + средняя чувствительность',
      conditionsJson: {
        skinType: 'dry',
        sensitivityLevel: 'medium',
      },
      stepsJson: {
        cleanser: {
          category: ['cleanser'],
          skin_types: ['dry', 'sensitive'],
          max_items: 1,
        },
        toner: {
          category: ['toner'],
          skin_types: ['dry'],
          max_items: 1,
        },
        moisturizer: {
          category: ['cream'],
          skin_types: ['dry'],
          concerns: ['dehydration'],
          max_items: 1,
        },
        spf: {
          category: ['spf'],
          max_items: 1,
        },
      },
      priority: 12,
      isActive: true,
    },
    {
      name: 'Комбинированная кожа + расширенные поры',
      conditionsJson: {
        skinType: 'combo',
      },
      stepsJson: {
        cleanser: {
          category: ['cleanser'],
          skin_types: ['combo'],
          concerns: ['pores'],
          max_items: 1,
        },
        toner: {
          category: ['toner'],
          concerns: ['pores'],
          max_items: 1,
        },
        serum: {
          concerns: ['pores'],
          max_items: 1,
        },
        moisturizer: {
          category: ['cream'],
          skin_types: ['combo'],
          max_items: 1,
        },
        spf: {
          category: ['spf'],
          max_items: 1,
        },
      },
      priority: 11,
      isActive: true,
    },
    {
      name: 'Комбинированная кожа (базовый уход)',
      conditionsJson: {
        skinType: 'combo',
      },
      stepsJson: {
        cleanser: {
          category: ['cleanser'],
          skin_types: ['combo', 'normal'],
          max_items: 1,
        },
        toner: {
          category: ['toner'],
          max_items: 1,
        },
        moisturizer: {
          category: ['cream'],
          skin_types: ['combo', 'normal'],
          max_items: 1,
        },
        spf: {
          category: ['spf'],
          max_items: 1,
        },
      },
      priority: 5,
      isActive: true,
    },
    {
      name: 'Чувствительная кожа (любой тип)',
      conditionsJson: {
        sensitivityLevel: 'high',
      },
      stepsJson: {
        cleanser: {
          category: ['cleanser'],
          skin_types: ['sensitive'],
          concerns: ['barrier'],
          max_items: 1,
        },
        moisturizer: {
          category: ['cream'],
          skin_types: ['sensitive'],
          concerns: ['barrier'],
          max_items: 1,
        },
        spf: {
          category: ['spf'],
          max_items: 1,
        },
      },
      priority: 13,
      isActive: true,
    },
    {
      name: 'Пигментация (35+)',
      conditionsJson: {
        pigmentationRisk: ['medium', 'high'],
        ageGroup: ['35_44', '45_54', '55_plus'],
      },
      stepsJson: {
        cleanser: {
          category: ['cleanser'],
          max_items: 1,
        },
        serum: {
          concerns: ['pigmentation'],
          max_items: 1,
        },
        moisturizer: {
          category: ['cream'],
          concerns: ['pigmentation'],
          max_items: 1,
        },
        spf: {
          category: ['spf'],
          max_items: 1,
        },
      },
      priority: 12,
      isActive: true,
    },
    {
      name: 'Морщины и возрастные изменения (35+)',
      conditionsJson: {
        ageGroup: ['35_44', '45_54', '55_plus'],
      },
      stepsJson: {
        cleanser: {
          category: ['cleanser'],
          max_items: 1,
        },
        serum: {
          concerns: ['wrinkles'],
          max_items: 1,
        },
        moisturizer: {
          category: ['cream'],
          concerns: ['wrinkles'],
          max_items: 1,
        },
        spf: {
          category: ['spf'],
          max_items: 1,
        },
      },
      priority: 11,
      isActive: true,
    },
    {
      name: 'Обезвоженная кожа',
      conditionsJson: {
        dehydrationLevel: { gte: 3 },
      },
      stepsJson: {
        cleanser: {
          category: ['cleanser'],
          max_items: 1,
        },
        toner: {
          category: ['toner'],
          concerns: ['dehydration'],
          max_items: 1,
        },
        serum: {
          concerns: ['dehydration'],
          max_items: 1,
        },
        moisturizer: {
          category: ['cream'],
          concerns: ['dehydration'],
          max_items: 1,
        },
        spf: {
          category: ['spf'],
          max_items: 1,
        },
      },
      priority: 10,
      isActive: true,
    },
    {
      name: 'Жирная кожа (без акне)',
      conditionsJson: {
        skinType: 'oily',
        acneLevel: { lte: 0 },
      },
      stepsJson: {
        cleanser: {
          category: ['cleanser'],
          skin_types: ['oily'],
          max_items: 1,
        },
        toner: {
          category: ['toner'],
          skin_types: ['oily'],
          max_items: 1,
        },
        moisturizer: {
          category: ['cream'],
          skin_types: ['oily'],
          max_items: 1,
        },
        spf: {
          category: ['spf'],
          max_items: 1,
        },
      },
      priority: 8,
      isActive: true,
    },
    {
      name: 'Сухая кожа (базовый уход)',
      conditionsJson: {
        skinType: 'dry',
      },
      stepsJson: {
        cleanser: {
          category: ['cleanser'],
          skin_types: ['dry'],
          max_items: 1,
        },
        toner: {
          category: ['toner'],
          skin_types: ['dry'],
          max_items: 1,
        },
        moisturizer: {
          category: ['cream'],
          skin_types: ['dry'],
          concerns: ['dehydration'],
          max_items: 1,
        },
        spf: {
          category: ['spf'],
          max_items: 1,
        },
      },
      priority: 7,
      isActive: true,
    },
    {
      name: 'Нормальная кожа (поддерживающий уход)',
      conditionsJson: {
        skinType: 'normal',
      },
      stepsJson: {
        cleanser: {
          category: ['cleanser'],
          max_items: 1,
        },
        toner: {
          category: ['toner'],
          max_items: 1,
        },
        moisturizer: {
          category: ['cream'],
          max_items: 1,
        },
        spf: {
          category: ['spf'],
          max_items: 1,
        },
      },
      priority: 1,
      isActive: true,
    },
  ];

  for (const rule of rules) {
    // Проверяем существование правила по имени
    const existing = await prisma.recommendationRule.findFirst({
      where: { name: rule.name },
    });

    if (existing) {
      await prisma.recommendationRule.update({
        where: { id: existing.id },
        data: rule,
      });
    } else {
      await prisma.recommendationRule.create({
        data: rule,
      });
    }
  }

  console.log('✅ Rules seeded:', rules.length);
}

seedRules()
  .catch((e) => {
    console.error('❌ Error seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
