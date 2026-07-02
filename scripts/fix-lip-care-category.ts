// scripts/fix-lip-care-category.ts
// Чинит ошибочную категорию у средств для губ: step='lip_care' но category='moisturizer'.
// Из-за этого лип-балм (напр. Mixit Lip Balm, id 577) просачивался в слот крема для лица
// в генераторе плана и вытеснял настоящий moisturizer (см. lib/step-matching.ts).
// Идемпотентно: ставит category='lip_care' там, где step='lip_care', а category ещё нет.
// Запуск: DATABASE_URL=... tsx scripts/fix-lip-care-category.ts

import { prisma } from '../lib/db';

async function main() {
  const broken = await prisma.product.findMany({
    where: { step: 'lip_care', NOT: { category: 'lip_care' } },
    include: { brand: true },
  });

  if (broken.length === 0) {
    console.log('✅ Нечего чинить: все lip_care-товары уже имеют category=lip_care');
    return;
  }

  console.log(`Найдено ${broken.length} товар(ов) с неверной категорией:`);
  for (const p of broken) {
    console.log(`  - id=${p.id} ${p.brand?.name} ${p.name} (category=${p.category} → lip_care)`);
  }

  const res = await prisma.product.updateMany({
    where: { step: 'lip_care', NOT: { category: 'lip_care' } },
    data: { category: 'lip_care' },
  });

  console.log(`\n✅ Обновлено: ${res.count}`);
}

main().then(() => prisma.$disconnect()).catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
