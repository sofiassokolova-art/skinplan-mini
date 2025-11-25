# Быстрая установка Webhook

## Проблема
Webhook не установлен, бот не отвечает на команды.

## Решение (3 способа)

### Способ 1: Прямая ссылка (САМЫЙ ПРОСТОЙ)

**Просто откройте эту ссылку в браузере:**

```
https://skinplan-mini.vercel.app/api/telegram/webhook?action=set-webhook
```

После открытия вы должны увидеть:
```json
{
  "ok": true,
  "result": true,
  "description": "Webhook was set"
}
```

**Затем сразу проверьте статус:**
```
https://skinplan-mini.vercel.app/api/telegram/webhook?action=check
```

Должно показать `"url": "https://skinplan-mini.vercel.app/api/telegram/webhook"` (не пустой).

### Способ 2: Через админ-панель

1. Откройте: https://skinplan-mini.vercel.app/admin/webhook-status
2. Нажмите кнопку **"Установить webhook"**
3. Подождите сообщения об успехе
4. Нажмите **"Проверить webhook"** для подтверждения

### Способ 3: Через curl (для разработчиков)

```bash
curl "https://skinplan-mini.vercel.app/api/telegram/webhook?action=set-webhook"
```

## После установки

1. ✅ Проверьте статус - URL должен быть заполнен
2. ✅ Отправьте `/start` боту @skinplanned_bot
3. ✅ Бот должен ответить с приветственным сообщением

## Если не работает

### Проверьте переменные окружения в Vercel

Убедитесь, что установлено:
- `TELEGRAM_BOT_TOKEN` = `8138388674:AAHt8HqnPS3LRwo7l_g_q1Bw05c9vTqsfEw`

### Проверьте логи Vercel

1. Vercel Dashboard → Logs
2. Найдите запросы к `/api/telegram/webhook`
3. Проверьте, есть ли ошибки

### Проверьте токен вручную

```bash
curl "https://api.telegram.org/bot8138388674:AAHt8HqnPS3LRwo7l_g_q1Bw05c9vTqsfEw/getMe"
```

Должен вернуть информацию о боте.

## Важно!

После установки webhook, Telegram автоматически отправит все 16 накопленных обновлений. Это нормально - они будут обработаны.

Если URL все еще пустой после установки, возможно:
1. Переменная `TELEGRAM_BOT_TOKEN` не установлена в Vercel
2. Есть ошибка в коде (проверьте логи)
3. Проблема с доступностью URL (но он должен быть доступен)

