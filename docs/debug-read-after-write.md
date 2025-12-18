# Диагностика read-after-write проблемы

## Что было добавлено

Добавлено детальное логирование для диагностики проблемы, когда профиль создается, но сразу после этого не находится при чтении.

## Где смотреть логи

### 1. Vercel Dashboard
- Перейдите в ваш проект на Vercel
- Откройте вкладку **Logs** или **Functions**
- Фильтруйте по `DEBUG:` для быстрого поиска

### 2. Что искать в логах

#### После POST /api/questionnaire/answers:

Ищите строки с `DEBUG: profiles count inside TX after create`:
```
DEBUG: profiles count inside TX after create { userId: "...", createdId: "...", countInsideTx: 1, profileVersion: 1 }
```

**Ожидаемый результат:** `countInsideTx` должен быть >= 1

#### После GET /api/profile/current или GET /api/plan:

Ищите строки с `DEBUG: DB identity`:
```
DEBUG: DB identity in profile/current { userId: "...", dbIdentity: { current_database: "...", current_schema: "public" } }
DEBUG: profiles count before getCurrentProfile { userId: "...", profilesCountBefore: 1 }
```

**Что проверить:**
1. **DB identity** - все endpoints должны показывать одинаковые `current_database` и `current_schema`
2. **profilesCountBefore** - должен совпадать с реальным количеством профилей в БД

#### В getCurrentProfile:

Ищите строки с `DEBUG: profiles found in getCurrentProfile`:
```
DEBUG: profiles found in getCurrentProfile { userId: "...", profilesCount: 1, profileIds: ["..."] }
```

**Ожидаемый результат:** `profilesCount` должен быть >= 1, если профиль был создан

## Интерпретация результатов

### Сценарий 1: Разные DB identity
**Симптом:** В разных endpoints разные `current_database` или `current_schema`

**Причина:** Разные подключения к БД (разные DATABASE_URL, разные окружения, Prisma Accelerate/Neon branch)

**Решение:** Проверить env переменные на Vercel:
- `DATABASE_URL` должен быть одинаковым везде
- Убедиться, что нет `POSTGRES_URL` или `POSTGRES_PRISMA_URL`, которые переопределяют `DATABASE_URL`

### Сценарий 2: countInsideTx = 1, но profilesCountBefore = 0
**Симптом:** В транзакции профиль есть (`countInsideTx = 1`), но при чтении его нет (`profilesCountBefore = 0`)

**Причина:** Read-replica lag или eventual consistency

**Решение:** 
- Использовать `profileId` из ответа `/api/questionnaire/answers` для последующих запросов
- Добавить задержку или retry логику
- Использовать read-your-write через `?profileId=` параметр

### Сценарий 3: Одинаковые DB identity, но profilesCountBefore = 0
**Симптом:** DB identity одинаковые, но профилей не находится

**Причина:** 
- Транзакция откатилась, но ответ 200 был возвращен
- Разные userId между запросами
- Проблема с миграциями/схемой БД

**Решение:**
- Проверить, что транзакция действительно коммитится
- Проверить логику возврата ответа в `/api/questionnaire/answers`
- Убедиться, что `userId` одинаковый в обоих запросах

## Пример правильных логов

```
POST /api/questionnaire/answers:
  DEBUG: profiles count inside TX after create { userId: "user123", createdId: "profile456", countInsideTx: 1 }
  DEBUG: DB identity in questionnaire/answers { userId: "user123", dbIdentity: { current_database: "neondb", current_schema: "public" } }

GET /api/profile/current:
  DEBUG: DB identity in profile/current { userId: "user123", dbIdentity: { current_database: "neondb", current_schema: "public" } }
  DEBUG: profiles count before getCurrentProfile { userId: "user123", profilesCountBefore: 1 }
  DEBUG: profiles found in getCurrentProfile { userId: "user123", profilesCount: 1, profileIds: ["profile456"] }
```

## Быстрый чеклист

- [ ] Все `DEBUG: DB identity` показывают одинаковые `current_database` и `current_schema`
- [ ] `countInsideTx` после создания >= 1
- [ ] `profilesCountBefore` в GET запросах >= 1 (если профиль был создан)
- [ ] `profilesCount` в `getCurrentProfile` >= 1 (если профиль был создан)
- [ ] `userId` одинаковый во всех логах

## Следующие шаги

После проверки логов:
1. Если DB identity разные - исправить env переменные
2. Если countInsideTx = 1, но profilesCountBefore = 0 - добавить workaround с profileId
3. Если все одинаково, но профиль не находится - проверить транзакции и логику создания
