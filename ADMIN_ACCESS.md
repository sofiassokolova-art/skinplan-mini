# Доступ к админ-панели

## Требования

- Админ-панель доступна только для пользователей, добавленных в таблицу `admins` в базе данных
- Авторизация происходит через **Telegram Mini App** (Telegram WebApp)
- Необходимо открыть `/admin/login` через Telegram Mini App

## Текущий админ

- **Telegram username**: `@sofiagguseynova`
- **Role**: `admin`

## Как добавить нового админа

1. Добавить запись в таблицу `admins` через Prisma Studio или SQL:
   ```sql
   INSERT INTO admins (telegram_username, role, created_at, updated_at)
   VALUES ('username', 'admin', NOW(), NOW());
   ```

   Или через скрипт (создать файл `scripts/seed-admin-USERNAME.ts`):
   ```typescript
   const admin = await prisma.admin.create({
     data: {
       telegramUsername: 'username', // без @
       role: 'admin',
     },
   });
   ```

2. Запустить скрипт или выполнить SQL запрос

## Безопасность

- Авторизация проверяет `initData` от Telegram (подпись)
- JWT токен хранится в `localStorage` на клиенте
- Каждый API запрос проверяет токен на сервере
- Токен действителен 7 дней

## Структура

- `/admin` - главная страница (дашборд)
- `/admin/login` - вход через Telegram
- `/admin/products` - управление продуктами
- `/admin/questionnaire` - управление анкетой
- `/admin/rules` - управление правилами рекомендаций

