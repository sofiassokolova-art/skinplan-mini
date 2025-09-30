# Типографическая система

## Базовые стили

Все стили применяются автоматически к стандартным HTML тегам:

### Заголовки

```tsx
<h1>Заголовок H1</h1>  // 24px/28px, Semibold (600)
<h2>Заголовок H2</h2>  // 18px/24px, Semibold (600)
```

### Основной текст

```tsx
<p>Обычный текст</p>   // 15px/22px, Regular (400)
<span>Текст</span>     // 15px/22px, Regular (400)
<div>Контент</div>     // 15px/22px, Regular (400)
```

## Tailwind классы

Вы можете использовать следующие кастомные классы:

```tsx
// Заголовки
<div className="text-h1">H1 заголовок</div>
<div className="text-h2">H2 заголовок</div>

// Основной текст
<div className="text-body">Основной текст</div>

// Табличные цифры (для консистентной ширины чисел)
<div className="tabular-nums">123,456.78</div>
<span className="numeric">99%</span>
```

## Примеры использования табличных цифр

Табличные цифры полезны для:
- Прогресс-баров: `<span className="tabular-nums">{progress}%</span>`
- Таймеров и счётчиков: `<div className="tabular-nums">00:45</div>`
- Таблиц с числовыми данными
- Любых мест, где числа должны иметь одинаковую ширину

```tsx
// Пример прогресс-бара
<div className="text-2xl font-semibold tabular-nums">
  {Math.round(value)}%
</div>

// Пример счётчика
<span className="text-[13px] tabular-nums">
  Выполнено {completed} из {items.length}
</span>
```

## CSS переменные

```css
font-feature-settings: "tnum" on;  /* Табличные цифры */
font-variant-numeric: tabular-nums;
```
