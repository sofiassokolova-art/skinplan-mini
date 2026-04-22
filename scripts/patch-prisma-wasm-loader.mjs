/**
 * Патч для Prisma WASM loader — base64 подход для Cloudflare Workers.
 *
 * Проблема: wasm-worker-loader.mjs делает `import('./query_engine_bg.wasm')`
 * который не работает в CF Workers через @opennextjs/cloudflare, вызывая fallback
 * к fs.readdir (не реализован в unenv).
 *
 * Решение: заменить loader на версию которая импортирует WASM как base64 строку
 * из @prisma/client/runtime/query_engine_bg.postgresql.wasm-base64.mjs
 * и компилирует его через WebAssembly.compile() — работает нативно в CF Workers.
 *
 * ВАЖНО: webpack алиасы в next.config.mjs направляют все non-postgresql WASM
 * на postgresql, предотвращая бандлинг 5× копий (14.5 МБ → 2.9 МБ).
 *
 * Запускать ПОСЛЕ prisma generate, ДО next build.
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

// Loader использует base64-encoded WASM вместо import('.wasm')
// Формат возврата: Promise<{ default: WebAssembly.Module }> — как ожидает Prisma
const patchedContent = `/* patched by scripts/patch-prisma-wasm-loader.mjs for Cloudflare Workers */
/* Original: export default import('./query_engine_bg.wasm') */
/* Uses base64-encoded WASM to avoid fs.readdir in CF Workers unenv */
import { wasm as wasmBase64 } from '@prisma/client/runtime/query_engine_bg.postgresql.wasm-base64.mjs';
const bytes = Uint8Array.from(atob(wasmBase64), (c) => c.charCodeAt(0));
export default WebAssembly.compile(bytes).then((mod) => ({ default: mod }));
`;

writeFileSync(loaderPath, patchedContent, 'utf8');
console.log('✅ Patched Prisma WASM loader for Cloudflare Workers (base64 approach)');
