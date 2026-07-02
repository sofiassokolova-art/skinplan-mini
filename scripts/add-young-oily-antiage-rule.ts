// scripts/add-young-oily-antiage-rule.ts
// Добавляет/обновляет правило под МОЛОДУЮ ЖИРНУЮ кожу с целями antiage/pores.
//
// Зачем: antiage-правила в каталоге зашиты на возраст 35+, акне-правила — на
// воспаление. Молодой (<35) жирный пользователь с целью «сократить морщины /
// сделать поры менее заметными» не подходил ни под одно профильное правило и
// проваливался в общий сезонный фолбэк («Лето»). Это правило ловит такой кейс.
//
// ВАЖНО: матчит по goals (skin_goals → GoalKey-токены), которые движок начал
// прокидывать в RuleContext (см. lib/recommendations-generator.ts + lib/rule-context.ts).
//
// Идемпотентно (upsert по имени). DRY=1 — превью без записи.
import { prisma } from '../lib/db';

const DRY = process.env.DRY === '1';

const NAME = 'Молодая жирная кожа — antiage/pores профилактика';

const RULE = {
  name: NAME,
  conditionsJson: {
    skin_type: 'oily',
    age: { in: ['under_25', '25-34'] },
    goals: { hasSome: ['antiage', 'pores'] },
  } as any,
  // Лёгкая жирная рутина с профилактикой старения и работой над порами.
  // Без агрессивного treatment-шага: в 25–34 профилактика идёт через сыворотку
  // (ниацинамид/антиоксиданты), а не «лечение». Если у юзера появятся показания
  // (акне/пигментация), treatment добавит централизованный гейт в движке.
  stepsJson: {
    cleanser: { category: ['cleanser'], max_items: 1 },
    toner: { category: ['toner'], max_items: 1 },
    serum: { category: ['serum'], concerns: ['photoaging', 'oiliness'], active_ingredients: ['ниацинамид'], max_items: 1 },
    moisturizer: { category: ['moisturizer'], max_items: 1 },
    spf: { category: ['spf'], max_items: 1 },
  } as any,
  // Выше сезонного фолбэка (#26, priority 90), ниже медицинских/специфичных (94+).
  priority: 93,
  isActive: true,
};

async function main() {
  console.log(`${DRY ? '🧪 DRY' : '🚀 APPLY'}\n`);
  const existing = await prisma.recommendationRule.findFirst({ where: { name: NAME }, select: { id: true } });
  console.log(`${existing ? `UPDATE #${existing.id}` : 'CREATE'} "${NAME}"`);
  console.log(`   conditions: ${JSON.stringify(RULE.conditionsJson)}`);
  console.log(`   steps: ${JSON.stringify(RULE.stepsJson)}`);
  console.log(`   priority: ${RULE.priority}`);
  if (DRY) {
    console.log('\n(dry-run, изменений нет)');
    return;
  }
  if (existing) {
    await prisma.recommendationRule.update({ where: { id: existing.id }, data: RULE });
  } else {
    await prisma.recommendationRule.create({ data: RULE });
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
