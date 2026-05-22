// scripts/patch-worker-buffer-response.mjs
// Патчит .open-next/worker.js чтобы HTML SSR-ответы:
//   1) полностью буферизовались перед отправкой (CF Workers HTTP/2 стриминг
//      с RSC иногда не закрывает соединение → Telegram WebView висит на лоадере);
//   2) принудительно сжимались gzip в воркере, если клиент не запретил явно.
//
// Почему gzip в воркере, а не auto-CF: на каналах с агрессивным DPI (TSPU,
// российские middlebox-ы и т.п.) часть запросов приходит на воркер БЕЗ
// Accept-Encoding (заголовок стрипается ради инспекции). CF тогда не сжимает,
// раздаёт 24KB сырого HTML → DPI режет ответ ~на 20KB → клиент никогда не
// получает </body> → системный лоадер не уходит. Сжимая в воркере, мы отдаём
// 5-7KB на проводе — пролетает гарантированно.
//
// Сжимаем только когда заголовок Accept-Encoding либо отсутствует, либо
// явно содержит gzip. Все современные браузеры/вебвью gzip понимают
// (если он есть в Accept-Encoding или заголовок отсутствует — RFC 9110).

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

// v1 — старый патч (только буферизация). Если уже стоит — снимаем и накатываем v2.
// v2 — буферизация + worker-side gzip.
if (content.includes('// BUFFERED_RESPONSE_PATCH_v2')) {
  console.log('ℹ️  Worker already patched (v2), skipping');
  process.exit(0);
}

const v2Replacement = `// BUFFERED_RESPONSE_PATCH_v2
            const _resp = await handler(reqOrResp, env, ctx, request.signal);
            const _ct = _resp.headers.get('content-type') || '';
            const _isHtml = _ct.includes('text/html') || _ct.includes('application/xhtml');
            if (!_isHtml || !_resp.body) return _resp;
            // Буферизуем всё тело — гарантирует END_STREAM на HTTP/2.
            const _buf = await _resp.arrayBuffer();
            const _h = new Headers(_resp.headers);
            _h.append('vary', 'Accept-Encoding');
            // Принудительный gzip, если клиент не отрицает его явно. Покрывает
            // случай, когда middlebox срезал Accept-Encoding для DPI-инспекции:
            // без сжатия 24KB raw попадает под российский DPI ~20KB truncate.
            const _ae = (request.headers.get('accept-encoding') || '').toLowerCase();
            const _wantsGzip = !_ae || _ae.includes('gzip') || _ae.includes('*');
            if (_wantsGzip && _buf.byteLength > 1024) {
              try {
                const _gzStream = new Response(_buf).body.pipeThrough(new CompressionStream('gzip'));
                const _gzBuf = await new Response(_gzStream).arrayBuffer();
                _h.set('content-encoding', 'gzip');
                _h.set('content-length', String(_gzBuf.byteLength));
                return new Response(_gzBuf, { status: _resp.status, statusText: _resp.statusText, headers: _h });
              } catch (_e) {
                // CompressionStream недоступен / ошибка — fallback на сырое тело
              }
            }
            _h.set('content-length', String(_buf.byteLength));
            return new Response(_buf, { status: _resp.status, statusText: _resp.statusText, headers: _h });`;

// Если уже стоит v1 — заменяем его на v2. Иначе — ищем оригинальный handler-возврат.
let newContent;
if (content.includes('// BUFFERED_RESPONSE_PATCH_v1')) {
  // Старый v1-блок: от маркера до его последней строки с new Response
  // (надо сменить именно его, а не оригинальный handler-вызов).
  newContent = content.replace(
    /\/\/ BUFFERED_RESPONSE_PATCH_v1[\s\S]*?return new Response\(_buf, \{ status: _resp\.status, statusText: _resp\.statusText, headers: _h \}\);/,
    v2Replacement
  );
  if (newContent === content) {
    console.error('❌ Found v1 marker but failed to replace block — patch script needs update');
    process.exit(1);
  }
  writeFileSync(workerPath, newContent, 'utf8');
  console.log('✅ Upgraded .open-next/worker.js patch v1 → v2 (added worker-side gzip)');
} else {
  newContent = content.replace(
    /return handler\(reqOrResp, env, ctx, request\.signal\);/,
    v2Replacement
  );
  if (newContent === content) {
    console.error('❌ Patch target string not found in worker.js — OpenNext template may have changed');
    process.exit(1);
  }
  writeFileSync(workerPath, newContent, 'utf8');
  console.log('✅ Patched .open-next/worker.js to buffer + gzip HTML responses (v2)');
}
