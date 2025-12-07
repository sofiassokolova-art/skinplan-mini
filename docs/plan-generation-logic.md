# Логика подбора средств и создания плана

## Общая схема процесса

```
┌─────────────────────────────────────────────────────────────────┐
│                    ПОЛЬЗОВАТЕЛЬ ПРОХОДИТ АНКЕТУ                 │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│  1. ОБРАБОТКА ОТВЕТОВ                                           │
│  - Сохранение ответов в UserAnswer                              │
│  - Извлечение scoreJson из каждого ответа                       │
│  - Агрегация баллов (oiliness, sensitivity, acne, ...)          │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│  2. СОЗДАНИЕ ПРОФИЛЯ КОЖИ (SkinProfile)                        │
│  - skinType: 'dry' | 'oily' | 'combo' | 'normal'               │
│  - sensitivityLevel: 'low' | 'medium' | 'high'                 │
│  - acneLevel: 0-5                                               │
│  - medicalMarkers: { diagnoses, contraindications, ... }         │
└────────────────────────────┬────────────────────────────────────┘
                             │
                    ┌────────┴────────┐
                    │                 │
                    ▼                 ▼
┌───────────────────────────┐  ┌───────────────────────────┐
│  3. РЕКОМЕНДАЦИИ            │  │  4. ПЛАН (28 ДНЕЙ)        │
│  (Главная страница)        │  │  (Страница плана)         │
│                             │  │                           │
│  a) Поиск правила           │  │  a) Дерматологический     │
│     (RecommendationRule)    │  │     анализ (6 осей)       │
│                             │  │                           │
│  b) Подбор продуктов        │  │  b) Выбор шаблона ухода   │
│     для каждого шага        │  │     (CarePlanTemplate)    │
│                             │  │                           │
│  c) Создание сессии         │  │  c) Использование         │
│     (RecommendationSession) │  │     продуктов из сессии   │
│     products: [123, 456]    │  │                           │
│                             │  │  d) Генерация дней        │
│                             │  │     (утро/вечер)          │
└─────────────────────────────┘  └───────────────────────────┘
                    │                 │
                    └────────┬─────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │  СИНХРОНИЗАЦИЯ  │
                    │  План использует│
                    │  те же продукты, │
                    │  что рекомендации│
                    └─────────────────┘
```

**Ключевой принцип:** План использует продукты из `RecommendationSession`, созданной правилами рекомендаций. Это гарантирует согласованность между главной страницей и планом.

---

## 1. Обработка ответов анкеты и создание профиля

### 1.1. Сохранение ответов (`app/api/questionnaire/answers/route.ts`)

Когда пользователь отправляет ответы анкеты:

```typescript
// app/api/questionnaire/answers/route.ts:20-150
export async function POST(request: NextRequest) {
  // 1. Получаем userId из Telegram initData
  const userId = await getUserIdFromInitData(initData);
  
  // 2. Сохраняем ответы в БД (upsert - обновляем если уже есть)
  const savedAnswers = await Promise.all(
    answers.map(async (answer: AnswerInput) => {
      const existingAnswer = await tx.userAnswer.findFirst({
        where: { userId, questionnaireId, questionId: answer.questionId },
      });
      
      if (existingAnswer) {
        // Обновляем существующий ответ
        return tx.userAnswer.update({ ... });
      } else {
        // Создаем новый ответ
        return tx.userAnswer.create({ ... });
      }
    })
  );
  
  // 3. Загружаем полные данные для расчета профиля
  const fullAnswers = await tx.userAnswer.findMany({
    where: { userId, questionnaireId },
    include: { question: { include: { answerOptions: true } } },
  });
  
  // 4. Рассчитываем профиль кожи
  const profileData = createSkinProfile(
    userId,
    questionnaireId,
    fullAnswers,
    questionnaire.version
  );
}
```

### 1.2. Расчет профиля кожи (`lib/profile-calculator.ts`)

**Ключевая логика:** Каждый ответ содержит `scoreJson` с баллами по различным параметрам.

