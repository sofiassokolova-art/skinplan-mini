# Где хранятся логи

## 1. База данных PostgreSQL (основное хранилище)

**Таблица:** `client_logs` (модель `ClientLog`)

**Что записывается:**
- Ошибки (`error`) - автоматически через `logger.error()`
- Предупреждения (`warn`) - автоматически через `logger.warn()`
- Информационные логи (`info`) - только если явно указано `saveToDb: true`
- Клиентские логи - через `/api/logs` endpoint

**Структура:**
```sql
client_logs
  - id (String)
  - user_id (String)
  - level (String) - 'debug' | 'info' | 'warn' | 'error'
  - message (String)
  - context (JSON) - дополнительный контекст
  - user_agent (String?)
  - url (String?)
  - created_at (DateTime)
```

**Автоматическая очистка:** Логи старше 7 дней автоматически удаляются (1% вероятность при каждом запросе к `/api/logs`)

## 2. Vercel Logs (консольные логи)

**Где:** Vercel Dashboard → Your Project → Logs

**Что записывается:**
- Все `console.log()`, `console.warn()`, `console.error()`
- Логи от `logger.info()`, `logger.warn()`, `logger.error()`
- Логи серверных функций (API routes, server components)

**Как посмотреть:**
1. Зайдите в Vercel Dashboard
2. Выберите проект
3. Перейдите в раздел "Logs"
4. Фильтруйте по времени, функции, уровню

## 3. Как просмотреть логи из базы данных

### Вариант 1: Через скрипт

```bash
# Логи конкретного пользователя
npx tsx scripts/check-user-logs-643160759.ts

# Последние ошибки
npx tsx scripts/check-logs.ts

# Логи за последние 24 часа
npx tsx scripts/check-recent-logs.ts
```

### Вариант 2: Через API (требует авторизации админа)

```bash
# Получить логи пользователя
GET /api/admin/logs?userId=cmieq8w2v0000js0480u0n0ax

# Получить только ошибки
GET /api/admin/logs?level=error

# С фильтрацией по дате
GET /api/admin/logs?startDate=2025-12-01&endDate=2025-12-07
```

### Вариант 3: Через админ-панель

Откройте `/admin/logs` в браузере (требует авторизации админа)

## 4. Где искать логи генерации плана

**Серверные логи (Vercel):**
- `logger.info('Plan generated successfully')` - в Vercel Logs
- `logger.error('Error during plan generation')` - в Vercel Logs и БД (если есть userId)

**Клиентские логи (БД):**
- `submitAnswers called` - через `/api/logs`
- `Plan generated successfully` - через `/api/logs`
- React ошибки - через ErrorBoundary → `/api/logs`

## 5. Проверка логов для конкретного пользователя

```bash
# Ваш пользователь (643160759)
npx tsx scripts/check-user-logs-643160759.ts
```

Это покажет:
- Последние 50 логов из БД
- Последние ответы на анкету
- Последние RecommendationSession
- Последние профили

## 6. Важно

- **Логи уровня `info`** по умолчанию НЕ сохраняются в БД (только в консоль)
- Для сохранения `info` в БД нужно явно указать `saveToDb: true`
- **Логи уровня `error` и `warn`** автоматически сохраняются в БД (если передан `userId`)
- **Клиентские логи** (через `/api/logs`) всегда сохраняются в БД
