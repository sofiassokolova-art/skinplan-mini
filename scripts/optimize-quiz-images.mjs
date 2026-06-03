/**
 * Оптимизация изображений анкеты (quiz) для быстрой загрузки в мини-аппе.
 *
 * Картинки в /public отдаются Cloudflare Workers Assets как есть (Next.js image
 * optimization выключен — `images.unoptimized: true`). Поэтому ужимаем исходники
 * до разумного 2x под реальный размер отображения и пережимаем webp.
 *
 *  - Отзывы (отзыв*): показываются ~в половину экрана → cap по ширине 500px
 *  - Тип кожи / цели (dry/normal/oily/wrinkles6/...): карточка-полоса → cap 900px
 *  - Онбординг (welcome/how-it-works): фон на весь экран → ширину не трогаем,
 *    только пережимаем
 *
 * Идемпотентно: повторный запуск не увеличивает размер (resize только вниз).
 * Запуск: `node scripts/optimize-quiz-images.mjs`
 */
import sharp from 'sharp';
import { readFileSync, writeFileSync, statSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const PUBLIC = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');

// [файл, capWidth | null (не ресайзить, только пережать), quality]
const PLAN = [
  ['отзыв1до.webp', 500, 80],
  ['отзыв1после.webp', 500, 80],
  ['отзыв4до.webp', 500, 80],
  ['отзыв4после.webp', 500, 80],

  ['dry.webp', 900, 80],
  ['dry (combi).webp', 900, 80],
  ['normal.webp', 900, 80],
  ['oily (combi).webp', 900, 80],
  ['oily.webp', 900, 80],

  ['wrinkles6.webp', 900, 80],
  ['acne6.webp', 900, 80],
  ['pores6.webp', 900, 80],
  ['puff6.webp', 900, 80],
  ['pigmentation6.webp', 900, 80],
  ['tone6.webp', 900, 80],

  ['onboarding/welcome.webp', null, 82],
  ['onboarding/how-it-works.webp', null, 82],
];

let totalBefore = 0;
let totalAfter = 0;

for (const [file, cap, quality] of PLAN) {
  const path = join(PUBLIC, file);
  const before = statSync(path).size;
  const input = readFileSync(path);
  const meta = await sharp(input).metadata();

  let pipeline = sharp(input);
  if (cap && meta.width > cap) {
    pipeline = pipeline.resize({ width: cap, withoutEnlargement: true });
  }
  const output = await pipeline.webp({ quality, effort: 6 }).toBuffer();

  // Не записываем, если стало больше (идемпотентность / защита от деградации)
  if (output.length < before) {
    writeFileSync(path, output);
  }
  const after = Math.min(output.length, before);

  totalBefore += before;
  totalAfter += after;
  const pct = Math.round((1 - after / before) * 100);
  const dims = cap && meta.width > cap ? `${meta.width}→${cap}px` : `${meta.width}px`;
  console.log(
    `${(before / 1024).toFixed(1).padStart(7)}KB → ${(after / 1024).toFixed(1).padStart(7)}KB  -${pct}%  ${dims}  ${file}`,
  );
}

console.log(
  `\nИтого: ${(totalBefore / 1024).toFixed(0)}KB → ${(totalAfter / 1024).toFixed(0)}KB  (-${Math.round((1 - totalAfter / totalBefore) * 100)}%)`,
);
