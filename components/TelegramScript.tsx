import Script from 'next/script';

/**
 * Telegram WebApp SDK + синхронная инициализация.
 *
 * strategy="beforeInteractive" → Next.js рендерит <script> прямо в <head>
 * без async/defer. SDK успевает загрузиться и вызвать ready()/expand() ДО
 * старта гидрации React, поэтому системный лоадер Telegram скрывается
 * сразу после первого пейнта, а не через секунды.
 *
 * onLoad/onError с beforeInteractive не работают (тег рендерится серверно),
 * поэтому инициализация вынесена в отдельный inline-скрипт ниже по порядку:
 * sync-скрипты исполняются в порядке вставки, к моменту запуска init'а
 * window.Telegram.WebApp уже доступен.
 */
export function TelegramScript() {
  return (
    <>
      <Script
        src="https://telegram.org/js/telegram-web-app.js"
        strategy="beforeInteractive"
      />
      <Script id="telegram-webapp-init" strategy="beforeInteractive">
        {`
(function(){
  function dispatchReady(){
    try { window.dispatchEvent(new Event('telegram-webapp-ready')); } catch(_) {}
  }
  function init(){
    try {
      var wa = window.Telegram && window.Telegram.WebApp;
      if (wa) {
        if (typeof wa.ready === 'function') wa.ready();
        if (typeof wa.expand === 'function') wa.expand();
        if (wa.initData) {
          try { sessionStorage.setItem('tg_init_data', wa.initData); } catch(_) {}
        }
      }
    } catch(_) {}
    dispatchReady();
  }
  if (window.Telegram && window.Telegram.WebApp) {
    init();
  } else {
    // Fallback: SDK не загрузился (network error) — не оставляем приложение
    // в подвешенном состоянии, диспатчим событие, чтобы useTelegram
    // переключился на initData из hash/sessionStorage.
    setTimeout(init, 1500);
  }
})();
        `}
      </Script>
    </>
  );
}
