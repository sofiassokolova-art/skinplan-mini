// scripts/seed-rules.ts
// Скрипт для заполнения правил рекомендаций

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function seedRules() {
  console.log('🌱 Seeding recommendation rules...');

  const rules = [
    {
      name: 'Жирная кожа + акне 18-30',
      conditionsJson: {
        skin_type: ['oily'],
        acne_level: { gte: 2 },
        age_group: ['18_25', '26_30'],
      },
      stepsJson: {
        cleanser: {
          category: ['cleanser'],
          skin_types: ['oily'],
          is_non_comedogenic: true,
          max_items: 2,
        },
        treatment: {
          concerns: ['acne'],
          is_non_comedogenic: true,
          max_items: 2,
        },
        moisturizer: {
          category: ['cream'],
          skin_types: ['oily'],
          is_non_comedogenic: true,
          max_items: 1,
        },
        spf: {
          category: ['spf'],
          is_non_comedogenic: true,
          max_items: 1,
        },
      },
      priority: 10,
      isActive: true,
    },
    {
      name: 'Сухая кожа + чувствительность',
      conditionsJson: {
        skin_type: ['dry'],
        sensitivity_level: ['medium', 'high'],
      },
      stepsJson: {
        cleanser: {
          category: ['cleanser'],
          skin_types: ['dry', 'sensitive'],
          is_fragrance_free: true,
          max_items: 2,
        },
        toner: {
          category: ['toner'],
          skin_types: ['dry', 'sensitive'],
          is_fragrance_free: true,
          max_items: 1,
        },
        moisturizer: {
          category: ['cream'],
          skin_types: ['dry', 'sensitive'],
          is_fragrance_free: true,
          max_items: 1,
        },
        spf: {
          category: ['spf'],
          is_fragrance_free: true,
          max_items: 1,
        },
      },
      priority: 10,
      isActive: true,
    },
    {
      name: 'Комбинированная кожа (базовый уход)',
      conditionsJson: {
        skin_type: ['combo'],
      },
      stepsJson: {
        cleanser: {
          category: ['cleanser'],
          skin_types: ['combo', 'normal'],
          max_items: 2,
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
      name: 'Нормальная кожа (поддерживающий уход)',
      conditionsJson: {
        skin_type: ['normal'],
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
