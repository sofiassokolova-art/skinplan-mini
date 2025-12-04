// scripts/add-combo-skin-rules.ts
// Скрипт для добавления правил рекомендаций для комбинированной кожи

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const newRules = [
  {
    name: 'Комбинированная кожа + акне (легкое)',
    priority: 93,
    conditionsJson: {
      skin_type: 'combo',
      inflammation: { gte: 40, lte: 60 },
    },
    stepsJson: {
      spf: {
        category: ['spf'],
        max_items: 3,
      },
      cleanser: {
        category: ['cleanser'],
        skin_types: ['combo'],
        max_items: 3,
      },
      serum: {
        category: ['serum'],
        concerns: ['acne'],
        skin_types: ['combo'],
        max_items: 3,
      },
      treatment: {
        category: ['treatment'],
        concerns: ['acne'],
        max_items: 2,
      },
      moisturizer: {
        category: ['moisturizer'],
        skin_types: ['combo'],
        max_items: 3,
      },
    },
  },
  {
    name: 'Комбинированная кожа + акне (среднее)',
    priority: 94,
    conditionsJson: {
      skin_type: 'combo',
      inflammation: { gte: 60, lte: 80 },
    },
    stepsJson: {
      spf: {
        category: ['spf'],
        max_items: 3,
      },
      cleanser: {
        category: ['cleanser'],
        skin_types: ['combo'],
        max_items: 3,
      },
      serum: {
        category: ['serum'],
        concerns: ['acne'],
        skin_types: ['combo'],
        max_items: 3,
      },
      treatment: {
        category: ['treatment'],
        concerns: ['acne'],
        max_items: 2,
      },
      moisturizer: {
        category: ['moisturizer'],
        skin_types: ['combo'],
        max_items: 3,
      },
    },
  },
  {
    name: 'Комбинированная кожа + пигментация',
    priority: 93,
    conditionsJson: {
      skin_type: 'combo',
      pigmentation: { gte: 50 },
    },
    stepsJson: {
      spf: {
        category: ['spf'],
        max_items: 3,
      },
      serum: {
        category: ['serum'],
        concerns: ['pigmentation'],
        skin_types: ['combo'],
        max_items: 3,
      },
      cleanser: {
        category: ['cleanser'],
        skin_types: ['combo'],
        max_items: 3,
      },
      moisturizer: {
        category: ['moisturizer'],
        skin_types: ['combo'],
        max_items: 3,
      },
    },
  },
  {
    name: 'Комбинированная кожа + чувствительность',
    priority: 93,
    conditionsJson: {
      skin_type: 'combo',
      sensitivity_level: 'high',
    },
    stepsJson: {
      spf: {
        category: ['spf'],
        max_items: 3,
      },
      toner: {
        category: ['toner'],
        skin_types: ['combo', 'sensitive'],
        max_items: 3,
      },
      cleanser: {
        category: ['cleanser'],
        skin_types: ['combo', 'sensitive'],
        max_items: 3,
      },
      serum: {
        category: ['serum'],
        skin_types: ['combo', 'sensitive'],
        max_items: 3,
      },
      moisturizer: {
        category: ['moisturizer'],
        skin_types: ['combo', 'sensitive'],
        max_items: 3,
      },
    },
  },
  {
    name: 'Комбинированная кожа + обезвоженность',
    priority: 93,
    conditionsJson: {
      skin_type: 'combo',
      hydration: { lte: 50 },
    },
    stepsJson: {
      spf: {
        category: ['spf'],
        max_items: 3,
      },
      serum: {
        category: ['serum'],
        concerns: ['dehydration'],
        skin_types: ['combo'],
        max_items: 3,
      },
      toner: {
        category: ['toner'],
        concerns: ['dehydration'],
        skin_types: ['combo'],
        max_items: 3,
      },
      cleanser: {
        category: ['cleanser'],
        skin_types: ['combo'],
        max_items: 3,
      },
      moisturizer: {
        category: ['moisturizer'],
        concerns: ['dehydration'],
        skin_types: ['combo'],
        max_items: 3,
      },
    },
  },
  {
    name: 'Комбинированная кожа + первые признаки старения',
    priority: 92,
    conditionsJson: {
      skin_type: 'combo',
      age: { in: ['25-34'] },
      photoaging: { gte: 40 },
    },
    stepsJson: {
      spf: {
        category: ['spf'],
        max_items: 3,
      },
      serum: {
        category: ['serum'],
        concerns: ['antiage'],
        skin_types: ['combo'],
        max_items: 3,
      },
      cleanser: {
        category: ['cleanser'],
        skin_types: ['combo'],
        max_items: 3,
      },
      moisturizer: {
        category: ['moisturizer'],
        concerns: ['antiage'],
        skin_types: ['combo'],
        max_items: 3,
      },
    },
  },
];

async function addComboSkinRules() {
  console.log('📋 Добавление правил для комбинированной кожи\n');

  for (const rule of newRules) {
    try {
      // Проверяем, не существует ли уже такое правило
      const existing = await prisma.recommendationRule.findFirst({
        where: {
          name: rule.name,
        },
      });

      if (existing) {
        console.log(`⚠️  Правило "${rule.name}" уже существует, пропускаем`);
        continue;
      }

      const created = await prisma.recommendationRule.create({
        data: {
          name: rule.name,
          priority: rule.priority,
          conditionsJson: rule.conditionsJson as any,
          stepsJson: rule.stepsJson as any,
          isActive: true,
        },
      });

      console.log(`✅ Добавлено правило: "${rule.name}" (ID: ${created.id}, Priority: ${created.priority})`);
    } catch (error: any) {
      console.error(`❌ Ошибка при добавлении правила "${rule.name}":`, error.message);
    }
  }

  console.log('\n🎉 Готово!');
  await prisma.$disconnect();
}

addComboSkinRules().catch(console.error);

