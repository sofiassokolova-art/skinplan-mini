# Дизайн-система SkinIQ

## Карточки

### Неоморфные белые карточки
**Использование**: виджеты, информационные блоки, карточки рутины

**Класс**: `neomorph-card`

**Характеристики**:
- Фон: чистый белый `#ffffff`
- Радиус: 24px (крупный)
- Граница: тонкая `1px solid rgba(0, 0, 0, 0.04)`
- Тень: мягкая неоморфная с объёмом
  - Внешняя: `8px 8px 16px rgba(0, 0, 0, 0.06), -4px -4px 12px rgba(255, 255, 255, 0.9)`
  - Внутренняя подсветка: `inset 0 1px 0 rgba(255, 255, 255, 0.8)`

**Hover**:
- Увеличенная тень: `12px 12px 24px rgba(0, 0, 0, 0.08)`

### Глянцевые чёрные карточки
**Использование**: "Совет дня", большие CTA, важные выделенные элементы

**Класс**: `glossy-black-card`

**Характеристики**:
- Фон: градиент от `#1a1a1a` до `#0a0a0a` (135deg)
- Радиус: 24px
- Граница: `1px solid rgba(255, 255, 255, 0.1)`
- Тень: глубокая `0 20px 40px rgba(0, 0, 0, 0.3)`
- Внутренняя подсветка: `inset 0 1px 0 rgba(255, 255, 255, 0.1)`
- Глянцевый блик: радиальный градиент сверху-слева

**Текст**:
- Основной: белый `#ffffff`
- Подзаголовок: 80% белого `rgba(255, 255, 255, 0.8)` для глубины

**Визуальные элементы**:
- Декоративные волны, сферы, паттерны в низкой непрозрачности (10-20%)

---

## Анимации

### Появление карточек
**Класс**: `animate-card-appear`

**Параметры**:
- Длительность: 200ms
- Easing: `cubic-bezier(0.2, 0.8, 0.2, 1)`
- Эффект: fade + tiny scale (0.98 → 1)

```css
@keyframes card-appear {
  0% { opacity: 0; transform: scale(0.98); }
  100% { opacity: 1; transform: scale(1); }
}
```

### Графики и прогресс
**Класс**: `animate-stroke-draw`

**Параметры**:
- Длительность: 250ms
- Easing: `ease-out`
- Эффект: stroke-dashoffset анимация

**Применение**: круговые прогресс-индикаторы, графики

### Чекбоксы и бейджи
**Класс**: `animate-badge-fill`

**Параметры**:
- Длительность: 120ms
- Easing: `ease-out`
- Эффект: краткий fill с лёгким scale

```css
@keyframes badge-fill {
  0% { transform: scale(0.8); opacity: 0; }
  100% { transform: scale(1); opacity: 1; }
}
```

---

## Специальные компоненты

### WaterDropProgress
Круговой индикатор в виде струи воды для гидрации

**Характеристики**:
- Размер: 90px
- Градиент: голубой (water gradient) от `#60A5FA` до `#2563EB`
- Паттерн: капли воды внутри круга (opacity 10%)
- Тень: мягкая голубая `drop-shadow(0 4px 8px rgba(59, 130, 246, 0.3))`
- Цифра: центрирована, tabular-nums, 18px, bold

**Анимация**: stroke-draw при обновлении (250ms)

---

## Использование

### Карточки рутины
```tsx
<div className="neomorph-card animate-card-appear">
  {/* content */}
</div>
```

### Совет дня / CTA
```tsx
<div className="glossy-black-card animate-card-appear">
  <div className="text-white">Заголовок</div>
  <div className="text-white/80">Подзаголовок</div>
</div>
```

### Чекбоксы
```tsx
<span className={`... ${done ? 'animate-badge-fill' : ''}`}>
  {/* checkmark */}
</span>
```

### Виджеты
```tsx
<article className="neomorph-card animate-card-appear">
  <WaterDropProgress value={72} />
</article>
```
