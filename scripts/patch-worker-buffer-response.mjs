// scripts/patch-worker-buffer-response.mjs
// Патчит .open-next/worker.js чтобы HTML SSR-ответы корректно закрывались.
//
// Проблема: CF Workers + Next.js App Router RSC streaming иногда не посылает
// HTTP/2 END_STREAM → Telegram WebView держит соединение открытым → `load`
// никогда не стреляет → браузер отменяет параллельные загрузки (SDK) →
// telegram-web-app.js.onload не вызывается → ready() не вызывается →
// системный лоадер Telegram висит вечно.
//
// Решение: буферизуем весь body в ArrayBuffer. Когда Worker возвращает
// ArrayBuffer (а не ReadableStream), CF Workers знает что тело полное и
// гарантированно посылает END_STREAM. content-length НЕ выставляем — пусть
// CF сам решает про сжатие (gzip/br по Accept-Encoding клиента). Явный
// content-length мешал CF compression и приводил к двойному сжатию.

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

// Уже пропатчен v1 или v2?
if (content.includes('// BUFFERED_RESPONSE_PATCH_v1') || content.includes('// BUFFERED_RESPONSE_PATCH_v2')) {
  console.log('ℹ️  Worker already patched, skipping');
  process.exit(0);
}

// Ищем тело handler-возврата handler(...) и оборачиваем в буферизацию
// для HTML-ответов (не для API/asset роутов).
const newContent = content.replace(
  /return handler\(reqOrResp, env, ctx, request\.signal\);/,
  `// BUFFERED_RESPONSE_PATCH_v2
            const _resp = await handler(reqOrResp, env, ctx, request.signal);
            const _ct = _resp.headers.get('content-type') || '';
            const _isHtml = _ct.includes('text/html') || _ct.includes('application/xhtml');
            if (!_isHtml || !_resp.body) return _resp;
            // Буферизуем всё тело. ArrayBuffer (в отличие от ReadableStream) сигнализирует
            // CF о конце тела → CF посылает END_STREAM. content-length НЕ проставляем:
            // CF сам вычислит его после (опционального) сжатия по Accept-Encoding клиента.
            // Явный content-length ломает CF compression и может вызвать двойное сжатие.
            const _buf = await _resp.arrayBuffer();
            const _h = new Headers(_resp.headers);
            _h.delete('content-length');
            _h.delete('transfer-encoding');
            return new Response(_buf, { status: _resp.status, statusText: _resp.statusText, headers: _h });`
);

if (newContent === content) {
  console.error('❌ Patch target string not found in worker.js — OpenNext template may have changed');
  process.exit(1);
}

writeFileSync(workerPath, newContent, 'utf8');
console.log('✅ Patched .open-next/worker.js: buffered ArrayBuffer, no content-length (v2)');
