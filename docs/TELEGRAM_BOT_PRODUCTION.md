# Telegram-бот в Production (main)

## Прод бот не отвечает на /start

**Причина:** у бота может быть только **один** webhook. Если он был установлен на домен develop (например `*.vercel.app`), Telegram шлёт все обновления туда, а на прод (www.proskiniq.ru) запросы не приходят — бот «молчит».

**Что сделать:** заново установить webhook на **продакшен-URL** (один из способов ниже). После этого /start и остальные команды будут обрабатываться продом.

| Способ | Действие |
|--------|----------|
| **Через админку** | Открыть **https://www.proskiniq.ru/admin/set-webhook** (обязательно на прод-домене), войти в админку, нажать «Установить Webhook». |
| **Через curl** | В Vercel → Production задать `WEBHOOK_SET_SECRET`, затем: `curl "https://www.proskiniq.ru/api/telegram/webhook?action=set-webhook&secret=ВАШ_SECRET"` |
| **Скрипт** | Локально: `TELEGRAM_WEBHOOK_URL=https://www.proskiniq.ru/api/telegram/webhook` в .env и `npx tsx scripts/setup-telegram-webhook.ts` |

Проверить, куда сейчас смотрит webhook: `curl "https://www.proskiniq.ru/api/telegram/webhook?action=check&secret=ВАШ_SECRET"` (или после входа в админку открыть ту же ссылку без secret в браузере).

---

Поведение бота в production такое же, как в develop: те же команды (/start, /admin, /help, /clear, /logs, /payment), те же ответы и кнопки (Mini App, админка, очистка данных). Код один и тот же, различаются только переменные окружения и URL вебхука.

## 1. Переменные в Vercel для Production

В **Project → Settings → Environment Variables** для окружения **Production** задайте:

| Переменная | Значение | Заметка |
|------------|----------|--------|
| `TELEGRAM_BOT_TOKEN` | Токен бота для прода (от @BotFather) | Обязательно для production |
| `NEXT_PUBLIC_MINI_APP_URL` | URL продакшен-приложения, например `https://skinplan-mini.vercel.app` | От него строятся ссылки в кнопках «Открыть SkinIQ», «Открыть админку» и т.д. |
| `WEBHOOK_SET_SECRET` | (опционально) Секрет для установки webhook без входа в админку | Позволяет вызывать `?action=set-webhook&secret=...` из curl/CI. |

Остальные переменные (БД, JWT, админка и т.д.) настраиваются как обычно для production.

## 2. Установка вебхука на production

У одного бота может быть только один URL вебхука. Чтобы бот в production обрабатывал сообщения тем же кодом и логикой, что и в develop, вебхук должен указывать на **production-домен**.

После деплоя **main** в production можно установить вебхук **без перехода по ссылке**:

### Вариант A: curl (если задан WEBHOOK_SET_SECRET)

В Vercel → Production добавьте переменную `WEBHOOK_SET_SECRET` (длинная случайная строка). Затем с любой машины:

```bash
curl "https://ВАШ-ПРОД-ДОМЕН/api/telegram/webhook?action=set-webhook&secret=ВАШ_WEBHOOK_SET_SECRET"
```

Проверка текущего вебхука:

```bash
curl "https://ВАШ-ПРОД-ДОМЕН/api/telegram/webhook?action=check&secret=ВАШ_WEBHOOK_SET_SECRET"
```

### Вариант B: скрипт локально

В `.env` задайте `TELEGRAM_BOT_TOKEN` и `TELEGRAM_WEBHOOK_URL=https://ВАШ-ПРОД-ДОМЕН/api/telegram/webhook`, затем:

```bash
npx tsx scripts/setup-telegram-webhook.ts
```

### Вариант C: через браузер (админка)

1. Откройте **на production-домене**: `https://ваш-домен.ru/admin/set-webhook`
2. Войдите в админку (логин/пароль админа).
3. Нажмите **«Установить webhook»**.

В любом случае в Telegram будет зарегистрирован URL вида:
`https://ваш-production-домен/api/telegram/webhook`.

Дальше все обновления от пользователей (сообщения, команды) Telegram будет слать на этот URL — их обрабатывает тот же код, что и в develop (приветствия, кнопки, /admin, /help и т.д.).

## 3. Админка и доступ к /admin

- Список администраторов хранится в БД (таблица `AdminWhitelist`): по `telegramId` или `phoneNumber`, флаг `isActive`.
- Если production и develop используют **одну БД** — те же админы будут и в production.
- Если БД **разные** — в production-БД нужно отдельно добавить нужные Telegram ID/номера в `AdminWhitelist`.

Команда `/admin` в боте проверяет этого же бота и ту же БД; ссылка «Открыть админку» ведёт на `NEXT_PUBLIC_MINI_APP_URL/admin`, т.е. на production-админку при корректном `NEXT_PUBLIC_MINI_APP_URL`.

## 4. Краткий чеклист

- [ ] В Vercel для **Production** заданы `TELEGRAM_BOT_TOKEN` и `NEXT_PUBLIC_MINI_APP_URL` (production-URL).
- [ ] Деплой **main** в production выполнен.
- [ ] Webhook установлен (curl с `WEBHOOK_SET_SECRET`, скрипт `setup-telegram-webhook.ts` или страница /admin/set-webhook на прод-домене).
- [ ] В production-БД при необходимости добавлены админы в `AdminWhitelist` для доступа к `/admin` и админке.

После этого коммуникация и ответы бота в production будут такими же, как в develop, с подключением к той же админке (на production-домене).
