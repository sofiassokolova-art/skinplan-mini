# 🎯 Простая инструкция (база уже есть!)

У вас уже есть база данных **neon-red-yacht** в Neon. Вот что нужно сделать:

## 📋 Быстрая настройка

### 1. Установить зависимости
```bash
npm install next@latest @prisma/client jsonwebtoken
npm install -D prisma @types/jsonwebtoken tsx
```

### 2. Получить connection string из Neon

1. Зайдите на https://neon.tech
2. Найдите проект **neon-red-yacht**
3. Откройте проект
4. Нажмите **"Connection Details"** или кнопку **"Connect"**
5. Выберите **"PostgreSQL connection string"**
6. Скопируйте строку (примерно: `postgresql://user:pass@ep-xxx.region.aws.neon.tech/neondb?sslmode=require`)

### 3. Создать `.env` файл

Создайте файл `.env` в корне проекта:

```env
DATABASE_URL="вставьте_connection_string_из_neon_сюда"
TELEGRAM_BOT_TOKEN="токен_от_ботфаther"
JWT_SECRET="любая_случайная_строка"
```

### 4. Получить токен Telegram бота

Если бота еще нет:
1. Откройте @BotFather в Telegram
2. Отправьте `/newbot`
3. Создайте бота
4. Скопируйте токен в `.env`

### 5. Инициализировать БД

```bash
npm run db:generate
npm run db:push
npm run seed:all
```

### 6. Запустить

```bash
npm run dev
```

---

## ✅ Готово!

Откройте http://localhost:3000

Проверьте API: http://localhost:3000/api/questionnaire/active