```typescript
// lib/profile-calculator.ts:83-174
export function createSkinProfile(
  userId: string,
  questionnaireId: number,
  userAnswers: Array<{...}>,
  version: number = 1
) {
  // 1. Собираем все score_json из ответов
  const answerScores: AnswerScore[] = [];
  
  for (const answer of userAnswers) {
    const optionValue = answer.answerValue || 
      (Array.isArray(answer.answerValues) ? answer.answerValues[0] : null);
    
    const option = question.answerOptions.find(opt => opt.value === optionValue);
    if (option?.scoreJson) {
      answerScores.push(option.scoreJson as AnswerScore);
      // Пример scoreJson: { oiliness: 2, sensitivity: 1, acne: 3 }
    }
  }
  
  // 2. Агрегируем баллы (суммируем все значения)
  const scores = aggregateAnswerScores(answerScores);
  // Результат: { oiliness: 5, sensitivity: 3, acne: 4, dehydration: 2, ... }
  
  // 3. Определяем характеристики профиля
  const skinType = determineSkinType(scores);
  // Логика: oiliness >= 4 && dehydration >= 3 → 'combo'
  //         oiliness >= 4 → 'oily'
  //         dehydration >= 4 → 'dry'
  //         иначе → 'normal'
  
  const sensitivityLevel = determineSensitivityLevel(scores);
  // sensitivity >= 4 → 'high'
  // sensitivity >= 2 → 'medium'
  // иначе → 'low'
  
  const acneLevel = determineAcneLevel(scores);
  // Нормализуем до 0-5
  
  // 4. Определяем риски
  const rosaceaRisk = (scores.rosacea || 0) >= 3 ? 'high' : 
                     (scores.rosacea || 0) >= 1 ? 'medium' : 'none';
  const pigmentationRisk = (scores.pigmentation || 0) >= 3 ? 'high' :
                          (scores.pigmentation || 0) >= 1 ? 'medium' : 'none';
  
  return {
    skinType,           // 'dry' | 'oily' | 'combo' | 'normal'
    sensitivityLevel,   // 'low' | 'medium' | 'high'
    acneLevel,         // 0-5
    dehydrationLevel,  // 0-5
    rosaceaRisk,       // 'none' | 'medium' | 'high'
    pigmentationRisk,  // 'none' | 'medium' | 'high'
    ageGroup,          // '18-24' | '25-34' | '35-44' | '45+'
    hasPregnancy,      // boolean
    medicalMarkers,    // { diagnoses: [], contraindications: [], ... }
  };
}
```

**Пример:** Если пользователь выбрал:
- "Жирная кожа" → `{ oiliness: 4 }`
- "Есть высыпания" → `{ acne: 3 }`
- "Кожа чувствительная" → `{ sensitivity: 2 }`

Результат: `skinType: 'oily'`, `acneLevel: 3`, `sensitivityLevel: 'medium'`

---

## 2. Генерация рекомендаций (главная страница)

### 2.1. Поиск подходящего правила (`app/api/recommendations/route.ts`)

**Логика:** Система ищет правило рекомендаций, которое соответствует профилю пользователя.

```typescript
// app/api/recommendations/route.ts:327-342
// Получаем все активные правила, отсортированные по приоритету
const rules = await prisma.recommendationRule.findMany({
  where: { isActive: true },
  orderBy: { priority: 'desc' },
});

// Находим подходящее правило
let matchedRule: Rule | null = null;

for (const rule of rules) {
  const conditions = rule.conditionsJson as RuleCondition;
  if (matchesRule(profile, { ...rule, conditionsJson: conditions } as Rule)) {
    matchedRule = { ...rule, conditionsJson: conditions } as Rule;
    break; // Берем первое подходящее правило
  }
}
```

### 2.2. Проверка соответствия правилу

```typescript
// app/api/recommendations/route.ts:32-57
function matchesRule(profile: any, rule: Rule): boolean {
  const conditions = rule.conditionsJson;
  
  for (const [key, condition] of Object.entries(conditions)) {
    const profileValue = profile[key];
    
    if (Array.isArray(condition)) {
      // Проверка: значение профиля должно быть в массиве условий
      // Пример: skinType: ['oily', 'combo'] → проверяем, что profile.skinType в этом списке
      if (!condition.includes(profileValue)) {
        return false;
      }
    } else if (typeof condition === 'object' && condition !== null) {
      // Проверка диапазона (gte = greater than or equal, lte = less than or equal)
      // Пример: acneLevel: { gte: 3, lte: 5 } → проверяем, что 3 <= profile.acneLevel <= 5
      if ('gte' in condition && typeof profileValue === 'number') {
        if (profileValue < condition.gte!) return false;
      }
      if ('lte' in condition && typeof profileValue === 'number') {
        if (profileValue > condition.lte!) return false;
      }
    } else if (condition !== profileValue) {
      // Точное совпадение
      return false;
    }
  }
  
  return true; // Все условия выполнены
}
```

**Пример правила в БД:**
```json
{
  "conditionsJson": {
    "skinType": ["oily", "combo"],
    "acneLevel": { "gte": 2 }
  },
  "stepsJson": {
    "cleanser": {
      "category": ["cleanser_balancing"],
      "concerns": ["acne"],
      "skin_types": ["oily", "combo"]
    },
    "serum": {
      "category": ["serum"],
      "active_ingredients": ["niacinamide"],
      "concerns": ["acne"]
    }
  }
}
```

### 2.3. Подбор продуктов для каждого шага (`lib/product-selection.ts`)

Для каждого шага из правила система ищет продукты:

