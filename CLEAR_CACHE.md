# Очистка кэша для генерации плана

## Способ 1: Через API endpoint (рекомендуется)

Вызовите API endpoint из консоли браузера или через curl:

```javascript
// В консоли браузера (на странице приложения)
fetch('/api/admin/clear-cache', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Telegram-Init-Data': window.Telegram.WebApp.initData,
  },
})
.then(r => r.json())
.then(data => console.log('✅ Кэш очищен:', data))
.catch(err => console.error('❌ Ошибка:', err));
```

Или через API клиент:

```javascript
import { api } from '@/lib/api';
await api.clearCache();
```

## Способ 2: Через скрипт (если знаете userId)

Создайте файл `scripts/clear-user-cache.ts`:

```typescript
import { prisma } from '../lib/db';
import { invalidateAllUserCache } from '../lib/cache';

const userId = 'YOUR_USER_ID'; // Замените на ваш userId

async function clearCache() {
  // Очищаем кэш
  await invalidateAllUserCache(userId);
  
  // Удаляем RecommendationSession
  await prisma.recommendationSession.deleteMany({
    where: { userId },
  });
  
  console.log('✅ Кэш и сессии очищены для пользователя:', userId);
  
  await prisma.$disconnect();
}

clearCache();
```

Запустите:
```bash
npx tsx scripts/clear-user-cache.ts
```

## Что очищается:

1. ✅ Весь кэш плана (`plan:userId:*`)
2. ✅ Весь кэш рекомендаций (`recommendations:userId:*`)
3. ✅ Все RecommendationSession для пользователя

## После очистки:

План будет автоматически перегенерирован при следующем запросе к `/api/plan/generate` или при открытии страницы `/plan`.
