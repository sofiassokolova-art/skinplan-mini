// scripts/seed-goldapple-gapfill.ts
// Добавляет goldapple-товары в слоты рекомендаций, где было 0-1 GA-товара
// (toner, mask_hydrating, mask, treatment_exfoliant_strong, treatment,
//  serum_niacinamide, serum_brightening_soft, treatment_pigmentation),
// чтобы движок покрывал эти типы без фолбеков и всё уходило в ЗЯ.
//
// Ссылки подобраны через WebSearch (goldapple под бот-защитой, не верифицированы
// по наличию/цене). Цены — ПРИБЛИЗИТЕЛЬНЫЕ оценки для budget-логики, заменить из фида.
// Идемпотентно: товар с таким link не создаётся повторно.
//
//   npx tsx scripts/seed-goldapple-gapfill.ts           (dry-run)
//   npx tsx scripts/seed-goldapple-gapfill.ts --apply    (запись)

import { prisma } from '../lib/db';

const GA = 'https://goldapple.ru/';

// бренды, которых может не быть в БД (создадим). Остальные берём существующие по name.
const NEW_BRANDS = ['ANUA', 'SKIN&LAB', 'ART & FACT'];

interface P {
  brand: string; name: string; step: string; category: string;
  ga: string; skinTypes: string[]; concerns: string[]; actives: string[];
  price: number; // ₽, приблизительно
}

