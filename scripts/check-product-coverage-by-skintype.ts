#!/usr/bin/env npx ts-node
// scripts/check-product-coverage-by-skintype.ts
// Проверка продуктового покрытия по skinTypes и категориям
// Помогает выявить «дыры» — комбинации без продуктов для добавления в БД

import { createScriptPrisma } from './lib/prisma';

const prisma = createScriptPrisma();

// Базовые категории продуктов (Product.category)
const PRODUCT_CATEGORIES = ['cleanser', 'toner', 'serum', 'moisturizer', 'cream', 'treatment', 'spf', 'mask'] as const;

// Типы кожи, используемые в шаблонах и rules
const SKIN_TYPES = ['dry', 'normal', 'combination_dry', 'combination_oily', 'oily'] as const;

// Маппинг skinType → значения в Product.skinTypes (БД может использовать combo, dry, oily)
const SKIN_TYPE_TO_DB: Record<string, string[]> = {
  dry: ['dry', 'very_dry'],
  normal: ['normal'],
  combination_dry: ['dry', 'combo', 'combination_dry', 'combination'],
  combination_oily: ['oily', 'combo', 'combination_oily', 'combination'],
  oily: ['oily'],
};

async function checkProductCoverage() {
  console.log('📊 Проверка продуктового покрытия по skinTypes и категориям\n');
  console.log('Выявляет комбинации (категория × skinType) с 0 или малым количеством продуктов.\n');

  const allResults: Array<{ category: string; skinType: string; count: number }> = [];

  for (const category of PRODUCT_CATEGORIES) {
    for (const skinType of SKIN_TYPES) {
      const dbSkinValues = SKIN_TYPE_TO_DB[skinType] ?? [skinType];

      const products = await prisma.product.findMany({
        where: {
          published: true,
          brand: { isActive: true },
          AND: [
            {
              OR: [
                { category },
                { step: category },
              ],
            },
            {
              OR: [
                { skinTypes: { hasSome: dbSkinValues } },
                { skinTypes: { isEmpty: true } },
              ],
            },
          ],
        },
        select: { id: true },
      });

      allResults.push({ category, skinType, count: products.length });
    }
  }

  // Отчёт
  const holes = allResults.filter((r) => r.count === 0);
  const low = allResults.filter((r) => r.count > 0 && r.count < 2);
  const ok = allResults.filter((r) => r.count >= 2);

  console.log('=== ИТОГ ===\n');
  console.log(`✅ Комбинаций с достаточным покрытием (≥2 продукта): ${ok.length}`);
  console.log(`⚠️  Комбинаций с малым покрытием (1 продукт): ${low.length}`);
  console.log(`❌ Комбинаций без продуктов (дыры): ${holes.length}\n`);

  if (holes.length > 0) {
    console.log('=== ДЫРЫ (0 продуктов) ===\n');
    const byCategory = new Map<string, typeof holes>();
    for (const h of holes) {
      if (!byCategory.has(h.category)) byCategory.set(h.category, []);
      byCategory.get(h.category)!.push(h);
    }
    for (const [cat, items] of byCategory) {
      console.log(`📦 ${cat}:`);
      for (const item of items) {
        console.log(`   × ${item.skinType}`);
      }
      console.log('');
    }
  }

  if (low.length > 0) {
    console.log('=== МАЛОЕ ПОКРЫТИЕ (1 продукт) ===\n');
    const byCategory = new Map<string, typeof low>();
    for (const h of low) {
      if (!byCategory.has(h.category)) byCategory.set(h.category, []);
      byCategory.get(h.category)!.push(h);
    }
    for (const [cat, items] of byCategory) {
      console.log(`📦 ${cat}:`);
      for (const item of items) {
        console.log(`   × ${item.skinType}: ${item.count} продукт`);
      }
      console.log('');
    }
  }

  // Матрица покрытия (компактная)
  console.log('=== МАТРИЦА ПОКРЫТИЯ ===\n');
  console.log('Категория      dry  norm combo_d combo_o oily');
  console.log('─────────────────────────────────────────────');
  for (const cat of PRODUCT_CATEGORIES) {
    const row = allResults.filter((r) => r.category === cat);
    const dry = row.find((r) => r.skinType === 'dry')?.count ?? 0;
    const norm = row.find((r) => r.skinType === 'normal')?.count ?? 0;
    const comboD = row.find((r) => r.skinType === 'combination_dry')?.count ?? 0;
    const comboO = row.find((r) => r.skinType === 'combination_oily')?.count ?? 0;
    const oily = row.find((r) => r.skinType === 'oily')?.count ?? 0;
    const status = (n: number) => (n >= 2 ? '✓' : n === 1 ? '·' : '✗');
    console.log(
      `${cat.padEnd(14)} ${String(dry).padStart(3)}  ${String(norm).padStart(3)}  ${String(comboD).padStart(6)}  ${String(comboO).padStart(6)}  ${String(oily).padStart(3)}   ${status(dry)}${status(norm)}${status(comboD)}${status(comboO)}${status(oily)}`
    );
  }

  console.log('\n💡 Рекомендация: добавьте продукты для комбинаций с ✗ или ·, чтобы планы генерировались без fallback.');
  await prisma.$disconnect();
}

checkProductCoverage().catch((e) => {
  console.error(e);
  process.exit(1);
});
