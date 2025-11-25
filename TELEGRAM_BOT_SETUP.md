# Настройка Telegram бота

## Проблема: "Bot domain invalid" в админке

Для работы Telegram Login Widget нужно добавить домен бота в BotFather:

1. Откройте [@BotFather](https://t.me/botfather) в Telegram
2. Отправьте команду: `/mybots`
3. Выберите вашего бота
4. Выберите "Bot Settings" → "Domain"
5. Отправьте домен вашего приложения: `skinplan-mini.vercel.app` (или ваш домен)
6. Telegram проверит домен и сохранит его

После этого Telegram Login Widget должен работать корректно.

## Настройка вебхука для бота

Вебхук нужен для получения сообщений от пользователей (например, команда `/start`).

### Автоматическая настройка

1. Убедитесь, что в `.env` есть:
   ```
   TELEGRAM_BOT_TOKEN=ваш_токен_бота
   TELEGRAM_SECRET_TOKEN=ваш_секретный_токен (опционально, но рекомендуется)
   ```

2. Запустите скрипт:
   ```bash
   npm run telegram:webhook
   ```

### Ручная настройка

1. Получите URL вашего вебхука: `https://skinplan-mini.vercel.app/api/telegram/webhook`

2. Установите вебхук через браузер или curl:
   ```bash
   curl "https://api.telegram.org/bot<ВАШ_ТОКЕН>/setWebhook?url=https://skinplan-mini.vercel.app/api/telegram/webhook"
   ```

3. Проверьте статус вебхука:
   ```bash
   curl "https://api.telegram.org/bot<ВАШ_ТОКЕН>/getWebhookInfo"
   ```

## Переменные окружения

Добавьте в `.env` и на Vercel:

- `TELEGRAM_BOT_TOKEN` - токен бота от BotFather
- `TELEGRAM_SECRET_TOKEN` (опционально) - секретный токен для защиты вебхука
- `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME` - username бота: `@skinplanned_bot` (или `skinplanned_bot` без @)
- `NEXT_PUBLIC_MINI_APP_URL` - URL мини-приложения (например, `https://skinplan-mini.vercel.app`)

## Проверка работы

1. Отправьте боту команду `/start`
2. Бот должен отправить приветственное сообщение с кнопкой для открытия Mini App

## Troubleshooting

### Вебхук не работает
- Проверьте, что URL вебхука доступен из интернета
- Проверьте, что токен правильный
- Проверьте логи на Vercel

### "Bot domain invalid"
- Убедитесь, что домен добавлен в BotFather
- Домен должен быть точно таким же, как в вашем приложении
- После добавления домена может потребоваться несколько минут для обновления
