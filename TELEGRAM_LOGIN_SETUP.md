# Настройка Telegram Login для админ-панели

## Быстрый старт

### 1. Создайте бота через @BotFather

1. Откройте Telegram и найдите `@BotFather`
2. Отправьте команду `/newbot`
3. Придумайте имя бота (например: `MySkinIQ_AdminBot`)
4. Придумайте username бота (например: `@skinplanned_admin_bot`)
5. Скопируйте полученный токен вида: `7123456789:AAH...xyz`

### 2. Настройте Telegram Login URL

1. В @BotFather → `/mybots` → выберите вашего бота
2. Перейдите в `Payments & Login` → `Login URL`
3. Укажите URL вашей админ-панели:
   ```
   https://skinplan-mini.vercel.app/admin/telegram-callback
   ```
   
   ⚠️ **Важно**: 
   - Домен должен быть с HTTPS
   - Без порта (или с портом 443)
   - Полный URL с путем

### 3. Настройте переменные окружения

#### Локально (.env файл):
```env
TELEGRAM_BOT_TOKEN=7123456789:AAH...xyz
NEXT_PUBLIC_TELEGRAM_BOT_USERNAME=@skinplanned_admin_bot
JWT_SECRET=your-very-secret-jwt-key-change-in-production
```

#### На Vercel (Settings → Environment Variables):
- `TELEGRAM_BOT_TOKEN` = `7123456789:AAH...xyz`
- `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME` = `@skinplanned_admin_bot`
- `JWT_SECRET` = `your-very-secret-jwt-key-change-in-production`

### 4. Создайте админа в базе данных

Запустите скрипт для создания админа:
```bash
npm run seed:admin
```

Или создайте админа вручную через Prisma Studio:
```bash
npm run db:studio
```

Админ должен иметь:
- `telegramId` или `telegramUsername` (например, `@sofiagguseynova`)
- `role` = `admin` или `editor`

## Как это работает

### Вариант 1: Callback функция (data-onauth)
Telegram виджет вызывает JavaScript функцию при успешной авторизации. Данные отправляются напрямую на `/api/admin/login`.

**Плюсы:**
- Простая реализация
- Не нужен отдельный callback endpoint

**Минусы:**
- Менее безопасно (данные проходят через клиент)
- Требует JavaScript

### Вариант 2: Callback URL (data-auth-url) - Рекомендуется
Telegram перенаправляет пользователя на указанный URL с данными в query параметрах. Сервер проверяет данные и авторизует пользователя.

**Плюсы:**
- Более безопасно (валидация на сервере)
- Работает даже без JavaScript
- Рекомендуется Telegram

**Минусы:**
- Нужен отдельный endpoint для обработки callback

## Структура файлов

```
app/
├── admin/
│   ├── login/
│   │   └── page.tsx          # Страница входа с виджетом
│   └── telegram-callback/
│       └── page.tsx          # Обработка callback от Telegram
└── api/
    └── admin/
        └── login/
            └── route.ts      # API endpoint для авторизации
```

## Безопасность

1. **Валидация hash**: Все данные от Telegram проверяются через HMAC-SHA256
2. **Проверка времени**: Данные должны быть не старше 24 часов
3. **JWT токены**: После авторизации выдаются JWT токены с истечением 7 дней
4. **Проверка админа**: Проверяется наличие пользователя в таблице `admins`

## Проверка работы

1. Откройте `/admin/login`
2. Должна появиться кнопка "Login with Telegram"
3. Нажмите на кнопку и авторизуйтесь
4. После успешной авторизации вы будете перенаправлены на `/admin`

## Решение проблем

### Виджет не появляется
- Проверьте `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME` в переменных окружения
- Убедитесь, что username бота указан без `@`
- Проверьте консоль браузера на ошибки

### "Access denied" после авторизации
- Убедитесь, что ваш Telegram username/ID добавлен в таблицу `admins`
- Проверьте, что `telegramUsername` в БД совпадает с username в Telegram (без `@`)
- Проверьте логи сервера для отладки

### "Invalid Telegram login data"
- Проверьте `TELEGRAM_BOT_TOKEN` - должен совпадать с токеном от @BotFather
- Убедитесь, что Login URL в BotFather настроен правильно
- Данные не должны быть старше 24 часов

## Дополнительные ресурсы

- [Официальная документация Telegram Login](https://core.telegram.org/widgets/login)
- [Telegram Bot API](https://core.telegram.org/bots/api)
- [@BotFather](https://t.me/BotFather)

