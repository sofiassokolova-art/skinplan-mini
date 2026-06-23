// scripts/add-catchall-rule.ts
// Добавляет/обновляет catch-all правило «Базовый уход (по умолчанию)».
//
// Зачем: движок рекомендаций (lib/recommendations-generator.ts) перебирает правила
// по priority desc и берёт ПЕРВОЕ совпавшее. Если профиль не подходит ни под одно
// специфичное правило — возвращался no_matching_rule и генерация плана падала.
// Правило с пустыми conditions ({} → matches любой профиль) и минимальным
// priority=1 выбирается только последним рубежом и гарантирует базовую рутину.
//
// Идемпотентно (upsert по имени). DRY=1 — превью без записи.
import { prisma } from '../lib/db';

const DRY = process.env.DRY === '1';

const NAME = 'Базовый уход (по умолчанию)';

const CATCHALL = {
  name: NAME,
  conditionsJson: {} as any, // пустые условия = матч любого профиля
  stepsJson: {
    cleanser: { category: ['cleanser'], max_items: 1 },
    serum: { category: ['serum'], concerns: ['maintenance'], max_items: 1 },
    moisturizer: { category: ['moisturizer'], max_items: 1 },
    spf: { category: ['spf'], max_items: 1 },
  } as any,
  priority: 0, // строго ниже всех специфичных правил (включая legacy-сид priority 1)
  isActive: true,
};

async function main() {
  console.log(`${DRY ? '🧪 DRY' : '🚀 APPLY'}\n`);
  const existing = await prisma.recommendationRule.findFirst({
    where: { name: NAME },
    select: { id: true },
  });
  console.log(`${existing ? `UPDATE #${existing.id}` : 'CREATE'} "${NAME}"`);
  console.log(`   conditions: ${JSON.stringify(CATCHALL.conditionsJson)}`);
  console.log(`   steps: ${JSON.stringify(CATCHALL.stepsJson)}`);
  console.log(`   priority: ${CATCHALL.priority}`);
  if (DRY) {
    console.log('\n(dry-run, изменений нет)');
    return;
  }
  if (existing) {
    await prisma.recommendationRule.update({ where: { id: existing.id }, data: CATCHALL });
  } else {
    await prisma.recommendationRule.create({ data: CATCHALL });
  }
  console.log('   ✅ применено');
}

main()
  .then(() => prisma.$disconnect())
  .then(() => process.exit(0))
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
