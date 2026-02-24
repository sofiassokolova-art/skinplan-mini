# Проверка прод-БД и миграций

## 1. Переменная в Vercel

- **Project** → **Settings** → **Environment Variables**
- Должна быть переменная **`DATABASE_URL`** для окружения **Production**
- Значение — полный URL прод-БД (PostgreSQL, Neon), например:
  `postgresql://USER:PASSWORD@HOST/neondb?sslmode=require`

## 2. Проверка миграций для прод-БД (локально)

Подключись к **прод-БД** только через переменную окружения (не храни URL в коде и не коммить).

```bash
# Один раз задать прод URL (подставь свой, затем удали из истории)
export DATABASE_URL="postgresql://neondb_owner:ТВОЙ_ПАРОЛЬ@ep-calm-paper-agnjsik8-pooler.c-2.eu-central-1.aws.neon.tech/neondb?sslmode=require"

# Статус миграций (какие применены, какие ожидают)
npx prisma migrate status

# Если есть pending — применить
npx prisma migrate deploy
```

После проверки выполни в том же терминале `unset DATABASE_URL`, чтобы не использовать прод-URL дальше.

## 3. Автоматическое применение при деплое

При каждом деплое в **Production** на Vercel в `postinstall` запускается:

- `prisma generate`
- при `VERCEL_ENV=production` — `scripts/migrate-deploy-with-retry.sh` → `npx prisma migrate deploy`

То есть миграции применяются к той БД, чей URL задан в **Production** переменной `DATABASE_URL`.

## 4. Мусорные папки в prisma/migrations

В папке есть каталоги с именами-ошибками (например `$(date...)`, `$(ls -t...`). Они не являются валидными миграциями Prisma. На статус миграций они не влияют; при желании их можно удалить вручную, чтобы не путаться.
