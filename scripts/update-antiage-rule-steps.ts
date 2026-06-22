// scripts/update-antiage-rule-steps.ts
// Чинит stepsJson возрастных правил (#21/#20/#22/#30): старый формат без `category`
// у serum-шага → продукты не подбирались. Новый набор шагов с category+concerns
// тянет antiage-активы (vit C, пептиды, ретиноид). Тип кожи применяется автоматически
// из профиля пользователя (getProductsForStep), поэтому skin_types в шагах не нужен.
// Идемпотентно. DRY=1 — превью. Печатает старый stepsJson (бэкап для отката).
import { prisma } from '../lib/db';
const DRY = process.env.DRY === '1';

// ВАЖНО: для активов таргетим по конкретному `step`-токену (getProductsForStep матчит
// {step: cat} / {step: startsWith cat}), а не по широкой category:['serum'/'treatment'] —
// иначе мягкий фильтр concerns пропускает acne-средства (azelaic/patches) и они
// обгоняют ретиноиды по ранжированию. step-таргетинг тянет ровно antiage-активы.
const ANTIAGE_STEPS = {
  cleanser_gentle: { category: ['cleanser'], max_items: 1 },
  serum_vitc: { category: ['serum_vitc'], max_items: 1 },
  serum_antiage: { category: ['serum_antiage'], max_items: 1 },
  treatment_antiage: { category: ['treatment_antiage'], max_items: 1 },
  moisturizer: { category: ['moisturizer'], max_items: 1 },
  spf_50_face: { category: ['spf'], max_items: 1 },
};

// ВАЖНО: матчим по ИМЕНИ — id правил различаются между dev и prod (autoincrement).
const TARGET_NAMES = [
  'Активный анти-эйдж 35–45 лет',
  'Зрелая кожа 55+',
  'Первые признаки старения 28–35 лет',
  'Жирная кожа + морщины 35+',
];

async function main() {
  console.log(`${DRY ? '🧪 DRY' : '🚀 APPLY'}\n`);
  for (const name of TARGET_NAMES) {
    const r = await prisma.recommendationRule.findFirst({ where: { name }, select: { id: true, name: true, stepsJson: true } });
    if (!r) { console.log(`"${name}": НЕ НАЙДЕНО`); continue; }
    console.log(`#${r.id} "${r.name}"`);
    console.log(`   OLD: ${JSON.stringify(r.stepsJson)}`);
    if (DRY) { console.log(`   NEW: ${JSON.stringify(ANTIAGE_STEPS)}\n`); continue; }
    await prisma.recommendationRule.update({ where: { id: r.id }, data: { stepsJson: ANTIAGE_STEPS as any } });
    console.log(`   ✅ обновлено\n`);
  }
}
main().then(() => prisma.$disconnect()).then(() => process.exit(0)).catch(async e => { console.error(e); await prisma.$disconnect(); process.exit(1); });
