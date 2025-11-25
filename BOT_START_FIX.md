# Решение проблемы: Бот не отвечает на /start

## Быстрая диагностика

### 1. Проверьте статус webhook

Откройте в браузере:
```
https://skinplan-mini.vercel.app/api/telegram/webhook?action=check
```

Или используйте страницу:
```
https://skinplan-mini.vercel.app/admin/webhook-status
```

**Ожидаемый результат:**
```json
{
  "ok": true,
  "result": {
    "url": "https://skinplan-mini.vercel.app/api/telegram/webhook",
    "has_custom_certificate": false,
    "pending_update_count": 0
  }
}
```

Если `url` пустой или отличается - webhook не установлен.

### 2. Установите webhook

Откройте в браузере:
```
https://skinplan-mini.vercel.app/api/telegram/webhook?action=set-webhook
```

Или на странице `/admin/webhook-status` нажмите кнопку "Установить webhook".

**Ожидаемый результат:**
```json
{
  "ok": true,
  "result": true,
  "description": "Webhook was set"
}
```

### 3. Проверьте переменные окружения в Vercel

Убедитесь, что в Vercel установлены:
- `TELEGRAM_BOT_TOKEN` - токен от @BotFather
- `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME` - username бота (например, `skinplanned_bot`)

### 4. Проверьте логи Vercel

1. Откройте Vercel Dashboard
2. Перейдите в проект `skinplan-mini`
3. Откройте вкладку "Logs" или "Functions"
4. Найдите логи функции `/api/telegram/webhook`
5. Отправьте `/start` боту и проверьте, появляются ли логи

**Ожидаемые логи:**
```
📥 Получено обновление от Telegram: [update_id]
📨 Processing /start command from user [name] (chatId: [id])
📤 Sending welcome message to chat [id]...
✅ Welcome message sent successfully
```

### 5. Проверьте, что бот запущен

Убедитесь, что:
- Бот не удален в @BotFather
- Токен бота действителен
- Бот не заблокирован

## Пошаговое решение

### Шаг 1: Установите webhook через API

Откройте в браузере (заменив URL на ваш):
```
https://skinplan-mini.vercel.app/api/telegram/webhook?action=set-webhook
```

### Шаг 2: Проверьте webhook

```
https://skinplan-mini.vercel.app/api/telegram/webhook?action=check
```

### Шаг 3: Отправьте тестовое сообщение

Отправьте боту команду `/start` и проверьте:
1. Логи в Vercel
2. Ответ бота

### Шаг 4: Если webhook установлен, но бот не отвечает

Проверьте:
1. **Логи Vercel** - есть ли ошибки при обработке запроса?
2. **TELEGRAM_BOT_TOKEN** - правильный ли токен?
3. **Middleware** - не блокирует ли запросы?

## Альтернативный способ: Установка через curl

```bash
curl "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook?url=https://skinplan-mini.vercel.app/api/telegram/webhook&allowed_updates=[\"message\"]"
```

Замените `<YOUR_BOT_TOKEN>` на реальный токен от @BotFather.

## Проверка работы webhook вручную

Отправьте тестовый POST запрос к webhook:

```bash
curl -X POST https://skinplan-mini.vercel.app/api/telegram/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "update_id": 123456,
    "message": {
      "message_id": 1,
      "from": {
        "id": 123456789,
        "is_bot": false,
        "first_name": "Test",
        "username": "testuser"
      },
      "chat": {
        "id": 123456789,
        "type": "private"
      },
      "date": 1234567890,
      "text": "/start"
    }
  }'
```

Если все настроено правильно, вы должны увидеть в логах Vercel:
- Получение обновления
- Обработка команды /start
- Попытку отправки сообщения

