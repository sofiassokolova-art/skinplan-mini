# Диагностика проблемы с записью логов в KV

## Возможные причины, почему логи перестали писаться в KV:

### 1. Переменные окружения не установлены в Vercel

**Проверка:**
- Зайдите в Vercel Dashboard → Ваш проект → Settings → Environment Variables
- Убедитесь, что установлены:
  - `KV_REST_API_URL` (или `UPSTASH_REDIS_REST_URL`)
  - `KV_REST_API_TOKEN` (или `UPSTASH_REDIS_REST_TOKEN`)

**Решение:**
- Если переменные отсутствуют, добавьте их из Upstash Dashboard
- После добавления переменных перезапустите деплоймент

### 2. Используется read-only токен вместо write токена

**Проверка:**
- В Vercel Dashboard проверьте, что `KV_REST_API_TOKEN` - это токен для записи (TOKEN), а не read-only токен (READONLY TOKEN)
- Если установлен `KV_REST_API_READ_ONLY_TOKEN`, убедитесь, что он НЕ совпадает с `KV_REST_API_TOKEN`

**Решение:**
- В Upstash Dashboard создайте новый токен с правами записи
- Обновите `KV_REST_API_TOKEN` в Vercel с новым токеном
- Перезапустите деплоймент

### 3. Redis не инициализируется

**Проверка:**
- Запустите скрипт диагностики:
  ```bash
  npx tsx scripts/diagnose-kv-logs.ts
  ```

**Решение:**
- Следуйте инструкциям из вывода скрипта

### 4. Проверка логов Vercel

**Проверка:**
- Зайдите в Vercel Dashboard → Ваш проект → Logs
- Ищите сообщения с префиксом `/api/logs:`
- Обратите внимание на ошибки:
  - `❌ /api/logs: READ-ONLY TOKEN ERROR!` - используется read-only токен
  - `❌ /api/logs: Redis variables set but getRedis() returned null` - Redis не инициализирован
  - `❌ /api/logs: Upstash KV error` - ошибка при записи в KV

## Быстрая диагностика

1. **Запустите скрипт диагностики:**
   ```bash
   npx tsx scripts/diagnose-kv-logs.ts
   ```

2. **Проверьте переменные окружения в Vercel:**
   - Settings → Environment Variables
   - Убедитесь, что `KV_REST_API_URL` и `KV_REST_API_TOKEN` установлены

3. **Проверьте логи Vercel:**
   - Logs → ищите ошибки с префиксом `/api/logs:`

4. **Проверьте Upstash Dashboard:**
   - Убедитесь, что база данных активна
   - Проверьте, что токен имеет права на запись

## Проверка работы после исправления

После исправления проблемы проверьте, что логи пишутся:

```bash
# Проверка последних логов
npx tsx scripts/check-kv-logs.ts

# Проверка логов конкретного пользователя
npx tsx scripts/check-user-kv-logs.ts <userId>
```

## Частые ошибки

### Ошибка: "NOPERM" или "no permissions"
**Причина:** Используется read-only токен
**Решение:** Замените `KV_REST_API_TOKEN` на токен с правами записи

### Ошибка: "Redis variables set but getRedis() returned null"
**Причина:** Переменные окружения установлены, но Redis не может быть инициализирован
**Решение:** 
- Проверьте, что токен правильный
- Проверьте, что URL правильный
- Убедитесь, что токен не совпадает с read-only токеном

### Ошибка: "KV_REST_API_TOKEN и KV_REST_API_READ_ONLY_TOKEN совпадают"
**Причина:** Оба токена одинаковые (оба read-only)
**Решение:** Создайте новый токен с правами записи и обновите `KV_REST_API_TOKEN`


