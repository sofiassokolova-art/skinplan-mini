# Решение проблем с админ-панелью

## Ошибка "Unauthorized"

### Причина 1: Админ не создан в базе данных

**Решение:**
1. Откройте Neon Dashboard → SQL Editor
2. Проверьте наличие админа:
   ```sql
   SELECT * FROM admins WHERE telegram_username = 'sofiagguseynova';
   ```
3. Если записи нет, создайте:
   ```sql
   INSERT INTO admins (telegram_username, role, created_at, updated_at)
   VALUES ('sofiagguseynova', 'admin', NOW(), NOW());
   ```

### Причина 2: Страница открыта не через Telegram Mini App

**Решение:**
- Откройте страницу `/admin/login` **через Telegram бота**
- Не открывайте напрямую в браузере

### Причина 3: Telegram username не совпадает

**Решение:**
1. Проверьте ваш точный Telegram username (без @)
2. Убедитесь, что в базе данных записано точно так же
3. Проверьте регистр букв (должно быть `sofiagguseynova` в нижнем регистре)

### Причина 4: Неправильный JWT_SECRET

**Решение:**
1. Убедитесь, что `JWT_SECRET` добавлен в Vercel Environment Variables
2. Перезапустите деплой после добавления переменной

## Проверка через отладочную страницу

Откройте `/admin/debug` - там будет вся информация о текущем состоянии:
- Наличие токена в localStorage
- Доступность Telegram WebApp
- Результат проверки токена
- Информация о пользователе Telegram

## Проверка логов в Vercel

1. Откройте Vercel Dashboard → Ваш проект → Deployments
2. Выберите последний деплой → Logs
3. Найдите ошибки, связанные с `/api/admin/login`

## Быстрая проверка

1. ✅ Админ создан в базе данных?
2. ✅ Страница открыта через Telegram Mini App?
3. ✅ JWT_SECRET добавлен в Vercel?
4. ✅ TELEGRAM_BOT_TOKEN добавлен в Vercel?
5. ✅ DATABASE_URL правильный?

