// app/layout.tsx
// Root layout для Next.js приложения

import type { Metadata, Viewport } from 'next';
import { headers } from 'next/headers';
import Script from 'next/script';
import { Analytics } from '@vercel/analytics/react';
import localFont from 'next/font/local';
import './globals.css';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { WebVitalsTracker } from './(miniapp)/components/WebVitals';
import { Toaster } from '@/components/Toaster';
import { GlobalErrorHandler } from '@/components/GlobalErrorHandler';
import { ServiceWorker } from '@/components/ServiceWorker';
import { TelegramScript } from '@/components/TelegramScript';

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

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const isDev = process.env.NODE_ENV === 'development';
  const headersList = await headers();
  const pathname = headersList.get('x-pathname') ?? '';
  const isAdminRoute = pathname.startsWith('/admin');

  return (
    <html 
      lang="ru" 
      className={`${unbounded.variable} ${inter.variable}`}
      suppressHydrationWarning
    >
      <head>
        {/* На мобильном Telegram передаёт initData в hash (#tgWebAppData=...). Парсим и сохраняем в sessionStorage. Stub-объект WebApp создаётся только для данных, ready() НЕ подменяем — его должен вызвать настоящий SDK. */}
        {!isAdminRoute && (
          <Script id="telegram-hash-fallback" strategy="beforeInteractive">
            {`
(function(){
  if (typeof window === 'undefined') return;

  var initData = '';

  // 1. Пробуем hash
  var h = window.location.hash.slice(1);
  if (h) {
    try {
      var p = new URLSearchParams(h);
      var raw = p.get('tgWebAppData');
      if (raw) initData = decodeURIComponent(raw);
    } catch (_) {}
  }

  // 2. Fallback — sessionStorage (после редиректа hash теряется)
  if (!initData) {
    try { initData = sessionStorage.getItem('tg_init_data') || ''; } catch (_) {}
  }

  if (!initData) return;

  // Сохраняем/обновляем в sessionStorage
  try { sessionStorage.setItem('tg_init_data', initData); } catch (_) {}

  if (!window.Telegram) window.Telegram = {};
  if (!window.Telegram.WebApp || !window.Telegram.WebApp.initData) {
    var w = window.Telegram.WebApp = window.Telegram.WebApp || {};
    w.initData = initData;
    w.initDataUnsafe = w.initDataUnsafe || {};
    try {
      var userMatch = initData.match(/user=([^&]+)/);
      if (userMatch) w.initDataUnsafe.user = JSON.parse(decodeURIComponent(userMatch[1]));
    } catch (_) {}
    w.ready = w.ready || function(){};
    w.expand = w.expand || function(){};
    w.close = w.close || function(){};
    w.sendData = w.sendData || function(){};
    w.showPopup = w.showPopup || function(){};
    w.openLink = w.openLink || function(url){ window.open(url); };
    w.openTelegramLink = w.openTelegramLink || function(url){ window.open(url); };
  }
})();
            `}
          </Script>
        )}
        {/* Telegram WebApp: после первого рендера, чтобы в WebView не зависало на загрузке telegram.org */}
        {!isAdminRoute && <TelegramScript />}
        {/* DEV-режим: мок Telegram WebApp для локального браузера (не на /admin) */}
        {isDev && !isAdminRoute && (
          <Script id="telegram-dev-mock" strategy="beforeInteractive">
            {`
              (function () {
                if (typeof window === 'undefined') return;
                if (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.initData) return;

                var host = window.location.hostname;
                if (host !== 'localhost' && host !== '127.0.0.1') return;

                var TEST_TELEGRAM_ID = '987654321';
                var authDate = Math.floor(Date.now() / 1000);
                var testInitData = 'user=%7B%22id%22%3A' + TEST_TELEGRAM_ID + '%2C%22first_name%22%3A%22Test%22%2C%22last_name%22%3A%22User%22%2C%22username%22%3A%22testuser%22%2C%22language_code%22%3A%22ru%22%7D&auth_date=' + authDate + '&hash=test_hash_for_development_only';

                if (!window.Telegram) {
                  window.Telegram = { WebApp: null };
                }
                if (!window.Telegram.WebApp) {
                  window.Telegram.WebApp = {
                    initData: testInitData,
                    initDataUnsafe: {
                      user: {
                        id: parseInt(TEST_TELEGRAM_ID, 10),
                        first_name: 'Test',
                        last_name: 'User',
                        username: 'testuser',
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
                  if (!w.initData || w.initData === 'dev-init-data=1') {
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
                }

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
        {/* Лоадер при открытии — показываем ВСЕГДА (кроме /admin).
            React удалит его при монтировании через useRemoveRootLoading().
            Не зависим от process.env.VERCEL — Vercel build cache может не подставлять его. */}
        {!isAdminRoute && (
          <div
            id="root-loading"
            style={{
              position: 'fixed',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: '#FFFFFF',
              color: '#333',
              fontSize: 16,
              fontFamily: 'system-ui, sans-serif',
              zIndex: 99998,
            }}
          >
            Загрузка...
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
  var reloadKey = 'skinplan_chunk_reload_done_' + ('${process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA?.slice(0,8) || Date.now()}');
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
        {/* Контейнер для кнопки «Назад» — вне основного контента, чтобы position:fixed не ломался из‑за transform */}
        <div id="back-button-portal-root" />
        {/* Обёртка для React DevTools и селекторов: в App Router нет #__next по умолчанию */}
        <div id="__next">
          <ErrorBoundary>
            <GlobalErrorHandler />
            <WebVitalsTracker />
            <ServiceWorker />
            {children}
            <Toaster />
            <Analytics />
          </ErrorBoundary>
        </div>
      </body>
    </html>
  );
}
