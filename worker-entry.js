// worker-entry.js
// Коммитнутый Cloudflare Worker entrypoint, который оборачивает сгенерированный
// OpenNext worker (.open-next/worker.js) и буферизует HTML-ответы.
//
// Зачем: CF Workers + Next.js RSC/SSR иногда отдают HTML как ReadableStream и не
// посылают HTTP/2 END_STREAM → Telegram WebView держит соединение открытым →
// `load` у telegram-web-app.js не стреляет → ready() не вызывается → системный
// лоадер Telegram висит вечно, а сам HTML доходит обрезанным (~20КБ из ~32КБ).
//
// Фикс: буферизуем тело HTML-ответа в ArrayBuffer. Полный ArrayBuffer (в отличие
// от ReadableStream) сигнализирует CF о завершённости тела → END_STREAM
// отправляется гарантированно, ответ доходит целиком.
//
// Раньше тем же занимался post-build патч scripts/patch-worker-buffer-response.mjs,
// но это отдельный шаг сборки, который пропускался в Cloudflare Workers Builds
// (в живом деплое ответы по-прежнему обрывались). Здесь обёртка — это сам
// wrangler entrypoint (main), поэтому она применяется на КАЖДОМ `wrangler deploy`,
// независимо от команды сборки в дашборде CF.

// .open-next/worker.js генерируется во время `opennextjs-cloudflare build`.
import worker, {
  DOQueueHandler,
  DOShardedTagCache,
  BucketCachePurge,
} from './.open-next/worker.js';

// Re-export Durable Object классов OpenNext (на случай биндингов в wrangler.toml).
export { DOQueueHandler, DOShardedTagCache, BucketCachePurge };

export default {
  ...worker,
  async fetch(request, env, ctx) {
    const resp = await worker.fetch(request, env, ctx);
    const contentType = resp.headers.get('content-type') || '';
    const isHtml =
      contentType.includes('text/html') || contentType.includes('application/xhtml');
    if (!isHtml || !resp.body) return resp;

    // Буферизуем тело целиком → CF гарантированно закрывает поток (END_STREAM).
    const buffered = await resp.arrayBuffer();
    const headers = new Headers(resp.headers);
    // content-length проставит сам CF после (опционального) сжатия по Accept-Encoding;
    // явный content-length ломает CF compression и может вызвать двойное сжатие.
    headers.delete('content-length');
    headers.delete('transfer-encoding');
    return new Response(buffered, {
      status: resp.status,
      statusText: resp.statusText,
      headers,
    });
  },
};
