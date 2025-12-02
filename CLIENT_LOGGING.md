# Система логирования для техподдержки

Система автоматического логирования действий клиентов с хранением в базе данных и автоматической очисткой старых логов.

## Возможности

- ✅ Автоматическое сохранение логов ошибок и предупреждений в БД
- ✅ Хранение логов в течение 7 дней с автоматической очисткой
- ✅ API для просмотра логов техподдержкой
- ✅ Фильтрация по пользователю, уровню, дате
- ✅ Интеграция с существующим logger.ts

## Структура данных

### Модель ClientLog

```prisma
model ClientLog {
  id        String   @id @default(cuid())
  userId    String   @map("user_id")
  level     String   // 'debug' | 'info' | 'warn' | 'error'
  message   String
  context   Json?    // Дополнительный контекст
  userAgent String?  @map("user_agent")
  url       String?  // URL страницы
  createdAt DateTime @default(now()) @map("created_at")
  
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
}
```

## API Endpoints

### POST /api/logs

Сохранение лога клиента.

**Заголовки:**
- `X-Telegram-Init-Data` - initData от Telegram WebApp

**Тело запроса:**
```json
{
  "level": "error",
  "message": "Ошибка загрузки анкеты",
  "context": {
    "method": "GET",
    "path": "/api/questionnaire/active",
    "error": "Network error"
  },
  "userAgent": "Mozilla/5.0...",
  "url": "https://skinplan-mini.vercel.app/quiz"
}
```

**Ответ:**
```json
{
  "success": true
}
```

### GET /api/admin/logs

Получение логов техподдержкой (требует авторизации админа).

**Query параметры:**
- `userId` (опционально) - фильтр по пользователю
- `level` (опционально) - фильтр по уровню: `debug`, `info`, `warn`, `error`
- `limit` (опционально, по умолчанию 100) - количество записей
- `offset` (опционально, по умолчанию 0) - смещение
- `startDate` (опционально) - начальная дата (ISO string)
- `endDate` (опционально) - конечная дата (ISO string)

**Пример запроса:**
```
GET /api/admin/logs?userId=cmieq8w2v0000js0480u0n0ax&level=error&limit=50
```

**Ответ:**
```json
{
  "logs": [
    {
      "id": "...",
      "userId": "...",
      "level": "error",
      "message": "Ошибка загрузки анкеты",
      "context": {...},
      "userAgent": "...",
      "url": "...",
      "createdAt": "2025-12-02T15:00:00.000Z",
      "user": {
        "id": "...",
        "telegramId": "...",
        "firstName": "...",
        "lastName": "...",
        "username": "..."
      }
    }
  ],
  "total": 150,
  "limit": 50,
  "offset": 0
}
```

### DELETE /api/admin/logs

Удаление старых логов (требует авторизации админа).

**Query параметры:**
- `days` (опционально, по умолчанию 7) - удалить логи старше N дней (1-30)
- `userId` (опционально) - удалить логи только для конкретного пользователя

**Пример запроса:**
```
DELETE /api/admin/logs?days=7
```

**Ответ:**
```json
{
  "success": true,
  "deleted": 1250
}
```

## Использование в коде

### Автоматическое логирование через logger.ts

Логи уровня `error` и `warn` автоматически сохраняются в БД, если передан `userId`:

```typescript
import { logger } from '@/lib/logger';

// Автоматически сохранится в БД (уровень error)
logger.error('Ошибка загрузки данных', error, {
  method: 'GET',
  path: '/api/profile/current',
}, {
  userId: 'cmieq8w2v0000js0480u0n0ax',
  userAgent: navigator.userAgent,
  url: window.location.href,
});

// Автоматически сохранится в БД (уровень warn)
logger.warn('Предупреждение', {
  message: 'Медленное соединение',
}, {
  userId: 'cmieq8w2v0000js0480u0n0ax',
});

// НЕ сохранится в БД (уровень info, по умолчанию)
logger.info('Информация', {
  message: 'Данные загружены',
}, {
  userId: 'cmieq8w2v0000js0480n0ax',
});

// Сохранится в БД, если явно указать saveToDb: true
logger.info('Важная информация', {
  message: 'Пользователь выполнил действие',
}, {
  userId: 'cmieq8w2v0000js0480u0n0ax',
  saveToDb: true,
});
```

### Ручное сохранение через API

```typescript
// В клиентском коде (например, в ErrorBoundary)
try {
  // какой-то код
} catch (error) {
  // Сохраняем лог через API
  await fetch('/api/logs', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Telegram-Init-Data': window.Telegram?.WebApp?.initData || '',
    },
    body: JSON.stringify({
      level: 'error',
      message: error.message,
      context: {
        stack: error.stack,
        component: 'ErrorBoundary',
      },
      userAgent: navigator.userAgent,
      url: window.location.href,
    }),
  });
}
```

## Автоматическая очистка

Логи старше 7 дней автоматически удаляются при сохранении нового лога (в фоновом режиме, не блокирует ответ).

Также можно вручную удалить логи через API:
```
DELETE /api/admin/logs?days=7
```

## Индексы

Для оптимизации запросов созданы индексы:
- `userId` - для фильтрации по пользователю
- `level` - для фильтрации по уровню
- `createdAt` - для фильтрации по дате и автоматической очистки

## Ограничения

- Максимум 1000 записей за один запрос GET
- Логи хранятся 7 дней (настраивается)
- По умолчанию сохраняются только `error` и `warn` логи
- Для сохранения `info` и `debug` нужно явно указать `saveToDb: true`

