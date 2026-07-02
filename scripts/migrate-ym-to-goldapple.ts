// scripts/migrate-ym-to-goldapple.ts
// Заменяет Яндекс-Маркет ссылки у 20 товаров на их goldapple-аналоги,
// чтобы они уходили через партнёрский редирект Goldapple (erid LdtCKFJmG) в корзине.
//
// Подбор аналогов сделан через поисковую выдачу (страницы goldapple.ru закрыты
// бот-защитой, проверить наличие/цену программно нельзя). Перед --apply
// сверьте ссылки глазами.
//
// Запуск:
//   npx tsx scripts/migrate-ym-to-goldapple.ts          (dry-run, ничего не пишет)
//   npx tsx scripts/migrate-ym-to-goldapple.ts --apply  (записывает в БД)
//
// Что делает с каждым товаром: link = goldapple-URL, marketLinks.ym удаляется
// (иначе getStore() в корзине вернёт яндекс-ссылку раньше link).

import { prisma } from '../lib/db';

const GA = 'https://goldapple.ru/';

interface Mapping {
  id: number;
  was: string;          // что было (для лога)
  ga: string | null;    // путь на goldapple (без домена); null = пропустить, нужен ручной выбор
  note?: string;
}

const MAP: Mapping[] = [
  { id: 650, was: 'LRP Retinol B3',                 ga: '89320600007-redermic-retinol',           note: 'аналог: LRP Redermic Retinol' },
  { id: 651, was: 'Vichy Retinol Specialist',        ga: '19000144294-retinol-specialist' },
  { id: 652, was: 'TO Retinol 0.2% Squalane',        ga: '19000324169-liposomal-retinol-0-4-squalane', note: 'аналог: TRUE ALCHEMY' },
  { id: 653, was: 'TO Granactive Retinoid 2%',       ga: null,                                      note: 'РЕШИТЬ: TO нет на ЗЯ, аналог не выбран' },
  { id: 654, was: 'COSRX Retinol 0.5 Oil',           ga: '19000163790-the-retinol-0-5-oil' },
  { id: 655, was: 'Some By Mi Retinol Intense',      ga: '19000170048-retinol-intense-reactivating-serum' },
  { id: 656, was: 'Medik8 Crystal Retinal 6',        ga: null,                                      note: 'РЕШИТЬ: Medik8 нет на ЗЯ, аналог не выбран' },
  { id: 657, was: 'Sesderma Reti Age',               ga: '24780100024-reti-age' },
  { id: 658, was: 'Mizon Peptide 500',               ga: '19000430248-7-vegan-peptide',             note: 'ПРОВЕРИТЬ: Mizon 7 Vegan Peptide (точного Peptide 500 слага нет)' },
  { id: 659, was: 'TO Multi-Peptide + HA',           ga: '19000135229-6-peptide-complex-serum',     note: 'аналог: MARY&MAY' },
  { id: 660, was: 'TO Matrixyl 10% + HA',            ga: '19000075393-smoothing-serum',             note: 'аналог: HELLO BEAUTY Matrixyl' },
  { id: 661, was: "Paula's Choice Multi-Peptide",    ga: '19000166627-peptide-serum',               note: 'аналог: COS DE BAHA' },
  { id: 662, was: 'Sesderma C-Vit Liposomal',        ga: '24780100051-c-vit',                       note: 'линейка Sesderma C-VIT (флюид)' },
  { id: 664, was: 'Vichy Liftactiv Supreme Vit C',   ga: '19000060265-liftactiv-supreme' },
  { id: 665, was: 'Bioderma Sensibio H2O',           ga: '89270300021-sensibio-h2o' },
  { id: 666, was: 'LRP Micellar Water Ultra',        ga: '19760335447-micellar-water-ultra' },
  { id: 667, was: 'Garnier Micellar',                ga: '6030400045-skin-naturals' },
  { id: 668, was: 'Avene Micellar Lotion',           ga: '89190400015-lotion-micellaire' },
  { id: 669, was: 'Uriage Thermal Micellar',         ga: '89141800015-thermal-micellar-water-removes-make-up-sensitive-skin' },
  { id: 670, was: 'Vichy Purete Thermale Micellar',  ga: '89310500016-purete-thermale' },
];

async function main() {
  const apply = process.argv.includes('--apply');
  console.log(apply ? '=== APPLY (запись в БД) ===' : '=== DRY-RUN (ничего не пишется) ===\n');

  let updated = 0, skipped = 0;
  for (const m of MAP) {
    if (!m.ga) {
      console.log(`SKIP  #${m.id} ${m.was} — ${m.note ?? 'нет ссылки'}`);
      skipped++;
      continue;
    }
    const url = GA + m.ga;
    const product = await prisma.product.findUnique({ where: { id: m.id }, select: { id: true, name: true, marketLinks: true } });
    if (!product) { console.log(`MISS  #${m.id} — товар не найден`); skipped++; continue; }

    // Снимаем ym из marketLinks, чтобы getStore() взял именно goldapple link.
    const ml = (product.marketLinks && typeof product.marketLinks === 'object' && !Array.isArray(product.marketLinks))
      ? { ...(product.marketLinks as Record<string, string>) } : {};
    delete ml.ym;
    const newMarketLinks = Object.keys(ml).length ? ml : null;

    console.log(`SET   #${m.id} ${product.name}\n        → ${url}${m.note ? `  [${m.note}]` : ''}`);

    if (apply) {
      await prisma.product.update({
        where: { id: m.id },
        data: { link: url, marketLinks: newMarketLinks as any },
      });
    }
    updated++;
  }

  console.log(`\nИтого: ${updated} обновлено, ${skipped} пропущено (нужен ручной выбор/не найдено).`);
  if (!apply) console.log('Это был dry-run. Для записи запусти с флагом --apply.');
  process.exit(0);
}

main();
