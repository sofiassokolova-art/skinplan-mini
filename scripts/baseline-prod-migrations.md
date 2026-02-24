# Базовая настройка прод-БД (один раз)

Прод-база не содержит таблиц, которые ожидают миграции. Нужно:
1) создать полную схему из `schema.prisma`;
2) пометить все миграции как уже применённые.

**Важно:** выполняй с продовым `DATABASE_URL` (в `.env` или `export`).

## Шаг 1. Создать схему в проде

```bash
npx prisma db push
```

Это создаст/обновит все таблицы по текущему `schema.prisma` без применения папки миграций.

## Шаг 2. Пометить все миграции как применённые

Чтобы при следующих деплоях Prisma не пытался заново применять эти миграции, отметь их как применённые (по одной):

```bash
npx prisma migrate resolve --applied "add_db_indexes"
npx prisma migrate resolve --applied "20250218120000_add_admin_email_whitelist"
npx prisma migrate resolve --applied "20251203154254_add_feedback_type"
npx prisma migrate resolve --applied "20251203154304_add_feedback_type"
npx prisma migrate resolve --applied "20251203163306_add_streaks_to_plan_progress"
npx prisma migrate resolve --applied "20251203163313_add_streaks_to_plan_progress"
npx prisma migrate resolve --applied "20251216162041_add_payments_and_entitlements"
npx prisma migrate resolve --applied "20251220185540_add_questionnaire_progress"
```

## Шаг 3. Проверка

```bash
npx prisma migrate status
```

Должно быть: **Database schema is up to date!** и список миграций без pending.

После этого деплой на Vercel не будет падать на миграциях.

---

## Если анкета в проде не открывается (404 «No active questionnaire found»)

В прод-БД должна быть хотя бы одна анкета с `isActive: true`. Один раз засей её:

```bash
# С продовым DATABASE_URL в .env или export
npx tsx scripts/seed-questionnaire-v2.ts
```

Или вручную в Neon SQL Editor: создай запись в `questionnaires` и поставь `is_active = true` (лучше использовать сид выше — он создаёт полную структуру с вопросами и группами).
