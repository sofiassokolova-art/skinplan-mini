# Код Ревью - SkinPlan Mini App

Дата: 2025-01-XX
Ревьюер: AI Code Assistant

## 📊 Общая оценка

**Статус:** ✅ Код в рабочем состоянии, но требует рефакторинга для улучшения maintainability и производительности

**Основные проблемы:**
1. Производительность (N+1 запросы)
2. Дублирование кода
3. Слабая типизация
4. Длинные функции
5. Отсутствие транзакций

---

## 🔴 Критические проблемы

### 1. N+1 Query Problem в генерации плана

**Файл:** `app/api/plan/generate/route.ts`

**Проблема:** Множественные запросы к БД в циклах для поиска fallback продуктов

```typescript
// ❌ ПЛОХО: Запросы в цикле
for (const [baseStep, stepCategories] of missingByBaseStep.entries()) {
  const fallbackProduct = await prisma.product.findFirst({
    where: whereClause,
    // ...
  });
}
```

**Решение:**
```typescript
// ✅ ХОРОШО: Batch запрос с группировкой
const baseSteps = Array.from(missingByBaseStep.keys());
const fallbackProducts = await prisma.product.findMany({
  where: {
    OR: baseSteps.map(baseStep => ({
      step: baseStep,
      published: true,
      brand: { isActive: true },
    })),
  },
  // Группируем в памяти по baseStep
});
```

### 2. Отсутствие транзакций при обновлении профиля

**Файл:** `app/api/questionnaire/answers/route.ts`

**Проблема:** Создание/обновление ответов и профиля происходит в отдельных запросах, возможны race conditions

**Решение:**
```typescript
// ✅ Использовать транзакцию
await prisma.$transaction(async (tx) => {
  // Обновляем ответы
  const savedAnswers = await Promise.all(...);
  
  // Создаем/обновляем профиль
  const profile = await tx.skinProfile.upsert(...);
  
  // Инвалидируем кэш
  await invalidateCache(userId, profile.version);
});
```

### 3. Дублирование кода в fallback логике продуктов

**Файл:** `app/api/plan/generate/route.ts` (строки 713-798)

**Проблема:** Повторяющаяся логика для cleanser и SPF

**Решение:** Вынести в общую функцию `ensureProductsForStep()`

---

## 🟡 Важные улучшения

### 4. Избыточное использование console.log

**Файлы:** Все API routes

**Проблема:** 190+ вызовов `console.log/warn/error` вместо использования `logger`

**Решение:**
```typescript
// ❌ ПЛОХО
console.log('✅ Plan generated');
console.warn('⚠️ No products found');
console.error('❌ Error:', error);

// ✅ ХОРОШО
logger.info('Plan generated', { userId, planId });
logger.warn('No products found', { step, userId });
logger.error('Plan generation failed', { error, userId });
```

**План миграции:**
1. Заменить все `console.log` на `logger.info`
2. Заменить все `console.warn` на `logger.warn`
3. Заменить все `console.error` на `logger.error`
4. Добавить контекст (userId, metadata) в логи

### 5. Слабая типизация (использование `any`)

**Файлы:** `app/api/plan/generate/route.ts`, `app/api/recommendations/route.ts`

**Проблема:** Много мест с типом `any`, что снижает безопасность типов

**Примеры:**
```typescript
// ❌ ПЛОХО
const where: any = { published: true };
const products = products.sort((a: any, b: any) => { ... });
```

**Решение:**
```typescript
// ✅ ХОРОШО
interface ProductWhereInput {
  published: boolean;
  step?: string;
  category?: { in: string[] };
  brand?: { isActive: boolean };
}

const where: Prisma.ProductWhereInput = {
  published: true,
  // ...
};
```

### 6. Длинные функции (свыше 200 строк)

**Файл:** `app/api/plan/generate/route.ts`
- `generate28DayPlan()` - ~800 строк
- `getProductsForStep()` - имеет дублирующуюся логику

**Решение:** Разбить на меньшие функции:
```typescript
// Структура рефакторинга:
generate28DayPlan()
  ├── initializePlanGeneration()
  ├── selectProductsForSteps()
  ├── ensureRequiredProducts()  // Объединить fallback логику
  ├── buildPlan28Days()
  └── calculatePlanMetrics()
```

