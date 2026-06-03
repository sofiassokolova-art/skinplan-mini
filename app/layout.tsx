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
        {/* Preload SDK параллельно с Next.js бандлом — скачивание стартует
            при парсинге <head>, до того как beforeInteractive запустится.
            Когда appendChid(s) выполняется в beforeInteractive, SDK уже
            в кеше браузера → onload стреляет сразу → ready() намного раньше.
            БЕЗ crossOrigin: динамический <script> ниже создаётся без
            crossOrigin → match → preload реально переиспользуется. */}
        {!isAdminRoute && (
          <link
            rel="preload"
            href="https://telegram.org/js/telegram-web-app.js"
            as="script"
          />
        )}
        {/* Preload картинки первого info-экрана:
            до этого фоновая картинка грузилась после рендера → контент
            на экране появлялся "по очереди" (контейнер + потом картинка хлоп).
            Второй экран грузится после старта приложения, чтобы не конкурировать
            с bootstrap-чанками за канал пользователя.
            Иконки списка оптимизированы (64×64 PNG вместо 880×880 JPEG-as-PNG)
            — экономия ~258KB (с 277KB до 19KB суммарно). */}
        {!isAdminRoute && (
          <>
            <link rel="preload" href="/onboarding/welcome.webp" as="image" fetchPriority="high" />
            <link rel="preload" href="/icons/detailed_3_64.png" as="image" />
            <link rel="preload" href="/icons/hydration_3_64.png" as="image" />
            <link rel="preload" href="/icons/face_3_64.png" as="image" />
          </>
        )}
        {/* Загружаем SDK до React: Telegram system loader должен закрыться,
            даже если загрузка чанков приложения задержалась. */}
        {!isAdminRoute && (
          <script
            dangerouslySetInnerHTML={{ __html: `(function(){
  if (typeof window === 'undefined') return;
  var startup = window.__skiniq_startup_timing = window.__skiniq_startup_timing || {
    startedAtEpochMs: Date.now(),
    marks: {},
    reported: false,
    reports: {}
  };
  function markStartup(name, context) {
    if (!startup.marks[name]) {
      startup.marks[name] = {
        atMs: Math.round(performance.now()),
        context: context || null
      };
    }
  }
  function reportStartup(reason, force) {
    startup.reports = startup.reports || {};
    if (startup.reports[reason]) return;
    if (startup.reported && !force) return;
    startup.reports[reason] = true;
    if (!force) startup.reported = true;
    try {
      var connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
      var initData = '';
      try {
        initData = (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.initData) ||
          sessionStorage.getItem('tg_init_data') || '';
      } catch (_) {}
      fetch('/api/logs', {
        method: 'POST',
        headers: Object.assign(
          { 'Content-Type': 'application/json' },
          initData ? { 'X-Telegram-Init-Data': initData } : {}
        ),
        body: JSON.stringify({
          level: 'info',
          message: 'Mini App startup timing',
          context: {
            type: 'startup_timing',
            reason: reason,
            startedAtEpochMs: startup.startedAtEpochMs,
            marks: startup.marks,
            connection: connection ? {
              effectiveType: connection.effectiveType,
              downlink: connection.downlink,
              rtt: connection.rtt,
              saveData: connection.saveData
            } : null
          },
          url: window.location.href,
          userAgent: navigator.userAgent
        }),
        keepalive: true
      }).catch(function(){});
    } catch (_) {}
  }
  window.__skiniqMarkStartup = markStartup;
  window.__skiniqReportStartup = reportStartup;
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function(){ markStartup('htmlParsed'); }, { once: true });
  } else {
    markStartup('htmlParsed');
  }
  markStartup('bootstrapScriptStarted');
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
    markStartup('telegramSdkReady', {
      hasTelegramWebApp: !!(window.Telegram && window.Telegram.WebApp),
      hasInitData: !!(window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.initData)
    });
    try { window.dispatchEvent(new Event('telegram-webapp-ready')); } catch (_) {}
  }
  try {
    var waEarly = window.Telegram && window.Telegram.WebApp;
    if (waEarly && typeof waEarly.ready === 'function') { done(); return; }
  } catch (_) {}
  var telegramSdkFinished = false;
  var s = document.createElement('script');
  s.src = 'https://telegram.org/js/telegram-web-app.js';
  s.async = true;
  s.onload = function(){
    telegramSdkFinished = true;
    done();
  };
  s.onerror = function(){
    telegramSdkFinished = true;
    markStartup('telegramSdkError');
    reportStartup('telegram-sdk-error', true);
    try { window.dispatchEvent(new Event('telegram-webapp-ready')); } catch (_) {}
  };
  document.head.appendChild(s);
  setTimeout(function(){
    if (telegramSdkFinished) return;
    try {
      var waLate = window.Telegram && window.Telegram.WebApp;
      if (waLate && typeof waLate.ready === 'function') {
        telegramSdkFinished = true;
        done();
        return;
      }
    } catch (_) {}
    telegramSdkFinished = true;
    markStartup('telegramSdkTimeout', { src: s.src });
    reportStartup('telegram-sdk-timeout', true);
    try { window.dispatchEvent(new Event('telegram-webapp-ready')); } catch (_) {}
  }, 5000);
})();` }}
          />
        )}
        {/* DEV-режим: мок Telegram WebApp для локального браузера (не на /admin) */}
        {isDev && !isAdminRoute && (
          <Script
            id="telegram-dev-mock"
            strategy="afterInteractive"
          >
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
                try { window.dispatchEvent(new Event('telegram-webapp-ready')); } catch (_) {}
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
              backgroundColor: '#F4F2EE',
              zIndex: 99998,
            }}
          >
            {/* Лаймовая дуга вращается по тёмному кольцу — брендированный fallback до React. */}
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: '50%',
                border: '5px solid rgba(10, 10, 10, 0.16)',
                borderTopColor: '#D5FE61',
                animation: 'skinplan-root-loader-spin 0.9s linear infinite',
              }}
            />
            <style
              dangerouslySetInnerHTML={{
                __html: `@keyframes skinplan-root-loader-spin { to { transform: rotate(360deg); } }`,
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
  function buildReloadKey(){
    try {
      var assets = [];
      var nodes = document.querySelectorAll('script[src*="/_next/static/"],link[href*="/_next/static/"]');
      for (var i = 0; i < nodes.length; i++) {
        var url = nodes[i].src || nodes[i].href || '';
        if (url) assets.push(url.replace(window.location.origin, ''));
      }
      assets.sort();
      var seed = assets.join('|') || 'no-next-assets';
      var hash = 0;
      for (var j = 0; j < seed.length; j++) {
        hash = ((hash * 31) + seed.charCodeAt(j)) >>> 0;
      }
      return 'skinplan_chunk_reload_done_' + hash.toString(36);
    } catch (err) {
      return 'skinplan_chunk_reload_done_static_v2';
    }
  }
  var reloadKey = buildReloadKey();
  window.__skiniq_mounted = false;
  function showFallback(){
    var e = document.getElementById("loading-timeout-fallback");
    if (e && e.style.display !== "block") {
      e.style.cssText = fallbackCss;
      e.innerHTML = fallbackHtml;
      if (window.__skiniqMarkStartup) window.__skiniqMarkStartup("chunkTimeout");
      if (window.__skiniqReportStartup) window.__skiniqReportStartup("chunk-timeout");
    }
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
  // Этот script исполняется до разметки #__next ниже по документу.
  // Скрывать loader можно только после реального React mount из miniapp layout.
  setTimeout(function(){
    if (!window.__skiniq_mounted) showFallback();
  }, 8000);
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
            {/* <Analytics /> */}
          </ErrorBoundary>
        </div>
      </body>
    </html>
  );
}
