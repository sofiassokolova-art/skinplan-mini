# Применение миграций в продакшене СЕЙЧАС

## Автоматическое применение (рекомендуется)

Миграции будут применены автоматически при следующем деплое на Vercel благодаря обновленному `buildCommand` в `vercel.json`.

**Чтобы применить миграции сейчас:**
1. Создайте новый деплой на Vercel (через push в main или вручную)
2. Миграции применятся автоматически во время build

## Ручное применение (если нужно применить СЕЙЧАС)

### Вариант 1: Через Vercel CLI

```bash
# Установите Vercel CLI (если еще не установлен)
npm i -g vercel

# Авторизуйтесь
vercel login

# Получите env переменные
vercel env pull .env.production

# Примените миграции
export DATABASE_URL=$(grep DATABASE_URL .env.production | cut -d '=' -f2-)
npx prisma migrate deploy
```

### Вариант 2: Через скрипт

```bash
# Установите DATABASE_URL из Vercel Dashboard
export DATABASE_URL="postgresql://user:password@host.neon.tech/dbname?sslmode=require"

# Запустите скрипт
./scripts/apply-migrations-production.sh
```

### Вариант 3: Через Neon Dashboard

1. Зайдите в Neon Dashboard
2. Откройте SQL Editor
3. Выполните миграции вручную (скопируйте SQL из `prisma/migrations/*/migration.sql`)

## Проверка после применения

После применения миграций проверьте:

```bash
curl https://www.proskiniq.ru/api/questionnaire/active
```

Должен вернуться статус 200 с данными анкеты, а не 500 ошибка.

## Текущий статус

- ✅ Миграции применены локально
- ✅ Настроено автоматическое применение при деплое
- ⏳ Требуется применить миграции в продакшене (через деплой или вручную)