const PRODUCTS: P[] = [
  // ── toner (был 0 GA в generic-слоте) ──
  { brand: 'Round Lab', name: '1025 Dokdo Toner', step: 'toner', category: 'toner', ga: '19000230922-1025-dokdo-toner', skinTypes: ['oily','combo','normal','sensitive'], concerns: ['dehydration','barrier','sensitivity'], actives: ['пантенол','минералы морской воды'], price: 1290 },
  { brand: 'Dear, Klairs', name: 'Supple Preparation Facial Toner', step: 'toner', category: 'toner', ga: '19000180243-supple-preparation-facial-toner', skinTypes: ['dry','normal','combo','sensitive'], concerns: ['dehydration','barrier'], actives: ['гиалуроновая кислота','аминокислоты'], price: 1690 },
  { brand: 'Ma:nyo', name: 'Bifida Cica Herb Toner', step: 'toner', category: 'toner', ga: '19000198799-bifida-cica-herb-toner', skinTypes: ['sensitive','dry','normal'], concerns: ['sensitivity','redness','barrier'], actives: ['бифида','центелла'], price: 1790 },
  { brand: 'Mizon', name: 'AHA & BHA Daily Clean Toner', step: 'toner', category: 'toner', ga: '9490200023-aha-bha-daily-clean-toner', skinTypes: ['oily','combo'], concerns: ['pores','texture','acne'], actives: ['AHA-кислоты','BHA'], price: 990 },
  { brand: 'Pyunkang Yul', name: 'Mist Toner', step: 'toner', category: 'toner', ga: '19000150165-mist-toner', skinTypes: ['dry','normal','sensitive'], concerns: ['dehydration','barrier'], actives: ['экстракт астрагала'], price: 1190 },

  // ── mask_hydrating (был 0 GA) ──
  { brand: 'COSRX', name: 'Advanced Snail Hydrogel Mask', step: 'mask_hydrating', category: 'mask', ga: '19000402079-advanced-snail-mucin-mask', skinTypes: ['oily','combo','dry','normal','sensitive'], concerns: ['dehydration','barrier','redness'], actives: ['муцин улитки'], price: 1490 },
  { brand: 'COSRX', name: 'Hydrogel Very Simple Pack', step: 'mask_hydrating', category: 'mask', ga: '97560200038-hydrogel-very-simple-pack', skinTypes: ['oily','combo','dry','normal'], concerns: ['dehydration'], actives: ['гиалуроновая кислота'], price: 390 },
  { brand: 'DARLING', name: 'Skin Fuel Soothing Hydrogel Mask', step: 'mask_hydrating', category: 'mask', ga: '19760306245-skin-fuel-glowing-hydrogel', skinTypes: ['oily','combo','dry','normal','sensitive'], concerns: ['dehydration','redness'], actives: ['гиалуроновая кислота'], price: 290 },

  // ── mask (generic, был 0 GA) ──
  { brand: 'COSRX', name: 'Ultimate Nourishing Rice Overnight Spa Mask', step: 'mask', category: 'mask', ga: '97560200033-ultimate-nourishing-rice-overnight-spa-mask', skinTypes: ['dry','normal','combo'], concerns: ['dehydration','dullness'], actives: ['экстракт риса','ниацинамид'], price: 1690 },
  { brand: 'Dear, Klairs', name: 'Freshly Juiced Vitamin E Mask', step: 'mask', category: 'mask', ga: '19000180230-freshly-juiced-vitamin-e-mask', skinTypes: ['dry','normal','combo','sensitive'], concerns: ['dullness','dehydration'], actives: ['витамин E'], price: 1990 },

  // ── treatment_exfoliant_strong (был 0 GA) ──
  { brand: 'Some By Mi', name: 'AHA-BHA-PHA 30 Days Miracle Serum', step: 'treatment_exfoliant_strong', category: 'treatment', ga: '19760303641-aha-bha-pha-30-days-miracle-serum', skinTypes: ['oily','combo'], concerns: ['acne','texture','post_acne','pores'], actives: ['AHA-кислоты','BHA','PHA'], price: 1490 },
  { brand: 'COSRX', name: 'AHA 7 Whitehead Power Liquid', step: 'treatment_exfoliant_strong', category: 'treatment', ga: '97560200004-aha-7-whitehead-power-liquid', skinTypes: ['oily','combo','normal'], concerns: ['texture','pores','dullness'], actives: ['гликолевая кислота'], price: 1390 },
  { brand: 'Mizon', name: 'AHA 8% Peeling Serum', step: 'treatment_exfoliant_strong', category: 'treatment', ga: '9490100063-aha-8-peeling-serum', skinTypes: ['oily','combo'], concerns: ['texture','pores','dullness'], actives: ['AHA-кислоты 8%'], price: 1290 },

  // ── treatment (generic acne/azelaic, был 0 GA) ──
  { brand: 'Sesderma', name: 'Azelac RU крем-гель депигментирующий', step: 'treatment', category: 'treatment', ga: '24780100019-azelac', skinTypes: ['oily','combo','sensitive'], concerns: ['redness','pigmentation','acne'], actives: ['азелаиновая кислота'], price: 3290 },
  { brand: 'SmoRodina', name: 'Azelaic Acid сыворотка', step: 'treatment', category: 'treatment', ga: '19000089083-azelaic-acid', skinTypes: ['oily','combo','sensitive'], concerns: ['redness','pigmentation','post_acne'], actives: ['азелаиновая кислота'], price: 890 },

  // ── serum_niacinamide (был 1 GA) ──
  { brand: 'For Me', name: 'Niacinamide TXA сыворотка', step: 'serum_niacinamide', category: 'serum', ga: '19000224129-niacinamide-txa', skinTypes: ['oily','combo','normal'], concerns: ['pores','pigmentation','oiliness','post_acne'], actives: ['ниацинамид','транексамовая кислота'], price: 990 },
  { brand: 'For Me', name: 'Glow Serum Propolis + Niacinamide', step: 'serum_niacinamide', category: 'serum', ga: '19000225147-glow-serum-propolis-niacinamide', skinTypes: ['oily','combo','dry','normal'], concerns: ['dullness','pores','dehydration'], actives: ['ниацинамид','прополис'], price: 990 },
  { brand: 'ART & FACT', name: 'Niacinamide 10% + Zinc 1%', step: 'serum_niacinamide', category: 'serum', ga: '19000039298-niacinamide-10-zinc-1-sebum-regulating-anti-acne', skinTypes: ['oily','combo'], concerns: ['oiliness','pores','acne'], actives: ['ниацинамид 10%','цинк'], price: 790 },

  // ── serum_brightening_soft (был 1 GA) ──
  { brand: 'SKIN&LAB', name: 'Vitamin C Brightening Serum', step: 'serum_brightening_soft', category: 'serum', ga: '19000113907-vitamin-c-brightening-serum', skinTypes: ['oily','combo','dry','normal'], concerns: ['dullness','pigmentation'], actives: ['витамин C'], price: 1490 },
  { brand: 'ANUA', name: 'Niacinamide 10% + TXA 4% Serum', step: 'serum_brightening_soft', category: 'serum', ga: '19000299524-niacinamide-10-txa-4', skinTypes: ['oily','combo','normal'], concerns: ['pigmentation','dullness','post_acne'], actives: ['ниацинамид 10%','транексамовая кислота'], price: 1690 },

  // ── treatment_pigmentation (был 1 GA) ──
  { brand: 'SKIN1004', name: 'Madagascar Centella Tone Brightening Capsule Ampoule', step: 'treatment_pigmentation', category: 'treatment', ga: '19000137120-madagascar-centella-tone-brightening-capsule-ampoule', skinTypes: ['oily','combo','dry','normal','sensitive'], concerns: ['pigmentation','dullness'], actives: ['центелла','ниацинамид'], price: 1990 },
  { brand: 'Sesderma', name: 'Azelac RU липосомальная сыворотка', step: 'treatment_pigmentation', category: 'treatment', ga: '19000003094-azelac', skinTypes: ['oily','combo','sensitive'], concerns: ['pigmentation','redness','post_acne'], actives: ['азелаиновая кислота'], price: 3490 },
];

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
}

