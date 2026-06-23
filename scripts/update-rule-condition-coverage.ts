// scripts/update-rule-condition-coverage.ts
// Чинит conditionsJson правил, чьи токены условий рассинхронизированы с тем, что
// реально кладёт RuleContext (см. lib/rule-context.ts):
//
//  1. «Активный анти-эйдж 35–45 лет»: age { in: ["35-44"] } не покрывал группу
//     45_54 (нормализуется в "45-54"). Расширяем диапазон → 35-44 + 45-54.
//  2. «Солнечное лентиго / Веснушки …»: skinTone { in: ["very_fair","fair"] }, но
//     RuleContext.skinTone приходит из fitzpatrickType ("I_II"/"III_IV"/"V_VI").
//     Переводим условие на fitzpatrick-токены, иначе правило мёртвое.
//
// Идемпотентно. DRY=1 — превью без записи. Матчим по ИМЕНИ (id различаются dev/prod).
import { prisma } from '../lib/db';

const DRY = process.env.DRY === '1';

type Patch = { name: string; conditions: Record<string, any> };

const PATCHES: Patch[] = [
  {
    name: 'Активный анти-эйдж 35–45 лет',
    conditions: { age: { in: ['35-44', '45-54'] } },
  },
  {
    // Имя в complete-2025 = "Веснушки + фототип I–II"
    name: 'Веснушки + фототип I–II',
    conditions: { skinTone: { in: ['I_II'] } },
  },
];

async function main() {
  console.log(`${DRY ? '🧪 DRY' : '🚀 APPLY'}\n`);
  for (const p of PATCHES) {
    const r = await prisma.recommendationRule.findFirst({
      where: { name: p.name },
      select: { id: true, name: true, conditionsJson: true },
    });
    if (!r) {
      console.log(`"${p.name}": НЕ НАЙДЕНО\n`);
      continue;
    }
    console.log(`#${r.id} "${r.name}"`);
    console.log(`   OLD: ${JSON.stringify(r.conditionsJson)}`);
    console.log(`   NEW: ${JSON.stringify(p.conditions)}`);
    if (DRY) {
      console.log('');
      continue;
    }
    await prisma.recommendationRule.update({
      where: { id: r.id },
      data: { conditionsJson: p.conditions as any },
    });
    console.log('   ✅ обновлено\n');
  }
}

main()
  .then(() => prisma.$disconnect())
  .then(() => process.exit(0))
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
