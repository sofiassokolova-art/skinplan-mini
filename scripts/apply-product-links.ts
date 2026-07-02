// scripts/apply-product-links.ts
// Применяет найденные ссылки покупки к товарам по Product.id.
//
// Вход: scripts/linkless-products.results.json — массив:
//   { id, status, link, marketLinks, evidence }
//
// Что делает:
//   ok                       -> Product.link = link; Product.marketLinks merge; published=true
//   not_found | out_of_stock -> ссылки не пишет, только выводит в отчете
//   needs_manual_check       -> ссылки не пишет, выводит отдельно
//
//   npx tsx scripts/apply-product-links.ts            (dry-run)
//   npx tsx scripts/apply-product-links.ts --apply    (запись)

import { createScriptPrisma } from './lib/prisma';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import type { Prisma } from '@prisma/client';

type StoreKey = 'goldapple' | 'ym' | 'ozon' | 'wildberries' | 'apteka';
type RowStatus = 'ok' | 'not_found' | 'out_of_stock' | 'needs_manual_check';

interface Row {
  id: number;
  brand?: string;
  name?: string;
  status: RowStatus;
  link?: string;
  marketLinks?: Partial<Record<StoreKey, string>>;
  evidence?: string;
}

const ALLOWED_STORES = new Set<StoreKey>([
  'goldapple',
  'ym',
  'ozon',
  'wildberries',
  'apteka',
]);
const PASSIVE_STATUSES = new Set<RowStatus>([
  'not_found',
  'out_of_stock',
  'needs_manual_check',
]);

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function normalizeMarketLinks(value: unknown): Partial<Record<StoreKey, string>> {
  if (!isPlainObject(value)) return {};

  const links: Partial<Record<StoreKey, string>> = {};
  for (const [key, rawValue] of Object.entries(value)) {
    if (!ALLOWED_STORES.has(key as StoreKey)) continue;
    if (typeof rawValue !== 'string') continue;

    const link = rawValue.trim();
    if (link) links[key as StoreKey] = link;
  }
  return links;
}

function existingMarketLinks(value: unknown): Record<string, unknown> {
  return isPlainObject(value) ? { ...value } : {};
}

function hasTrackingParams(link: string): boolean {
  return /[?&](utm_|erid|yclid|do-waremd5|ogV)/i.test(link);
}

function formatProduct(id: number, brand?: string, name?: string): string {
  return `#${id}${brand || name ? ` ${[brand, name].filter(Boolean).join(' ')}` : ''}`;
}

async function main() {
  const prisma = createScriptPrisma();
  const args = process.argv.slice(2);
  const apply = args.includes('--apply');
  const file = resolve(args.find(arg => !arg.startsWith('--')) || 'scripts/linkless-products.results.json');

  console.log(apply ? '=== APPLY ===' : '=== DRY-RUN ===', `\nfile: ${file}\n`);

  let rows: Row[];
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

  const ids = [...new Set(rows.map(row => row.id).filter(Number.isInteger))];
  const products = await prisma.product.findMany({
    where: { id: { in: ids } },
    select: {
      id: true,
      name: true,
      link: true,
      marketLinks: true,
      published: true,
      status: true,
    },
  });
  const byId = new Map(products.map(product => [product.id, product]));

  const counts = {
    ok: 0,
    not_found: 0,
    out_of_stock: 0,
    needs_manual_check: 0,
    no_match: 0,
    invalid: 0,
    changed: 0,
    noop: 0,
  };
  const passive: string[] = [];
  const invalid: string[] = [];
  const noMatch: string[] = [];

  for (const row of rows) {
    if (!Number.isInteger(row.id)) {
      counts.invalid++;
      invalid.push(`invalid id: ${JSON.stringify(row)}`);
      continue;
    }

    if (!['ok', 'not_found', 'out_of_stock', 'needs_manual_check'].includes(row.status)) {
      counts.invalid++;
      invalid.push(`${formatProduct(row.id, row.brand, row.name)} — unknown status '${row.status}'`);
      continue;
    }

    counts[row.status]++;

    const product = byId.get(row.id);
    if (!product) {
      counts.no_match++;
      noMatch.push(formatProduct(row.id, row.brand, row.name));
      continue;
    }

    if (PASSIVE_STATUSES.has(row.status)) {
      passive.push(`${formatProduct(row.id, row.brand, row.name)} — ${row.status}`);
      continue;
    }

    if (!row.link || typeof row.link !== 'string' || !row.link.trim()) {
      counts.invalid++;
      invalid.push(`${formatProduct(row.id, row.brand, row.name)} — ok без link`);
      continue;
    }

    if (hasTrackingParams(row.link)) {
      counts.invalid++;
      invalid.push(`${formatProduct(row.id, row.brand, row.name)} — link содержит tracking/query params`);
      continue;
    }

    const incomingLinks = normalizeMarketLinks(row.marketLinks);
    if (Object.keys(incomingLinks).length === 0) {
      counts.invalid++;
      invalid.push(`${formatProduct(row.id, row.brand, row.name)} — ok без marketLinks`);
      continue;
    }

    let hasBadMarketLink = false;
    for (const link of Object.values(incomingLinks)) {
      if (hasTrackingParams(link)) {
        counts.invalid++;
        invalid.push(`${formatProduct(row.id, row.brand, row.name)} — marketLinks содержит tracking/query params`);
        hasBadMarketLink = true;
      }
    }
    if (hasBadMarketLink) continue;

    const existingLinks = existingMarketLinks(product.marketLinks);
    const mergedLinks = { ...existingLinks, ...incomingLinks };
    const data: Prisma.ProductUpdateInput = {};

    if (product.link !== row.link) data.link = row.link;
    if (JSON.stringify(existingLinks) !== JSON.stringify(mergedLinks)) {
      data.marketLinks = mergedLinks as Prisma.InputJsonValue;
    }
    if (!product.published) data.published = true;
    if (product.status !== 'published') data.status = 'published';

    if (Object.keys(data).length === 0) {
      counts.noop++;
      continue;
    }

    counts.changed++;
    console.log(`SET   #${product.id} ${product.name}  ${JSON.stringify(data)}`);
    if (apply) {
      await prisma.product.update({ where: { id: product.id }, data });
    }
  }

  console.log('\nИтого:');
  console.log(`  ok=${counts.ok}`);
  console.log(`  not_found=${counts.not_found}`);
  console.log(`  out_of_stock=${counts.out_of_stock}`);
  console.log(`  needs_manual_check=${counts.needs_manual_check}`);
  console.log(`  changed=${counts.changed}`);
  console.log(`  noop=${counts.noop}`);
  console.log(`  invalid=${counts.invalid}`);
  console.log(`  no_match=${counts.no_match}`);

  if (passive.length) {
    console.log('\nБез записи ссылок:');
    passive.forEach(item => console.log(`  ${item}`));
  }
  if (invalid.length) {
    console.log('\nINVALID:');
    invalid.forEach(item => console.log(`  ${item}`));
  }
  if (noMatch.length) {
    console.log('\nNO MATCH:');
    noMatch.forEach(item => console.log(`  ${item}`));
  }
  if (!apply) console.log('\ndry-run — для записи добавь --apply');

  await prisma.$disconnect();
}

main().catch(async error => {
  console.error(error);
  process.exit(1);
});