### 7. Дублирование логики определения проблем кожи

**Файл:** `app/api/analysis/route.ts` и `lib/skin-analysis-engine.ts`

**Проблема:** Логика определения проблем частично дублируется

**Решение:** Вынести в отдельный модуль `lib/skin-issues-calculator.ts`

### 8. Отсутствие валидации входных данных

**Файлы:** Многие API routes

**Проблема:** Нет валидации входных данных перед обработкой

**Решение:** Использовать библиотеку валидации (Zod, Yup):
```typescript
import { z } from 'zod';

const AnswerInputSchema = z.object({
  questionId: z.number().int().positive(),
  answerValue: z.string().nullable().optional(),
  answerValues: z.array(z.string()).nullable().optional(),
});

// В route handler:
const validatedData = AnswerInputSchema.parse(await request.json());
```

---

## 🟢 Рекомендации по улучшению

### 9. Оптимизация запросов к БД

**Проблема:** Множественные отдельные запросы вместо одного с `include`

**Пример из `app/api/recommendations/route.ts`:**
```typescript
// ❌ ПЛОХО: 2 запроса
const session = await prisma.recommendationSession.findFirst(...);
const products = await prisma.product.findMany({
  where: { id: { in: session.products } },
  include: { brand: true },
});
```

**Решение:**
```typescript
// ✅ ХОРОШО: 1 запрос с include
const session = await prisma.recommendationSession.findFirst({
  include: {
    products: {
      include: { brand: true },
    },
  },
});
```

### 10. Кэширование результатов тяжелых вычислений

**Файл:** `app/api/analysis/route.ts`

**Проблема:** `calculateSkinIssues()` вызывается каждый раз, хотя результаты могут быть закэшированы

**Решение:**
```typescript
// Добавить кэширование на уровне Redis/KV
const cacheKey = `skin-issues:${profile.id}:${profile.version}`;
const cachedIssues = await getCachedIssues(cacheKey);
if (cachedIssues) return cachedIssues;

const issues = calculateSkinIssues(profile, userAnswers, skinScores);
await setCachedIssues(cacheKey, issues, { ttl: 3600 });
```

### 11. Обработка ошибок - единый формат

**Проблема:** Разные форматы ошибок в разных endpoints

**Решение:** Создать utility функцию:
```typescript
// lib/api-error-handler.ts
export function handleApiError(error: unknown, context: Record<string, any>) {
  logger.error('API Error', { error, ...context });
  
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    // Обработка специфичных ошибок Prisma
  }
  
  return NextResponse.json(
    { 
      error: error instanceof Error ? error.message : 'Internal server error',
      ...(process.env.NODE_ENV === 'development' && { stack: error.stack }),
    },
    { status: 500 }
  );
}
```

### 12. Константы вместо магических чисел/строк

**Проблема:** Хардкод значений в коде

**Пример:**
```typescript
// ❌ ПЛОХО
if (retryCount < 3) { ... }
await new Promise(resolve => setTimeout(resolve, 2000));
take: (step.max_items || 3) * 2,
```

**Решение:**
```typescript
// ✅ ХОРОШО
const MAX_RETRY_ATTEMPTS = 3;
const RETRY_DELAY_MS = 2000;
const PRODUCT_SELECTION_MULTIPLIER = 2;
const DEFAULT_MAX_ITEMS = 3;
```

### 13. Рефакторинг клиентского кода

**Файл:** `app/(miniapp)/plan/page.tsx`

**Проблема:** Сложная логика retry в компоненте

**Решение:** Вынести в custom hook:
```typescript
// hooks/usePlanLoader.ts
export function usePlanLoader() {
  const [plan, setPlan] = useState<PlanData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const loadPlan = useCallback(async (retryCount = 0) => {
    // Логика загрузки с retry
  }, []);
  
  useEffect(() => {
    loadPlan();
  }, [loadPlan]);
  
  return { plan, loading, error, retry: () => loadPlan(0) };
}
```

### 14. Улучшение типизации компонентов

