# Обзор логики перепрохождения анкеты

## Текущая логика (после исправлений)

### 1. Инициализация при монтировании (`useEffect` на строке 65)
- ✅ Проверяет `is_retaking_quiz` в localStorage
- ✅ Если найден, устанавливает `setIsRetakingQuiz(true)` и `setShowRetakeScreen(true)`
- ✅ Очищает `full_retake_from_home` после использования
- ✅ НЕ очищает `quiz_progress` (прогресс сохраняется)

### 2. Проверка профиля в `init()` (строка 210)
- ✅ Проверяет наличие профиля через API
- ✅ Если профиль найден И анкета завершена → показывает экран выбора тем
- ⚠️ **ПРОБЛЕМА**: Не проверяет флаг `is_retaking_quiz` из localStorage
- **РЕШЕНИЕ**: Нужно проверять флаг из localStorage перед установкой `isRetakingQuiz`

### 3. Экран выбора тем (`showRetakeScreen && isRetakingQuiz`)
- ✅ Показывается список тем с PaymentGate (49₽)
- ✅ Показывается кнопка "Пройти всю анкету заново" с PaymentGate (99₽)
- ✅ После оплаты темы → редирект на `/quiz/update/{topicId}`
- ✅ После оплаты полного перепрохождения → `setShowRetakeScreen(false)`, `setIsRetakingQuiz(true)`

### 4. Пропуск инфо-экранов (`isShowingInitialInfoScreen`)
- ✅ Проверяет `showRetakeScreen` - если `true`, не показывает начальные экраны
- ✅ Проверяет `isRetakingQuiz && !showRetakeScreen` - если `true`, не показывает начальные экраны
- ✅ Проверяет `currentInfoScreenIndex >= initialInfoScreens.length` - если `true`, не показывает
- ✅ При перепрохождении `currentInfoScreenIndex` устанавливается в `initialInfoScreens.length`

### 5. Пропуск инфо-экранов в `useEffect` (строка 1857)
- ✅ Проверяет `isRetakingQuiz && !showRetakeScreen`
- ✅ Устанавливает `currentInfoScreenIndex = initialInfoScreens.length`
- ⚠️ **ПРОБЛЕМА**: Проверка `currentQuestionIndex === 0` может не сработать, если уже есть ответы
- **РЕШЕНИЕ**: Убрать проверку `currentQuestionIndex === 0`, всегда устанавливать `currentInfoScreenIndex`

### 6. Фильтрация вопросов (`allQuestions`)
- ✅ При `isRetakingQuiz && !showRetakeScreen` фильтруются вопросы про пол и возраст
- ✅ Пропускаются все инфо-экраны между вопросами (`!isRetakingQuiz` в `handleNext`)

### 7. Очистка ответов
- ✅ В `handleFullRetake` ответы НЕ очищаются (закомментировано `setAnswers({})`)
- ✅ Прогресс НЕ очищается при перепрохождении
- ✅ Ответы сохраняются, чтобы пользователь мог изменить только часть

### 8. Отправка ответов (`submitAnswers`)
- ✅ После успешной отправки очищаются флаги `is_retaking_quiz` и `full_retake_from_home`
- ✅ Очищается прогресс через `clearProgress()`
- ✅ Редирект на `/plan`

## Потенциальные проблемы

1. **Двойная установка `isRetakingQuiz`**: 
   - В `useEffect` (строка 71) устанавливается из localStorage
   - В `init()` (строка 220) устанавливается при проверке профиля
   - **РЕШЕНИЕ**: В `init()` проверять флаг из localStorage перед установкой

2. **`currentInfoScreenIndex` может быть 0 при перепрохождении**:
   - Если пользователь зашел на страницу анкеты, `currentInfoScreenIndex` инициализируется как 0
   - `useEffect` на строке 1857 должен установить его в `initialInfoScreens.length`, но может не успеть
   - **РЕШЕНИЕ**: В `isShowingInitialInfoScreen` добавить проверку `currentInfoScreenIndex < initialInfoScreens.length` для перепрохождения

3. **Ответы могут быть очищены при загрузке**:
   - Если `answers` пустой, но есть прогресс в localStorage, он должен загружаться
   - **РЕШЕНИЕ**: Проверить логику загрузки прогресса

