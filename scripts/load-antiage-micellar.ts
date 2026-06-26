// scripts/load-antiage-micellar.ts
// Идемпотентная загрузка средств из more_antiage_plus_micellar.xlsx (anti-age serums + micellar waters).
// Источник: файл пользователя; 3 строки без цены/ссылки пропущены по согласованию.
// Шаги нормализованы к каноническим StepCategory (ретиноиды → treatment_antiage как PM-актив).
// Запуск: DATABASE_URL=... npx tsx scripts/load-antiage-micellar.ts        (запись)
//         DATABASE_URL=... DRY=1 npx tsx scripts/load-antiage-micellar.ts   (превью без записи)

import { prisma } from '../lib/db';

const DRY = process.env.DRY === '1';
const ALL_SKIN = ['dry', 'normal', 'oily', 'combination_dry', 'combination_oily'];

function priceSegment(price: number | null): string | null {
  if (price == null) return null;
  if (price < 2000) return 'mass';
  if (price < 5000) return 'mid';
  return 'premium';
}

function concernsForRow(row: Row): string[] {
  if (row.step === 'treatment_antiage' || row.step === 'serum_antiage') {
    return Array.from(new Set([...row.concerns, 'photoaging']));
  }
  return row.concerns;
}

function slugify(input: string): string {
  return input.toLowerCase().replace(/[^a-z0-9а-я]+/g, '-').replace(/^-+|-+$/g, '').substring(0, 60);
}

interface Row {
  brand: string; name: string; step: string; category: string;
  price: number | null; volume: string; concerns: string[]; actives: string[];
  url: string; desc: string;
}

