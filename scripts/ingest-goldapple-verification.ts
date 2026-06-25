// scripts/ingest-goldapple-verification.ts
// Применяет результаты браузерной верификации goldapple-карточек к БД.
// Источник истины — рендер реальной страницы (H1/цена/наличие), не WebSearch-догадки.
//
// Вход: JSON-файл (по умолчанию scripts/verification-results.json) — массив:
//   [
//     { "link": "https://goldapple.ru/19000230922-1025-dokdo-toner",
//       "status": "ok", "name": "Round Lab 1025 Dokdo Toner", "price": 1290, "in_stock": true },
//     { "link": "...", "status": "not_found" },
//     { "link": "...", "status": "needs_manual_check" }
//   ]
// link — полный URL или просто путь (19000230922-...). Матчим по product.link.
//
// Что делает (по status):
//   ok + in_stock!=false → published=true; обновляет price (если число) и name (если задан)
//   ok + in_stock=false  → published=false (нет в наличии — не рекомендуем)
//   not_found | 404 | redirect | no_h1 → published=false (карточка недоступна)
//   needs_manual_check   → НЕ трогаем published, только помечаем в отчёте
//
//   npx tsx scripts/ingest-goldapple-verification.ts [file.json]            (dry-run)
//   npx tsx scripts/ingest-goldapple-verification.ts [file.json] --apply     (запись)

import { createScriptPrisma } from './lib/prisma';
import { readFileSync } from 'fs';
import { resolve } from 'path';

interface Row { link: string; status?: string; name?: string; price?: number | string; in_stock?: boolean }

const HIDE_STATUSES = new Set(['not_found', '404', 'redirect', 'no_h1', 'gone', 'unavailable']);

function pathOf(link: string): string {
  try { return new URL(link).pathname.replace(/^\/+/, ''); } catch { return link.replace(/^https?:\/\/[^/]+\/+/, '').replace(/^\/+/, ''); }
}

async function main() {
  const prisma = createScriptPrisma();
  const args = process.argv.slice(2);
  const apply = args.includes('--apply');
  const file = resolve(args.find(a => !a.startsWith('--')) || 'scripts/verification-results.json');
  console.log(apply ? '=== APPLY ===' : '=== DRY-RUN ===', `\nfile: ${file}\n`);

  let rows: Row[];
  try { rows = JSON.parse(readFileSync(file, 'utf8')); }
  catch (e) { console.error(`Не прочитать ${file}:`, (e as Error).message); process.exit(1); }
  if (!Array.isArray(rows)) { console.error('Ожидался JSON-массив'); process.exit(1); }

  // индекс продуктов по пути ссылки
  const products = await prisma.product.findMany({ where: { link: { not: null } }, select: { id: true, name: true, link: true, price: true, published: true } });
  const byPath = new Map<string, typeof products[number]>();
  for (const p of products) if (p.link) byPath.set(pathOf(p.link), p);

  const counts = { price: 0, name: 0, hidden: 0, shown: 0, manual: 0, miss: 0, noop: 0 };
  const manual: string[] = [];

  for (const r of rows) {
    if (!r.link) continue;
    const prod = byPath.get(pathOf(r.link));
    if (!prod) { console.log(`MISS  ${r.link} — нет товара с такой ссылкой`); counts.miss++; continue; }
    const status = (r.status || 'ok').toLowerCase().trim();
    const data: Record<string, unknown> = {};

    if (status === 'needs_manual_check' || status === 'manual') {
      manual.push(`#${prod.id} ${prod.name}`); counts.manual++; continue;
    }
    if (HIDE_STATUSES.has(status)) {
      if (prod.published) { data.published = false; counts.hidden++; }
    } else { // ok / in_stock
      const inStock = r.in_stock !== false;
      if (!inStock) { if (prod.published) { data.published = false; counts.hidden++; } }
      else {
        if (!prod.published) { data.published = true; counts.shown++; }
        const price = typeof r.price === 'string' ? parseInt(r.price.replace(/\D/g, ''), 10) : r.price;
        if (Number.isFinite(price) && price! > 0 && price !== prod.price) { data.price = price; counts.price++; }
        if (r.name && r.name.trim() && r.name.trim() !== prod.name) { data.name = r.name.trim(); counts.name++; }
      }
    }

    if (Object.keys(data).length === 0) { counts.noop++; continue; }
    console.log(`SET   #${prod.id} ${prod.name}  ${JSON.stringify(data)}`);
    if (apply) await prisma.product.update({ where: { id: prod.id }, data });
  }

  console.log(`\nИтого: price=${counts.price}, name=${counts.name}, скрыто=${counts.hidden}, показано=${counts.shown}, manual=${counts.manual}, без изменений=${counts.noop}, не найдено=${counts.miss}`);
  if (manual.length) { console.log('\nNEEDS MANUAL CHECK (не трогал, сверь сам):'); manual.forEach(m => console.log('  ' + m)); }
  if (!apply) console.log('\ndry-run — для записи добавь --apply');
  process.exit(0);
}
main();
