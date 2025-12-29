# Анализ проблемы отображения вопросов в Quiz Page

## Дата анализа
29 декабря 2025

## Проблема
Вопросы не отображаются, показываются только инфо-экраны. В логах видно повторяющееся сообщение:
```
⏸️ currentQuestion: null (blocked by info screen)
```

## Результаты автотестов
✅ Все 23 теста прошли успешно

## Выводы из анализа кода и тестов

### 1. Основные причины блокировки вопросов

#### Причина 1: `isOnInitialInfoScreen = true`
Вопросы блокируются, если:
- `currentInfoScreenIndex < initialInfoScreens.length` (еще не прошли все начальные экраны)
- `isShowingInitialInfoScreenCorrected = true`
- `currentInitialInfoScreen` существует
- `initialInfoScreens[currentInfoScreenIndex]` существует

**Решение:** Пользователь должен пройти все начальные экраны, нажимая "Продолжить" на каждом экране.

#### Причина 2: `pendingInfoScreen` блокирует вопросы
Вопросы блокируются, если:
- Есть `pendingInfoScreen` (инфо-экран между вопросами)
- `isRetakingQuiz = false`
- `showResumeScreen = false`

**Решение:** После прохождения `pendingInfoScreen` вопросы должны показываться.

#### Причина 3: Несоответствие состояний
**КРИТИЧЕСКАЯ ПРОБЛЕМА:** Если `isShowingInitialInfoScreen = true`, но `currentInitialInfoScreen = null`, это означает несоответствие условий.

**Решение:** Добавлен `isShowingInitialInfoScreenCorrected`, который исправляет это несоответствие:
```typescript
const isShowingInitialInfoScreenCorrected = useMemo(() => {
  if (isShowingInitialInfoScreen && !currentInitialInfoScreen) {
    return false; // Исправляем несоответствие
  }
  return isShowingInitialInfoScreen;
}, [isShowingInitialInfoScreen, currentInitialInfoScreen]);
```

### 2. Критические сценарии, которые могут блокировать вопросы

#### Сценарий 1: `currentInfoScreenIndex` не обновляется
**Проблема:** Если пользователь прошел все начальные экраны, но `currentInfoScreenIndex` не обновился до `initialInfoScreens.length`, вопросы будут заблокированы.

**Проверка:** В `handleNext` есть логика:
```typescript
if (currentInfoScreenIndex === initialInfoScreens.length - 1) {
  const newInfoIndex = initialInfoScreens.length;
  setCurrentInfoScreenIndex(newInfoIndex);
  // ...
}
```

**Вывод:** Логика обновления индекса правильная, но может быть задержка в обновлении состояния React.

#### Сценарий 2: Элемент массива `undefined`
**Проблема:** Если `currentInfoScreenIndex` указывает на несуществующий элемент массива `initialInfoScreens[currentInfoScreenIndex]`, то `currentInitialInfoScreen` будет `null`, но `isShowingInitialInfoScreen` может быть `true`.

**Решение:** Добавлена проверка `!!initialInfoScreens[currentInfoScreenIndex]` в `isOnInitialInfoScreen`:
```typescript
const isOnInitialInfoScreen = initialInfoScreens.length > 0 && 
                               currentInfoScreenIndex < initialInfoScreens.length && 
                               isShowingInitialInfoScreenCorrected && 
                               !!currentInitialInfoScreen &&
                               !!initialInfoScreens[currentInfoScreenIndex]; // КРИТИЧНО
```

#### Сценарий 3: Задержка обновления состояния
**Проблема:** React может обновлять состояние асинхронно, поэтому может быть ситуация, когда:
- `currentInfoScreenIndex` уже обновлен до `initialInfoScreens.length`
- Но `isShowingInitialInfoScreen` еще `true` (из предыдущего рендера)

**Решение:** Проверка `currentInfoScreenIndex >= initialInfoScreens.length` в `isShowingInitialInfoScreen`:
```typescript
if (currentInfoScreenIndex >= initialInfoScreens.length) {
  return false; // Все экраны пройдены
}
```

### 3. Логика `shouldBlockByInfoScreen`

```typescript
const shouldBlockByInfoScreen = (isOnInitialInfoScreen || (pendingInfoScreen && !isRetakingQuiz)) && !showResumeScreen;
```

