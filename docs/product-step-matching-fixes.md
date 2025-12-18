# Исправления матчинга продуктов к шагам

## Найденные проблемы

1. **SPF маппился неправильно**: `spf_50_sensitive` маппился на `spf_50_face` вместо `spf_50_sensitive`
   - Причина: проверка общего `spf` срабатывала раньше специфичных вариантов
   - Исправление: изменен порядок проверок - сначала специфичные варианты (sensitive, oily), потом общий

2. **Избыточный маппинг для toner/moisturizer**: 
   - `toner_soothing` маппился на `moisturizer_soothing` и `mask_soothing`
   - `toner_hydrating` маппился на `mask_hydrating`
   - Причина: проверки `stepStr.includes('soothing')` и `stepStr.includes('hydrating')` срабатывали для всех продуктов с этими словами
   - Исправление: добавлена проверка, что это именно нужный тип продукта (toner/moisturizer/mask)

3. **Избыточный маппинг для cleanser_balancing**:
   - `cleanser_balancing` маппился также на `moisturizer_balancing`
   - Причина: проверка `stepStr.includes('balancing')` срабатывала для всех продуктов
   - Исправление: добавлена проверка, что это именно cleanser

## Исправления

### 1. SPF маппинг (lib/plan-generator.ts:1076-1083)
```typescript
// БЫЛО:
if (stepStr.startsWith('spf_50_face') || stepStr === 'spf' || category === 'spf') {
  categories.push('spf_50_face');
} else if (stepStr.startsWith('spf_50_oily') || stepStr.includes('oily')) {
  categories.push('spf_50_oily');
} else if (stepStr.startsWith('spf_50_sensitive') || stepStr.includes('sensitive')) {
  categories.push('spf_50_sensitive');
}

// СТАЛО:
if (stepStr.startsWith('spf_50_sensitive') || (stepStr.includes('spf') && stepStr.includes('sensitive'))) {
  categories.push('spf_50_sensitive');
} else if (stepStr.startsWith('spf_50_oily') || (stepStr.includes('spf') && stepStr.includes('oily'))) {
  categories.push('spf_50_oily');
} else if (stepStr.startsWith('spf_50_face') || stepStr === 'spf' || categoryStr === 'spf') {
  categories.push('spf_50_face');
}
```

### 2. Cleanser маппинг (lib/plan-generator.ts:994)
```typescript
// БЫЛО:
} else if (stepStr.startsWith('cleanser_balancing') || stepStr.includes('balancing') || categoryStr.includes('balancing')) {
  categories.push('cleanser_balancing');

// СТАЛО:
} else if (stepStr.startsWith('cleanser_balancing') || (stepStr.includes('cleanser') && (stepStr.includes('balancing') || categoryStr.includes('balancing')))) {
  categories.push('cleanser_balancing');
```

### 3. Toner маппинг (lib/plan-generator.ts:1007)
```typescript
// БЫЛО:
} else if (stepStr.startsWith('toner_soothing') || stepStr.includes('soothing') || categoryStr.includes('soothing')) {
  categories.push('toner_soothing');

// СТАЛО:
} else if (stepStr.startsWith('toner_soothing') || (stepStr.includes('toner') && (stepStr.includes('soothing') || categoryStr.includes('soothing')))) {
  categories.push('toner_soothing');
```

### 4. Moisturizer маппинг (lib/plan-generator.ts:1060)
```typescript
// БЫЛО:
} else if (stepStr.startsWith('moisturizer_soothing') || stepStr.includes('soothing') || categoryStr.includes('soothing')) {
  categories.push('moisturizer_soothing');

// СТАЛО:
} else if (stepStr.startsWith('moisturizer_soothing') || (stepStr.includes('moisturizer') && (stepStr.includes('soothing') || categoryStr.includes('soothing')))) {
  categories.push('moisturizer_soothing');
```

### 5. Mask маппинг (lib/plan-generator.ts:1088-1091)
```typescript
// БЫЛО:
} else if (stepStr.startsWith('mask_hydrating') || stepStr.includes('hydrating')) {
  categories.push('mask_hydrating');
} else if (stepStr.startsWith('mask_soothing') || stepStr.includes('soothing')) {
  categories.push('mask_soothing');

// СТАЛО:
} else if (stepStr.startsWith('mask_hydrating') || (stepStr.includes('mask') && stepStr.includes('hydrating'))) {
  categories.push('mask_hydrating');
} else if (stepStr.startsWith('mask_soothing') || (stepStr.includes('mask') && stepStr.includes('soothing'))) {
  categories.push('mask_soothing');
```

## Результаты проверки

После исправлений для пользователя 643160759 (dry skin):

✅ **Правильный маппинг:**
- `cleanser_gentle`: 5 продуктов
- `toner_hydrating`: 1 продукт (только toner, не маппится на mask)
- `toner_soothing`: 2 продукта (только toner, не маппится на moisturizer/mask)
- `moisturizer_barrier`: 3 продукта
- `spf_50_sensitive`: 3 продукта (правильно, не маппится на spf_50_face)

❌ **Отсутствует в RecommendationSession:**
- `serum_hydrating`: нет продуктов (будет найден через fallback при генерации плана)

## Файлы изменены

- `lib/plan-generator.ts` - исправлена функция `mapStepToStepCategory`
- `scripts/check-product-step-matching.ts` - добавлен скрипт для проверки маппинга

