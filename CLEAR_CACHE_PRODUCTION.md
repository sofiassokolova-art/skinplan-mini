# Очистка кэша на Production

## Способ 1: Через скрипт с production переменными окружения

### Шаги:

1. **Установите production переменные окружения:**
   ```bash
   export DATABASE_URL="your-production-database-url"
   export UPSTASH_REDIS_REST_URL="your-upstash-redis-url"
   export UPSTASH_REDIS_REST_TOKEN="your-upstash-redis-token"
   # или
   export KV_REST_API_URL="your-vercel-kv-url"
   export KV_REST_API_TOKEN="your-vercel-kv-token"
   ```

2. **Запустите скрипт:**
   ```bash
   npx tsx scripts/clear-cache-production.ts
   ```

3. **Проверьте результат:**
   Скрипт выведет информацию о том, что было очищено.

## Способ 2: Через API endpoint из приложения

1. Откройте приложение в Telegram
2. Откройте консоль разработчика (F12)
3. Выполните:
   ```javascript
   const initData = window.Telegram.WebApp.initData;
   fetch('/api/admin/clear-cache', {
     method: 'POST',
     headers: {
       'Content-Type': 'application/json',
       'X-Telegram-Init-Data': initData,
     },
   })
   .then(r => r.json())
   .then(console.log)
   .catch(console.error);
   ```

## Способ 3: Через Vercel Dashboard

1. Зайдите в Vercel Dashboard
2. Откройте ваш проект
3. Перейдите в Settings → Environment Variables
4. Убедитесь, что установлены:
   - `UPSTASH_REDIS_REST_URL`
   - `UPSTASH_REDIS_REST_TOKEN` (с правами записи!)
   - или `KV_REST_API_URL` и `KV_REST_API_TOKEN`

5. Запустите функцию очистки через Vercel CLI или через API

## Важно

- **Токен должен иметь права записи!** Если используется read-only токен, очистка кэша не сработает.
- План хранится в Redis/KV кэше, а не в базе данных.
- После очистки кэша план будет автоматически перегенерирован при следующем запросе к `/api/plan/generate`.
