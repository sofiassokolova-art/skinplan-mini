# Логика перепрохождения анкеты

## Поток перепрохождения с главной страницы

1. **Пользователь нажимает "Перепройти анкету" на главной странице**
   - Устанавливается `localStorage.setItem('is_retaking_quiz', 'true')`
   - Устанавливается `localStorage.setItem('full_retake_from_home', 'true')`
   - Редирект на `/quiz`

2. **При загрузке страницы анкеты (`quiz/page.tsx`)**
   - `useEffect` проверяет `is_retaking_quiz` в localStorage
   - Если найден, устанавливается `setIsRetakingQuiz(true)`
   - Если найден `full_retake_from_home`, устанавливается `setShowRetakeScreen(true)`
   - Флаг `full_retake_from_home` очищается из localStorage

3. **Экран выбора тем (`showRetakeScreen && isRetakingQuiz`)**
   - Показывается список тем с PaymentGate (49₽ за тему)
   - Показывается кнопка "Пройти всю анкету заново" с PaymentGate (99₽)

4. **При выборе темы (после оплаты 49₽)**
   - Редирект на `/quiz/update/{topicId}`
   - Там пользователь отвечает только на вопросы по выбранной теме

5. **При выборе "Пройти всю анкету заново" (после оплаты 99₽)**
   - `setShowRetakeScreen(false)` - скрываем экран выбора тем
   - `setIsRetakingQuiz(true)` - устанавливаем флаг перепрохождения
   - `setCurrentInfoScreenIndex(initialInfoScreens.length)` - пропускаем все начальные инфо-экраны
   - `setCurrentQuestionIndex(0)` - начинаем с первого вопроса
   - **ВАЖНО: Ответы НЕ очищаются** - пользователь может изменить только часть ответов

6. **При прохождении вопросов**
   - Фильтруются вопросы про пол и возраст (`isRetakingQuiz && !showRetakeScreen`)
   - Пропускаются все инфо-экраны между вопросами (`isRetakingQuiz`)
   - Ответы сохраняются в state и localStorage

7. **При отправке ответов**
   - Если `isRetakingQuiz`, устанавливается `localStorage.setItem('is_retaking_quiz', 'true')`
   - Ответы отправляются на сервер
   - Профиль обновляется
   - План перегенерируется
   - Редирект на `/plan`

## Проблемы, которые нужно исправить

1. **При перепрохождении показывается первый инфо-экран**
   - Проблема: `currentInfoScreenIndex` может быть 0 при перепрохождении
   - Решение: При установке `isRetakingQuiz = true` и `showRetakeScreen = false` нужно сразу установить `currentInfoScreenIndex = initialInfoScreens.length`

2. **Ответы очищаются при перепрохождении**
   - Проблема: В `handleFullRetake` был `setAnswers({})`
   - Решение: Убрать очистку ответов, чтобы пользователь мог изменить только часть ответов

3. **Прогресс очищается при перепрохождении**
   - Проблема: `localStorage.removeItem('quiz_progress')` вызывался при перепрохождении
   - Решение: Не очищать прогресс, если пользователь просто перепроходит анкету

4. **Экран выбора тем показывается даже после оплаты**
   - Проблема: `showRetakeScreen` может оставаться `true` после оплаты
   - Решение: После оплаты и выбора "Пройти всю анкету" устанавливать `setShowRetakeScreen(false)`

