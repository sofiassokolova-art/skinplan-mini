// scripts/seed-gapfill-round2.ts
// Сидит товары из scripts/gapfill-round2.json — браузерно-верифицированные in-stock
// карточки (H1/цена/наличие подтверждены) для закрытия 10 тонких слотов рекомендаций.
// goldapple-ссылки оборачиваются в партнёрский редирект в рендере (lib/affiliate);
// Яндекс-ссылки (BPO: Базирон/Эффезел и т.п.) хранятся как есть, ведут напрямую.
//
// Идемпотентно по link. Бренды — нормализованный матч против БД, отсутствующие создаём.
//
//   npx tsx scripts/seed-gapfill-round2.ts            (dry-run)
//   npx tsx scripts/seed-gapfill-round2.ts --apply     (запись)

import { createScriptPrisma } from './lib/prisma';
import { readFileSync } from 'fs';
import { resolve } from 'path';

interface Row {
  slot: string; step: string; category: string; brand: string; name: string;
  link: string; price?: number; in_stock?: boolean;
  skin_types?: string[]; concerns?: string[]; active_ingredients?: string[]; verification?: string;
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
function pathSlug(link: string): string {
  try { return slugify(new URL(link).pathname); } catch { return slugify(link); }
}
function displayName(brand: string, name: string): string {
  return norm(name).startsWith(norm(brand)) ? name : `${brand} ${name}`;
}

async function main() {
  const prisma = createScriptPrisma();
  const args = process.argv.slice(2);
  const apply = args.includes('--apply');
  const file = resolve(args.find(a => !a.startsWith('--')) || 'scripts/gapfill-round2.json');
  console.log(apply ? '=== APPLY ===' : '=== DRY-RUN ===', `\nfile: ${file}\n`);

  const rows: Row[] = JSON.parse(readFileSync(file, 'utf8'));
  // только подтверждённые in-stock карточки
  const usable = rows.filter(r => r.verification === 'ok' && r.in_stock === true && r.link);
  if (usable.length !== rows.length) console.log(`(пропущено ${rows.length - usable.length} строк без ok/in_stock)`);

  // бренды
  const allBrands = await prisma.brand.findMany({ select: { id: true, name: true, slug: true } });
  const brandId: Record<string, number> = {};
  for (const name of [...new Set(usable.map(r => r.brand))]) {
    const hit = allBrands.find(b => norm(b.name) === norm(name));
    if (hit) { brandId[name] = hit.id; continue; }
    let slug = slugify(name) || `brand-${norm(name)}`;
    if (allBrands.some(b => b.slug === slug)) slug = `${slug}-x`;
    console.log(`NEW BRAND  ${name} (slug=${slug})`);
    if (apply) {
      const b = await prisma.brand.create({ data: { name, slug, isActive: true }, select: { id: true, name: true, slug: true } });
      allBrands.push(b); brandId[name] = b.id;
    }
  }

  let created = 0, skipped = 0;
  for (const r of usable) {
    const bid = brandId[r.brand];
    if (!bid && apply) { console.log(`SKIP ${r.brand} — нет бренда`); skipped++; continue; }
    const exists = await prisma.product.findFirst({ where: { link: r.link }, select: { id: true } });
    if (exists) { console.log(`HAS  #${exists.id} ${r.brand} ${r.name}`); skipped++; continue; }
    const name = displayName(r.brand, r.name);
    console.log(`NEW  [${r.step}] ${name}  → ${r.link}  (${r.price ?? '—'}₽)`);
    if (apply && bid) {
      await prisma.product.create({ data: {
        brandId: bid, name, step: r.step, category: r.category,
        skinTypes: r.skin_types ?? [], concerns: r.concerns ?? [], activeIngredients: r.active_ingredients ?? [],
        link: r.link, slug: pathSlug(r.link),
        price: Number.isFinite(r.price as number) ? r.price : null,
        published: true, status: 'published', priority: 50, isFragranceFree: false,
      }});
    }
    created++;
  }
  console.log(`\nИтого: ${created} новых, ${skipped} пропущено.`);
  if (!apply) console.log('dry-run — для записи добавь --apply');
  process.exit(0);
}
main();