// 21 средство (ретиноид-сыворотки → treatment_antiage; пептиды → serum_antiage;
// vit C → serum_vitc; мицеллярка → cleanser_micellar).
const ROWS: Row[] = [
  // --- anti-age: ретиноиды → treatment_antiage (вечерний актив) ---
  { brand: 'La Roche-Posay', name: 'Retinol B3 Serum', step: 'treatment_antiage', category: 'treatment', price: 5079, volume: '30 мл', concerns: ['wrinkles', 'loss_of_elasticity'], actives: ['retinol', 'vitamin_b3'], url: 'https://market.yandex.ru/card/syvorotka-la-roche-posay-retinol-b3-30-ml/103189855233', desc: 'Интенсивная антивозрастная сыворотка с ретинолом и витамином B3 против глубоких морщин' },
  { brand: 'Vichy', name: 'Liftactiv Retinol Specialist Serum', step: 'treatment_antiage', category: 'treatment', price: 3567, volume: '30 мл', concerns: ['wrinkles', 'texture'], actives: ['retinol'], url: 'https://market.yandex.ru/card/syvorotka-dlya-korrektsii-glubokikh-morshchin-vichy-liftactiv-retinol-specialist-30-ml/4912219200', desc: 'Антивозрастная сыворотка с ретинолом и гиалуроновой кислотой против морщин' },
  { brand: 'The Ordinary', name: 'Retinol 0.2% in Squalane', step: 'treatment_antiage', category: 'treatment', price: 2185, volume: '30 мл', concerns: ['wrinkles', 'texture'], actives: ['retinol', 'squalane'], url: 'https://market.yandex.ru/card/syvorotka-dlya-litsa-s-retinolom-retinol-02-in-squalane-the-ordinary-obyem-30-ml-ot-morshchin-i-dlya-omolazhivaniya-kozhi/103481444236', desc: 'Сыворотка с ретинолом 0,2% в скваляне для омоложения кожи' },
  { brand: 'The Ordinary', name: 'Granactive Retinoid 2% Emulsion', step: 'treatment_antiage', category: 'treatment', price: 1924, volume: '30 мл', concerns: ['wrinkles', 'texture'], actives: ['granactive_retinoid'], url: 'https://market.yandex.ru/card/emulsiya-dlya-litsa-granactive-retinoid-2-emulsion-the-ordinary-obyem-30-ml-sokrashchayet-morshchiny-i-uluchshayet-kachestvo-kozhi/103481417451', desc: 'Сыворотка-эмульсия с гранактивным ретиноидом 2% против морщин' },
  { brand: 'COSRX', name: 'The Retinol 0.5 Oil', step: 'treatment_antiage', category: 'treatment', price: 2960, volume: '20 мл', concerns: ['wrinkles', 'firmness'], actives: ['retinol_0_5', 'squalane'], url: 'https://market.yandex.ru/card/maslo-cosrx-the-retinol-05-oil-20-ml/5555540014', desc: 'Масло с ретинолом 0,5% для упругости и сокращения морщин' },
  { brand: 'Some By Mi', name: 'Retinol Intense Reactivating Serum', step: 'treatment_antiage', category: 'treatment', price: 2337, volume: '30 мл', concerns: ['wrinkles', 'texture'], actives: ['retinol', 'retinal', 'bakuchiol'], url: 'https://market.yandex.ru/card/syvorotka-s-retinolom-koreya-sam-bay-mi/103597734450', desc: 'Антивозрастная сыворотка с ретинолом, ретиналом и бакучиолом' },
  { brand: 'Medik8', name: 'Crystal Retinal 6', step: 'treatment_antiage', category: 'treatment', price: 22130, volume: '30 мл', concerns: ['wrinkles', 'texture'], actives: ['retinal'], url: 'https://market.yandex.ru/card/medik8-nochnaya-syvorotka-crystal-retinal-6-serum-30-ml/5037779657', desc: 'Ночная сыворотка с ретиналом против морщин и для текстуры кожи' },
  { brand: 'Sesderma', name: 'Reti Age Serum', step: 'treatment_antiage', category: 'treatment', price: 7104, volume: '30 мл', concerns: ['wrinkles', 'firmness'], actives: ['retinoids'], url: 'https://market.yandex.ru/card/syvorotka-reti-age-anti-aging-serum-30-ml/102197982205', desc: 'Антивозрастная сыворотка с ретиноидами против морщин и для упругости' },
  // --- anti-age: пептиды → serum_antiage (заполняют слот antiage_mature) ---
  { brand: 'Mizon', name: 'Peptide 500', step: 'serum_antiage', category: 'serum', price: 2935, volume: '30 мл', concerns: ['firmness', 'wrinkles'], actives: ['peptides'], url: 'https://market.yandex.ru/card/syvorotka-mizon-peptide-500-30-ml/103200485418', desc: 'Пептидная антивозрастная сыворотка (45% пептидов) для упругости' },
  { brand: 'The Ordinary', name: 'Multi-Peptide + HA Serum', step: 'serum_antiage', category: 'serum', price: 4803, volume: '30 мл', concerns: ['firmness', 'wrinkles', 'dehydration'], actives: ['peptides', 'hyaluronic_acid'], url: 'https://market.yandex.ru/card/peptidnaya-antivozrastnaya-syvorotka-dlya-litsa-multi-peptide--ha-serum-the-ordinary-obyem-30-ml-s-gialuronovoy-kislotoy-dlya-ustraneniya-morshchin/5835292646', desc: 'Пептидная сыворотка с гиалуроновой кислотой против морщин' },
  { brand: 'The Ordinary', name: 'Matrixyl 10% + HA', step: 'serum_antiage', category: 'serum', price: 1737, volume: '30 мл', concerns: ['wrinkles', 'firmness'], actives: ['matrixyl', 'hyaluronic_acid'], url: 'https://market.yandex.ru/card/syvorotka-dlya-litsa-antivozrastnaya-matrixyl-10--ha-the-ordinary-obyem-30ml-umenshayet-morshchiny-i-uluchshayet-teksturu-kozhi/103481423740', desc: 'Сыворотка с Matrixyl 10% и гиалуроновой кислотой против морщин' },
  { brand: "Paula's Choice", name: 'Pro-Collagen Multi-Peptide Booster', step: 'serum_antiage', category: 'serum', price: 20107, volume: '20 мл', concerns: ['firmness', 'wrinkles'], actives: ['peptides', 'amino_acids'], url: 'https://market.yandex.ru/card/paulas-choice---pro-collagen-multi-peptide-booster-syvorotka-protiv-morshchin-20-ml/5847476776', desc: 'Мульти-пептидный бустер против морщин для упругости кожи' },
  // --- anti-age: vitamin C → serum_vitc ---
  { brand: 'Sesderma', name: 'C-Vit Liposomal Serum', step: 'serum_vitc', category: 'serum', price: 6609, volume: '30 мл', concerns: ['dullness', 'early_aging', 'pigmentation'], actives: ['vitamin_c'], url: 'https://market.yandex.ru/card/sesderma--c-vit-5-liposomal-serum--syvorotka-liposomalnaya-s-kompleksom-vitamina-s-5-tipov-30-ml/102473031835', desc: 'Липосомальная сыворотка с витамином C для сияния и тонуса кожи' },
  { brand: 'SkinCeuticals', name: 'C E Ferulic', step: 'serum_vitc', category: 'serum', price: 2093, volume: '30 мл', concerns: ['photoaging', 'pigmentation'], actives: ['vitamin_c', 'vitamin_e', 'ferulic_acid'], url: 'https://market.yandex.ru/card/skinceuticals--c-e-ferulic-vysokoeffektivnaya-syvorotka-troynogo-deystviya-30-ml/5642050361', desc: 'Антиоксидантная сыворотка с витамином C, E и феруловой кислотой' },
  { brand: 'Vichy', name: 'Liftactiv Supreme Vitamin C Serum', step: 'serum_vitc', category: 'serum', price: 2500, volume: '20 мл', concerns: ['dullness', 'early_aging'], actives: ['vitamin_c', 'peptides'], url: 'https://market.yandex.ru/card/vichy-liftactiv-supreme-syvorotka-vitamin-s-20-ml/4912581687', desc: 'Сыворотка с витамином C против морщин и для сияния кожи' },
  // --- micellar water → cleanser_micellar ---
  { brand: 'Bioderma', name: 'Sensibio H2O', step: 'cleanser_micellar', category: 'cleanser', price: 1346, volume: '500 мл', concerns: ['sensitivity'], actives: [], url: 'https://market.yandex.ru/card/bioderma-sensibio-h2o-ar-mitsellyarnaya-voda-dlya-ochishcheniya-kozhi-litsa-s-pokrasneniyami-i-rozatsea-500-ml/4604669077', desc: 'Мицеллярная вода для чувствительной кожи, склонной к покраснениям' },
  { brand: 'La Roche-Posay', name: 'Micellar Water Ultra', step: 'cleanser_micellar', category: 'cleanser', price: 2202, volume: '400 мл', concerns: ['sensitivity'], actives: [], url: 'https://market.yandex.ru/card/voda-mitsellyarnaya-dlya-chuvstvitelnoy-i-sklonnoy-k-allergii-kozhi-ultra-reactive-la-roche-posaylya-rosh-poze-400ml/102110099881', desc: 'Мицеллярная вода Ultra для чувствительной и склонной к аллергии кожи' },
  { brand: 'Garnier', name: 'Micellar Cleansing Water', step: 'cleanser_micellar', category: 'cleanser', price: 328, volume: '400 мл', concerns: [], actives: [], url: 'https://market.yandex.ru/card/mitsellyarnaya-voda-garnier-dlya-litsa-glaz-i-gub/103809396836', desc: 'Мицеллярная вода для лица, глаз и губ' },
  { brand: 'Avene', name: 'Micellar Lotion', step: 'cleanser_micellar', category: 'cleanser', price: 5015, volume: '400 мл', concerns: ['sensitivity'], actives: ['avene_thermal_water'], url: 'https://market.yandex.ru/card/avene-mitsellyarnyy-loson-dlya-ochishcheniya-kozhi-i-udaleniya-makiyazha-400-ml-1-sht/5703118331', desc: 'Мицеллярный лосьон для очищения и снятия макияжа, для чувствительной кожи' },
  { brand: 'Uriage', name: 'Thermal Micellar Water', step: 'cleanser_micellar', category: 'cleanser', price: 2843, volume: '500 мл x 2 шт', concerns: ['sensitivity'], actives: ['uriage_water'], url: 'https://market.yandex.ru/card/uriage-thermal-micellar-water-mitsellyarnaya-voda-ochishchayushchaya-dlya-sukhoy-i-normalnoy-kozhi-500-ml-2-sht/5601750566', desc: 'Термальная мицеллярная вода для сухой и нормальной кожи' },
  { brand: 'Vichy', name: 'Purete Thermale Micellar Water', step: 'cleanser_micellar', category: 'cleanser', price: 1862, volume: '400 мл', concerns: ['sensitivity'], actives: ['vichy_mineral_water'], url: 'https://market.yandex.ru/card/mitsellyarnaya-voda-s-mineralami-dlya-chuvstvitelnoy-kozhi-purete-thermale/4912612012', desc: 'Мицеллярная вода с минералами для чувствительной кожи' },
];