```typescript
// lib/product-selection.ts:23-200
export async function getProductsForStep(step: RuleStep, userPriceSegment?: string | null) {
  const where: any = {
    published: true,
    brand: { isActive: true },
  };
  
  // 1. Фильтрация по категории/шагу
  if (step.category && step.category.length > 0) {
    // Маппинг: 'cream' → 'moisturizer', 'cleanser_oil' → 'cleanser' и т.д.
    const categoryMapping: Record<string, string[]> = {
      'cream': ['moisturizer'],
      'cleanser': ['cleanser'],
      'serum': ['serum'],
      'spf': ['spf'],
    };
    
    for (const cat of step.category) {
      const normalizedCats = categoryMapping[cat] || [cat];
      // Ищем по category, step, или step начинается с категории
      categoryConditions.push({ category: normalizedCat });
      categoryConditions.push({ step: { startsWith: normalizedCat } });
    }
    
    where.OR = categoryConditions;
  }
  
  // 2. Фильтрация по типу кожи (кроме SPF - он универсален)
  if (step.skin_types && step.skin_types.length > 0 && !isSPF) {
    where.skinTypes = { hasSome: step.skin_types };
    // Пример: skin_types: ['oily', 'combo'] → ищем продукты, где skinTypes содержит 'oily' или 'combo'
  }
  
  // 3. Фильтрация по concerns (проблемы кожи)
  if (step.concerns && step.concerns.length > 0) {
    where.OR = [
      { concerns: { hasSome: step.concerns } },
      { concerns: { isEmpty: true } }, // Также берем продукты без concerns
    ];
  }
  
  // 4. Фильтрация по активным ингредиентам
  if (step.active_ingredients && step.active_ingredients.length > 0) {
    const normalizedIngredients: string[] = [];
    for (const ingredient of step.active_ingredients) {
      const variants = normalizeIngredient(ingredient);
      // "ниацинамид" → ["niacinamide", "ниацинамид", "nicotinamide"]
      normalizedIngredients.push(...variants);
    }
    
    where.OR = [
      ...normalizedIngredients.map(ingredient => ({
        activeIngredients: { has: ingredient },
      })),
      { activeIngredients: { isEmpty: true } }, // Fallback
    ];
  }
  
  // 5. Фильтрация по бюджету
  if (step.budget && step.budget !== 'любой') {
    const budgetMapping = {
      'бюджетный': 'mass',
      'средний': 'mid',
      'премиум': 'premium',
    };
    where.priceSegment = budgetMapping[step.budget];
  }
  
  // 6. Выполняем запрос
  const products = await prisma.product.findMany({
    where,
    include: { brand: true },
    take: step.max_items || 3,
  });
  
  // 7. Сортируем: сначала hero продукты, потом по priority
  products.sort((a, b) => {
    if (a.isHero !== b.isHero) return b.isHero ? 1 : -1;
    return b.priority - a.priority;
  });
  
  return products;
}
```

**Пример:** Для шага `serum` с условиями:
- `category: ["serum"]`
- `active_ingredients: ["niacinamide"]`
- `concerns: ["acne"]`
- `skin_types: ["oily"]`

Система найдет все продукты, где:
- `category = 'serum'` ИЛИ `step` начинается с `'serum'`
- `activeIngredients` содержит `'niacinamide'` (или нормализованные варианты)
- `concerns` содержит `'acne'` ИЛИ `concerns` пустой
- `skinTypes` содержит `'oily'`
- `published = true` и бренд активен

### 2.4. Сохранение сессии рекомендаций

```typescript
// app/api/recommendations/route.ts:420-532
// После подбора продуктов создаем RecommendationSession
const productIds = products.map(p => p.id);

await prisma.recommendationSession.create({
  data: {
    userId,
    profileId: profile.id,
    ruleId: matchedRule.id, // Связь с правилом
    products: productIds, // [123, 456, 789, ...]
  },
});

// Сохраняем в кэш
await setCachedRecommendations(userId, profile.version, response);
```

**Важно:** Сессия сохраняет ID продуктов, которые будут использоваться и для плана.

---

## 3. Генерация 28-дневного плана

### 3.1. Дерматологический анализ (`lib/skin-analysis-engine.ts`)

Перед генерацией плана система рассчитывает 6 осей кожи:

```typescript
// lib/skin-analysis-engine.ts:34-104
export function calculateSkinAxes(answers: QuestionnaireAnswers): SkinScore[] {
  // 1. Oiliness (жирность) - 0-100
  const oiliness = (() => {
    let score = 50; // нейтральная база
    if (answers.skinType === 'oily') score += 40;
    if (answers.skinType === 'combo') score += 25;
    if (answers.skinType === 'dry') score -= 30;
    if (answers.concerns?.some(c => c.includes('Жирность'))) score += 30;
    return Math.max(0, Math.min(100, score));
  })();
  
  // 2. Hydration (увлажнение) - инвертируется в "обезвоженность"
  const hydration = (() => {
    let score = 100; // идеальное увлажнение
    if (answers.concerns?.some(c => c.includes('Сухость'))) score -= 40;
    if (answers.skinType === 'dry') score -= 35;
    return Math.max(0, Math.min(100, score));
  })();
  
  // 3. Barrier (барьер) - целостность защитного барьера
  const barrier = (() => {
    let score = 100;
    if (answers.concerns?.some(c => c.includes('Чувствительность'))) score -= 30;
    if (answers.diagnoses?.some(d => d.includes('Атопический'))) score -= 50;
    return Math.max(0, Math.min(100, score));
  })();
  
  // 4. Inflammation (воспаление/акне)
  const inflammation = (() => {
    let score = 0;
    if (answers.concerns?.some(c => c.includes('Акне'))) score += 50;
    if (answers.diagnoses?.some(d => d.includes('Акне'))) score += 40;
    if (answers.acneLevel) score += answers.acneLevel * 8;
    return Math.min(100, score);
  })();
  
  // 5. Pigmentation (пигментация)
  const pigmentation = (() => {
    let score = 0;
    if (answers.concerns?.some(c => c.includes('Пигментация'))) score += 50;
    if (answers.habits?.some(h => h.includes('солнце без SPF'))) score += 40;
    return Math.min(100, score);
  })();
  
  // 6. Photoaging (фотостарение)
  const photoaging = (() => {
    let score = 0;
    const age = answers.age === '45+' ? 90 : 
                answers.age === '35-44' ? 70 : 
                answers.age === '25-34' ? 40 : 10;
    score += age / 2;
    if (answers.concerns?.some(c => c.includes('Морщины'))) score += 40;
    return Math.min(100, score);
  })();
  
  return [
    { axis: 'oiliness', value: oiliness, level: getLevel(oiliness), ... },
    { axis: 'hydration', value: 100 - hydration, ... }, // инвертируем
    { axis: 'barrier', value: barrier, ... },
    { axis: 'inflammation', value: inflammation, ... },
    { axis: 'pigmentation', value: pigmentation, ... },
    { axis: 'photoaging', value: photoaging, ... },
  ];
}
```

