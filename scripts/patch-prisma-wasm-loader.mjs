/**
 * Патч для Prisma WASM loader — native .wasm подход для Cloudflare Workers.
 *
 * Проблема: wasm-worker-loader.mjs делает `import('./query_compiler_bg.wasm')`
 * что webpack пытается парсить как JS → "Module parse failed".
 *
 * Решение: webpackIgnore:true — webpack пропускает импорт полностью.
 * Затем esbuild (@opennextjs/cloudflare setWranglerExternal plugin) перехватывает
 * .wasm импорт, конвертирует relative→absolute путь и помечает как external.
 * Wrangler загружает WASM отдельно как CompiledWasm — не входит в 3 МБ JS-лимит.
 *
 * Цепочка: webpack (игнорирует) → esbuild/setWranglerExternal (external) → wrangler (CompiledWasm)
 *
 * Запускать ПОСЛЕ prisma generate, ДО next build.
 */

import { writeFileSync, existsSync } from 'fs';
import { resolve, dirname, basename } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '..');

const loaderPath = resolve(projectRoot, 'node_modules/.prisma/client/wasm-worker-loader.mjs');

if (!existsSync(loaderPath)) {
  console.error('❌ wasm-worker-loader.mjs not found — run prisma generate first');
  process.exit(1);
}

// Абсолютный путь к WASM бинарю — вычисляется здесь, при патче.
// esbuild resolve(dirname(importer), absPath) = absPath (абсолютный путь остаётся абсолютным).
// Wrangler затем включает WASM как CompiledWasm через [[rules]] в wrangler.toml.
const wasmCandidates = [
  'query_compiler_bg.wasm',
  'query_engine_bg.wasm',
];
const wasmBinaryPath = wasmCandidates
  .map((fileName) => resolve(projectRoot, 'node_modules/.prisma/client', fileName))
  .find((path) => existsSync(path));

if (!wasmBinaryPath) {
  console.error('❌ Prisma WASM binary not found — run prisma generate first');
  process.exit(1);
}

// /* webpackIgnore: true */ — webpack полностью пропускает этот импорт.
// Динамический импорт возвращает Promise<{ default: WebAssembly.Module }> — именно то, что ждёт Prisma.
// esbuild (OpenNext setWranglerExternal) перехватывает .wasm импорт:
//   onResolve filter=/(\.bin|\.wasm)$/ → path=absPath, external=true
// Wrangler подхватывает через [[rules]] type="CompiledWasm" globs=["**/*.wasm"].
const patchedContent = `/* patched by scripts/patch-prisma-wasm-loader.mjs for Cloudflare Workers */
/* webpack: ignored via webpackIgnore → esbuild: external → wrangler: CompiledWasm */
export default import(/* webpackIgnore: true */ ${JSON.stringify(wasmBinaryPath)});
`;

writeFileSync(loaderPath, patchedContent, 'utf8');
console.log('✅ Patched Prisma WASM loader: webpackIgnore + absolute path → wrangler CompiledWasm');
console.log('   WASM file:', basename(wasmBinaryPath));
console.log('   WASM path:', wasmBinaryPath);
