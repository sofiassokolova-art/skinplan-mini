/**
 * Патч для Prisma WASM loader — нативный импорт для Cloudflare Workers.
 *
 * Проблема с base64 подходом: webpack включает 2.9 МБ base64 строку в JS бандл,
 * раздувая worker.js до >10 МБ и превышая лимиты CF Workers.
 *
 * Правильный подход: оставить нативный import('./query_engine_bg.wasm').
 * Wrangler обрабатывает .wasm файлы как отдельные WebAssembly модули,
 * которые НЕ учитываются в лимите размера JS скрипта.
 *
 * Бинарный WASM (2.2 МБ) в gzip ≈ 600-900 КБ — отлично вписывается в лимиты.
 */

import { writeFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '..');

const loaderPath = resolve(projectRoot, 'node_modules/.prisma/client/wasm-worker-loader.mjs');

if (!existsSync(loaderPath)) {
  console.error('❌ wasm-worker-loader.mjs not found — run prisma generate first');
  process.exit(1);
}

// Нативный импорт: wrangler обработает .wasm как WebAssembly.Module
// Формат: Promise<{ default: WebAssembly.Module }> — как ожидает Prisma
const patchedContent = `/* patched by scripts/patch-prisma-wasm-loader.mjs for Cloudflare Workers */
/* Uses native WASM import — wrangler bundles .wasm as WebAssembly.Module (not base64 JS) */
import wasm from './query_engine_bg.wasm';
export default Promise.resolve(wasm);
`;

writeFileSync(loaderPath, patchedContent, 'utf8');
console.log('✅ Patched Prisma WASM loader: native import (not base64)');