const VALID_STEPS = new Set(['treatment_antiage', 'serum_antiage', 'serum_vitc', 'cleanser_micellar']);

async function resolveBrandId(name: string): Promise<number> {
  const existing = await prisma.brand.findFirst({ where: { name: { equals: name, mode: 'insensitive' } }, select: { id: true, name: true } });
  if (existing) return existing.id;
  if (DRY) { console.log(`   [dry] создал бы бренд: ${name}`); return -1; }
  const created = await prisma.brand.create({ data: { name, slug: slugify(name), isActive: true } });
  console.log(`   ✅ создан бренд #${created.id}: ${name}`);
  return created.id;
}

async function main() {
  console.log(`${DRY ? '🧪 DRY-RUN' : '🚀 ЗАПИСЬ'} — ${ROWS.length} средств\n`);
  let created = 0, updated = 0;
  const bad = ROWS.filter((r) => !VALID_STEPS.has(r.step));
  if (bad.length) { console.error('❌ Неизвестные шаги:', bad.map((b) => b.step)); process.exit(1); }

  for (const r of ROWS) {
    const brandId = await resolveBrandId(r.brand);
    const data = {
      name: r.name,
      brandId: brandId === -1 ? 0 : brandId,
      category: r.category,
      step: r.step,
      price: r.price,
      priceSegment: priceSegment(r.price),
      volume: r.volume,
      skinTypes: ALL_SKIN,
      concerns: concernsForRow(r),
      activeIngredients: r.actives,
      descriptionUser: r.desc,
      link: r.url,
      marketLinks: { ym: r.url } as any,
      status: 'published',
      published: true,
      priority: 50,
    };

    const existing = brandId === -1 ? null : await prisma.product.findFirst({ where: { name: r.name, brandId }, select: { id: true } });
    if (DRY) {
      console.log(`${existing ? '↻' : '+'} ${r.brand} — ${r.name} | step=${r.step} cat=${r.category} price=${r.price ?? '—'} seg=${data.priceSegment}`);
      continue;
    }
    if (existing) {
      await prisma.product.update({ where: { id: existing.id }, data });
      console.log(`↻ обновлён #${existing.id}: ${r.brand} — ${r.name}`);
      updated++;
    } else {
      let slug = slugify(`${r.brand}-${r.name}`);
      let prod;
      try {
        prod = await prisma.product.create({ data: { ...data, slug } });
      } catch (e: any) {
        if (e?.code === 'P2002') { slug = `${slug}-${Date.now() % 100000}`; prod = await prisma.product.create({ data: { ...data, slug } }); }
        else throw e;
      }
      console.log(`+ создан #${prod.id}: ${r.brand} — ${r.name} (${r.step})`);
      created++;
    }
  }
  console.log(`\n✅ Готово. Создано: ${created}, обновлено: ${updated}${DRY ? ' (dry-run, ничего не записано)' : ''}`);
}

main().then(() => prisma.$disconnect()).then(() => process.exit(0)).catch(async (e) => { console.error('❌', e); await prisma.$disconnect(); process.exit(1); });
