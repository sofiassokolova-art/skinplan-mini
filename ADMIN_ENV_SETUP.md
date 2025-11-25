# Настройка переменных окружения для админ-панели

## NEXT_PUBLIC_TELEGRAM_BOT_USERNAME

Эта переменная нужна для работы Telegram Login Widget в админ-панели.

### Как узнать username вашего бота:

1. Откройте [@BotFather](https://t.me/botfather) в Telegram
2. Отправьте команду: `/mybots`
3. Выберите вашего бота
4. В информации о боте будет указан **Username** (для вашего бота: `@skinplanned_bot`)

### Настройка:

#### Локально (в файле `.env`):

Добавьте строку в файл `.env` в корне проекта:

```env
NEXT_PUBLIC_TELEGRAM_BOT_USERNAME=@skinplanned_bot
```

Или без @ (оба варианта работают):

```env
NEXT_PUBLIC_TELEGRAM_BOT_USERNAME=skinplanned_bot
```

#### На Vercel:

1. Зайдите в проект на Vercel: https://vercel.com/dashboard
2. Выберите проект `skinplan-mini`
3. Перейдите в **Settings** → **Environment Variables**
4. Добавьте переменную:
   - **Key:** `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME`
   - **Value:** `@skinplanned_bot` (или `skinplanned_bot` без @)
   - **Environment:** Production, Preview, Development (все)

### После добавления:

1. **Локально:** Перезапустите сервер (`npm run dev`)
2. **На Vercel:** Подождите несколько минут, пока переменная применится, или сделайте redeploy

### Проверка:

После настройки предупреждение на странице `/admin/login` должно исчезнуть, и должна появиться кнопка Telegram Login Widget.

