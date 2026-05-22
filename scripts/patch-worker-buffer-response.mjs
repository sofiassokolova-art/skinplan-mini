// scripts/patch-worker-buffer-response.mjs
// Патчит .open-next/worker.js чтобы ответ HTML SSR полностью буферизовался
// перед отправкой. У CF Workers HTTP/2 стриминг с RSC иногда не закрывает
// соединение — Telegram WebView показывает endless loader.
//
// Воркер по-прежнему стримит на сервере, но мы перехватываем итоговый Response
// и заменяем его на новый с буферизованным body, что гарантирует END_STREAM
// и корректное закрытие соединения.

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const workerPath = resolve(__dirname, '..', '.open-next/worker.js');

if (!existsSync(workerPath)) {
  console.error('❌ .open-next/worker.js not found — run build first');
  process.exit(1);
}

const content = readFileSync(workerPath, 'utf8');

// Уже пропатчен?
if (content.includes('// BUFFERED_RESPONSE_PATCH_v1')) {
  console.log('ℹ️  Worker already patched, skipping');
  process.exit(0);
}

// Ищем тело handler-возврата handler(...) и оборачиваем в буферизацию
// для HTML-ответов (не для API/asset роутов).
const newContent = content.replace(
  /return handler\(reqOrResp, env, ctx, request\.signal\);/,
  `// BUFFERED_RESPONSE_PATCH_v1
            const _resp = await handler(reqOrResp, env, ctx, request.signal);
            const _ct = _resp.headers.get('content-type') || '';
            const _isHtml = _ct.includes('text/html') || _ct.includes('application/xhtml');
            if (!_isHtml || !_resp.body) return _resp;
            // Буферизуем весь body, ставим Content-Length — HTTP/2 корректно закрывает поток.
            const _buf = await _resp.arrayBuffer();
            const _h = new Headers(_resp.headers);
            _h.set('content-length', String(_buf.byteLength));
            return new Response(_buf, { status: _resp.status, statusText: _resp.statusText, headers: _h });`
);

if (newContent === content) {
  console.error('❌ Patch target string not found in worker.js — OpenNext template may have changed');
  process.exit(1);
}

writeFileSync(workerPath, newContent, 'utf8');
console.log('✅ Patched .open-next/worker.js to buffer HTML responses');
