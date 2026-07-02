// scripts/apply-link-renames.ts
// Переименовывает товары, для которых найдена ДРУГАЯ (cross-brand) альтернатива,
// чтобы карточка совпадала с тем, куда ведёт ссылка (см. apply-product-links.ts).
//
// Вход: scripts/link-renames.json — массив { id, brand, name }.
// Бренд матчим по имени (case-insensitive) к существующей строке Brand —
// новые бренды НЕ создаём (проверено: все нужные уже есть). Если бренд не найден,
// строка помечается как INVALID и не применяется.
//
//   npx tsx scripts/apply-link-renames.ts            (dry-run)
//   npx tsx scripts/apply-link-renames.ts --apply    (запись)

import { createScriptPrisma } from './lib/prisma';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import type { Prisma } from '@prisma/client';

interface RenameRow {
  id: number;
  brand: string;
  name: string;
}

async function main() {
  const prisma = createScriptPrisma();
  const args = process.argv.slice(2);
  const apply = args.includes('--apply');
  const file = resolve(args.find(arg => !arg.startsWith('--')) || 'scripts/link-renames.json');

  console.log(apply ? '=== APPLY ===' : '=== DRY-RUN ===', `\nfile: ${file}\n`);

  let rows: RenameRow[];
  try {
    rows = JSON.parse(readFileSync(file, 'utf8'));
  } catch (error) {
    console.error(`Не прочитать ${file}:`, (error as Error).message);
    process.exit(1);
  }
  if (!Array.isArray(rows)) {
    console.error('Ожидался JSON-массив');
    process.exit(1);
  }

  const brands = await prisma.brand.findMany({ select: { id: true, name: true } });
  const brandByLower = new Map(brands.map(b => [b.name.toLowerCase(), b]));

  const counts = { changed: 0, noop: 0, invalid: 0, no_match: 0 };
  const invalid: string[] = [];

  for (const row of rows) {
    if (!Number.isInteger(row.id) || !row.brand || !row.name) {
      counts.invalid++;
      invalid.push(`bad row: ${JSON.stringify(row)}`);
      continue;
    }
    const brand = brandByLower.get(row.brand.toLowerCase());
    if (!brand) {
      counts.invalid++;
      invalid.push(`#${row.id} — бренд '${row.brand}' не найден в таблице brands`);
      continue;
    }
    const product = await prisma.product.findUnique({
      where: { id: row.id },
      select: { id: true, name: true, brandId: true, brand: { select: { name: true } } },
    });
    if (!product) {
      counts.no_match++;
      invalid.push(`#${row.id} — товар не найден`);
      continue;
    }

    const data: Prisma.ProductUpdateInput = {};
    if (product.name !== row.name) data.name = row.name;
    if (product.brandId !== brand.id) data.brand = { connect: { id: brand.id } };

    if (Object.keys(data).length === 0) {
      counts.noop++;
      continue;
    }

    counts.changed++;
    console.log(
      `RENAME #${product.id}: «${product.brand?.name} ${product.name}» → «${row.brand} ${row.name}»`,
    );
    if (apply) {
      await prisma.product.update({ where: { id: product.id }, data });
    }
  }

  console.log('\nИтого:');
  console.log(`  changed=${counts.changed}`);
  console.log(`  noop=${counts.noop}`);
  console.log(`  invalid=${counts.invalid}`);
  console.log(`  no_match=${counts.no_match}`);
  if (invalid.length) {
    console.log('\nINVALID / NO MATCH:');
    invalid.forEach(item => console.log(`  ${item}`));
  }
  if (!apply) console.log('\ndry-run — для записи добавь --apply');

  await prisma.$disconnect();
}

main().catch(async error => {
  console.error(error);
  process.exit(1);
});
