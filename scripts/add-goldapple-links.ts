// scripts/add-goldapple-links.ts
// Проставляет goldapple-ссылки товарам, у которых сейчас НЕТ ссылки (link=null,
// marketLinks пуст). Только точные/близкие совпадения того же бренда (по решению:
// бюджетные/отсутствующие на ЗЯ бренды остаются без ссылки). RU-бренды на ЗЯ
// (Mixit, For Me by gold apple, Dr.Ceuracle, Natura Siberica и т.п.) тоже включаем.
//
// Подбор — через поисковую выдачу (goldapple.ru закрыт бот-защитой, наличие/цену
// программно не проверить). Перед --apply сверьте 🟡-строки глазами.
//
// Запуск:
//   npx tsx scripts/add-goldapple-links.ts          (dry-run)
//   npx tsx scripts/add-goldapple-links.ts --apply   (запись)

import { prisma } from '../lib/db';

const GA = 'https://goldapple.ru/';

interface Row { id: number; was: string; ga: string | null; ok?: boolean; note?: string }
// ok:true = точное/уверенное; ok:false (note) = близкий аналог, проверить; ga:null = пропуск.

const MAP: Row[] = [
  // ── batch 1: gentle cleansers ──
  { id: 460, was: 'CeraVe Hydrating Cleanser',      ga: '89810200001-hydrating-cleanser', ok: true },
  { id: 461, was: 'CeraVe Cream-to-Foam',           ga: '19760325596-cream-to-foam-cleanser', note: 'слаг standalone не подтверждён (есть набор kit-cleansing-creamfoam)' },
  { id: 462, was: 'LRP Toleriane Dermo Cleanser',   ga: '11117-89320500009-toleriane', ok: true },
  { id: 463, was: 'Bioderma Sensibio Gel Moussant', ga: '89270300016-sensibio-mild-cleansing-foaming-gel', ok: true },
  { id: 464, was: 'Uriage Xémose Cleansing Oil',    ga: '89140300009-xemose-cleansing-soothing-oil', ok: true },
  { id: 465, was: 'Avene Tolerance Gentle Cleanser', ga: '89190400001-lotion-nettoyante-peaux-intolerantes', note: 'аналог: Avene lotion nettoyante (gel-аналога нет)' },
  { id: 468, was: 'Bioderma Atoderm Shower Gel',    ga: '19000141452-atoderm', ok: true },
  { id: 469, was: 'Eucerin Ultra Sensitive Cleanser', ga: '19000162309-dermatoclean', note: 'аналог: Eucerin DermatoCLEAN' },
  // ── batch 2: balancing/deep cleansers + toners ──
  { id: 472, was: 'LRP Effaclar Gel',               ga: '89320200010-gel-mous', ok: true },
  { id: 473, was: 'Bioderma Sébium Gel',            ga: '89270200005-sebium-purifying-cleansing-foaming-gel', ok: true },
  { id: 474, was: 'CeraVe Foaming Cleanser',        ga: '89810300001-foaming-cleanser', ok: true },
  { id: 475, was: 'COSRX Low pH Good Morning Gel',  ga: '97560200022-low-ph-good-morning-gel-cleanser', ok: true },
  { id: 480, was: 'Dr.Jart+ Teatreement Foam',      ga: '19760305999-ctrl-a-teatreement-cleansing-foam', ok: true },
  { id: 482, was: 'COSRX Salicylic Cleanser',       ga: '19000048751-salicylic-acid-daily-gentle-cleanser-mini', note: 'только мини-формат' },
  { id: 490, was: 'Pyunkang Yul Essence Toner',     ga: '19000135262-essence-toner', ok: true },
  { id: 491, was: 'Hada Labo Gokujyun Lotion',      ga: '19760321676-gokujyun-lotion', ok: true },
  { id: 493, was: 'LRP Hydrating Tonic',            ga: '89320300008-uspokaivajuschij', note: 'аналог: LRP успокаивающий тоник (hydrating-нет)' },
  // ── batch 3: rest cleansers + toners (incl. RU brands) ──
  { id: 478, was: 'For Me Pore Cleansing Gel',      ga: '19000193310-gel-cleanser', ok: true, note: 'For Me = house brand goldapple' },
  { id: 487, was: 'Dr.Ceuracle Tea Tree Foam',      ga: '19000012307-tea-tree-purifine-30-cleansing-foam', ok: true },
  { id: 488, was: 'Mixit Clean Pores Gel',          ga: '19000420958-niacinamide', note: 'аналог: Mixit матирующий гель Niacinamide' },
  { id: 494, was: 'Bioderma Sensibio Tonic',        ga: '19000041344-sensibio', ok: true },
  { id: 495, was: 'Uriage Thermal Water',           ga: '11092113-thermal-water', ok: true },
  { id: 496, was: 'SKIN1004 Centella Toner',        ga: '19000137124-madagascar-centella-tone-brightening-boosting-toner', ok: true },
  // ── batch 4: serums ──
  { id: 502, was: 'Medi-Peel Bio-Cell Hyaluron',    ga: '19000266159-hyaluronic-acid-layer-mooltox-ampoule', note: 'аналог: Medi-Peel Hyaluronic ампула' },
  { id: 505, was: 'COSRX Niacinamide 15',           ga: '19000163786-the-niacinamide-15-serum', ok: true },
  { id: 509, was: 'COSRX Vitamin C 23',             ga: '19000163788-the-vitamin-c-23-serum', ok: true },
  { id: 510, was: 'Some By Mi Yuja Niacin',         ga: '19760303644-galactomyces-pure-vitamin-c-glow-serum', note: 'аналог: Some By Mi Galactomyces Vit C Glow (Yuja Niacin серума нет, есть тонер)' },
  { id: 513, was: 'Medi-Peel Vitamin C Ampoule',    ga: '19000070278-dr-green-vitamin-ampoule', ok: true },
  { id: 514, was: 'LRP Rosaliac AR',                ga: '89321500005-rosaliac-ar-intense', ok: true },
  { id: 515, was: 'Uriage Roséliane Serum',         ga: '89140100002-roseliane', note: 'аналог: Uriage Roseliane крем (серума нет)' },
  { id: 516, was: 'Dr.Jart+ Cicapair Serum',        ga: '19000224711-cicapair-intensive-soothing-repair', ok: true },
  { id: 517, was: 'SKIN1004 Ampoule Centella',      ga: '19000112672-madagascar-centella-ampoule', ok: true },
  // ── batch 5: treatments + moisturizers ──
  { id: 524, was: 'LRP Effaclar Duo(+)',            ga: '19000005028-effaclar-duo', ok: true },
  { id: 527, was: 'COSRX BHA Blackhead Liquid',     ga: '97560200010-bha-blackhead-power-liquid', ok: true },
  { id: 528, was: 'Some By Mi AHA-BHA-PHA Toner',   ga: '19760303642-aha-bha-pha-30-days-miracle-toner', ok: true },
  { id: 535, was: 'Medi-Peel Mela Tox Ampoule',     ga: '19000149599-melanon-x-ampoule', note: 'аналог: Medi-Peel Melanon X (Mela Tox нет)' },
  { id: 539, was: 'CeraVe PM Facial Lotion',        ga: '89810200003-moisturising', note: 'аналог: CeraVe Facial Lotion (PM-варианта на ЗЯ нет)' },
  { id: 540, was: 'COSRX Oil-Free Ultra Moisturizing', ga: '97560200008-oil-free-ultra-moisturizing-lotion-with-birch-sap', ok: true },
  { id: 542, was: 'LRP Effaclar MAT',               ga: '89320200007-effaclar-mat', ok: true },
  { id: 543, was: 'Bioderma Sébium Mat Control',    ga: '89270200008-sebium-mat-control-shine-control-moisturizer', ok: true },
  { id: 545, was: 'CeraVe Moisturizing Cream',      ga: '11746003-moisturising', ok: true },
  { id: 546, was: 'LRP Cicaplast Baume B5',         ga: '19000126618-cicaplast-b5', ok: true },
  { id: 548, was: 'Avene Cicalfate+',               ga: '89190600004-cicalfate', ok: true },
  { id: 549, was: 'LRP Toleriane Sensitive',        ga: '89320500010-toleriane-sensitive', ok: true },
  { id: 550, was: 'Dr.Jart+ Cicapair Cream',        ga: '21070200008-cicapair-cream', ok: true },
  // ── batch 6: eye creams + SPF + Mixit ──
  { id: 526, was: 'Mixit Acne Spot',                ga: '19000038690-skin-chemistry', note: 'аналог: Mixit Anti-Blemish (точечного нет)' },
  { id: 538, was: 'Mixit Peptide Booster',          ga: '19000038692-skin-chemistry', note: 'аналог: Mixit Copper антивозрастная' },
  { id: 547, was: 'Uriage Bariederm Cica',          ga: '19000021595-bariederm', ok: true },
  { id: 552, was: 'CeraVe Eye Repair Cream',        ga: '89810400001-eye-repair', ok: true },
  { id: 553, was: 'LRP Hyalu B5 Eye',               ga: '89322000003-hyalu-b5', ok: true },
  { id: 554, was: "Kiehl's Creamy Eye Avocado",     ga: '10693-15370600002-creamy-eye-treatment-with-avocado', ok: true },
  { id: 558, was: "d'Alba Waterfull Essence SPF50", ga: '19000076478-waterfull-essence-sun-cream-spf-50-pa', ok: true },
  { id: 559, was: 'LRP UVMune 400 Fluid',           ga: '19000237061-with-mexoryl400', ok: true },
  { id: 560, was: 'SKIN1004 Centella SPF50',        ga: '19000137100-madagascar-centella-hyalu-cica-water-fit-sun-serum', ok: true },
  { id: 561, was: 'Eucerin Oil Control SPF50+',     ga: '19000162322-sun-protection', ok: true },
  { id: 562, was: 'Bioderma Photoderm AKN Mat',     ga: '89270800002-photoderm-akn-mat-high-protection-matifying-fluid-spf30', ok: true },
  { id: 563, was: 'Some By Mi Truecica Mineral 50+', ga: '19760303646-truecica-mineral-100-calming-suncream', ok: true },
  { id: 564, was: 'Bioderma Photoderm AR SPF50+',   ga: '89270800003-photoderm-ar-very-high', ok: true },
  { id: 565, was: 'LRP Anthelios Comfort',          ga: '89320900007-anthelios-xl', note: 'аналог: Anthelios молочко SPF50+' },
  // ── batch 7: masks, balms, lip, patches ──
  { id: 567, was: "L'Oreal Pure Clay Mask",         ga: '6025100005-pure-clay-mask', ok: true },
  { id: 568, was: 'LRP Effaclar Clay Mask',         ga: '89320200012-effaclar', ok: true },
  { id: 569, was: 'Laneige Sleeping Mask',          ga: '19000492192-laneige-water-sleeping', ok: true },
  { id: 573, was: 'Uriage Cica Balm',               ga: '19000021594-bariederm', note: 'аналог: Uriage Bariederm Cica' },
  { id: 576, was: 'Nuxe Reve de Miel Lip Balm',     ga: '89130400004-reve-de-miel', ok: true },
  { id: 577, was: 'Mixit Lip Balm',                 ga: '19000326972-lipstick-balm', note: 'слаг по review-SKU' },
  { id: 578, was: 'COSRX AC Collection Patches',    ga: '97560200044-ac-collection-acne-patch', ok: true },
  { id: 579, was: 'Medi-Peel Black Peptide Patches', ga: '19000261090-volume-lifting-eye-patch-pro', note: 'аналог: Medi-Peel lifting eye patch' },
  { id: 581, was: 'Mixit Pore Clay Mask',           ga: '30120900013-interstellar-mask', ok: true },
  // ── batch 7b: дубликаты ранее найденных + дермо-серии 624-642 ──
  { id: 626, was: 'LRP Effaclar Duo(+) M',          ga: '19000237056-effaclar', ok: true },
  { id: 628, was: 'LRP Lipikar Balm AP+M',          ga: '89321300011-lipik-baum', ok: true },
  { id: 629, was: 'Bioderma Atoderm Intensive Baume', ga: '89270100016-atoderm-intensive-baume-ultra-soothing-balm', ok: true },
  { id: 630, was: 'Eucerin AtopiControl Balm',      ga: '19000162323-atopi-control', ok: true },
  { id: 631, was: 'Avene Cicalfate крем',           ga: '89190600004-cicalfate', ok: true },
  { id: 632, was: 'LRP Mela B3 сыворотка',          ga: '19000275597-mela-b3', ok: true },
  { id: 633, was: 'Eucerin Anti-Pigment Serum',     ga: '19000162330-anti-pigment', ok: true },
  { id: 634, was: 'Bioderma Photoderm AR крем SPF50', ga: '89270800003-photoderm-ar-very-high', ok: true },
  { id: 636, was: 'Vichy Liftactiv Supreme',        ga: '89311000001-liftactiv-supreme', ok: true },
  { id: 638, was: 'LRP Effaclar Gel очищающий',     ga: '89320200010-gel-mous', ok: true },
  { id: 639, was: 'Bioderma Sebium Gel',            ga: '89270200005-sebium-purifying-cleansing-foaming-gel', ok: true },
  { id: 642, was: 'LRP Anthelios SPF50',            ga: '19000040881-anthelios', ok: true },
  // ── batch 8: финал (дермо-серии + RU SPF) ──
  { id: 574, was: 'LRP Cicaplast Baume B5',         ga: '19000126618-cicaplast-b5', ok: true },
  { id: 637, was: 'Eucerin Hyaluron-Filler Serum',  ga: '19000162350-hyaluron-filler', ok: true },
  { id: 640, was: 'Avene Cleanance Gel',            ga: '89191000004-cleanance', ok: true },
  { id: 643, was: 'Avene Very High Protection SPF50', ga: '89191800010-sun', ok: true },
  { id: 644, was: 'Topicrem Solaire Milk SPF50',    ga: '19000291202-sun-protect', note: 'Topicrem Sun Protect' },
  { id: 645, was: 'Natura Siberica SPF30',          ga: '19000003671-lab-biome', note: 'аналог: Natura Siberica LAB Biome SPF50 (SPF30 нет)' },
];

async function main() {
  const apply = process.argv.includes('--apply');
  console.log(apply ? '=== APPLY ===' : '=== DRY-RUN ===');
  let upd = 0, skip = 0;
  for (const m of MAP) {
    if (!m.ga) { console.log(`SKIP #${m.id} ${m.was} — ${m.note ?? ''}`); skip++; continue; }
    const p = await prisma.product.findUnique({ where: { id: m.id }, select: { id: true, name: true, link: true } });
    if (!p) { console.log(`MISS #${m.id}`); skip++; continue; }
    if (p.link) { console.log(`HAS  #${m.id} ${p.name} — уже есть link, пропускаю`); skip++; continue; }
    const url = GA + m.ga;
    console.log(`${m.ok ? 'SET ' : 'SET?'} #${m.id} ${p.name}\n       → ${url}${m.note ? `  [${m.note}]` : ''}`);
    if (apply) await prisma.product.update({ where: { id: m.id }, data: { link: url } });
    upd++;
  }
  console.log(`\nИтого: ${upd} к записи, ${skip} пропущено.`);
  if (!apply) console.log('dry-run — для записи добавь --apply');
  process.exit(0);
}
main();