### 3.2. Определение ключевых проблем

```typescript
// app/api/plan/generate/route.ts:303-313
// Вычисляем проблемы кожи для синхронизации с /analysis
const issues = calculateSkinIssues(profile, userAnswers, skinScores);
const keyProblems = issues
  .filter((i: any) => i.severity_label === 'критично' || i.severity_label === 'плохо')
  .map((i: any) => i.name);

// Пример результата:
// keyProblems = ['Акне / высыпания', 'Жирность и блеск кожи']
```

### 3.3. Выбор шаблона ухода (`lib/care-plan-templates.ts`)

Система выбирает шаблон на основе профиля:

```typescript
// lib/care-plan-templates.ts:84-120
export function selectCarePlanTemplate(
  profile: CarePlanProfileInput
): CarePlanTemplate {
  const { skinType, mainGoals, sensitivityLevel, routineComplexity } = profile;
  
  // Ищем шаблон, который соответствует всем условиям
  for (const template of CARE_PLAN_TEMPLATES) {
    const cond = template.conditions;
    
    // Проверяем тип кожи
    if (cond.skinTypes && !cond.skinTypes.includes(skinType)) continue;
    
    // Проверяем цели (хотя бы одна должна совпадать)
    if (cond.mainGoals && !cond.mainGoals.some(g => mainGoals.includes(g))) continue;
    
    // Проверяем чувствительность
    if (cond.sensitivityLevels && !cond.sensitivityLevels.includes(sensitivityLevel)) continue;
    
    // Проверяем сложность рутины
    if (cond.routineComplexity && !cond.routineComplexity.includes(routineComplexity)) continue;
    
    return template; // Найден подходящий шаблон
  }
  
  return CARE_PLAN_TEMPLATES.find(t => t.id === 'default_balanced')!; // Fallback
}
```

**Пример шаблона:**
```typescript
{
  id: 'acne_oily_basic',
  conditions: {
    skinTypes: ['oily', 'combo'],
    mainGoals: ['acne'],
    routineComplexity: ['medium', 'maximal'],
  },
  morning: ['cleanser_balancing', 'serum_niacinamide', 'moisturizer_balancing', 'spf_50_oily'],
  evening: ['cleanser_balancing', 'treatment_acne_azelaic', 'moisturizer_balancing'],
  weekly: ['mask_clay'],
}
```

### 3.4. Использование продуктов из RecommendationSession

**Ключевая логика:** План использует те же продукты, что и главная страница.

```typescript
// app/api/plan/generate/route.ts:479-575
// Ищем сессию для текущего профиля
const existingSession = await prisma.recommendationSession.findFirst({
  where: {
    userId,
    profileId: profile.id,
    ruleId: { not: null }, // Только сессии из правил (не из плана)
  },
  orderBy: { createdAt: 'desc' },
});

if (existingSession && existingSession.products) {
  const productIds = existingSession.products as number[];
  
  // Проверяем, достаточно ли продуктов (минимум 3)
  if (productIds.length >= MIN_PRODUCTS_IN_SESSION) {
    // Загружаем продукты из сессии
    recommendationProducts = await prisma.product.findMany({
      where: {
        id: { in: productIds },
        published: true,
        brand: { isActive: true },
      },
      include: { brand: true },
    });
    
    // Сортируем: hero продукты первыми, потом по priority
    recommendationProducts.sort((a, b) => {
      if (a.isHero !== b.isHero) return b.isHero ? 1 : -1;
      return b.priority - a.priority;
    });
  }
}
```

### 3.5. Группировка продуктов по шагам

