// scripts/depublish-graymarket-departed.ts
// Снимает с публикации товары ушедших из РФ иностранных брендов, у которых остался
// только серый Яндекс.Маркет-линк (без GoldApple) и завышенные цены (напр. CeraVe-серум
// ~9000₽, Medik8 Crystal Retinal 6 — 22130₽). Такие товары не должны попадать в план/корзину.
// Идемпотентно: трогает только published=true товары указанных брендов БЕЗ GoldApple-ссылки.
// Запуск: DATABASE_URL=... tsx scripts/depublish-graymarket-departed.ts

import { prisma } from '../lib/db';

// Бренды, официально ушедшие из РФ → на ЯМ только серые продавцы с накруткой.
const DEPARTED_BRANDS = ['CeraVe', 'Medik8', "Paula's Choice", 'The Inkey List'];

function hasGoldApple(p: { link: string | null; marketLinks: any }): boolean {
  const ml = (p.marketLinks || {}) as Record<string, unknown>;
  if (ml.goldapple) return true;
  if (p.link && p.link.includes('goldapple')) return true;
  return false;
}

async function main() {
  const candidates = await prisma.product.findMany({
    where: { published: true, brand: { name: { in: DEPARTED_BRANDS } } },
    include: { brand: true },
  });

  const toDepublish = candidates.filter((p) => !hasGoldApple(p));

  if (toDepublish.length === 0) {
    console.log('✅ Нечего снимать: у всех товаров этих брендов есть GoldApple-ссылка или они уже сняты');
    return;
  }

  console.log(`Снимаю с публикации ${toDepublish.length} товар(ов):`);
  for (const p of toDepublish) {
    console.log(`  - id=${p.id} ${p.brand?.name} ${p.name} [${p.step}] price=${p.price}`);
  }

  const res = await prisma.product.updateMany({
    where: { id: { in: toDepublish.map((p) => p.id) } },
    data: { published: false },
  });

  console.log(`\n✅ Снято с публикации: ${res.count}`);
  console.log('⚠️  Товары остаются в БД (для истории/восстановления), но не попадают в подбор.');
}

main().then(() => prisma.$disconnect()).catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
