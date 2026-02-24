# Прод-бот не отвечает: проверка и исправление

## 1. Проверить, куда Telegram шлёт обновления

Откройте в браузере (залогинившись в админку или с секретом):

- **Проверка:**  
  `https://www.proskiniq.ru/api/telegram/webhook?action=check`  
  (с cookie админки или с параметром `?secret=WEBHOOK_SET_SECRET`)

В ответе смотрите `result.url`:

- Должно быть: `https://www.proskiniq.ru/api/telegram/webhook` (ваш прод-домен).
- Если `url` пустой или другой (например, `skinplan-mini.vercel.app`) — webhook указывает не на прод.

## 2. Установить webhook на прод

1. Зайдите в админку: `https://www.proskiniq.ru/admin/login`.
2. Откройте: `https://www.proskiniq.ru/admin/set-webhook`.
3. Нажмите кнопку **«Установить webhook»**.

Страница подставит текущий origin (`https://www.proskiniq.ru`) и вызовет `setWebhook` для этого URL. После этого Telegram начнёт слать обновления на прод.

## 3. Переменные окружения в Vercel (прод)

В настройках проекта Vercel для **Production** должны быть:

- `TELEGRAM_BOT_TOKEN` — токен бота от @BotFather.
- `NEXT_PUBLIC_MINI_APP_URL` — полный URL мини-приложения, например:  
  `https://www.proskiniq.ru`

Если используется кастомный домен, после смены домена нужно заново нажать «Установить webhook» на странице set-webhook (чтобы URL в Telegram совпадал с новым доменом).

## 4. Секретный токен webhook (по желанию)

Если в Vercel задан `TELEGRAM_SECRET_TOKEN`:

- При установке webhook он должен передаваться в Telegram (страница set-webhook берёт его из env и передаёт).
- Тогда Telegram будет присылать заголовок `X-Telegram-Bot-Api-Secret-Token`; бэкенд его проверяет.

Если webhook когда-то ставили без secret, а потом добавили `TELEGRAM_SECRET_TOKEN`, нужно один раз заново нажать «Установить webhook» в админке, чтобы Telegram начал присылать заголовок.

## 5. Логи и таймауты

- В Vercel → проект → Logs смотрите запросы к `/api/telegram/webhook`: приходят ли POST при сообщениях в бота, нет ли 500/403.
- Ответ webhook’у нужно отдавать быстро (желательно в пределах десятка секунд), и всегда возвращать 200 OK, иначе Telegram будет повторять запрос.

## Краткий чеклист

1. В Vercel (Production) заданы `TELEGRAM_BOT_TOKEN` и `NEXT_PUBLIC_MINI_APP_URL`.
2. Открыта админка на проде и нажата «Установить webhook» на `/admin/set-webhook`.
3. В `?action=check` в ответе `result.url` = `https://www.proskiniq.ru/api/telegram/webhook`.
4. В логах Vercel при отправке сообщения боту есть POST на `/api/telegram/webhook` и ответ 200.