```typescript
// app/api/plan/generate/route.ts:815-1051
// Группируем продукты по StepCategory
const productsByStepMap = new Map<StepCategory, ProductWithBrand[]>();

selectedProducts.forEach((product) => {
  // Преобразуем старый формат step/category в StepCategory
  const stepCategories = mapStepToStepCategory(product.step, product.category);
  // Пример: step='serum_niacinamide' → ['serum_niacinamide', 'serum']
  
  stepCategories.forEach(stepCategory => {
    registerProductForStep(stepCategory, productWithBrand);
  });
});

// Функция маппинга:
function mapStepToStepCategory(step: string, category: string): StepCategory[] {
  const stepStr = (step || '').toLowerCase();
  const categories: StepCategory[] = [];
  
  if (stepStr.startsWith('serum_niacinamide')) {
    categories.push('serum_niacinamide');
  } else if (stepStr.startsWith('serum')) {
    categories.push('serum_hydrating', 'serum_niacinamide');
  }
  
  if (stepStr.startsWith('cleanser_gentle')) {
    categories.push('cleanser_gentle');
  } else if (stepStr.startsWith('cleanser')) {
    categories.push('cleanser_gentle', 'cleanser_balancing', 'cleanser_deep');
  }
  
  // ... аналогично для других шагов
  
  return categories;
}
```

### 3.6. Генерация дней плана

```typescript
// app/api/plan/generate/route.ts:1425-1780
// Генерируем план (28 дней, 4 недели)
const weeks: PlanWeek[] = [];

for (let weekNum = 1; weekNum <= PLAN_WEEKS_TOTAL; weekNum++) {
  const days: PlanDay[] = [];
  
  for (let dayNum = 1; dayNum <= PLAN_DAYS_PER_WEEK; dayNum++) {
    const day = (weekNum - 1) * 7 + dayNum;
    
    // Получаем шаги из шаблона
    const morningSteps = adjustedMorning; // ['cleanser_balancing', 'serum_niacinamide', ...]
    const eveningSteps = adjustedEvening; // ['cleanser_balancing', 'treatment_acne_azelaic', ...]
    
    const dayProducts: Record<string, any> = {};
    
    // Для каждого утреннего шага выбираем продукт
    for (const step of morningSteps) {
      let stepProducts = getProductsForStep(step); // Получаем из productsByStepMap
      
      if (stepProducts.length === 0) {
        // Если продуктов нет, ищем fallback
        const fallbackProduct = await findFallbackProduct('cleanser', profileClassification);
        stepProducts = [fallbackProduct];
      }
      
      // Для очищения и SPF - берем первый продукт без фильтрации
      if (isCleanserStep(step) || isSPFStep(step)) {
        const selectedProduct = stepProducts[0];
        dayProducts[step] = {
          id: selectedProduct.id,
          name: selectedProduct.name,
          brand: selectedProduct.brand.name,
          step,
        };
      } else {
        // Для остальных шагов применяем дерматологическую фильтрацию
        const context: ProductSelectionContext = {
          timeOfDay: 'morning',
          day,
          week: weekNum,
          alreadySelected: selectedProductsForDay,
          protocol: dermatologyProtocol,
          profileClassification,
        };
        
        const filteredResults = filterProductsWithDermatologyLogic(stepProducts, context);
        const compatibleProducts = filteredResults.filter(r => r.allowed);
        
        if (compatibleProducts.length > 0) {
          const selectedProduct = compatibleProducts[0].product;
          dayProducts[step] = {
            id: selectedProduct.id,
            name: selectedProduct.name,
            brand: selectedProduct.brand.name,
            step,
            justification: generateProductJustification(...),
            warnings: generateProductWarnings(...),
          };
        }
      }
    }
    
    // Аналогично для вечерних шагов
    
    days.push({
      day,
      week: weekNum,
      morning: morningSteps,
      evening: eveningSteps,
      products: dayProducts,
      completed: false,
    });
  }
  
  weeks.push({ week: weekNum, days, summary: { ... } });
}
```

### 3.7. Дерматологическая фильтрация продуктов

```typescript
// lib/dermatology-product-filter.ts
export function filterProductsWithDermatologyLogic(
  products: ProductWithBrand[],
  context: ProductSelectionContext
): FilterResult[] {
  return products.map(product => {
    const reasons: string[] = [];
    
    // 1. Проверка совместимости с протоколом
    if (context.protocol.condition === 'acne' && context.timeOfDay === 'morning') {
      // Утром при акне избегаем ретинол
      if (containsRetinol(product)) {
        reasons.push('Ретинол не используется утром при акне');
        return { product, allowed: false, reason: reasons.join('; ') };
      }
    }
    
    // 2. Проверка совместимости с уже выбранными продуктами
    for (const selected of context.alreadySelected) {
      if (isIncompatible(product, selected)) {
        reasons.push(`Несовместим с ${selected.name}`);
        return { product, allowed: false, reason: reasons.join('; ') };
      }
    }
    
    // 3. Проверка противопоказаний
    if (context.profileClassification.pregnant && containsRetinol(product)) {
      reasons.push('Ретинол противопоказан при беременности');
      return { product, allowed: false, reason: reasons.join('; ') };
    }
    
    return { product, allowed: true, reason: null };
  });
}
```

---

## 4. Синхронизация между рекомендациями и планом

