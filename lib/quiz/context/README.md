# QuizContext

Централизованное управление состоянием анкеты через React Context API.

## Использование

### 1. Обернуть компонент в QuizProvider

```tsx
import { QuizProvider } from '@/lib/quiz/context';

function QuizPage() {
  const contextValue = {
    // ... все state, refs, setters, functions
  };
  
  return (
    <QuizProvider value={contextValue}>
      <QuizContent />
    </QuizProvider>
  );
}
```

### 2. Использовать хуки в дочерних компонентах

```tsx
import { useQuizState, useQuizActions, useQuizComputed } from '@/lib/quiz/context';

function QuizContent() {
  // Только state
  const { questionnaire, loading, error, currentQuestionIndex } = useQuizState();
  
  // Только actions
  const { handleNext, handleBack, handleAnswer } = useQuizActions();
  
  // Только computed values
  const { currentQuestion, allQuestions } = useQuizComputed();
  
  // Или все сразу
  const quiz = useQuizContext();
  
  return (
    // ...
  );
}
```

## Преимущества

1. **Упрощение props drilling** - не нужно передавать множество props через компоненты
2. **Централизация состояния** - все состояние в одном месте
3. **Типобезопасность** - TypeScript типы для всего контекста
4. **Разделение ответственности** - хуки разделяют state, actions и computed values
5. **Легкое тестирование** - можно мокировать контекст в тестах

## Структура

- `QuizContext` - основной контекст
- `QuizProvider` - провайдер компонент
- `useQuizContext()` - хук для доступа ко всему контексту
- `useQuizState()` - хук для доступа только к state
- `useQuizActions()` - хук для доступа только к actions
- `useQuizComputed()` - хук для доступа только к computed values

## Интеграция с State Machine

QuizContext может быть интегрирован с `QuizStateMachine` для еще более централизованного управления состоянием. State Machine будет управлять переходами между состояниями, а Context будет предоставлять доступ к этим состояниям и действиям.

