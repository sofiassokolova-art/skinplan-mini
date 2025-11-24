# SkinIQ - Архитектура проекта

## Общая схема

```
Клиенты
├── Пользователь → Telegram → Mini App (WebApp)
└── Админ/Эксперт → Веб-панель /admin

Фронтенд
├── /(miniapp) — интерфейс анкеты и рекомендаций (Next.js App Router)
└── /admin — CMS для продуктов и анкеты

Бэкенд
└── Next.js API (app/api/.../route.ts)
    ├── Авторизация через Telegram
    ├── Приём и обработка ответов анкеты
    ├── Расчёт профиля кожи
    ├── Выдача рекомендаций
    └── Admin-API для CMS

Данные
└── PostgreSQL (Neon)
    ├── users
    ├── skin_profiles
    ├── questionnaires (версионирование)
    ├── products (каталог)
    └── recommendation_rules (правила)
```

## Структура базы данных

### Основные таблицы

1. **users** — пользователи Telegram
2. **skin_profiles** — профили кожи, рассчитанные из анкеты
3. **questionnaires** — версии анкет
4. **question_groups** — логические блоки вопросов
5. **questions** — вопросы анкеты
6. **answer_options** — варианты ответов с score_json
7. **user_answers** — ответы пользователей
8. **brands** — бренды продуктов
9. **products** — каталог продуктов
10. **recommendation_rules** — правила рекомендаций (JSON-логика)
11. **recommendation_sessions** — лог выданных рекомендаций

## API Endpoints

### Авторизация
- `POST /api/auth/telegram` — авторизация через Telegram WebApp initData

### Анкета
- `GET /api/questionnaire/active` — получение активной анкеты
- `POST /api/questionnaire/answers` — сохранение ответов и расчёт профиля

### Профиль
- `GET /api/profile/current` — текущий профиль пользователя

### Рекомендации
- `GET /api/recommendations` — получение рекомендаций продуктов

### Admin API (будущее)
- `GET /api/admin/products` — список продуктов
- `POST /api/admin/products` — создание продукта
- `PUT /api/admin/products/:id` — обновление продукта
- `GET /api/admin/questionnaire` — управление анкетой
- `GET /api/admin/rules` — управление правилами

## Процесс работы

### 1. Пользователь открывает мини-ап

1. Telegram передает `initData` в мини-апп
2. Фронтенд отправляет `initData` на `/api/auth/telegram`
3. Бэкенд валидирует подпись Telegram
4. Создаётся/обновляется пользователь в БД
5. Возвращается JWT токен

### 2. Заполнение анкеты

1. Фронтенд запрашивает `/api/questionnaire/active`
2. Отображается структура анкеты (группы, вопросы, варианты)
3. Пользователь заполняет анкету
4. Ответы отправляются на `/api/questionnaire/answers`
5. Бэкенд:
   - Сохраняет ответы в `user_answers`
   - Агрегирует баллы из `score_json` вариантов
   - Рассчитывает профиль (тип кожи, уровни, риски)
   - Сохраняет в `skin_profiles`

### 3. Получение рекомендаций

1. Фронтенд запрашивает `/api/recommendations`
2. Бэкенд:
   - Получает последний профиль пользователя
   - Находит подходящее правило (`recommendation_rules`)
   - Проверяет условия (JSON-логика)
   - Фильтрует продукты по правилам
   - Группирует по шагам рутины
   - Сохраняет сессию в `recommendation_sessions`
3. Возвращает структурированные рекомендации

## Версионирование анкеты

- Каждая анкета имеет `version` (int)
- Можно создать новую версию, копируя текущую
- Старые ответы привязаны к старой версии
- Профили рассчитываются с указанием версии логики

## Правила рекомендаций

Правила хранятся в JSON формате:

```json
{
  "conditions": {
    "skin_type": ["oily"],
    "acne_level": { "gte": 2 },
    "age_group": ["18_25", "26_30"]
  },
  "steps": {
    "cleanser": {
      "category": ["cleanser"],
      "skin_types": ["oily"],
      "max_items": 2
    },
    "treatment": {
      "concerns": ["acne"],
      "max_items": 3
    }
  }
}
```

## Миграция с текущего проекта

1. Текущий проект использует Vite + React Router
2. Новый проект — Next.js App Router
3. Компоненты можно перенести с минимальными изменениями
4. Данные из localStorage переносятся в БД

## Настройка окружения

См. `.env.example` для необходимых переменных:
- `DATABASE_URL` — строка подключения к PostgreSQL (Neon)
- `TELEGRAM_BOT_TOKEN` — токен бота для валидации
- `JWT_SECRET` — секрет для JWT токенов
