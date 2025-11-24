# Инструкция по миграции на новую архитектуру

## Этап 1: Подготовка

### 1.1. Установка зависимостей

```bash
# Установить зависимости Next.js
npm install next@latest react@latest react-dom@latest

# Установить Prisma и клиент
npm install @prisma/client
npm install -D prisma

# Установить JWT
npm install jsonwebtoken
npm install -D @types/jsonwebtoken
```

### 1.2. Настройка базы данных

1. Создать базу данных на [Neon](https://neon.tech) или другом PostgreSQL провайдере
2. Скопировать `.env.example` в `.env` и заполнить `DATABASE_URL`
3. Выполнить миграции Prisma:

```bash
npx prisma generate
npx prisma db push
```

### 1.3. Настройка Telegram бота

1. Создать бота через [@BotFather](https://t.me/botfather)
2. Получить токен бота
3. Добавить токен в `.env` как `TELEGRAM_BOT_TOKEN`

## Этап 2: Перенос компонентов

### 2.1. Структура Next.js

Создать структуру папок:
```
app/
├── (miniapp)/
│   ├── page.tsx          # Главная страница мини-аппа
│   ├── quiz/
│   │   └── page.tsx      # Страница анкеты
│   └── plan/
│       └── page.tsx      # Страница плана ухода
├── admin/
│   ├── login/
│   │   └── page.tsx
│   ├── products/
│   │   └── page.tsx
│   └── questionnaire/
│       └── page.tsx
└── api/
    └── ...               # API роуты
```

### 2.2. Перенос UI компонентов

Компоненты из `src/ui/` и `src/components/` можно использовать как есть:
- Перенести в `components/`
- Адаптировать импорты для Next.js (использовать `'@/components'`)

### 2.3. Адаптация страниц

**Quiz.tsx** → `app/(miniapp)/quiz/page.tsx`:
- Заменить `useNavigate` на `next/navigation` → `useRouter`
- Заменить `localStorage` на вызовы API
- Использовать серверные компоненты где возможно

**Home.tsx** → `app/(miniapp)/page.tsx`:
- Заменить захардкоженные продукты на данные из API
- Заменить `localStorage` на вызовы API
- Интегрировать с `/api/recommendations`

## Этап 3: Заполнение данных

### 3.1. Создание анкеты

Создать скрипт для заполнения начальной анкеты:

```typescript
// scripts/seed-questionnaire.ts
import { prisma } from '../lib/db';

async function seedQuestionnaire() {
  // Создать анкету
  const questionnaire = await prisma.questionnaire.create({
    data: {
      name: 'Базовая анкета v1',
      version: 1,
      isActive: true,
      // ... вопросы и варианты
    },
  });
  
  console.log('Questionnaire created:', questionnaire.id);
}

seedQuestionnaire();
```

### 3.2. Добавление продуктов

Создать админ-панель или скрипт для добавления продуктов из текущего кода.

### 3.3. Создание правил рекомендаций

Создать правила на основе текущей логики подбора продуктов.

## Этап 4: Тестирование

1. Протестировать авторизацию через Telegram
2. Протестировать заполнение анкеты
3. Протестировать получение рекомендаций
4. Протестировать отображение плана ухода

## Этап 5: Деплой

1. Настроить Vercel проект
2. Добавить переменные окружения в Vercel
3. Запустить миграции БД в продакшене
4. Задеплоить приложение

## Рекомендации

- Начать с MVP: авторизация + базовая анкета + простые рекомендации
- Постепенно добавлять функционал (фото, админ-панель, аналитика)
- Сохранить старую версию как backup до полного перехода
