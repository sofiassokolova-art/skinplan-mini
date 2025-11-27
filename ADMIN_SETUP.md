# Настройка доступа к админ-панели

## Как получить свой Telegram ID

1. Напишите боту [@userinfobot](https://t.me/userinfobot)
2. Он пришлет ваш `id` (например: `123456789`)
3. Используйте этот ID для добавления в whitelist

## Добавление админов в whitelist

### Вариант 1: Через скрипт (рекомендуется)

1. Откройте `scripts/seed-admins.ts`
2. Замените `null` на реальные telegramId админов
3. Запустите:
```bash
npx tsx scripts/seed-admins.ts
```

### Вариант 2: Через Prisma Studio

```bash
npx prisma studio
```

1. Откройте таблицу `admin_whitelist`
2. Добавьте новую запись:
   - `telegramId`: ваш Telegram ID (число, например: `123456789`)
   - `name`: ваше имя
   - `role`: `admin` или `editor`
   - `isActive`: `true`

### Вариант 3: Через SQL (Neon/Supabase)

```sql
INSERT INTO admin_whitelist (telegram_id, name, role, is_active)
VALUES 
  ('123456789', 'София', 'admin', true),
  ('987654321', 'Максим', 'admin', true),
  ('555555555', 'Марьям', 'admin', true);
```

## Как заходить в админку

### Правильный способ (через бота):

1. Напишите боту `@skiniq_bot` команду `/admin`
2. Бот ответит с кнопкой "Открыть админку"
3. Нажмите кнопку → откроется WebApp с админкой
4. Авторизация произойдет автоматически

### Альтернативный способ (прямая ссылка):

Если вы уже в whitelist, можете открыть напрямую:
- https://skinplan-mini.vercel.app/admin

Но лучше использовать `/admin` команду в боте для правильной инициализации Telegram WebApp.

## Список админов для добавления

- @sofiagguseynova - София
- @MA_Shishov - Максим  
- @gde_maryam - Марьям

**Важно:** Получите их Telegram ID через @userinfobot перед добавлением в whitelist.

