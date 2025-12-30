# Варианты рефакторинга Quiz Page

## Текущие проблемы

1. **Огромный файл**: 8638+ строк кода в одном файле
2. **Множество состояний**: ~20+ useState, ~10+ useRef
3. **Сложная синхронизация**: state и ref дублируются и синхронизируются через useEffect
4. **Гонки состояний**: между state и ref, между разными useEffect
5. **Дублирование логики**: извлечение вопросов, фильтрация, проверки
6. **Сложные зависимости**: useMemo и useEffect с множественными зависимостями

## Варианты рефакторинга

### Вариант 1: State Machine (XState или кастомная) ⭐ Рекомендуется

**Преимущества:**
- Четкое управление состояниями (LOADING → INTRO → QUESTIONS → SUBMITTING)
- Устранение гонок состояний
- Легче тестировать и отлаживать
- Уже есть заготовка в `lib/quiz/quiz-state-machine.ts`

**Что нужно сделать:**
1. Интегрировать существующую state machine в page.tsx
2. Заменить множественные boolean флаги на единое состояние
3. Использовать события для переходов между состояниями

**Пример:**
```typescript
const { state, send } = useQuizStateMachine();

// Вместо множественных проверок
if (state === 'LOADING') return <Loader />;
if (state === 'INTRO') return <IntroScreen />;
if (state === 'QUESTIONS') return <QuestionScreen />;
```

**Оценка:** 2-3 дня работы

---

### Вариант 2: Context API + Кастомные хуки

**Преимущества:**
- Централизованное управление состоянием
- Устранение prop drilling
- Легче тестировать отдельные части
- Уже есть хуки в `lib/quiz/hooks/` (но не используются)

**Что нужно сделать:**
1. Создать `QuizContext` для глобального состояния
2. Использовать существующие хуки (`useQuizState`, `useQuizProgress`, etc.)
3. Разбить page.tsx на компоненты, использующие context

**Пример:**
```typescript
// QuizProvider.tsx
const QuizProvider = ({ children }) => {
  const quizState = useQuizState();
  const quizProgress = useQuizProgress();
  // ...
  return (
    <QuizContext.Provider value={{ ...quizState, ...quizProgress }}>
      {children}
    </QuizContext.Provider>
  );
};

// В компонентах
const { questionnaire, currentQuestion, handleAnswer } = useQuiz();
```

**Оценка:** 3-4 дня работы

---

### Вариант 3: Разбиение на компоненты (поэтапно)

**Преимущества:**
- Минимальные изменения в текущей логике
- Можно делать постепенно
- Меньше риска сломать что-то

**Что нужно сделать:**
1. Вынести экраны в отдельные компоненты:
   - `LoadingScreen.tsx`
   - `IntroScreens.tsx`
   - `QuestionScreen.tsx`
   - `ResumeScreen.tsx` (уже есть)
   - `RetakeScreen.tsx` (уже есть)
2. Вынести логику в хуки:
   - `useQuestionnaireLoader.ts`
   - `useQuestionNavigation.ts`
   - `useAnswerHandler.ts`
3. Упростить page.tsx до роутера экранов

**Пример:**
```typescript
// page.tsx становится простым роутером
export default function QuizPage() {
  const view = useQuizView(); // определяет, какой экран показывать
  
  switch (view) {
    case 'loading': return <LoadingScreen />;
    case 'intro': return <IntroScreens />;
    case 'resume': return <ResumeScreen />;
    case 'questions': return <QuestionScreen />;
    // ...
  }
}
```

**Оценка:** 4-5 дней работы (можно делать постепенно)

---

### Вариант 4: Упрощение синхронизации state/ref

**Преимущества:**
- Решает текущую проблему с гонками
- Минимальные изменения
- Можно сделать быстро

**Что нужно сделать:**
1. Использовать только ref для критических данных (questionnaire, currentQuestionIndex)
2. State использовать только для UI (loading, error)
3. Убрать дублирование и синхронизацию через useEffect

**Пример:**
```typescript
// Вместо state + ref + синхронизация
const questionnaireRef = useRef<Questionnaire | null>(null);
const [questionnaire, setQuestionnaire] = useState<Questionnaire | null>(null);

// Использовать только ref для логики
const questionnaireRef = useRef<Questionnaire | null>(null);
// State только для триггера ре-рендера
const [questionnaireVersion, setQuestionnaireVersion] = useState(0);

// При обновлении
questionnaireRef.current = data;
setQuestionnaireVersion(v => v + 1); // триггер ре-рендера
```

**Оценка:** 1-2 дня работы

---

### Вариант 5: Комбинированный подход (рекомендуется для продакшена)

**Этап 1: Быстрые улучшения (1-2 дня)**
- Упростить синхронизацию state/ref (Вариант 4)
- Вынести самые большие функции в отдельные файлы
- Добавить больше логирования для диагностики

**Этап 2: Разбиение на компоненты (3-4 дня)**
- Вынести экраны в компоненты (Вариант 3)
- Использовать существующие хуки из `lib/quiz/hooks/`
- Упростить page.tsx

**Этап 3: State Machine (опционально, 2-3 дня)**
- Интегрировать state machine
- Заменить множественные проверки на switch по состоянию

---

## Рекомендации

### Для быстрого улучшения (сейчас):
1. ✅ **Упростить синхронизацию state/ref** - использовать ref для логики, state для UI
2. ✅ **Вынести большие функции** - `loadQuestionnaire`, `handleNext`, `renderInfoScreen` в отдельные файлы
3. ✅ **Использовать существующие хуки** - `useQuizState`, `useQuizProgress` уже есть

### Для долгосрочного улучшения:
1. ⭐ **State Machine** - самое чистое решение для сложных состояний
2. ⭐ **Context API** - для глобального состояния
3. ⭐ **Разбиение на компоненты** - для читаемости и поддержки

---

## Приоритеты

1. **Критично**: Упростить синхронизацию state/ref (решает текущие проблемы)
2. **Важно**: Вынести экраны в компоненты (снижает сложность)
3. **Желательно**: State Machine (улучшает архитектуру)

