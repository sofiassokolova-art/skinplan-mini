# Исправление проблемы рассинхронизации подключений к БД

## Проблема

Запись создается в одной БД, а читается из другой. Это приводит к:
- `foundInDb: false` после создания профиля
- `No profile found` в `/api/profile/current` сразу после создания
- Разные fingerprint между роутами

## Причины

1. **Разные импорты Prisma клиента**
   - `lib/get-current-profile.ts` использовал `import { prisma } from './db'`
   - Другие файлы использовали `import { prisma } from '@/lib/db'`
   - Это могло приводить к разным экземплярам Prisma клиента

2. **Конфликтующие env переменные**
   - `DATABASE_URL` - основной URL
   - `POSTGRES_URL` - может конфликтовать
   - `POSTGRES_PRISMA_URL` - может конфликтовать
   - `NEON_DATABASE_URL` - может конфликтовать

3. **Разные типы подключений Neon**
   - Pooled connection (через pooler)
   - Direct connection (напрямую)
   - Разные ветки БД

## Исправления

### 1. Единый импорт Prisma клиента

**Было:**
```typescript
// lib/get-current-profile.ts
import { prisma } from './db';
```

**Стало:**
```typescript
// lib/get-current-profile.ts
import { prisma } from '@/lib/db';
```

**Исправлены файлы:**
- `lib/get-current-profile.ts`
- `lib/db-fingerprint.ts`
- `lib/update-user-activity.ts`
- `lib/telegram-validation.ts`
- `lib/recommendations-generator.ts`
- `lib/get-user-from-telegram-id.ts`
- `lib/get-user-from-initdata.ts`
- `lib/product-fallback.ts`
- `lib/plan-data.ts`
- `lib/plan-generation-helpers.ts`
- `lib/admin-stats.ts`

### 2. Единый источник правды для DATABASE_URL

В `lib/db.ts` используется **ТОЛЬКО** `DATABASE_URL`:

```typescript
// КРИТИЧНО: Используем ТОЛЬКО DATABASE_URL как единственный источник правды
// Не используем POSTGRES_URL, POSTGRES_PRISMA_URL или другие переменные
const url = process.env.DATABASE_URL;
```

### 3. Улучшенный DB fingerprint

Добавлен детальный fingerprint в:
- `/api/questionnaire/answers` (в начале POST)
- `/api/profile/current` (уже был)
- `/api/plan` (уже был)

Fingerprint включает:
- `current_database()` - имя БД
- `current_schema()` - схема
- `current_user` - пользователь
- `inet_server_addr()` - адрес сервера
- `inet_server_port()` - порт
- Информацию о всех env переменных (DATABASE_URL, POSTGRES_URL, etc.)

### 4. Правильная verification after create

**Было:**
```typescript
// Проверка через prisma после транзакции (может не увидеть запись)
const profileAfterCreate = await prisma.skinProfile.findUnique(...);
```

**Стало:**
```typescript
// Проверка внутри транзакции через tx (правильно)
const profileInTx = await tx.skinProfile.findUnique(...);

// Проверка после транзакции через тот же prisma instance (для диагностики)
const profileAfterCreate = await prisma.skinProfile.findUnique(...);
```

## Рекомендации для Vercel

### 1. Удалить конфликтующие env переменные

В Vercel Dashboard → Settings → Environment Variables:

**Оставить только:**
- `DATABASE_URL` - основной URL подключения

**Удалить или выровнять:**
- `POSTGRES_URL` - удалить или установить = `DATABASE_URL`
- `POSTGRES_PRISMA_URL` - удалить или установить = `DATABASE_URL`
- `NEON_DATABASE_URL` - удалить или установить = `DATABASE_URL`

### 2. Использовать один тип подключения Neon

Для Neon рекомендуется использовать **pooled connection** для всех запросов:
```
postgresql://user:pass@ep-xxx-pooler.region.aws.neon.tech/dbname?sslmode=require
```

Не смешивать:
- Pooled connection (через pooler)
- Direct connection (напрямую к БД)

### 3. Проверка fingerprint в логах

После деплоя проверить логи Vercel:

1. Отправить анкету
2. Проверить логи `/api/questionnaire/answers`:
   ```
   🔍 DB_FINGERPRINT /api/questionnaire/answers
   fingerprint: { db: "...", schema: "...", user: "...", host: "...", port: ... }
   ```

3. Проверить логи `/api/profile/current`:
   ```
   🔍 DB_FINGERPRINT /api/profile/current
   fingerprint: { db: "...", schema: "...", user: "...", host: "...", port: ... }
   ```

4. Сравнить:
   - Если `db`, `schema`, `user`, `host`, `port` **одинаковые** - проблема не в разных БД
   - Если **разные** - проблема в env переменных или подключениях

## Диагностика

### Проверка в коде

Добавлен fingerprint в начало POST `/api/questionnaire/answers`:

```typescript
const fingerprintAtStart = await logDbFingerprint('/api/questionnaire/answers');
```

И после создания профиля:

```typescript
const fingerprintAfterCreate = await logDbFingerprint('/api/questionnaire/answers');
```

### Проверка в логах

Искать в Vercel logs:
```
🔍 DB_FINGERPRINT
```

Сравнить:
- `fingerprint.db` - должно быть одинаково
- `fingerprint.schema` - должно быть одинаково
- `fingerprint.user` - должно быть одинаково
- `envVars.DATABASE_URL.host` - должно быть одинаково
- `envVars.DATABASE_URL.db` - должно быть одинаково

## Миграции

Убедиться, что миграции применены:

```bash
# Локально
npx prisma migrate dev

# В продакшене (через CI/CD или вручную)
npx prisma migrate deploy
```

Проверить наличие таблиц:
- `payments` - должна существовать
- `entitlements` - должна существовать
