// public/sw.js
// Service Worker для кеширования ресурсов и улучшения производительности

const CACHE_NAME = 'skinplan-mini-v2';
const STATIC_CACHE_NAME = 'skinplan-mini-static-v2';

// Не кэшируем HTML (/, /quiz и т.д.) — после деплоя нужен свежий HTML с новыми хэшами чанков.
// Иначе на кастомном домене пользователь получает старый HTML → 404 на чанки → «не удалось загрузить приложение».
const STATIC_ASSETS = [
  '/manifest.json',
  '/favicon.ico',
  '/quiz_welcome_image.png',
];

// Установка Service Worker
self.addEventListener('install', (event) => {
  console.log('Service Worker installing.');

  event.waitUntil(
    caches.open(STATIC_CACHE_NAME)
      .then((cache) => {
        console.log('Caching static assets...');
        // Cache assets individually to handle failures gracefully
        return Promise.allSettled(
          STATIC_ASSETS.map(url =>
            cache.add(url).catch(error => {
              console.warn(`Failed to cache ${url}:`, error);
              // Continue with other assets even if one fails
            })
          )
        );
      })
      .catch((error) => {
        console.error('Failed to open cache:', error);
      })
  );

  // Активировать немедленно
  self.skipWaiting();
});

// Активация Service Worker
self.addEventListener('activate', (event) => {
  console.log('Service Worker activating.');

  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== STATIC_CACHE_NAME && cacheName !== CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );

  // Захватить все клиенты
  self.clients.claim();
});

// Обработка запросов
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  if (event.request.url.includes('/api/') && !event.request.url.includes('/api/static/')) return;

  // Навигация (HTML) — всегда из сети, не из кэша. Иначе после деплоя отдаётся старый HTML → 404 на чанки.
  const isNavigation = event.request.mode === 'navigate' || event.request.destination === 'document';
  if (isNavigation) {
    event.respondWith(fetch(event.request));
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then((cachedResponse) => {
        if (cachedResponse) return cachedResponse;

        // Иначе делаем запрос к сети
        return fetch(event.request)
          .then((response) => {
            // Кешируем успешные GET запросы для статических ресурсов
            if (
              response.status === 200 &&
              (event.request.destination === 'script' ||
               event.request.destination === 'style' ||
               event.request.destination === 'font' ||
               event.request.destination === 'image' ||
               event.request.url.includes('.woff2') ||
               event.request.url.includes('.png') ||
               event.request.url.includes('.jpg') ||
               event.request.url.includes('.jpeg'))
            ) {
              const responseClone = response.clone();
              caches.open(CACHE_NAME)
                .then((cache) => {
                  cache.put(event.request, responseClone);
                });
            }

            return response;
          })
          .catch((error) => {
            console.error('Fetch failed:', error);
            // Для HTML страниц возвращаем offline страницу (если есть)
            if (event.request.destination === 'document') {
              return caches.match('/offline.html');
            }
            throw error;
          });
      })
  );
});

// Обработка сообщений от main thread
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});