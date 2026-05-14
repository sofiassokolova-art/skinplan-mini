/**
 * Telegram WebApp SDK + синхронная инициализация.
 *
 * Рендерим обычные <script>-теги (без next/script), потому что:
 * 1) оба тега должны быть в <head> и исполниться синхронно ДО гидрации React,
 *    чтобы WebApp.ready() закрыл системный Telegram-лоадер до старта основного JS;
 * 2) обёртка next/script для beforeInteractive добавляет лишние байты в worker
 *    bundle, а мы упираемся в лимит CF Workers (3 MiB gzipped).
 *
 * Порядок исполнения важен: hash-fallback (в app/layout.tsx) → SDK → init.
 * Все три скрипта в <head> идут sync, исполняются в порядке вставки.
 */
const INIT_JS = `(function(){function f(){try{var w=window.Telegram&&window.Telegram.WebApp;if(w){w.ready&&w.ready();w.expand&&w.expand();w.initData&&sessionStorage.setItem('tg_init_data',w.initData)}}catch(_){}try{window.dispatchEvent(new Event('telegram-webapp-ready'))}catch(_){}}window.Telegram&&window.Telegram.WebApp?f():setTimeout(f,1500)})()`;

export function TelegramScript() {
  return (
    <>
      <script src="https://telegram.org/js/telegram-web-app.js" />
      <script dangerouslySetInnerHTML={{ __html: INIT_JS }} />
    </>
  );
}
