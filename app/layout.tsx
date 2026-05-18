// app/layout.tsx
// Root layout для Next.js приложения

import type { Metadata, Viewport } from 'next';
import { headers } from 'next/headers';
import Script from 'next/script';
import localFont from 'next/font/local';
import './globals.css';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { WebVitalsTracker } from './(miniapp)/components/WebVitals';
import { Toaster } from '@/components/Toaster';
import { GlobalErrorHandler } from '@/components/GlobalErrorHandler';
import { ServiceWorker } from '@/components/ServiceWorker';

// Загружаем шрифты локально из public/fonts
// Файлы шрифтов загружены в public/fonts/
// ИСПРАВЛЕНО: Используем относительный путь от корня проекта
const unbounded = localFont({
  src: [
    {
      path: '../public/fonts/unbounded-regular.ttf',
      weight: '400',
      style: 'normal',
    },
    {
      path: '../public/fonts/unbounded-bold.ttf',
      weight: '700',
      style: 'normal',
    },
  ],
  variable: '--font-unbounded',
  display: 'swap',
  preload: false, // отключаем HTTP/2 preload push — обрывает соединение на кастомном домене
  fallback: ['-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
  adjustFontFallback: false,
});

// Inter: только основные начертания, чтобы меньше запросов к статике (особенно на кастомном домене)
const inter = localFont({
  src: [
    { path: '../public/fonts/inter-regular.ttf', weight: '400', style: 'normal' },
    { path: '../public/fonts/inter-semibold.ttf', weight: '600', style: 'normal' },
    { path: '../public/fonts/inter-bold.ttf', weight: '700', style: 'normal' },
  ],
  variable: '--font-inter',
  display: 'swap',
  preload: false, // отключаем HTTP/2 preload push — обрывает соединение на кастомном домене
  fallback: ['-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
  adjustFontFallback: false,
});

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
};

export const metadata: Metadata = {
  title: 'SkinIQ - Умный уход за кожей',
  description: 'Персонализированный план ухода за кожей на основе анкеты',
  icons: { icon: '/icons/icon_sparkles.svg', apple: '/icons/icon_sparkles.svg' },
};

const DEV_TELEGRAM_ID = process.env.NEXT_PUBLIC_DEV_TELEGRAM_ID || '987654322';

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const isDev = process.env.NODE_ENV === 'development';
  const headersList = await headers();
  const pathname = (headersList as any).get?.('x-pathname') ?? '';
  const isAdminRoute = pathname.startsWith('/admin');

  return (
    <html 
      lang="ru" 
      className={`${unbounded.variable} ${inter.variable}`}
      suppressHydrationWarning
    >
      <head>
        {/* Telegram SDK + init через next/script beforeInteractive.
            Plain <script dangerouslySetInnerHTML> в head ломал гидрацию
            React 19 — миниапка падала в белый экран (никакие useEffect
            не запускались). Возвращаемся к проверенной обёртке next/script.

            Минус: код кладётся в __next_s очередь и исполняется чуть позже
            (после загрузки основного JS) — на медленном Telegram WebView
            системный лоадер может задержаться лишние пол-секунды. Это
            приемлемее, чем поломанная гидрация. */}
        {!isAdminRoute && (
          <Script id="telegram-hash-fallback" strategy="beforeInteractive">
            {`
(function(){
  if (typeof window === 'undefined') return;
  try {
    var h = window.location.hash.slice(1);
    if (h) {
      var raw = new URLSearchParams(h).get('tgWebAppData');
      if (raw) sessionStorage.setItem('tg_init_data', decodeURIComponent(raw));
    }
  } catch (_) {}

  function done(){
    try {
      var wa = window.Telegram && window.Telegram.WebApp;
      if (wa) {
        if (typeof wa.ready === 'function') wa.ready();
        if (typeof wa.expand === 'function') wa.expand();
        if (wa.initData) {
          try { sessionStorage.setItem('tg_init_data', wa.initData); } catch (_) {}
        }
      }
    } catch (_) {}
    try { window.dispatchEvent(new Event('telegram-webapp-ready')); } catch (_) {}
  }

  // Telegram pre-injects the SDK into WebView before the page loads.
  // In that case the early body <script> already called ready(); we just
  // confirm state here without a redundant network request.
  if (window.Telegram && window.Telegram.WebApp) {
    done();
    return;
  }

  // Fallback for non-Telegram contexts: load SDK dynamically.
  var s = document.createElement('script');
  s.src = 'https://telegram.org/js/telegram-web-app.js';
  s.onload = done;
  s.onerror = function(){
    try { window.dispatchEvent(new Event('telegram-webapp-ready')); } catch (_) {}
  };
  document.head.appendChild(s);
})();
            `}
          </Script>
        )}
        {/* DEV-режим: мок Telegram WebApp для локального браузера (не на /admin) */}
        {isDev && !isAdminRoute && (
          <Script id="telegram-dev-mock" strategy="beforeInteractive">
            {`
              (function () {
                if (typeof window === 'undefined') return;
                var host = window.location.hostname;
                if (host !== 'localhost' && host !== '127.0.0.1') return;

                // В dev на localhost всегда используем нашего тестового пользователя (перезаписываем старый tg_init_data)
                try { sessionStorage.removeItem('tg_init_data'); } catch (_) {}

                // Локальный dev-пользователь Telegram — ID берём из NEXT_PUBLIC_DEV_TELEGRAM_ID (fallback: 987654322)
                var TEST_TELEGRAM_ID = '${DEV_TELEGRAM_ID}';
                var authDate = Math.floor(Date.now() / 1000);
                var testInitData = 'user=%7B%22id%22%3A' + TEST_TELEGRAM_ID + '%2C%22first_name%22%3A%22Local%22%2C%22last_name%22%3A%22User2%22%2C%22username%22%3A%22local_test_user_2%22%2C%22language_code%22%3A%22ru%22%7D&auth_date=' + authDate + '&hash=test_hash_for_development_only';

                if (!window.Telegram) {
                  window.Telegram = { WebApp: null };
                }
                if (!window.Telegram.WebApp) {
                  window.Telegram.WebApp = {
                    initData: testInitData,
                    initDataUnsafe: {
                      user: {
                        id: parseInt(TEST_TELEGRAM_ID, 10),
                        first_name: 'Local',
                        last_name: 'User2',
                        username: 'local_test_user_2',
                        language_code: 'ru',
                      },
                    },
                    ready: function () { console.log('[DEV TG] ready()'); },
                    expand: function () { console.log('[DEV TG] expand()'); },
                    close: function () { console.log('[DEV TG] close()'); },
                    sendData: function (data) { console.log('[DEV TG] sendData:', data); },
                    showPopup: function (params) { console.log('[DEV TG] showPopup:', params); },
                    openLink: function (url) { window.open(url, '_blank'); },
                    openTelegramLink: function (url) { window.open(url, '_blank'); },
                  };
                } else {
                  var w = window.Telegram.WebApp;
                  try {
                    w.initData = testInitData;
                  } catch (e) {
                    try {
                      Object.defineProperty(w, 'initData', { value: testInitData, writable: true });
                    } catch (e2) {}
                  }
                  if (w.initDataUnsafe && w.initDataUnsafe.user) {
                    w.initDataUnsafe.user.id = parseInt(TEST_TELEGRAM_ID, 10);
                  }
                }
                try { sessionStorage.setItem('tg_init_data', testInitData); } catch (_) {}

                console.log('[DEV TG] Telegram WebApp mocked for local development (test initData)');
              })();
            `}
          </Script>
        )}
        {/* Шрифты Unbounded и Inter загружаются через next/font (см. импорты выше).
            Manrope / Space Grotesk для админки загружаются ТОЛЬКО в admin/layout.tsx.
            НЕ грузим Google Fonts в root layout — это render-blocking ресурс,
            который блокирует отрисовку в Telegram WebView (fonts.googleapis.com может быть недоступен). */}
      </head>
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          backgroundColor: '#FFFFFF',
        }}
      >
        {/* Earliest possible ready() — executes synchronously during HTML parse,
            before any JS bundle downloads. Telegram always pre-injects
            window.Telegram.WebApp into the WebView, so this dismisses the
            system loader immediately. No DOM changes → React 19 safe. */}
        {!isAdminRoute && (
          <script
            dangerouslySetInnerHTML={{
              __html: `(function(){try{var h=window.location.hash.slice(1);if(h){var raw=new URLSearchParams(h).get('tgWebAppData');if(raw)try{sessionStorage.setItem('tg_init_data',decodeURIComponent(raw))}catch(_){}}}catch(_){}try{var wa=window.Telegram&&window.Telegram.WebApp;if(wa){if(wa.initData)try{sessionStorage.setItem('tg_init_data',wa.initData)}catch(_){};if(typeof wa.ready==='function')wa.ready();if(typeof wa.expand==='function')wa.expand();try{window.dispatchEvent(new Event('telegram-webapp-ready'))}catch(_){}}}catch(_){}})();`,
            }}
          />
        )}
        {/* Контейнер для кнопки «Назад» — первый ребёнок body, блок 80×80 в углу */}
        <div
          id="back-button-fixed-container"
          aria-hidden="true"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: 80,
            height: 80,
            background: 'transparent',
            pointerEvents: 'none',
            zIndex: 99999,
          }}
        />
        {/* Лоадер при открытии — показываем ВСЕГДА (кроме /admin).
            React удалит его при монтировании через useRemoveRootLoading().
            Не зависим от process.env.VERCEL — Vercel build cache может не подставлять его. */}
        {!isAdminRoute && (
          <div
            id="root-loading"
            suppressHydrationWarning
            style={{
              position: 'fixed',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: '#FFFFFF',
              zIndex: 99998,
            }}
          >
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: '50%',
                border: '3px solid rgba(15, 23, 42, 0.12)',
                borderTopColor: '#111827',
                animation: 'spin 0.8s linear infinite',
              }}
            />
          </div>
        )}
        {/* При ошибке загрузки чанков или таймауте — показываем кнопку «Обновить» */}
        <div id="loading-timeout-fallback" style={{ display: 'none' }} />
        <script
          dangerouslySetInnerHTML={{
            __html: `
(function(){
  var fallbackCss = "display:block;position:fixed;bottom:24px;left:50%;transform:translateX(-50%);z-index:99999;padding:12px 20px;background:rgba(10,95,89,0.95);color:#fff;border-radius:12px;font-family:system-ui,sans-serif;font-size:14px;box-shadow:0 4px 20px rgba(0,0,0,0.2);";
  var fallbackHtml = 'Не удалось загрузить приложение. <a href="javascript:location.reload()" style="color:#fff;text-decoration:underline;font-weight:600">Обновить</a>';
  var reloadKey = 'skinplan_chunk_reload_done_' + ('${process.env.CF_PAGES_COMMIT_SHA?.slice(0,8) || Date.now()}');
  window.__skiniq_mounted = false;
  function showFallback(){
    var e = document.getElementById("loading-timeout-fallback");
    if (e && e.style.display !== "block") { e.style.cssText = fallbackCss; e.innerHTML = fallbackHtml; }
    try { var rl = document.getElementById("root-loading"); if (rl) rl.style.display = 'none'; } catch(_) {}
  }
  function tryReloadOnce(){
    try {
      if (!sessionStorage.getItem(reloadKey)) {
        sessionStorage.setItem(reloadKey, '1');
        location.reload();
        return;
      }
    } catch (err) {}
    showFallback();
  }
  window.addEventListener("error", function(ev){
    if (ev.message && (ev.message.indexOf("Loading chunk") !== -1 || ev.message.indexOf("ChunkLoadError") !== -1)) { tryReloadOnce(); return; }
    var t = ev.target;
    if (t && (t.tagName === "SCRIPT" || t.tagName === "LINK") && (t.src || t.href)) {
      var u = (t.src || t.href || "").toString();
      // Реагируем только на ошибки загрузки наших чанков, не внешних скриптов (аналитика, CDN)
      if (u.indexOf("/_next/") !== -1 || u.indexOf("chunks") !== -1) tryReloadOnce();
    }
  }, true);
  // Скрываем root-loading как только React отрендерил контент в #__next.
  // MutationObserver надёжнее чем __skiniq_mounted (который может не попасть в бандл).
  (function(){
    var rl = document.getElementById("root-loading");
    if (!rl) return;
    var next = document.getElementById("__next");
    if (!next) { rl.style.display = 'none'; return; }
    // Если контент уже есть — скрываем сразу
    if (next.children.length > 0) { rl.style.display = 'none'; return; }
    var obs = new MutationObserver(function(){
      if (next.children.length > 0) {
        rl.style.display = 'none';
        window.__skiniq_mounted = true;
        obs.disconnect();
      }
    });
    obs.observe(next, { childList: true, subtree: false });
    // Fallback: скрываем через 8с в любом случае
    setTimeout(function(){
      rl.style.display = 'none';
      obs.disconnect();
    }, 8000);
  })();
})();
            `.trim(),
          }}
        />
        {/* Показывается, если JS не загрузился (например, чанки не дошли) */}
        <noscript>
          <div style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
            backgroundColor: '#FFFFFF',
            color: '#333',
            fontFamily: 'system-ui, sans-serif',
            textAlign: 'center',
          }}>
            <div>
              <p style={{ fontSize: 18, marginBottom: 8 }}>SkinIQ</p>
              <p style={{ fontSize: 14, opacity: 0.9 }}>Включите JavaScript или обновите страницу.</p>
            </div>
          </div>
        </noscript>
        {/* Обёртка для React DevTools и селекторов: в App Router нет #__next по умолчанию */}
        <div id="__next">
          <div id="back-button-portal-root" />
          <ErrorBoundary>
            <GlobalErrorHandler />
            <WebVitalsTracker />
            <ServiceWorker />
            {children}
            <Toaster />
          </ErrorBoundary>
        </div>
      </body>
    </html>
  );
}
