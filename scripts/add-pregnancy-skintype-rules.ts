// scripts/add-pregnancy-skintype-rules.ts
// Добавляет правила для беременность + skinType для разнообразия подбора
// Приоритет 101 (выше Rule 23) — более специфичные правила матчатся первыми

import { prisma } from '../lib/db';

const RULE_23_STEPS = {
  toner: {
    category: ['toner'],
    concerns: ['hydration'],
    max_items: 3,
    active_ingredients: ['hyaluronic_acid', 'niacinamide'],
  },
  spf_50_face: {
    avoidIf: ['ретинол', 'салициловая >2%', 'гидрохинон', 'эфирные масла'],
    category: ['spf'],
    max_items: 1,
  },
  cleanser_gentle: {
    avoidIf: ['ретинол', 'салициловая >2%', 'гидрохинон', 'эфирные масла'],
    category: ['cleanser'],
    max_items: 1,
  },
  moisturizer_light: {
    avoidIf: ['ретинол', 'салициловая >2%', 'гидрохинон', 'эфирные масла'],
    category: ['cream'],
    max_items: 1,
  },
  serum_niacinamide: {
    avoidIf: ['ретинол', 'салициловая >2%', 'гидрохинон', 'эфирные масла'],
    concerns: ['dehydration'],
    max_items: 1,
    active_ingredients: ['гиалуронка', 'ниацинамид'],
  },
  treatment_acne_azelaic: {
    avoidIf: ['ретинол', 'салициловая >2%', 'гидрохинон', 'эфирные масла'],
    concerns: ['acne'],
    max_items: 1,
    active_ingredients: ['азелаиновая кислота до 10%'],
  },
};

// Для сухой кожи — moisturizer_barrier вместо moisturizer_light
const DRY_STEPS = {
  ...RULE_23_STEPS,
  moisturizer_barrier: {
    avoidIf: ['ретинол', 'салициловая >2%', 'гидрохинон', 'эфирные масла'],
    category: ['cream'],
    max_items: 1,
  },
};
delete (DRY_STEPS as any).moisturizer_light;

const newRules = [
  {
    name: 'Беременность + сухая кожа — барьерный уход',
    priority: 101,
    conditionsJson: { pregnant: true, skin_type: 'dry' },
    stepsJson: DRY_STEPS,
  },
  {
    name: 'Беременность + комбинированная кожа (сухая зона)',
    priority: 101,
    conditionsJson: { pregnant: true, skin_type: 'combination_dry' },
    stepsJson: DRY_STEPS,
  },
  {
    name: 'Беременность + жирная кожа — легкие текстуры',
    priority: 101,
    conditionsJson: { pregnant: true, skin_type: 'oily' },
    stepsJson: RULE_23_STEPS, // moisturizer_light подходит
  },
  {
    name: 'Беременность + комбинированная кожа (жирная зона)',
    priority: 101,
    conditionsJson: { pregnant: true, skin_type: 'combination_oily' },
    stepsJson: RULE_23_STEPS,
  },
  {
    name: 'Беременность + нормальная кожа',
    priority: 101,
    conditionsJson: { pregnant: true, skin_type: 'normal' },
    stepsJson: RULE_23_STEPS,
  },
];

async function addPregnancySkinTypeRules() {
  console.log('🔧 Добавление правил беременность + skinType\n');

  for (const rule of newRules) {
    const existing = await prisma.recommendationRule.findFirst({
      where: {
        name: rule.name,
        isActive: true,
      },
    });
    if (existing) {
      console.log(`   ⏭️  Правило "${rule.name}" уже существует (id: ${existing.id})`);
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
    console.log(`   ✅ Создано: "${rule.name}" (id: ${created.id})`);
  }

  console.log('\n📌 Итог: Rule 23 остаётся fallback для беременных без совпадения по skinType');
  console.log('   Новые правила (priority 101) матчатся первыми при pregnant + skin_type');

  await prisma.$disconnect();
}

addPregnancySkinTypeRules()
  .then(() => {
    console.log('\n✅ Готово');
    process.exit(0);
  })
  .catch((e) => {
    console.error('❌ Ошибка:', e);
    process.exit(1);
  });
