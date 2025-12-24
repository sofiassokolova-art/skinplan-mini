# Источники текстов для тегов профиля

## Обзор

Тексты для тегов формируются в нескольких местах и проходят через разные этапы форматирования.

## 1. Возрастная группа ("26_30 лет")

### Источники данных:
- **БД**: `SkinProfile.ageGroup` (например, `"26_30"`, `"25_34"`, `"18_24"`)
- **API Analysis**: `analysis.profile.age` (число, например, `28`)

### Форматирование:
- **Файл**: `lib/format-helpers.ts` → `formatAgeGroup()`
- **Маппинг**:
  - `"26_30"` → `"26-30 лет"`
  - `"25_34"` → `"25-34 лет"`
  - `"18_24"` → `"18-24 лет"`
  - `"35_44"` → `"35-44 лет"`
  - `"45plus"` → `"45+ лет"`
  - Число (например, `28`) → `"28 лет"`

### Где используется:
- `app/(miniapp)/plan/plan-client-new.tsx:88-90` - форматирование для `userInfo.age`
- `components/PlanHeader.tsx:69-82` - отображение тега возраста

## 2. Тип кожи ("Тип кожи: Сухая")

### Источники данных:
- **БД**: `SkinProfile.skinType` (например, `"dry"`, `"combo"`, `"oily"`)
- **API Profile**: `profile.skinTypeRu` (уже переведенный, например, `"Сухая"`)

### Форматирование:
- **Файл**: `lib/format-helpers.ts` → `formatSkinType()`
- **Маппинг**:
  - `"dry"` → `"Сухая"`
  - `"oily"` → `"Жирная"`
  - `"combo"` → `"Комбинированная"`
  - `"normal"` → `"Нормальная"`
  - `"sensitive"` → `"Чувствительная"`
  - `"combination_dry"` → `"Комбинированная (сухая)"`
  - `"combination_oily"` → `"Комбинированная (жирная)"`

### Альтернативные источники:
- `lib/profile-calculator.ts:218-227` → `getSkinTypeLabel()` (старая функция)
- `app/api/profile/current/route.ts:59-65` → `skinTypeRuMap` (маппинг в API)

### Где используется:
- `app/(miniapp)/plan/plan-client-new.tsx:92-95` - форматирование для `userInfo.skinType`
- `components/PlanHeader.tsx:84-97` - отображение тега "Тип кожи: {skinType}"

## 3. Основной запрос ("Основной запрос: barrier" / "Барьер")

### Источники данных:
- **План**: `plan28.mainGoals[0]` (код, например, `"barrier"`, `"acne"`, `"pigmentation"`)

### Форматирование:
- **Файл**: `lib/format-helpers.ts` → `formatMainGoal()`
- **Маппинг**:
  - `"barrier"` → `"Барьер"`
  - `"acne"` → `"Акне"`
  - `"pores"` → `"Поры"`
  - `"pigmentation"` → `"Пигментация"`
  - `"dehydration"` → `"Обезвоженность"`
  - `"wrinkles"` → `"Морщины"`
  - `"antiage"` → `"Антиэйдж"`
  - `"general"` → `"Общий уход"`

### Альтернативные источники:
- `components/PlanHeader.tsx:18-26` → `goalLabels` (маппинг для отображения целей)
- `components/PlanInfographic.tsx:102-110` → `goalLabels` (расширенный маппинг)
- `components/GoalProgressInfographic.tsx:92-100` → `goalLabels` (маппинг для прогресса)

### Где используется:
- `app/(miniapp)/plan/plan-client-new.tsx:97-99` - форматирование для `userInfo.mainConcern`
- `components/PlanHeader.tsx:99-113` - отображение тега "Основной запрос: {mainConcern}"
- `components/PlanHeader.tsx:122-137` - отображение тегов целей из `mainGoals` массива

## 4. Теги целей ("Барьер", "Акне", и т.д.)

### Источники данных:
- **План**: `plan28.mainGoals` (массив кодов, например, `["barrier", "acne"]`)

### Форматирование:
- **Файл**: `components/PlanHeader.tsx:18-26` → `goalLabels`
- **Использование**: `goalLabels[goal] || goal` (строка 135)

### Где используется:
- `components/PlanHeader.tsx:116-139` - отображение тегов целей

## Проблемы и исправления

### Проблема 1: Несоответствие форматов
**Было**: 
- Возраст: `"26_30"` отображался как `"26_30 лет"` (неправильно)
- Тип кожи: `"dry"` отображался как `"dry"` (неправильно)
- Основной запрос: `"barrier"` отображался как `"barrier"` (неправильно)

**Исправлено**:
- Создан `lib/format-helpers.ts` с едиными функциями форматирования
- Все значения форматируются перед отображением

### Проблема 2: Дублирование маппингов
**Было**: Маппинги были разбросаны по разным файлам:
- `lib/profile-calculator.ts` → `getSkinTypeLabel()`
- `app/api/profile/current/route.ts` → `skinTypeRuMap`
- `components/PlanHeader.tsx` → `goalLabels`
- `components/PlanInfographic.tsx` → `goalLabels`
- `components/GoalProgressInfographic.tsx` → `goalLabels`

**Исправлено**:
- Централизованы функции форматирования в `lib/format-helpers.ts`
- Компоненты используют единые функции

## Рекомендации

1. **Использовать `lib/format-helpers.ts`** для всех форматирований
2. **Не дублировать маппинги** в разных компонентах
3. **Добавлять новые форматы** только в `format-helpers.ts`
4. **Тестировать форматирование** для всех возможных значений