**Условия блокировки:**
1. `isOnInitialInfoScreen = true` ИЛИ
2. `pendingInfoScreen` существует И `isRetakingQuiz = false`
3. И `showResumeScreen = false`

**Важно:** Если `showResumeScreen = true`, вопросы НЕ блокируются, даже если есть начальные экраны.

### 4. Рекомендации по исправлению

#### Рекомендация 1: Улучшить логирование
✅ **УЖЕ ИСПРАВЛЕНО:** Добавлено детальное логирование с информацией о:
- `blockReason` - что именно блокирует вопросы
- `shouldShowInitialScreen` - должен ли показываться начальный экран
- `hasScreenAtIndex` - существует ли элемент массива

#### Рекомендация 2: Проверить обновление `currentInfoScreenIndex`
**Проблема:** Может быть задержка в обновлении состояния после `handleNext`.

**Решение:** Добавить `useEffect`, который проверяет несоответствие и исправляет его:
```typescript
useEffect(() => {
  if (currentInfoScreenIndex >= initialInfoScreens.length && isShowingInitialInfoScreen) {
    // Принудительно обновляем состояние
    // Это должно быть обработано в isShowingInitialInfoScreen useMemo
  }
}, [currentInfoScreenIndex, initialInfoScreens.length, isShowingInitialInfoScreen]);
```

#### Рекомендация 3: Проверить инициализацию `currentInfoScreenIndex`
**Проблема:** При первой загрузке `currentInfoScreenIndex` может быть установлен неправильно.

**Проверка:** В коде есть логика инициализации в `useEffect`, но нужно убедиться, что она работает правильно.

### 5. Выводы из логов

Из логов видно:
```
⏸️ currentQuestion: null (blocked by info screen)
```

Это означает, что `shouldBlockByInfoScreen = true`.

**Возможные причины:**
1. `isOnInitialInfoScreen = true` - пользователь еще не прошел все начальные экраны
2. `pendingInfoScreen` существует - показывается инфо-экран между вопросами
3. Несоответствие состояний - `isShowingInitialInfoScreen = true`, но `currentInitialInfoScreen = null`

**Решение:** Новое логирование покажет точную причину блокировки через `blockReason`.

### 6. Тестовые сценарии

Все критические сценарии покрыты тестами:
- ✅ Вопросы показываются, если все начальные экраны пройдены
- ✅ Вопросы НЕ показываются, если `isOnInitialInfoScreen = true`
- ✅ Вопросы показываются, если `currentInfoScreenIndex >= initialInfoScreens.length`, даже если `isShowingInitialInfoScreen = true`
- ✅ Вопросы показываются, если `currentInitialInfoScreen = null`, даже если `isShowingInitialInfoScreen = true`
- ✅ Вопросы показываются, если `initialInfoScreens` пустой
- ✅ Вопросы НЕ показываются, если `pendingInfoScreen` существует
- ✅ Вопросы показываются, если `showResumeScreen = true`

### 7. Финальные выводы

**Основная проблема:** Вопросы блокируются из-за того, что:
1. Пользователь еще не прошел все начальные экраны (`currentInfoScreenIndex < initialInfoScreens.length`)
2. ИЛИ есть несоответствие состояний (`isShowingInitialInfoScreen = true`, но `currentInitialInfoScreen = null`)

**Исправления:**
1. ✅ Добавлен `isShowingInitialInfoScreenCorrected` для исправления несоответствий
2. ✅ Добавлена проверка `!!initialInfoScreens[currentInfoScreenIndex]` в `isOnInitialInfoScreen`
3. ✅ Улучшено логирование для диагностики проблем
4. ✅ Добавлены проверки для случая, когда `currentInfoScreenIndex >= initialInfoScreens.length`

**Следующие шаги:**
1. Проверить логи с новым детальным логированием
2. Убедиться, что `currentInfoScreenIndex` обновляется правильно после прохождения всех начальных экранов
3. Проверить, что `handleNext` вызывается правильно при нажатии "Продолжить" на последнем начальном экране

## Автотесты

Все тесты находятся в `tests/quiz-question-display.test.ts` и покрывают:
- Логику `isShowingInitialInfoScreenCorrected`
- Логику `isOnInitialInfoScreen`
- Логику `shouldBlockByInfoScreen`
- Логику `calculateCurrentQuestion`
- Критические сценарии из логов

Запуск тестов:
```bash
npm test -- tests/quiz-question-display.test.ts
```