**Проблема:** Использование `any` в props и state

**Решение:**
```typescript
// ✅ Строгая типизация
interface StepCardProps {
  step: DayStep; // не any
  product: Product | null; // не any
  skinIssues?: string[];
  onToggleWishlist: (productId: number) => void;
}
```

### 15. Оптимизация сортировки продуктов

**Файл:** `app/api/recommendations/route.ts`

**Проблема:** Сортировка в памяти после запроса (строка 111)

**Решение:** Сортировка на уровне БД:
```typescript
const products = await prisma.product.findMany({
  // ...
  orderBy: [
    { isHero: 'desc' },
    { priority: 'desc' },
    { createdAt: 'desc' },
  ],
  take: step.max_items || 3, // Не нужно брать больше
});
```

---

## 📈 Метрики качества кода

### Текущее состояние:
- **Cyclomatic Complexity:** Высокая (некоторые функции > 20)
- **Code Duplication:** ~15-20%
- **Test Coverage:** Низкая (нужно добавить тесты)
- **Type Safety:** Средняя (много `any`)
- **Error Handling:** Хорошая, но не единообразная

### Целевое состояние:
- **Cyclomatic Complexity:** < 10 для всех функций
- **Code Duplication:** < 5%
- **Test Coverage:** > 70%
- **Type Safety:** 100% (без `any` в продакшене)
- **Error Handling:** Единый формат через utility

---

## 🔧 Приоритетный план рефакторинга

### Фаза 1 (Критично) - 1-2 недели:
1. ✅ Исправить N+1 запросы в генерации плана
2. ✅ Добавить транзакции для атомарных операций
3. ✅ Рефакторинг дублирующейся fallback логики

### Фаза 2 (Важно) - 2-3 недели:
4. ✅ Замена console.log на logger
5. ✅ Улучшение типизации (убрать any)
6. ✅ Разбить длинные функции

### Фаза 3 (Улучшения) - 1 месяц:
7. ✅ Добавить валидацию входных данных
8. ✅ Улучшить кэширование
9. ✅ Создать единый error handler
10. ✅ Вынести константы

---

## 📝 Примеры рефакторинга

### Пример 1: Вынос fallback логики

```typescript
// lib/product-fallback.ts
export async function ensureProductForStep(
  stepCategory: StepCategory,
  profile: SkinProfile,
  existingProducts: Product[]
): Promise<Product | null> {
  // Проверяем, есть ли уже продукт
  if (existingProducts.length > 0) {
    return existingProducts[0];
  }
  
  // Ищем fallback
  const baseStep = getBaseStepFromStepCategory(stepCategory);
  const fallback = await findFallbackProduct(baseStep, profile);
  
  return fallback;
}
```

### Пример 2: Улучшение типизации

```typescript
// types/product.types.ts
export interface ProductWithBrand extends Product {
  brand: Brand;
}

export type ProductWhereInput = Prisma.ProductWhereInput;

export interface ProductSelectionCriteria {
  stepCategory: StepCategory;
  skinType?: string;
  concerns?: string[];
  isNonComedogenic?: boolean;
  isFragranceFree?: boolean;
  maxItems?: number;
}
```

### Пример 3: Единый error handler

```typescript
// lib/api-response.ts
export class ApiResponse {
  static success<T>(data: T, status = 200) {
    return NextResponse.json(data, { status });
  }
  
  static error(message: string, status = 500, details?: any) {
    return NextResponse.json(
      {
        error: message,
        ...(process.env.NODE_ENV === 'development' && { details }),
      },
      { status }
    );
  }
  
  static unauthorized(message = 'Unauthorized') {
    return ApiResponse.error(message, 401);
  }
  
  static notFound(message = 'Resource not found') {
    return ApiResponse.error(message, 404);
  }
}
```

---

## ✅ Резюме

Код функционален и работает, но требует рефакторинга для:
- Улучшения производительности (устранить N+1)
- Повышения maintainability (убрать дублирование)
- Усиления безопасности типов
- Улучшения наблюдаемости (логирование)

Рекомендуется начать с критических проблем (Фаза 1), затем перейти к важным улучшениям.
