# API Documentation

Документация REST API для SkinPlan Mini.

## Базовый URL

```
https://your-domain.com/api
```

## Аутентификация

Все API endpoints требуют аутентификации через Telegram WebApp. Передавайте заголовок:

```
X-Telegram-Init-Data: <telegram_init_data>
```

## Questionnaire API

### GET /api/questionnaire/active

Получить активную анкету.

**Запрос:**
```http
GET /api/questionnaire/active
Headers:
  X-Telegram-Init-Data: <telegram_init_data>
```

**Ответ:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "title": "Анкета по уходу за кожей",
    "isActive": true,
    "questions": [
      {
        "id": 1,
        "code": "user_name",
        "type": "free_text",
        "text": "Как вас зовут?",
        "options": []
      }
    ]
  }
}
```

### GET /api/questionnaire/progress

Получить прогресс прохождения анкеты.

**Запрос:**
```http
GET /api/questionnaire/progress
Headers:
  X-Telegram-Init-Data: <telegram_init_data>
```

**Ответ:**
```json
{
  "success": true,
  "data": {
    "progress": {
      "answers": {
        "1": "John",
        "2": "dry"
      },
      "questionIndex": 2,
      "infoScreenIndex": 0
    }
  }
}
```

### POST /api/questionnaire/answers

Сохранить ответы пользователя и создать профиль кожи.

**Запрос:**
```http
POST /api/questionnaire/answers
Headers:
  Content-Type: application/json
  X-Telegram-Init-Data: <telegram_init_data>
Body:
{
  "questionnaireId": 1,
  "answers": [
    {
      "questionId": 1,
      "answerValue": "John"
    },
    {
      "questionId": 2,
      "answerValue": "dry"
    }
  ],
  "clientSubmissionId": "unique-client-id"
}
```

**Ответ:**
```json
{
  "success": true,
  "data": {
    "success": true,
    "profileId": 123,
    "profileVersion": 1,
    "message": "Answers saved and profile created"
  }
}
```

### GET /api/questionnaire/answers

Получить все ответы пользователя для активной анкеты.

**Запрос:**
```http
GET /api/questionnaire/answers
Headers:
  X-Telegram-Init-Data: <telegram_init_data>
```

**Ответ:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "userId": "user123",
      "questionId": 1,
      "answerValue": "John",
      "question": {
        "id": 1,
        "code": "user_name",
        "text": "Как вас зовут?",
        "type": "free_text"
      }
    }
  ]
}
```

## Profile API

### GET /api/profile/current

Получить текущий профиль кожи пользователя (последняя версия).

**Запрос:**
```http
GET /api/profile/current
Headers:
  X-Telegram-Init-Data: <telegram_init_data>
```

**Ответ:**
```json
{
  "success": true,
  "data": {
    "id": 123,
    "userId": "user123",
    "version": 1,
    "skinType": "dry",
    "concerns": ["moisturizing", "anti-aging"],
    "diagnoses": ["eczema"],
    "createdAt": "2024-01-01T00:00:00Z",
    "updatedAt": "2024-01-01T00:00:00Z"
  }
}
```

**Ошибки:**
- `404` - Профиль не найден

## Plan API

### GET /api/plan

Получить текущий план ухода за кожей.

**Запрос:**
```http
GET /api/plan?profileId=123
Headers:
  X-Telegram-Init-Data: <telegram_init_data>
```

**Параметры:**
- `profileId` (optional) - ID профиля для read-your-write консистентности

**Ответ:**
```json
{
  "success": true,
  "data": {
    "id": 456,
    "userId": "user123",
    "profileId": 123,
    "profileVersion": 1,
    "steps": [
      {
        "day": 1,
        "products": [...]
      }
    ],
    "createdAt": "2024-01-01T00:00:00Z"
  }
}
```

### GET /api/plan/generate

Запустить генерацию плана ухода.

**Запрос:**
```http
GET /api/plan/generate?profileId=123
Headers:
  X-Telegram-Init-Data: <telegram_init_data>
```

**Параметры:**
- `profileId` (required) - ID профиля кожи

**Ответ:**
```json
{
  "success": true,
  "data": {
    "status": "generating",
    "profileId": 123
  }
}
```

**Ошибки:**
- `400` - Не указан profileId
- `404` - Профиль не найден

### GET /api/plan/status

Проверить статус генерации плана.

**Запрос:**
```http
GET /api/plan/status?profileId=123
Headers:
  X-Telegram-Init-Data: <telegram_init_data>
```

**Ответ:**
```json
{
  "success": true,
  "data": {
    "status": "completed",
    "planId": 456,
    "profileId": 123
  }
}
```

**Статусы:**
- `generating` - Генерация в процессе
- `completed` - Генерация завершена
- `error` - Ошибка генерации

## Коды ошибок

- `200` - Успешный запрос
- `400` - Неверный запрос (недостаточно параметров, неверный формат данных)
- `401` - Не авторизован (отсутствует или неверный X-Telegram-Init-Data)
- `404` - Ресурс не найден
- `500` - Внутренняя ошибка сервера

## Примеры использования

### Сохранение ответов анкеты

```typescript
const response = await fetch('/api/questionnaire/answers', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Telegram-Init-Data': window.Telegram.WebApp.initData,
  },
  body: JSON.stringify({
    questionnaireId: 1,
    answers: [
      { questionId: 1, answerValue: 'John' },
      { questionId: 2, answerValue: 'dry' },
    ],
  }),
});

const data = await response.json();
```

### Получение профиля

```typescript
const response = await fetch('/api/profile/current', {
  headers: {
    'X-Telegram-Init-Data': window.Telegram.WebApp.initData,
  },
});

const data = await response.json();
if (data.success) {
  const profile = data.data;
  console.log('Skin type:', profile.skinType);
}
```

### Генерация плана

```typescript
const response = await fetch(`/api/plan/generate?profileId=${profileId}`, {
  headers: {
    'X-Telegram-Init-Data': window.Telegram.WebApp.initData,
  },
});

// Проверяем статус
const statusResponse = await fetch(`/api/plan/status?profileId=${profileId}`, {
  headers: {
    'X-Telegram-Init-Data': window.Telegram.WebApp.initData,
  },
});
```

## Rate Limiting

Некоторые endpoints имеют ограничение на количество запросов:
- `/api/admin/login` - 5 запросов в минуту

## Кэширование

Некоторые endpoints возвращают заголовки кэширования:
- `/api/questionnaire/active` - `Cache-Control: public, max-age=3600` (1 час)
- `/api/profile/current` - `Cache-Control: private, max-age=300` (5 минут)
