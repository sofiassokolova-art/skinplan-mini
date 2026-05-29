// scripts/audit-product-prices.ts
//
// Аудит покрытия БД ценами.
// Запуск: DATABASE_URL=... npx tsx scripts/audit-product-prices.ts [--csv path/to/output.csv]
//
// Выводит:
//   - сколько продуктов всего;
//   - у скольких заполнено price;
//   - у скольких заполнен marketLinks (ссылки в маркетплейсы);
//   - возраст цен (если есть updatedAt — приближённо: продукт без актуализации > 90 дней под флагом);
//   - --csv: выгружает в CSV «id, brand, name, link, currentPrice» — готово к ручному обновлению
//     с goldapple.ru, после чего обратно через scripts/import-products-from-csv.ts.
//
// Что делать с выгрузкой:
//   1. Открыть в Excel/Google Sheets.
//   2. Вручную (или через ассистента маркетинга) проставить актуальную цену по каждой ссылке.
//   3. Сохранить как CSV (UTF-8, разделитель `,`).
//   4. `npx tsx scripts/import-products-from-csv.ts <путь>` — обновит price/marketLinks.

import { PrismaClient } from '@prisma/client';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const prisma = new PrismaClient();

async function main() {
  const args = process.argv.slice(2);
  const csvFlagIdx = args.indexOf('--csv');
  const csvPath = csvFlagIdx >= 0 ? args[csvFlagIdx + 1] : null;

  const products = await prisma.product.findMany({
    where: { published: true },
    select: {
      id: true,
      name: true,
      price: true,
      marketLinks: true,
      updatedAt: true,
      brand: { select: { name: true } },
    },
    orderBy: [{ brand: { name: 'asc' } }, { name: 'asc' }],
  });

  const total = products.length;
  const withPrice = products.filter(p => typeof p.price === 'number' && p.price > 0);
  const withMarketLink = products.filter(p => p.marketLinks && Object.keys(p.marketLinks as object).length > 0);

  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  const staleProducts = withPrice.filter(p => p.updatedAt < ninetyDaysAgo);

  console.log('─'.repeat(60));
  console.log(`Всего опубликованных продуктов:           ${total}`);
  console.log(`С заполненной ценой (price > 0):          ${withPrice.length} (${pct(withPrice.length, total)})`);
  console.log(`С marketLinks (ссылки на маркетплейсы):   ${withMarketLink.length} (${pct(withMarketLink.length, total)})`);
  console.log(`Цены старше 90 дней (нужно перепроверить):${staleProducts.length}`);
  console.log('─'.repeat(60));

  if (withPrice.length < total) {
    const missing = products.filter(p => !p.price || p.price <= 0);
    console.log(`\n⚠️  ${missing.length} продуктов БЕЗ цены:`);
    for (const p of missing.slice(0, 20)) {
      console.log(`   - [${p.id}] ${p.brand.name} — ${p.name}`);
    }
    if (missing.length > 20) {
      console.log(`   …и ещё ${missing.length - 20}`);
    }
  }

  if (csvPath) {
    const csv = ['id,brand,name,currentPrice,marketLink'];
    for (const p of products) {
      const link = extractFirstLink(p.marketLinks);
      const row = [
        p.id,
        csvEscape(p.brand.name),
        csvEscape(p.name),
        p.price ?? '',
        csvEscape(link ?? ''),
      ].join(',');
      csv.push(row);
    }
    const out = resolve(process.cwd(), csvPath);
    writeFileSync(out, csv.join('\n') + '\n', 'utf8');
    console.log(`\n📄 CSV выгружен: ${out}`);
    console.log('   Заполните "currentPrice" актуальными ценами с goldapple.ru,');
    console.log('   затем: npx tsx scripts/import-products-from-csv.ts <путь>');
  }

  await prisma.$disconnect();
}

function pct(part: number, total: number): string {
  return total === 0 ? '0%' : `${((part / total) * 100).toFixed(1)}%`;
}

function csvEscape(s: string): string {
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

function extractFirstLink(marketLinks: unknown): string | null {
  if (!marketLinks || typeof marketLinks !== 'object') return null;
  const values = Object.values(marketLinks as Record<string, unknown>);
  for (const v of values) {
    if (typeof v === 'string' && v.startsWith('http')) return v;
  }
  return null;
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
