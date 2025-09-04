# 📝 Пошаговое обновление GitHub репозитория

## 🎯 Цель: Обновить файлы в GitHub, чтобы Vercel подхватил изменения

### 📋 **Список файлов для обновления:**

## 1. **package.json** - добавить зависимости
Зайди на: https://github.com/sofiassokolova-art/skinplan-mini/blob/main/package.json

Найди секцию `"dependencies"` и добавь:
```json
"jspdf": "^2.5.1",
"html2canvas": "^1.4.1",
"@types/jspdf": "^2.3.0"
```

## 2. **src/index.css** - жидкий фон
Зайди на: https://github.com/sofiassokolova-art/skinplan-mini/blob/main/src/index.css

Замени весь файл на:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  html, body, #root { height: 100%; }
  body { 
    @apply text-ink antialiased;
    position: relative;
    overflow: hidden;
  }
  
  body::before {
    content: '';
    position: fixed;
    top: -50%;
    left: -50%;
    width: 200%;
    height: 200%;
    background: linear-gradient(45deg, 
      rgba(219, 234, 254, 0.8) 0%,
      rgba(243, 232, 255, 0.8) 25%,
      rgba(254, 242, 242, 0.8) 50%,
      rgba(240, 249, 255, 0.8) 75%,
      rgba(219, 234, 254, 0.8) 100%
    );
    animation: liquidFlow 20s ease-in-out infinite;
    z-index: -1;
  }
  
  body::after {
    content: '';
    position: fixed;
    top: -30%;
    right: -30%;
    width: 150%;
    height: 150%;
    background: radial-gradient(ellipse at center,
      rgba(167, 139, 250, 0.3) 0%,
      rgba(196, 181, 253, 0.2) 30%,
      transparent 70%
    );
    animation: liquidPulse 15s ease-in-out infinite reverse;
    z-index: -1;
  }
}

@layer components {
  .card {
    @apply rounded-3xl border border-white/70 bg-white/70 backdrop-blur-xl shadow-soft;
  }
  .btn {
    @apply inline-flex items-center justify-center rounded-full px-6 py-3 font-semibold;
  }
  .btn-primary {
@apply btn text-white bg-gradient-to-r from-indigo-600 to-fuchsia-600 shadow-lg hover:opacity-95;

  }
  .chip {
    @apply rounded-full px-4 py-2 border border-slate-200 bg-white/70 hover:bg-white/90 text-sm;
  }
  .chip-active {
    @apply border-indigo-300 ring-2 ring-indigo-300/30 bg-indigo-50;
  }
}

@keyframes liquidFlow {
  0%, 100% {
    transform: rotate(0deg) scale(1);
    filter: hue-rotate(0deg);
  }
  25% {
    transform: rotate(90deg) scale(1.1);
    filter: hue-rotate(90deg);
  }
  50% {
    transform: rotate(180deg) scale(0.9);
    filter: hue-rotate(180deg);
  }
  75% {
    transform: rotate(270deg) scale(1.05);
    filter: hue-rotate(270deg);
  }
}

@keyframes liquidPulse {
  0%, 100% {
    transform: scale(1) rotate(0deg);
    opacity: 0.3;
  }
  33% {
    transform: scale(1.2) rotate(120deg);
    opacity: 0.5;
  }
  66% {
    transform: scale(0.8) rotate(240deg);
    opacity: 0.2;
  }
}
```

## 3. **Создать новые файлы:**

### src/lib/pdfGenerator.ts
Создай новый файл и скопируй содержимое из локального файла

### src/components/Onboarding.tsx  
Создай новый файл и скопируй содержимое из локального файла

### src/components/SkinAnalysis.tsx
Создай новый файл и скопируй содержимое из локального файла

### src/pages/SkinInsights.tsx
Создай новый файл и скопируй содержимое из локального файла

## 4. **Обновить существующие файлы:**
- `src/pages/Quiz.tsx` - новая подробная анкета
- `src/pages/Plan.tsx` - PDF + исправленная навигация
- `src/pages/Cart.tsx` - исправленная навигация
- `src/pages/Home.tsx` - онбординг
- `src/App.tsx` - новые роуты

## 🎉 **После коммита:**
Vercel автоматически подхватит изменения и сделает новый деплой!

**Все файлы готовы в папке проекта - можешь копировать! 🚀**