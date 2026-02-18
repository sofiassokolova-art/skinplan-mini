# Интеграция State Machine в Quiz Page

## Текущий статус

✅ **Создан хук `useQuizStateMachine`** - готов к использованию
✅ **State Machine класс** - полностью функционален
✅ **Экспорты обновлены** - хук доступен через `@/lib/quiz/hooks`

## Следующие шаги для полной интеграции

### 1. Заменить boolean флаги на State Machine состояния

**Текущие флаги:**
- `loading` → `state === 'LOADING'`
- `showResumeScreen` → `state === 'RESUME'`
- `isSubmitting` → `state === 'SUBMITTING'`
- `isRetakingQuiz` → `state === 'RETAKE_SELECT'`
- `showRetakeScreen` → `state === 'RETAKE_SELECT'`

**Пример замены:**
```tsx
// Было:
const [loading, setLoading] = useState(false);
const [showResumeScreen, setShowResumeScreen] = useState(false);
const [isSubmitting, setIsSubmitting] = useState(false);

// Станет:
const { state, dispatch } = useQuizStateMachine({
  initialState: 'LOADING',
  onStateChange: (newState, previousState) => {
    clientLogger.log('State changed', { newState, previousState });
  },
});

const loading = state === 'LOADING';
const showResumeScreen = state === 'RESUME';
const isSubmitting = state === 'SUBMITTING';
```

### 2. Заменить setState вызовы на dispatch событий

**Пример замены:**
```tsx
// Было:
setLoading(false);
setShowResumeScreen(true);
setIsSubmitting(true);

// Станет:
dispatch('QUESTIONNAIRE_LOADED');
dispatch('SHOW_RESUME');
dispatch('SUBMIT_STARTED');
```

### 3. Обновить условия рендеринга

**Пример замены:**
```tsx
// Было:
if (loading) return <LoadingScreen />;
if (showResumeScreen) return <ResumeScreen />;
if (isSubmitting) return <SubmittingScreen />;

// Станет:
if (state === 'LOADING') return <LoadingScreen />;
if (state === 'RESUME') return <ResumeScreen />;
if (state === 'SUBMITTING') return <SubmittingScreen />;
```

### 4. Интегрировать с существующими обработчиками

**Пример:**
```tsx
const handleNext = useCallback(() => {
  // ... существующая логика ...
  
  // Вместо setState используем dispatch
  if (allQuestionsAnswered) {
    dispatch('ALL_QUESTIONS_ANSWERED');
  } else {
    dispatch('QUESTION_ANSWERED');
  }
}, [dispatch, allQuestionsAnswered]);
```

## Преимущества интеграции

1. **Единое состояние** - все флаги заменены на одно состояние
2. **Предсказуемые переходы** - State Machine гарантирует валидные переходы
3. **Легче отлаживать** - все переходы логируются
4. **Меньше багов** - невозможно попасть в невалидное состояние
5. **Лучшая читаемость** - явные состояния вместо множества boolean флагов

## Важные моменты

- State Machine не заменяет все state - только UI флаги
- Данные (questionnaire, answers) остаются в обычном state
- State Machine управляет только потоком экранов и действий
- Нужно синхронизировать State Machine с существующей логикой постепенно

## План миграции

1. ✅ Создать хук useQuizStateMachine
2. ⏳ Добавить State Machine в page.tsx (параллельно с существующими флагами)
3. ⏳ Постепенно заменить условия рендеринга
4. ⏳ Заменить setState на dispatch в обработчиках
5. ⏳ Удалить старые boolean флаги
6. ⏳ Протестировать все сценарии

