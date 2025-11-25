# Настройка Upstash Redis для Rate Limiting

## Зачем нужен Redis?

В serverless окружении (Vercel) каждый запрос может попасть на другой инстанс. In-memory rate limiting не работает правильно в такой архитектуре, так как счётчики не разделяются между инстансами.

**Redis** обеспечивает распределённое rate limiting, которое работает корректно в serverless окружении.

## Шаг 1: Создать Upstash Redis Database

1. Перейдите на [upstash.com](https://upstash.com/)
2. Войдите или создайте аккаунт
3. Создайте новую Redis database:
   - **Name**: `skinplan-rate-limit` (или любое другое)
   - **Region**: Выберите ближайший к Vercel (например, `eu-west-1` или `us-east-1`)
   - **Type**: Regional (достаточно для rate limiting)

## Шаг 2: Получить credentials

После создания базы данных, на странице базы вы увидите:

- **UPSTASH_REDIS_REST_URL** (например: `https://...upstash.io`)
- **UPSTASH_REDIS_REST_TOKEN** (длинный токен)

## Шаг 3: Добавить переменные окружения в Vercel

1. Откройте проект в Vercel Dashboard
2. Перейдите в **Settings** → **Environment Variables**
3. Добавьте две переменные:

```
UPSTASH_REDIS_REST_URL=https://...
UPSTASH_REDIS_REST_TOKEN=...
```

**Важно**: Добавьте эти переменные для всех окружений:
- ✅ Production
- ✅ Preview
- ✅ Development (опционально)

## Шаг 4: Перезапустить деплой

После добавления переменных окружения:

1. Перейдите в **Deployments**
2. Выберите последний деплой
3. Нажмите **Redeploy**

Или просто сделайте новый коммит и push:

```bash
git commit --allow-empty -m "Trigger redeploy for Redis setup"
git push origin main
```

## Проверка работы

После деплоя, rate limiting будет использовать Redis автоматически.

Вы можете проверить это:

1. Откройте логи Vercel Functions
2. Найдите сообщение: `✅ Using Upstash Redis for rate limiting`

Если Redis не настроен, будет использован in-memory fallback (работает только для разработки).

## Мониторинг

Upstash предоставляет dashboard для мониторинга:
- Количество команд Redis
- Latency
- Использование памяти

Перейдите в ваш проект на upstash.com и откройте вкладку **Monitoring**.

## Лимиты (бесплатный план)

Upstash Free tier предоставляет:
- 10,000 команд в день
- Достаточно для rate limiting при среднем трафике

Если нужно больше, можно перейти на платный план.

## Troubleshooting

### Rate limiting не работает

1. Проверьте, что переменные окружения добавлены в Vercel
2. Проверьте логи Vercel - должно быть сообщение о Redis
3. Если видите `⚠️ Upstash Redis not available`, проверьте переменные окружения

### Ошибки подключения

1. Убедитесь, что URL и токен скопированы правильно
2. Проверьте, что токен не истёк (они не истекают, но стоит проверить)
3. Проверьте, что база данных активна в Upstash dashboard

---

**После настройки**: Rate limiting будет работать распределённо и корректно в serverless окружении.

