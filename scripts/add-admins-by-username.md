# Добавление админов по username

## Проблема
У нас есть username'ы, но для whitelist нужны telegramId (числа).

## Решение

### Шаг 1: Получить telegramId для каждого админа

Попросите каждого админа:
1. Написать боту [@userinfobot](https://t.me/userinfobot)
2. Скопировать свой `id` (число, например: `123456789`)
3. Прислать вам этот ID

### Шаг 2: Добавить в whitelist

После получения всех ID, запустите:

```bash
# София (@sofiagguseynova)
npx tsx scripts/add-admin.ts <telegramId_софии> "София"

# Максим (@MA_Shishov)
npx tsx scripts/add-admin.ts <telegramId_максима> "Максим"

# Марьям (@gde_maryam)
npx tsx scripts/add-admin.ts <telegramId_марьям> "Марьям"
```

### Альтернативный способ (если админ уже пытался войти)

Если админ уже пытался войти через бота, его telegramId может быть в логах сервера или в базе данных (таблица `users`).

Можно проверить:
```bash
npx tsx -e "import { PrismaClient } from '@prisma/client'; const p = new PrismaClient(); p.user.findMany({ where: { username: { in: ['sofiagguseynova', 'MA_Shishov', 'gde_maryam'] } } }).then(users => { console.log('Найденные пользователи:'); users.forEach(u => console.log('-', u.username, '| telegramId:', u.telegramId)); p.\$disconnect(); });"
```

Если найдутся пользователи с этими username, можно использовать их telegramId.

