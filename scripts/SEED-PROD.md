# Что засидить в прод

После деплоя и миграций выполни по порядку (из корня проекта, с `DATABASE_URL` на продовую БД).

## 1. Продукты и бренды ✅

Уже сделано (134 продукта). Если нужно перезалить или расширить:

```bash
npm run seed:products-full
# или
npx tsx scripts/seed-products-120.ts
```

## 2. Правила рекомендаций (обязательно)

Без правил планы не собираются по шагам. В проде было пусто — засидь:

```bash
npm run seed:rules
# или полный набор (68 правил):
npm run seed:rules-complete
```

## 3. Анкета (обязательно)

Должна быть одна активная анкета, иначе квиз не работает:

```bash
npm run seed:questionnaire-v2
# или
npm run seed:questionnaire-full
```

## 4. Доступ в админку

Вход по email + коду. Добавь email продового админа в белый список (код пользователь задаёт при первом входе на /admin/login):

```bash
npx tsx scripts/add-admin-email.ts your-admin@example.com
```

Добавь все нужные email по одному вызову.

## 5. Backfill mainGoals в профили (опционально)

Чтобы в админке в карточке пользователя отображались «Основной фокус» и «Проблемы» из уже сгенерированных планов:

```bash
npm run backfill:main-goals
# или
npx tsx scripts/backfill-main-goals-from-plan28.ts
```

---

**Порядок при первом запуске прода:**  
миграции → 2 (rules) → 3 (questionnaire) → 4 (admin email).  
Пункт 5 — когда уже есть пользователи с планами.
