// scripts/add-comprehensive-rules.ts
// Скрипт для добавления комплексных правил рекомендаций для покрытия всех возможных комбинаций

import { createScriptPrisma } from './lib/prisma';

const prisma = createScriptPrisma();

const newRules = [
  // ========== СУХАЯ КОЖА ==========
  {
    name: 'Сухая кожа + акне (легкое)',
    priority: 91,
    conditionsJson: {
      skin_type: 'dry',
      inflammation: { gte: 40, lte: 60 },
    },
    stepsJson: {
      spf: { category: ['spf'], max_items: 3 },
      cleanser: { category: ['cleanser'], skin_types: ['dry'], max_items: 3 },
      serum: { category: ['serum'], concerns: ['acne'], skin_types: ['dry'], max_items: 3 },
      moisturizer: { category: ['moisturizer'], skin_types: ['dry'], max_items: 3 },
    },
  },
  {
    name: 'Сухая кожа + пигментация',
    priority: 91,
    conditionsJson: {
      skin_type: 'dry',
      pigmentation: { gte: 50 },
    },
    stepsJson: {
      spf: { category: ['spf'], max_items: 3 },
      serum: { category: ['serum'], concerns: ['pigmentation'], skin_types: ['dry'], max_items: 3 },
      cleanser: { category: ['cleanser'], skin_types: ['dry'], max_items: 3 },
      moisturizer: { category: ['moisturizer'], skin_types: ['dry'], max_items: 3 },
    },
  },
  {
    name: 'Сухая кожа + обезвоженность',
    priority: 92,
    conditionsJson: {
      skin_type: 'dry',
      hydration: { lte: 50 },
    },
    stepsJson: {
      spf: { category: ['spf'], max_items: 3 },
      toner: { category: ['toner'], concerns: ['dehydration'], skin_types: ['dry'], max_items: 3 },
      serum: { category: ['serum'], concerns: ['dehydration'], skin_types: ['dry'], max_items: 3 },
      cleanser: { category: ['cleanser'], skin_types: ['dry'], max_items: 3 },
      moisturizer: { category: ['moisturizer'], concerns: ['dehydration'], skin_types: ['dry'], max_items: 3 },
    },
  },
  {
    name: 'Сухая кожа + первые признаки старения',
    priority: 91,
    conditionsJson: {
      skin_type: 'dry',
      age: { in: ['25-34'] },
      photoaging: { gte: 40 },
    },
    stepsJson: {
      spf: { category: ['spf'], max_items: 3 },
      serum: { category: ['serum'], concerns: ['antiage'], skin_types: ['dry'], max_items: 3 },
      cleanser: { category: ['cleanser'], skin_types: ['dry'], max_items: 3 },
      moisturizer: { category: ['moisturizer'], concerns: ['antiage'], skin_types: ['dry'], max_items: 3 },
    },
  },
  
  // ========== ЖИРНАЯ КОЖА ==========
  {
    name: 'Жирная кожа + пигментация',
    priority: 91,
    conditionsJson: {
      skin_type: 'oily',
      pigmentation: { gte: 50 },
    },
    stepsJson: {
      spf: { category: ['spf'], max_items: 3 },
      serum: { category: ['serum'], concerns: ['pigmentation'], skin_types: ['oily'], max_items: 3 },
      cleanser: { category: ['cleanser'], skin_types: ['oily'], max_items: 3 },
      moisturizer: { category: ['moisturizer'], skin_types: ['oily'], max_items: 3 },
    },
  },
  {
    name: 'Жирная кожа + обезвоженность',
    priority: 91,
    conditionsJson: {
      skin_type: 'oily',
      hydration: { lte: 50 },
    },
    stepsJson: {
      spf: { category: ['spf'], max_items: 3 },
      toner: { category: ['toner'], concerns: ['dehydration'], skin_types: ['oily'], max_items: 3 },
      serum: { category: ['serum'], concerns: ['dehydration'], skin_types: ['oily'], max_items: 3 },
      cleanser: { category: ['cleanser'], skin_types: ['oily'], max_items: 3 },
      moisturizer: { category: ['moisturizer'], concerns: ['dehydration'], skin_types: ['oily'], max_items: 3 },
    },
  },
  {
    name: 'Жирная кожа + первые признаки старения',
    priority: 91,
    conditionsJson: {
      skin_type: 'oily',
      age: { in: ['25-34'] },
      photoaging: { gte: 40 },
    },
    stepsJson: {
      spf: { category: ['spf'], max_items: 3 },
      serum: { category: ['serum'], concerns: ['antiage'], skin_types: ['oily'], max_items: 3 },
      cleanser: { category: ['cleanser'], skin_types: ['oily'], max_items: 3 },
      moisturizer: { category: ['moisturizer'], concerns: ['antiage'], skin_types: ['oily'], max_items: 3 },
    },
  },
  
  // ========== НОРМАЛЬНАЯ КОЖА ==========
  {
    name: 'Нормальная кожа + акне (легкое)',
    priority: 89,
    conditionsJson: {
      skin_type: 'normal',
      inflammation: { gte: 40, lte: 60 },
    },
    stepsJson: {
      spf: { category: ['spf'], max_items: 3 },
      cleanser: { category: ['cleanser'], skin_types: ['normal'], max_items: 3 },
      serum: { category: ['serum'], concerns: ['acne'], skin_types: ['normal'], max_items: 3 },
      treatment: { category: ['treatment'], concerns: ['acne'], max_items: 2 },
      moisturizer: { category: ['moisturizer'], skin_types: ['normal'], max_items: 3 },
    },
  },
  {
    name: 'Нормальная кожа + пигментация',
    priority: 89,
    conditionsJson: {
      skin_type: 'normal',
      pigmentation: { gte: 50 },
    },
    stepsJson: {
      spf: { category: ['spf'], max_items: 3 },
      serum: { category: ['serum'], concerns: ['pigmentation'], skin_types: ['normal'], max_items: 3 },
      cleanser: { category: ['cleanser'], skin_types: ['normal'], max_items: 3 },
      moisturizer: { category: ['moisturizer'], skin_types: ['normal'], max_items: 3 },
    },
  },
  {
    name: 'Нормальная кожа + первые признаки старения',
    priority: 89,
    conditionsJson: {
      skin_type: 'normal',
      age: { in: ['25-34'] },
      photoaging: { gte: 40 },
    },
    stepsJson: {
      spf: { category: ['spf'], max_items: 3 },
      serum: { category: ['serum'], concerns: ['antiage'], skin_types: ['normal'], max_items: 3 },
      cleanser: { category: ['cleanser'], skin_types: ['normal'], max_items: 3 },
      moisturizer: { category: ['moisturizer'], concerns: ['antiage'], skin_types: ['normal'], max_items: 3 },
    },
  },
  
  // ========== ЧУВСТВИТЕЛЬНАЯ КОЖА ==========
  {
    name: 'Чувствительная кожа + акне (легкое)',
    priority: 91,
    conditionsJson: {
      skin_type: 'sensitive',
      inflammation: { gte: 40, lte: 60 },
    },
    stepsJson: {
      spf: { category: ['spf'], max_items: 3 },
      cleanser: { category: ['cleanser'], skin_types: ['sensitive'], max_items: 3 },
      serum: { category: ['serum'], concerns: ['acne'], skin_types: ['sensitive'], max_items: 3 },
      moisturizer: { category: ['moisturizer'], skin_types: ['sensitive'], max_items: 3 },
    },
  },
  {
    name: 'Чувствительная кожа + пигментация',
    priority: 91,
    conditionsJson: {
      skin_type: 'sensitive',
      pigmentation: { gte: 50 },
    },
    stepsJson: {
      spf: { category: ['spf'], max_items: 3 },
      toner: { category: ['toner'], skin_types: ['sensitive'], max_items: 3 },
      serum: { category: ['serum'], concerns: ['pigmentation'], skin_types: ['sensitive'], max_items: 3 },
      cleanser: { category: ['cleanser'], skin_types: ['sensitive'], max_items: 3 },
      moisturizer: { category: ['moisturizer'], skin_types: ['sensitive'], max_items: 3 },
    },
  },
  {
    name: 'Чувствительная кожа + обезвоженность',
    priority: 92,
    conditionsJson: {
      skin_type: 'sensitive',
      hydration: { lte: 50 },
    },
    stepsJson: {
      spf: { category: ['spf'], max_items: 3 },
      toner: { category: ['toner'], concerns: ['dehydration'], skin_types: ['sensitive'], max_items: 3 },
      serum: { category: ['serum'], concerns: ['dehydration'], skin_types: ['sensitive'], max_items: 3 },
      cleanser: { category: ['cleanser'], skin_types: ['sensitive'], max_items: 3 },
      moisturizer: { category: ['moisturizer'], concerns: ['dehydration'], skin_types: ['sensitive'], max_items: 3 },
    },
  },
  
  // ========== ВОЗРАСТНЫЕ ГРУППЫ ==========
  {
    name: '18-25 лет + комбинированная кожа',
    priority: 89,
    conditionsJson: {
      skin_type: 'combo',
      age: { in: ['18-25'] },
    },
    stepsJson: {
      spf: { category: ['spf'], max_items: 3 },
      cleanser: { category: ['cleanser'], skin_types: ['combo'], max_items: 3 },
      serum: { category: ['serum'], skin_types: ['combo'], max_items: 3 },
      moisturizer: { category: ['moisturizer'], skin_types: ['combo'], max_items: 3 },
    },
  },
  {
    name: '18-25 лет + жирная кожа',
    priority: 89,
    conditionsJson: {
      skin_type: 'oily',
      age: { in: ['18-25'] },
    },
    stepsJson: {
      spf: { category: ['spf'], max_items: 3 },
      cleanser: { category: ['cleanser'], skin_types: ['oily'], max_items: 3 },
      serum: { category: ['serum'], skin_types: ['oily'], max_items: 3 },
      moisturizer: { category: ['moisturizer'], skin_types: ['oily'], max_items: 3 },
    },
  },
  {
    name: '35-44 лет + комбинированная кожа',
    priority: 91,
    conditionsJson: {
      skin_type: 'combo',
      age: { in: ['35-44'] },
      photoaging: { gte: 50 },
    },
    stepsJson: {
      spf: { category: ['spf'], max_items: 3 },
      serum: { category: ['serum'], concerns: ['antiage'], skin_types: ['combo'], max_items: 3 },
      cleanser: { category: ['cleanser'], skin_types: ['combo'], max_items: 3 },
      moisturizer: { category: ['moisturizer'], concerns: ['antiage'], skin_types: ['combo'], max_items: 3 },
    },
  },
  {
    name: '35-44 лет + сухая кожа',
    priority: 91,
    conditionsJson: {
      skin_type: 'dry',
      age: { in: ['35-44'] },
      photoaging: { gte: 50 },
    },
    stepsJson: {
      spf: { category: ['spf'], max_items: 3 },
      toner: { category: ['toner'], skin_types: ['dry'], max_items: 3 },
      serum: { category: ['serum'], concerns: ['antiage'], skin_types: ['dry'], max_items: 3 },
      cleanser: { category: ['cleanser'], skin_types: ['dry'], max_items: 3 },
      moisturizer: { category: ['moisturizer'], concerns: ['antiage'], skin_types: ['dry'], max_items: 3 },
    },
  },
  
  // ========== СЕЗОННЫЕ ПРАВИЛА ==========
  {
    name: 'Весна — комбинированная кожа',
    priority: 87,
    conditionsJson: {
      skin_type: 'combo',
      season: 'spring',
    },
    stepsJson: {
      spf: { category: ['spf'], max_items: 3 },
      cleanser: { category: ['cleanser'], skin_types: ['combo'], max_items: 3 },
      serum: { category: ['serum'], skin_types: ['combo'], max_items: 3 },
      moisturizer: { category: ['moisturizer'], skin_types: ['combo'], max_items: 3 },
    },
  },
  {
    name: 'Весна — сухая кожа',
    priority: 87,
    conditionsJson: {
      skin_type: 'dry',
      season: 'spring',
    },
    stepsJson: {
      spf: { category: ['spf'], max_items: 3 },
      toner: { category: ['toner'], skin_types: ['dry'], max_items: 3 },
      cleanser: { category: ['cleanser'], skin_types: ['dry'], max_items: 3 },
      serum: { category: ['serum'], skin_types: ['dry'], max_items: 3 },
      moisturizer: { category: ['moisturizer'], skin_types: ['dry'], max_items: 3 },
    },
  },
  {
    name: 'Осень — комбинированная кожа',
    priority: 87,
    conditionsJson: {
      skin_type: 'combo',
      season: 'autumn',
    },
    stepsJson: {
      spf: { category: ['spf'], max_items: 3 },
      cleanser: { category: ['cleanser'], skin_types: ['combo'], max_items: 3 },
      serum: { category: ['serum'], skin_types: ['combo'], max_items: 3 },
      moisturizer: { category: ['moisturizer'], skin_types: ['combo'], max_items: 3 },
    },
  },
  {
    name: 'Осень — сухая кожа',
    priority: 87,
    conditionsJson: {
      skin_type: 'dry',
      season: 'autumn',
    },
    stepsJson: {
      spf: { category: ['spf'], max_items: 3 },
      toner: { category: ['toner'], skin_types: ['dry'], max_items: 3 },
      cleanser: { category: ['cleanser'], skin_types: ['dry'], max_items: 3 },
      serum: { category: ['serum'], skin_types: ['dry'], max_items: 3 },
      moisturizer: { category: ['moisturizer'], skin_types: ['dry'], max_items: 3 },
    },
  },
  
  // ========== КОМБИНАЦИИ ПРОБЛЕМ ==========
  {
    name: 'Комбинированная кожа + акне + пигментация',
    priority: 95,
    conditionsJson: {
      skin_type: 'combo',
      inflammation: { gte: 50 },
      pigmentation: { gte: 50 },
    },
    stepsJson: {
      spf: { category: ['spf'], max_items: 3 },
      cleanser: { category: ['cleanser'], skin_types: ['combo'], max_items: 3 },
      serum: { category: ['serum'], concerns: ['acne', 'pigmentation'], skin_types: ['combo'], max_items: 3 },
      treatment: { category: ['treatment'], concerns: ['acne'], max_items: 2 },
      moisturizer: { category: ['moisturizer'], skin_types: ['combo'], max_items: 3 },
    },
  },
  {
    name: 'Жирная кожа + акне + пигментация',
    priority: 95,
    conditionsJson: {
      skin_type: 'oily',
      inflammation: { gte: 50 },
      pigmentation: { gte: 50 },
    },
    stepsJson: {
      spf: { category: ['spf'], max_items: 3 },
      cleanser: { category: ['cleanser'], skin_types: ['oily'], max_items: 3 },
      serum: { category: ['serum'], concerns: ['acne', 'pigmentation'], skin_types: ['oily'], max_items: 3 },
      treatment: { category: ['treatment'], concerns: ['acne'], max_items: 2 },
      moisturizer: { category: ['moisturizer'], skin_types: ['oily'], max_items: 3 },
    },
  },
  {
    name: 'Сухая кожа + обезвоженность + чувствительность',
    priority: 94,
    conditionsJson: {
      skin_type: 'dry',
      hydration: { lte: 50 },
      sensitivity_level: 'high',
    },
    stepsJson: {
      spf: { category: ['spf'], max_items: 3 },
      toner: { category: ['toner'], concerns: ['dehydration'], skin_types: ['dry', 'sensitive'], max_items: 3 },
      cleanser: { category: ['cleanser'], skin_types: ['dry', 'sensitive'], max_items: 3 },
      serum: { category: ['serum'], concerns: ['dehydration'], skin_types: ['dry', 'sensitive'], max_items: 3 },
      moisturizer: { category: ['moisturizer'], concerns: ['dehydration'], skin_types: ['dry', 'sensitive'], max_items: 3 },
    },
  },
  
  // ========== БАЗОВЫЕ ПРАВИЛА ДЛЯ ВСЕХ ТИПОВ ==========
  {
    name: 'Сухая кожа — базовый уход',
    priority: 6,
    conditionsJson: {
      skin_type: 'dry',
    },
    stepsJson: {
      spf: { category: ['spf'], max_items: 3 },
      toner: { category: ['toner'], skin_types: ['dry'], max_items: 3 },
      cleanser: { category: ['cleanser'], skin_types: ['dry'], max_items: 3 },
      moisturizer: { category: ['moisturizer'], skin_types: ['dry'], max_items: 3 },
    },
  },
  {
    name: 'Жирная кожа — базовый уход',
    priority: 6,
    conditionsJson: {
      skin_type: 'oily',
    },
    stepsJson: {
      spf: { category: ['spf'], max_items: 3 },
      cleanser: { category: ['cleanser'], skin_types: ['oily'], max_items: 3 },
      serum: { category: ['serum'], skin_types: ['oily'], max_items: 3 },
      moisturizer: { category: ['moisturizer'], skin_types: ['oily'], max_items: 3 },
    },
  },
  {
    name: 'Нормальная кожа — базовый уход',
    priority: 4,
    conditionsJson: {
      skin_type: 'normal',
    },
    stepsJson: {
      spf: { category: ['spf'], max_items: 3 },
      toner: { category: ['toner'], skin_types: ['normal'], max_items: 3 },
      cleanser: { category: ['cleanser'], skin_types: ['normal'], max_items: 3 },
      moisturizer: { category: ['moisturizer'], skin_types: ['normal'], max_items: 3 },
    },
  },
  {
    name: 'Чувствительная кожа — базовый уход',
    priority: 7,
    conditionsJson: {
      skin_type: 'sensitive',
    },
    stepsJson: {
      spf: { category: ['spf'], max_items: 3 },
      toner: { category: ['toner'], skin_types: ['sensitive'], max_items: 3 },
      cleanser: { category: ['cleanser'], skin_types: ['sensitive'], max_items: 3 },
      moisturizer: { category: ['moisturizer'], skin_types: ['sensitive'], max_items: 3 },
    },
  },
];

async function addComprehensiveRules() {
  console.log('📋 Добавление комплексных правил рекомендаций\n');

  let added = 0;
  let skipped = 0;

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
        skipped++;
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

      console.log(`✅ Добавлено: "${rule.name}" (ID: ${created.id}, Priority: ${created.priority})`);
      added++;
    } catch (error: any) {
      console.error(`❌ Ошибка при добавлении правила "${rule.name}":`, error.message);
    }
  }

  console.log(`\n🎉 Готово!`);
  console.log(`   Добавлено: ${added} правил`);
  console.log(`   Пропущено: ${skipped} правил (уже существуют)`);
  
  // Показываем итоговую статистику
  const totalRules = await prisma.recommendationRule.count({
    where: { isActive: true },
  });
  console.log(`   Всего активных правил: ${totalRules}`);
  
  await prisma.$disconnect();
}

addComprehensiveRules().catch(console.error);