**Ключевой принцип:** План использует продукты из `RecommendationSession`, созданной правилами рекомендаций.

```
1. Пользователь проходит анкету
   ↓
2. Создается SkinProfile
   ↓
3. Система находит подходящее RecommendationRule
   ↓
4. Для каждого шага правила подбираются продукты
   ↓
5. Создается RecommendationSession с productIds
   ↓
6. При генерации плана система:
   - Ищет RecommendationSession для текущего профиля
   - Использует продукты из сессии
   - Группирует их по шагам плана
   - Применяет дерматологическую фильтрацию
   ↓
7. Результат: план с теми же продуктами, что на главной странице
```

---

## 5. Пример полного потока

### Сценарий: Пользователь с жирной кожей и акне

**Шаг 1: Анкета**
```json
{
  "skinType": "oily",
  "concerns": ["Акне", "Жирность"],
  "acneLevel": 3
}
```

**Шаг 2: Профиль**
```typescript
{
  skinType: 'oily',
  sensitivityLevel: 'medium',
  acneLevel: 3,
  dehydrationLevel: 1,
  rosaceaRisk: 'none',
  pigmentationRisk: 'none'
}
```

**Шаг 3: Правило рекомендаций**
```json
{
  "conditionsJson": {
    "skinType": ["oily", "combo"],
    "acneLevel": { "gte": 2 }
  },
  "stepsJson": {
    "cleanser": {
      "category": ["cleanser_balancing"],
      "concerns": ["acne"]
    },
    "serum": {
      "category": ["serum"],
      "active_ingredients": ["niacinamide"],
      "concerns": ["acne"]
    }
  }
}
```

**Шаг 4: Подбор продуктов**
- Cleanser: Находит очищающее средство для жирной кожи с акне
- Serum: Находит сыворотку с ниацинамидом для акне
- Сохраняет в `RecommendationSession`: `products: [123, 456, 789]`

**Шаг 5: Шаблон плана**
```typescript
{
  morning: ['cleanser_balancing', 'serum_niacinamide', 'moisturizer_balancing', 'spf_50_oily'],
  evening: ['cleanser_balancing', 'treatment_acne_azelaic', 'moisturizer_balancing']
}
```

**Шаг 6: Генерация плана**
- Берет продукты из `RecommendationSession` (ID: 123, 456, 789)
- Группирует по шагам: `cleanser_balancing` → [123], `serum_niacinamide` → [456]
- Для каждого дня выбирает продукты из соответствующих групп
- Применяет дерматологическую фильтрацию (проверка совместимости)

**Результат:** 28-дневный план с конкретными продуктами для каждого дня.

---

## 6. Ключевые особенности

### 6.1. Версионирование профилей
- При перепрохождении анкеты создается новая версия профиля
- План генерируется для последней версии
- Старые сессии рекомендаций игнорируются

**Код:**
```typescript
// app/api/plan/generate/route.ts:209-212
const profile = await prisma.skinProfile.findFirst({
  where: { userId },
  orderBy: { version: 'desc' }, // Берем последнюю версию
});
```

### 6.2. Fallback логика
- Если правило не найдено → базовые продукты
- Если продукт не найден для шага → поиск fallback
- Если нет совместимых продуктов → используется первый доступный с предупреждением

**Код:**
```typescript
// app/api/plan/generate/route.ts:1502-1536
if (stepProducts.length === 0) {
  // Ищем fallback продукт
  const baseStep = getBaseStepFromStepCategory(step);
  const fallbackProduct = await findFallbackProduct(baseStep, profileClassification);
  
  if (fallbackProduct) {
    registerProductForStep(step, fallbackProduct);
    stepProducts = [fallbackProduct];
  }
}
```

### 6.3. Кэширование
- Рекомендации кэшируются по `userId` и `profileVersion`
- План кэшируется по `userId` и `profileVersion`
- TTL: рекомендации - 30 минут, план - 7 дней

**Код:**
```typescript
// lib/cache.ts:90-93
const CACHE_TTL = {
  plan: 7 * 24 * 60 * 60, // 7 дней для плана
  recommendations: 30 * 60, // 30 минут для рекомендаций
};

// Ключ кэша: "plan:userId:profileVersion"
const key = `plan:${userId}:${profileVersion}`;
await setWithTTL(key, JSON.stringify(plan), CACHE_TTL.plan);
```

### 6.4. Дерматологическая логика
- Проверка совместимости продуктов между собой
- Учет времени суток (утро/вечер)
- Проверка противопоказаний (беременность, аллергии)
- Генерация обоснований и предупреждений

**Пример проверки:**
```typescript
// lib/dermatology-product-filter.ts
// Проверка: можно ли использовать ретинол утром при акне?
if (context.protocol.condition === 'acne' && context.timeOfDay === 'morning') {
  if (containsRetinol(product)) {
    return { product, allowed: false, reason: 'Ретинол не используется утром при акне' };
  }
}
```

### 6.5. Синхронизация продуктов между рекомендациями и планом

**Критически важно:** План использует продукты из `RecommendationSession`, созданной правилами рекомендаций.

