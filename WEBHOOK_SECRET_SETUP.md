# Настройка секретного токена для Telegram Webhook

Для дополнительной безопасности webhook Telegram бота можно использовать секретный токен.

## Генерация секретного токена

### Вариант 1: Используя Node.js

```bash
node -e "const crypto = require('crypto'); console.log(crypto.randomBytes(32).toString('hex'))"
```

### Вариант 2: Используя скрипт

```bash
npm run generate:webhook-secret
# или
tsx scripts/generate-webhook-secret.ts
```

## Настройка в Vercel

1. Откройте ваш проект в Vercel Dashboard
2. Перейдите в **Settings** → **Environment Variables**
3. Добавьте новую переменную:
   - **Name**: `TELEGRAM_SECRET_TOKEN`
   - **Value**: (вставьте сгенерированный токен)
   - **Environment**: Production, Preview, Development (на выбор)

## Настройка webhook с секретным токеном

После добавления переменной окружения, переустановите webhook:

```bash
# Через браузер:
https://skinplan-mini.vercel.app/api/telegram/webhook?action=set-webhook

# Или через curl:
curl "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook?url=https://skinplan-mini.vercel.app/api/telegram/webhook&secret_token=<YOUR_SECRET_TOKEN>&allowed_updates=[\"message\"]"
```

## Важно

- Без секретного токена webhook будет работать, но будет менее защищённым
- С секретным токеном Telegram будет отправлять токен в заголовке `x-telegram-bot-api-secret-token`
- Сервер будет проверять этот токен перед обработкой запроса
- Если токен не установлен, webhook работает без проверки (подходит для разработки)

## Проверка работы

После настройки проверьте статус webhook:

```bash
curl "https://skinplan-mini.vercel.app/api/telegram/webhook?action=check"
```

Или через браузер:
```
https://skinplan-mini.vercel.app/api/telegram/webhook?action=check
```

