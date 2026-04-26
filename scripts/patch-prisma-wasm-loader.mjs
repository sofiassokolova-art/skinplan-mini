/**
 * Патч для Prisma WASM loader — нативный импорт для Cloudflare Workers.
 *
 * Проблема с base64 подходом: webpack/esbuild включает ~3 МБ base64 строку в JS бандл,
 * раздувая handler.mjs до 14+ МБ и превышая лимит CF Workers (3 МБ для free tier).
 *
 * Правильный подход: нативный `import wasm from './query_engine_bg.wasm'`.
 *
 * Поток:
 *  1. webpack видит .wasm импорт → externals функция (next.config.mjs) возвращает
 *     `commonjs /absolute/path/query_engine_bg.wasm` → webpack НЕ парсит WASM файл,
 *     просто эмитит require('/abs/path/...wasm') в выходных чанках.
 *  2. OpenNext esbuild обрабатывает чанки → плагин setWranglerExternal перехватывает
 *     .wasm импорты, помечает как external с абсолютным путём.
 *  3. wrangler deploy: видит import .wasm, применяет [[rules]] CompiledWasm,
 *     загружает WASM как отдельный модуль (не считается в лимите JS 3 МБ).
 *  4. В CF Workers: импорт резолвится в WebAssembly.Module — именно это ожидает Prisma.
 *
 * Запускать ПОСЛЕ prisma generate, ДО next build (как часть build:cf).
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

// Абсолютный путь к WASM бинарю — вычисляется здесь, во время патча, чтобы esbuild
// мог резолвить его через setWranglerExternal (resolve(dirname(importer), absPath) = absPath).
const wasmBinaryPath = resolve(projectRoot, 'node_modules/.prisma/client/query_engine_bg.wasm');

if (!existsSync(wasmBinaryPath)) {
  console.error('❌ query_engine_bg.wasm not found — run prisma generate first');
  process.exit(1);
}

// /* webpackIgnore: true */ — webpack полностью пропускает этот импорт (не парсит .wasm как JS).
// esbuild (OpenNext setWranglerExternal) перехватывает .wasm импорт, помечает как external.
// wrangler загружает WASM отдельно как CompiledWasm (не входит в 3 МБ лимит JS).
// Динамический импорт возвращает Promise<{ default: WebAssembly.Module }> — именно то, что ждёт Prisma.
const patchedContent = `/* patched by scripts/patch-prisma-wasm-loader.mjs for Cloudflare Workers */
/* webpackIgnore: webpack skips this import entirely — no "Module parse failed" */
/* esbuild setWranglerExternal marks .wasm as external → wrangler CompiledWasm */
export default import(/* webpackIgnore: true */ ${JSON.stringify(wasmBinaryPath)});
`;

writeFileSync(loaderPath, patchedContent, 'utf8');
console.log('✅ Patched Prisma WASM loader: webpackIgnore + absolute path (CF Workers CompiledWasm)');
