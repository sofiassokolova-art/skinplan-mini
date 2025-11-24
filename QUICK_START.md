# 🚀 Быстрый старт - что нужно настроить

## Пошаговая инструкция

### Шаг 1: Установить зависимости Next.js

```bash
npm install next@latest @prisma/client jsonwebtoken
npm install -D prisma @types/jsonwebtoken tsx
```

### Шаг 2: Создать .env файл

Создайте файл `.env` в корне проекта:

```env
# База данных (Neon)
DATABASE_URL="postgresql://user:password@ep-xxx.region.aws.neon.tech/dbname?sslmode=require"

# Telegram Bot Token
TELEGRAM_BOT_TOKEN="your_bot_token_here"

# JWT Secret (любая случайная строка)
JWT_SECRET="your-random-secret-key"

# Environment
NODE_ENV="development"
```

### Шаг 3: Получить connection string из Neon

У вас уже есть база данных **neon-red-yacht**! Нужно только получить connection string:

1. Зайдите на https://neon.tech
2. Найдите проект **neon-red-yacht**
3. В дашборде нажмите **"Connection Details"** или **"Connect"**
4. Скопируйте **connection string** (PostgreSQL connection string)
5. Вставьте в `.env` как `DATABASE_URL`

### Шаг 4: Создать Telegram бота

1. Откройте @BotFather в Telegram
2. Отправьте `/newbot`
3. Следуйте инструкциям
4. Скопируйте токен и вставьте в `.env` как `TELEGRAM_BOT_TOKEN`

### Шаг 5: Обновить package.json

Добавьте эти скрипты в `package.json`:

```json
{
  "scripts": {
    "dev": "next dev",
    "dev:vite": "vite",
    "build": "next build",
    "start": "next start",
    "db:generate": "prisma generate",
    "db:push": "prisma db push",
    "db:studio": "prisma studio",
    "seed:all": "tsx scripts/seed-all.ts"
  }
}
```

### Шаг 6: Инициализировать базу данных

```bash
# Генерация Prisma Client
npm run db:generate

# Применить схему к БД
npm run db:push

# Заполнить начальные данные (анкету, продукты, правила)
npm run seed:all
```

### Шаг 7: Запустить проект

```bash
npm run dev
```

Откройте http://localhost:3000

## ✅ Готово!

Если все настроено правильно, вы должны увидеть:
- ✅ API работает: http://localhost:3000/api/questionnaire/active
- ✅ Страницы загружаются
- ✅ База данных подключена

## 🔧 Автоматическая настройка (альтернатива)

Можно использовать скрипт:

```bash
bash scripts/setup.sh
```

Но все равно нужно будет заполнить `.env` вручную.

## ❓ Проверка что все работает

1. **Проверить БД:**
   ```bash
   npm run db:studio
   ```
   Откроется Prisma Studio - должен показать таблицы

2. **Проверить API:**
   ```bash
   curl http://localhost:3000/api/questionnaire/active
   ```
   Должен вернуть JSON с анкетой

3. **Проверить страницы:**
   - http://localhost:3000 - главная
   - http://localhost:3000/quiz - анкета

## ⚠️ Частые ошибки

### "Cannot find module '@prisma/client'"
```bash
npm run db:generate
```

### "DATABASE_URL is not defined"
Проверьте, что `.env` файл существует и содержит `DATABASE_URL`

### "Invalid DATABASE_URL"
Проверьте connection string из Neon - должен быть формат:
```
postgresql://user:password@host:port/dbname?sslmode=require
```

### "TELEGRAM_BOT_TOKEN not configured"
Добавьте токен бота в `.env`

## 📝 Что дальше?

После настройки:
1. Протестируйте заполнение анкеты
2. Проверьте получение рекомендаций
3. Настройте деплой на Vercel

Подробная инструкция в `SETUP.md`
