# Как попасть в админ-панель

## Шаг 1: Убедитесь, что вы админ в базе данных

Ваш Telegram username должен быть в базе данных как администратор. У вас уже настроен username: `@sofiagguseynova`

Чтобы создать/обновить админа, выполните:
```bash
npm run seed:admin
```

Это создаст админа с username `sofiagguseynova` в базе данных.

## Шаг 2: Откройте страницу входа через Telegram Mini App

**Важно:** Админ-панель доступна ТОЛЬКО через Telegram Mini App!

### Вариант 1: Через Telegram бота
1. Откройте вашего Telegram бота
2. Отправьте команду `/start`
3. Нажмите на кнопку "Открыть SkinIQ Mini App"
4. В открывшемся приложении перейдите по адресу: `/admin/login`
   - Полный URL: `https://skinplan-mini.vercel.app/admin/login`

### Вариант 2: Прямая ссылка в Telegram
1. Откройте Telegram
2. Отправьте себе сообщение со ссылкой:
   ```
   https://t.me/your_bot_name?start=admin
   ```
   Или создайте кнопку в боте, которая открывает Mini App по адресу `/admin/login`

## Шаг 3: Авторизация

1. На странице `/admin/login` нажмите кнопку "Войти через Telegram"
2. Система автоматически проверит ваш Telegram username
3. Если вы админ (`@sofiagguseynova`), вас перенаправит в админ-панель
4. Если нет доступа - получите ошибку "Access denied"

## Структура админ-панели

После входа вы попадете на:
- **Дашборд**: `/admin` - главная страница админ-панели
- **Продукты**: `/admin/products` - управление продуктами
- **Анкета**: `/admin/questionnaire` - просмотр и редактирование анкеты
- **Правила**: `/admin/rules` - управление правилами рекомендаций

## Отладка проблем

Если у вас не получается войти:

1. Откройте страницу отладки: `/admin/debug`
2. Проверьте:
   - Доступен ли Telegram WebApp (`telegram.available`)
   - Есть ли initData (`telegram.initData`)
   - Какой ваш Telegram username (`telegram.user.username`)
   - Существует ли админ в базе данных

3. Убедитесь, что:
   - Вы открыли страницу через Telegram Mini App (не просто в браузере)
   - Ваш Telegram username совпадает с тем, что в базе данных (`sofiagguseynova`)
   - Админ создан в базе данных (выполните `npm run seed:admin`)

## Важно

- **Админ-панель работает только через Telegram Mini App!**
- Открытие `/admin/login` в обычном браузере не сработает
- Авторизация происходит автоматически на основе Telegram username
- Токен хранится в `localStorage` как `admin_token`

## Быстрый доступ

Если у вас настроен Telegram бот, самый простой способ:
1. Откройте бота в Telegram
2. Создайте кнопку, которая открывает Mini App с URL: `https://skinplan-mini.vercel.app/admin/login`
3. Или просто отправьте себе ссылку на Mini App в Telegram