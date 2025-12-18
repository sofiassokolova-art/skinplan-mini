# Настройка DATABASE_URL в Vercel

## Проблема

В списке Environment Variables в Vercel **НЕТ** `DATABASE_URL`, но он критически необходим для работы приложения.

## Решение

### 1. Добавьте DATABASE_URL в Vercel

1. Зайдите в Vercel Dashboard → ваш проект → Settings → Environment Variables
2. Нажмите "Create new"
3. Добавьте:
   - **Key:** `DATABASE_URL`
   - **Value:** ваш PostgreSQL connection string (например, от Neon)
   - **Environments:** All Environments (или Production + Preview)
   - **Sensitive:** ✅ (включите, чтобы скрыть значение)

### 2. Формат DATABASE_URL

Для Neon PostgreSQL:
```
postgresql://user:password@host.neon.tech/dbname?sslmode=require
```

Для других провайдеров:
```
postgresql://user:password@host:port/dbname?sslmode=require
```

### 3. Важно

- **НЕ используйте** `POSTGRES_URL` или `POSTGRES_PRISMA_URL` - они могут переопределить `DATABASE_URL`
- Используйте **только** `DATABASE_URL` как единственный источник правды
- После добавления переменной **создайте новый Deployment** (Vercel не применяет изменения env переменных к существующим деплоям)

### 4. Проверка

После деплоя проверьте логи:
- Ищите `DB_FINGERPRINT` в логах
- Все роуты должны показывать одинаковые `db`, `schema`, `host`, `port`
- Если хоть одно поле отличается - значит используются разные БД

## Текущие env переменные в Vercel

Сейчас есть:
- ✅ UPSTASH_REDIS_REST_TOKEN
- ✅ NEXT_PUBLIC_TELEGRAM_BOT_USERNAME
- ✅ JWT_SECRET (только Production)
- ✅ VITE_OPENAI_API_KEY
- ✅ VITE_HUGGINGFACE_API_KEY

**Отсутствует:**
- ❌ DATABASE_URL (критично!)

## После добавления DATABASE_URL

1. Создайте новый Deployment
2. Проверьте логи на наличие `DB_FINGERPRINT`
3. Убедитесь, что все роуты показывают одинаковый fingerprint
4. Проверьте, что профили создаются и находятся корректно
