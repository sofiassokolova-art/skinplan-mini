# Критическая проблема: Таблица questionnaires не существует в продакшене

## Проблема

В логах продакшена видна ошибка:
```
The table `public.questionnaires` does not exist in the current database.
```

Это означает, что миграции Prisma не были применены в продакшене.

## Решение

### 1. Применить миграции в продакшене

Выполните вручную на сервере или через CI/CD:

```bash
npx prisma migrate deploy
```

Или если используете Vercel, добавьте в `package.json`:

```json
{
  "scripts": {
    "postinstall": "prisma generate && prisma migrate deploy"
  }
}
```

**⚠️ ВНИМАНИЕ:** `prisma migrate deploy` применяет все непримененные миграции. Убедитесь, что:
- Все миграции протестированы локально
- У вас есть бэкап БД
- Вы понимаете, какие изменения будут применены

### 2. Проверить наличие таблиц

После применения миграций проверьте:

```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name LIKE 'question%';
```

Должны быть таблицы:
- `questionnaires`
- `question_groups`
- `questions`
- `answer_options`
- `user_answers`
- `questionnaire_progress`
- `questionnaire_submissions`

### 3. Заполнить данные

После применения миграций заполните анкету:

```bash
npm run seed:questionnaire-v2
```

### 4. Проверить работу API

После применения миграций проверьте:

```bash
curl https://www.proskiniq.ru/api/questionnaire/active
```

Должен вернуться статус 200 с данными анкеты, а не 500 ошибка.

## Альтернативное решение (если миграции не работают)

Если `prisma migrate deploy` не работает, можно использовать `prisma db push`:

```bash
npx prisma db push
```

**⚠️ ВНИМАНИЕ:** `db push` не создает миграции и может быть опасным в продакшене. Используйте только если миграции не работают.

## Профилактика

Чтобы избежать этой проблемы в будущем:

1. **Добавить проверку миграций в CI/CD:**
   ```yaml
   - name: Check migrations
     run: npx prisma migrate status
   ```

2. **Добавить health check endpoint:**
   ```typescript
   // app/api/health/route.ts
   export async function GET() {
     try {
       await prisma.$queryRaw`SELECT 1`;
       return NextResponse.json({ status: 'ok' });
     } catch (error) {
       return NextResponse.json({ status: 'error' }, { status: 500 });
     }
   }
   ```

3. **Мониторинг:**
   - Настроить алерты на ошибки Prisma
   - Проверять логи на наличие ошибок "table does not exist"

## Текущий статус

- ✅ Добавлена обработка ошибки отсутствия таблицы в API route
- ⏳ Требуется применить миграции в продакшене
- ⏳ Требуется заполнить данные анкеты