```typescript
// app/api/plan/generate/route.ts:481-575
// Ищем сессию для текущего профиля
const existingSession = await prisma.recommendationSession.findFirst({
  where: {
    userId,
    profileId: profile.id,
    ruleId: { not: null }, // Только сессии из правил
  },
});

if (existingSession && existingSession.products) {
  const productIds = existingSession.products as number[];
  
  // Загружаем продукты из сессии
  recommendationProducts = await prisma.product.findMany({
    where: { id: { in: productIds }, published: true },
    include: { brand: true },
  });
  
  // Используем ВСЕ продукты из сессии для плана
  selectedProducts = recommendationProducts;
}
```

**Почему это важно:**
- Пользователь видит одни и те же продукты на главной странице и в плане
- Нет рассинхронизации между рекомендациями и планом
- При перепрохождении анкеты создается новая сессия с новыми продуктами

---

## 7. Реальные примеры кода из проекта

### 7.1. Как работает агрегация баллов

```typescript
// lib/profile-calculator.ts:23-39
export function aggregateAnswerScores(answerScores: AnswerScore[]): AggregatedScores {
  const aggregated: AggregatedScores = {};

  for (const score of answerScores) {
    for (const [key, value] of Object.entries(score)) {
      if (typeof value === 'number') {
        // Суммируем числовые значения
        aggregated[key] = (aggregated[key] as number || 0) + value;
      } else if (typeof value === 'string' || typeof value === 'boolean') {
        // Сохраняем строковые и булевы значения как есть
        aggregated[key] = value;
      }
    }
  }

  return aggregated;
}

// Пример:
// Ответ 1: { oiliness: 2, sensitivity: 1 }
// Ответ 2: { oiliness: 2, acne: 3 }
// Результат: { oiliness: 4, sensitivity: 1, acne: 3 }
```

### 7.2. Как определяется тип кожи

```typescript
// lib/profile-calculator.ts:44-59
export function determineSkinType(scores: AggregatedScores): string {
  const oiliness = scores.oiliness || 0;
  const dehydration = scores.dehydration || 0;

  // Логика определения типа кожи
  if (oiliness >= 4 && dehydration >= 3) {
    return 'combo'; // Комбинированная: и жирная, и сухая
  } else if (oiliness >= 4) {
    return 'oily'; // Жирная
  } else if (dehydration >= 4) {
    return 'dry'; // Сухая
  } else if (oiliness >= 2 || dehydration >= 2) {
    return 'combo'; // Склонность к комбинированной
  }
  return 'normal'; // Нормальная
}
```

### 7.3. Как работает поиск продуктов по правилу

```typescript
// lib/product-selection.ts:23-200
export async function getProductsForStep(step: RuleStep) {
  const where: any = {
    published: true,
    brand: { isActive: true },
  };
  
  // Пример: step = {
  //   category: ["serum"],
  //   active_ingredients: ["niacinamide"],
  //   concerns: ["acne"],
  //   skin_types: ["oily"]
  // }
  
  // 1. Фильтр по категории
  where.OR = [
    { category: 'serum' },
    { step: 'serum' },
    { step: { startsWith: 'serum' } }, // Найдет 'serum_niacinamide', 'serum_hydrating'
  ];
  
  // 2. Фильтр по типу кожи
  where.skinTypes = { hasSome: ['oily'] };
  
  // 3. Фильтр по concerns
  where.OR = [
    ...where.OR,
    { concerns: { hasSome: ['acne'] } },
    { concerns: { isEmpty: true } }, // Fallback
  ];
  
  // 4. Фильтр по активным ингредиентам
  const normalizedIngredients = normalizeIngredient('niacinamide');
  // Результат: ['niacinamide', 'ниацинамид', 'nicotinamide']
  
  where.OR = [
    ...where.OR,
    ...normalizedIngredients.map(ing => ({
      activeIngredients: { has: ing },
    })),
  ];
  
  // Выполняем запрос
  const products = await prisma.product.findMany({ where, ... });
  
  // Сортируем: hero продукты первыми
  products.sort((a, b) => {
    if (a.isHero !== b.isHero) return b.isHero ? 1 : -1;
    return b.priority - a.priority;
  });
  
  return products.slice(0, step.max_items || 3);
}
```

### 7.4. Как выбирается шаблон плана

```typescript
// lib/care-plan-templates.ts:84-120
export function selectCarePlanTemplate(profile: CarePlanProfileInput): CarePlanTemplate {
  // Пример входных данных:
  // profile = {
  //   skinType: 'oily',
  //   mainGoals: ['acne'],
  //   sensitivityLevel: 'medium',
  //   routineComplexity: 'medium'
  // }
  
  for (const template of CARE_PLAN_TEMPLATES) {
    const cond = template.conditions;
    
    // Проверяем тип кожи
    if (cond.skinTypes && !cond.skinTypes.includes(profile.skinType)) {
      continue; // Не подходит
    }
    // 'oily' в ['oily', 'combo'] → ✅ проходит
    
    // Проверяем цели (хотя бы одна должна совпадать)
    if (cond.mainGoals && !cond.mainGoals.some(g => profile.mainGoals.includes(g))) {
      continue; // Не подходит
    }
    // 'acne' в ['acne'] → ✅ проходит
    
    // Проверяем чувствительность
    if (cond.sensitivityLevels && !cond.sensitivityLevels.includes(profile.sensitivityLevel)) {
      continue; // Не подходит
    }
    
    // Проверяем сложность
    if (cond.routineComplexity && !cond.routineComplexity.includes(profile.routineComplexity)) {
      continue; // Не подходит
    }
    
    // Все условия выполнены - возвращаем этот шаблон
    return template;
  }
  
  // Если ничего не подошло - возвращаем дефолтный
  return CARE_PLAN_TEMPLATES.find(t => t.id === 'default_balanced')!;
}
```