async function main() {
  const apply = process.argv.includes('--apply');
  console.log(apply ? '=== APPLY ===' : '=== DRY-RUN ===');

  // 1) бренды — нормализованное сопоставление (игнор пробелов/пунктуации/регистра),
  //    т.к. в БД бренд может быть записан иначе (напр. "ART&FACT" vs "ART & FACT").
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  const allBrands = await prisma.brand.findMany({ select: { id: true, name: true, slug: true } });
  const brandId: Record<string, number> = {};
  const names = [...new Set(PRODUCTS.map(p => p.brand))];
  for (const name of names) {
    const hit = allBrands.find(b => norm(b.name) === norm(name));
    if (hit) { brandId[name] = hit.id; continue; }
    if (!NEW_BRANDS.includes(name)) { console.log(`!! бренд "${name}" не найден — пропускаю его товары`); continue; }
    // уникальный slug (на случай коллизии добавляем суффикс)
    let slug = slugify(name);
    if (allBrands.some(b => b.slug === slug)) slug = `${slug}-kbeauty`;
    console.log(`NEW BRAND  ${name} (slug=${slug})`);
    if (apply) {
      const b = await prisma.brand.create({ data: { name, slug, isActive: true }, select: { id: true, name: true, slug: true } });
      allBrands.push(b);
      brandId[name] = b.id;
    }
  }

  // 2) товары
  let created = 0, skipped = 0;
  for (const p of PRODUCTS) {
    const bid = brandId[p.brand];
    if (!bid && apply) { console.log(`SKIP  ${p.brand} ${p.name} — нет бренда`); skipped++; continue; }
    const url = GA + p.ga;
    const exists = await prisma.product.findFirst({ where: { link: url }, select: { id: true } });
    if (exists) { console.log(`HAS   #${exists.id} ${p.brand} ${p.name} — link уже есть`); skipped++; continue; }
    console.log(`NEW   [${p.step}] ${p.brand} — ${p.name}\n        → ${url}`);
    if (apply && bid) {
      await prisma.product.create({ data: {
        brandId: bid, name: `${p.brand} ${p.name}`, step: p.step, category: p.category,
        skinTypes: p.skinTypes, concerns: p.concerns, activeIngredients: p.actives,
        link: url, slug: slugify(p.ga), price: p.price,
        published: true, status: 'published', priority: 50, isFragranceFree: false,
      }});
    }
    created++;
  }
  console.log(`\nИтого: ${created} новых товаров, ${skipped} пропущено.`);
  if (!apply) console.log('dry-run — для записи добавь --apply');
  process.exit(0);
}
main();