### 7.5. Как продукты распределяются по дням плана

```typescript
// app/api/plan/generate/route.ts:1498-1624
// Для каждого дня плана:

// 1. Получаем шаги из шаблона
const morningSteps = ['cleanser_balancing', 'serum_niacinamide', 'moisturizer_balancing', 'spf_50_oily'];
const eveningSteps = ['cleanser_balancing', 'treatment_acne_azelaic', 'moisturizer_balancing'];

// 2. Для каждого шага выбираем продукт
for (const step of morningSteps) {
  // Получаем продукты для этого шага из productsByStepMap
  let stepProducts = getProductsForStep(step);
  // Результат: [
  //   { id: 123, name: 'Очищающее средство X', step: 'cleanser_balancing', ... },
  //   { id: 124, name: 'Очищающее средство Y', step: 'cleanser_balancing', ... }
  // ]
  
  // 3. Применяем дерматологическую фильтрацию (для необязательных шагов)
  if (!isCleanserStep(step) && !isSPFStep(step)) {
    const filteredResults = filterProductsWithDermatologyLogic(stepProducts, context);
    const compatibleProducts = filteredResults.filter(r => r.allowed);
    
    if (compatibleProducts.length > 0) {
      const selectedProduct = compatibleProducts[0].product;
      dayProducts[step] = {
        id: selectedProduct.id,
        name: selectedProduct.name,
        brand: selectedProduct.brand.name,
        step,
        justification: 'Ниацинамид уменьшает выработку себума и воспаление',
        warnings: undefined,
      };
    }
  } else {
    // Для очищения и SPF - берем первый продукт без фильтрации
    const selectedProduct = stepProducts[0];
    dayProducts[step] = {
      id: selectedProduct.id,
      name: selectedProduct.name,
      brand: selectedProduct.brand.name,
      step,
    };
  }
}

// 4. Результат для одного дня:
const dayProducts = {
  'cleanser_balancing': {
    id: 123,
    name: 'Очищающее средство X',
    brand: 'Brand A',
    step: 'cleanser_balancing'
  },
  'serum_niacinamide': {
    id: 456,
    name: 'Сыворотка с ниацинамидом',
    brand: 'Brand B',
    step: 'serum_niacinamide',
    justification: 'Ниацинамид уменьшает выработку себума...',
  },
  // ... остальные шаги
};
```

### 7.6. Как работает маппинг старых форматов в StepCategory

```typescript
// app/api/plan/generate/route.ts:839-950
function mapStepToStepCategory(step: string, category: string): StepCategory[] {
  const stepStr = (step || category || '').toLowerCase();
  const categories: StepCategory[] = [];
  
  // Примеры маппинга:
  
  // 'serum_niacinamide' → ['serum_niacinamide']
  if (stepStr.startsWith('serum_niacinamide')) {
    categories.push('serum_niacinamide');
  }
  // 'serum' → ['serum_hydrating', 'serum_niacinamide']
  else if (stepStr === 'serum') {
    categories.push('serum_hydrating');
    categories.push('serum_niacinamide');
  }
  
  // 'cleanser_gentle' → ['cleanser_gentle']
  if (stepStr.startsWith('cleanser_gentle')) {
    categories.push('cleanser_gentle');
  }
  // 'cleanser' → ['cleanser_gentle', 'cleanser_balancing', 'cleanser_deep']
  else if (stepStr.startsWith('cleanser')) {
    categories.push('cleanser_gentle');
    categories.push('cleanser_balancing');
    categories.push('cleanser_deep');
  }
  
  // 'spf' → ['spf_50_face']
  if (stepStr === 'spf' || category === 'spf') {
    categories.push('spf_50_face');
  }
  
  return categories;
}

// Это позволяет:
// 1. Найти продукты по точному совпадению (serum_niacinamide)
// 2. Найти продукты по базовому шагу (serum)
// 3. Обеспечить обратную совместимость со старыми форматами
```

---

## Заключение

Система работает в несколько этапов:
1. **Анкета** → агрегация баллов → **Профиль кожи**
2. **Профиль** → поиск правила → **Подбор продуктов** → **RecommendationSession**
3. **Профиль + Ответы** → дерматологический анализ → **Шаблон плана**
4. **RecommendationSession + Шаблон** → группировка продуктов → **28-дневный план**

Все этапы связаны через профиль пользователя и версионирование, что обеспечивает согласованность между рекомендациями на главной странице и планом ухода.
