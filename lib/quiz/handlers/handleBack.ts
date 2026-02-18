// lib/quiz/handlers/handleBack.ts

import { clientLogger } from '@/lib/client-logger';
import { safeSessionStorageSet } from '@/lib/storage-utils';
import {
  getInitialInfoScreens,
  getInfoScreenAfterQuestion,
  getNextInfoScreenAfterScreen,
  INFO_SCREENS,
} from '@/app/(miniapp)/quiz/info-screens';
import type { InfoScreen } from '@/app/(miniapp)/quiz/info-screens';
import type { Questionnaire, Question } from '@/lib/quiz/types';
import {
  saveProgressSafely,
  updateInfoScreenIndex,
  updateQuestionIndex,
  isOnQuestions,
  hasQuestionnaire,
} from './shared-utils';

export interface HandleBackParams {
  // state
  currentInfoScreenIndex: number;
  currentQuestionIndex: number;
  questionnaire: Questionnaire | null;
  questionnaireRef: React.MutableRefObject<Questionnaire | null>;
  pendingInfoScreen: InfoScreen | null;
  allQuestions: Question[];
  answers: Record<number, string | string[]>;

  // refs
  currentInfoScreenIndexRef: React.MutableRefObject<number>;
  currentQuestionIndexRef?: React.MutableRefObject<number>;
  pendingInfoScreenRef?: React.MutableRefObject<InfoScreen | null>;
  handleBackInProgressRef: React.MutableRefObject<boolean>;

  // setters
  setCurrentInfoScreenIndex: React.Dispatch<React.SetStateAction<number>>;
  setCurrentQuestionIndex: React.Dispatch<React.SetStateAction<number>>;
  setPendingInfoScreen: React.Dispatch<React.SetStateAction<InfoScreen | null>>;
  setAnswers: React.Dispatch<React.SetStateAction<Record<number, string | string[]>>>;

  // additional context for initial info flow
  isShowingInitialInfoScreen?: boolean;
  initialInfoScreensLength?: number;

  // persistence
  saveProgress: (
    answers: Record<number, string | string[]>,
    questionIndex: number,
    infoScreenIndex: number
  ) => Promise<void>;

  // ✅ scoped keys from page.tsx (must match)
  scopedStorageKeys: {
    CURRENT_INFO_SCREEN: string;
    CURRENT_QUESTION: string;
  };
}

// Функция заменена на импортированную из storage-utils

function dropAnswer(
  answers: Record<number, string | string[]>,
  q?: Question | null
) {
  if (!q) return answers;
  if (answers[q.id] === undefined) return answers;
  const next = { ...answers };
  delete next[q.id];
  return next;
}

export async function handleBack(params: HandleBackParams): Promise<void> {
  const {
    currentInfoScreenIndex,
    currentQuestionIndex,
    questionnaire,
    questionnaireRef,
    pendingInfoScreen,
    currentInfoScreenIndexRef,
    currentQuestionIndexRef,
    pendingInfoScreenRef,
    allQuestions,
    answers,

    handleBackInProgressRef,

    setCurrentInfoScreenIndex,
    setCurrentQuestionIndex,
    setPendingInfoScreen,
    setAnswers,

    isShowingInitialInfoScreen = false,
    initialInfoScreensLength = 0,

    saveProgress,
    scopedStorageKeys,
  } = params;

  console.log('⬅️ [handleBack] called', {
    currentQuestionIndex,
    currentInfoScreenIndex,
    allQuestionsLength: allQuestions.length,
    answersCount: Object.keys(answers).length,
    isShowingInitialInfoScreen,
    initialInfoScreensLength,
    pendingInfoScreen: !!pendingInfoScreen,
    canGoBack: currentQuestionIndex > 0 || currentInfoScreenIndex > 0
  });

  if (handleBackInProgressRef.current) {
    clientLogger.warn('⏸️ handleBack: ignored (in progress)');
    return;
  }
  handleBackInProgressRef.current = true;

  try {
    // Все вычисления внутри try для предотвращения залипания флага
    const initialInfoScreens = getInitialInfoScreens();
    const isOnQuestionsValue = isOnQuestions(currentInfoScreenIndex, currentInfoScreenIndexRef);
    // если на вопросах (кроме случая “первый вопрос -> назад в инфо”), анкета должна быть
    const isOnFirstQuestion = currentQuestionIndex === 0 && allQuestions.length > 0;
    if (isOnQuestionsValue && !isOnFirstQuestion && !hasQuestionnaire(questionnaire, questionnaireRef)) {
      clientLogger.warn('⏸️ handleBack: questionnaire not ready on questions');
      return;
    }

    // ИСПРАВЛЕНО: Нормализуем currentQuestionIndex в начале, если он выходит за границы
    // Это предотвращает ошибки, когда индекс был установлен на неотфильтрованный список
    let normalizedCurrentIndex = currentQuestionIndex;
    if (normalizedCurrentIndex >= allQuestions.length && allQuestions.length > 0) {
      // Если индекс выходит за границы, находим последний вопрос, на который есть ответ
      // или устанавливаем на последний валидный индекс
      const answeredQuestionIds = Object.keys(answers).map(id => Number(id)).filter(id => !isNaN(id));
      const lastAnsweredQuestion = allQuestions
        .map((q, idx) => ({ q, idx }))
        .reverse()
        .find(({ q }) => answeredQuestionIds.includes(q.id));
      
      if (lastAnsweredQuestion) {
        normalizedCurrentIndex = lastAnsweredQuestion.idx;
        clientLogger.log('🔧 [handleBack] нормализован индекс по последнему отвеченному вопросу', {
          oldIndex: currentQuestionIndex,
          newIndex: normalizedCurrentIndex,
          allQuestionsLength: allQuestions.length,
          questionCode: lastAnsweredQuestion.q.code,
        });
      } else {
        normalizedCurrentIndex = Math.max(0, allQuestions.length - 1);
        clientLogger.log('🔧 [handleBack] нормализован индекс на последний валидный', {
          oldIndex: currentQuestionIndex,
          newIndex: normalizedCurrentIndex,
          allQuestionsLength: allQuestions.length,
        });
      }
      
      // ИСПРАВЛЕНО: Обновляем currentQuestionIndex, если он был нормализован
      // Это предотвращает ошибки, когда компонент перерисовывается с невалидным индексом
      if (normalizedCurrentIndex !== currentQuestionIndex) {
        updateQuestionIndex(normalizedCurrentIndex, currentQuestionIndexRef, setCurrentQuestionIndex);
        safeSessionStorageSet(scopedStorageKeys.CURRENT_QUESTION, String(normalizedCurrentIndex));
        clientLogger.log('🔧 [handleBack] обновлен currentQuestionIndex после нормализации', {
          oldIndex: currentQuestionIndex,
          newIndex: normalizedCurrentIndex,
        });
      }
    }

    // ===============================
    // 1) BACK внутри pendingInfoScreen
    // ===============================
    if (pendingInfoScreen) {
      // 1.1 если есть цепочка showAfterInfoScreenId — идём на предыдущий экран цепочки
      if (pendingInfoScreen.showAfterInfoScreenId) {
        const prev = INFO_SCREENS.find(s => s.id === pendingInfoScreen.showAfterInfoScreenId);
        if (prev) {
          // ИСПРАВЛЕНО: Синхронно обновляем ref перед установкой state
          if (pendingInfoScreenRef) {
            pendingInfoScreenRef.current = prev;
          }
          setPendingInfoScreen(prev);
          // ИСПРАВЛЕНО: Используем нормализованный индекс
          void saveProgressSafely(saveProgress, answers, normalizedCurrentIndex, currentInfoScreenIndex);
          return;
        }
      }

      // 1.2 иначе закрываем pending и возвращаемся к вопросу “после которого он был”
      // ИСПРАВЛЕНО: Сохраняем showAfterQuestionCode перед очисткой pendingInfoScreen
      const showAfterQuestionCode = pendingInfoScreen.showAfterQuestionCode;
      // ИСПРАВЛЕНО: Синхронно очищаем ref перед установкой state в null
      // Это предотвращает бесконечный лоадер, когда useQuizComputed проверяет effectivePending
      if (pendingInfoScreenRef) {
        pendingInfoScreenRef.current = null;
        clientLogger.log('🔧 [handleBack] синхронно очищен pendingInfoScreenRef', {
          showAfterQuestionCode,
        });
      }
      setPendingInfoScreen(null);

      let targetQuestionIndex = -1;
      if (showAfterQuestionCode && allQuestions.length > 0) {
        targetQuestionIndex = allQuestions.findIndex(q => q.code === showAfterQuestionCode);
      }
      if (targetQuestionIndex === -1) {
        // ИСПРАВЛЕНО: Используем нормализованный индекс вместо текущего
        if (normalizedCurrentIndex > 0) {
          targetQuestionIndex = normalizedCurrentIndex - 1;
        } else {
          // ИСПРАВЛЕНО: Если нет предыдущего вопроса, возвращаемся к текущему
          clientLogger.warn('⚠️ handleBack: нет предыдущего вопроса, остаемся на текущем', {
            currentQuestionIndex,
            normalizedCurrentIndex,
            showAfterQuestionCode,
            allQuestionsLength: allQuestions.length,
          });
          handleBackInProgressRef.current = false;
          return;
        }
      }

      // ИСПРАВЛЕНО: Проверяем, что targetQuestionIndex валиден
      // Если индекс выходит за границы (например, 22 в неотфильтрованном массиве),
      // устанавливаем его на последний валидный индекс
      let validTargetIndex = targetQuestionIndex;
      if (targetQuestionIndex < 0) {
        // Если вопрос не найден, используем нормализованный индекс
        validTargetIndex = normalizedCurrentIndex > 0 ? normalizedCurrentIndex - 1 : 0;
        clientLogger.warn('⚠️ handleBack: вопрос не найден по коду, используем предыдущий индекс', {
          showAfterQuestionCode,
          targetQuestionIndex,
          validTargetIndex,
          normalizedCurrentIndex,
        });
      } else if (targetQuestionIndex >= allQuestions.length) {
        // ИСПРАВЛЕНО: Если индекс выходит за границы (например, 22 в неотфильтрованном массиве),
        // находим вопрос по коду и устанавливаем индекс на его позицию, но ограничиваем максимальным валидным индексом
        const questionByCode = allQuestions.find(q => q.code === showAfterQuestionCode);
        if (questionByCode) {
          const foundIndex = allQuestions.findIndex(q => q.code === showAfterQuestionCode);
          validTargetIndex = foundIndex >= 0 ? Math.min(foundIndex, allQuestions.length - 1) : Math.min(normalizedCurrentIndex, allQuestions.length - 1);
          clientLogger.warn('⚠️ handleBack: индекс выходит за границы, исправляем', {
            showAfterQuestionCode,
            targetQuestionIndex,
            foundIndex,
            validTargetIndex,
            allQuestionsLength: allQuestions.length,
          });
        } else {
          validTargetIndex = Math.min(normalizedCurrentIndex, allQuestions.length - 1);
          clientLogger.error('❌ handleBack: невалидный targetQuestionIndex и вопрос не найден', {
            targetQuestionIndex,
            allQuestionsLength: allQuestions.length,
            showAfterQuestionCode,
            validTargetIndex,
          });
        }
      }
      
      // ИСПРАВЛЕНО: Финальная проверка - убеждаемся, что validTargetIndex всегда валиден
      if (validTargetIndex < 0 || validTargetIndex >= allQuestions.length) {
        // Если индекс все еще невалиден, устанавливаем на последний валидный
        validTargetIndex = Math.max(0, Math.min(allQuestions.length - 1, normalizedCurrentIndex));
        clientLogger.error('❌ handleBack: validTargetIndex все еще невалиден, устанавливаем на последний валидный', {
          previousValidTargetIndex: validTargetIndex,
          newValidTargetIndex: validTargetIndex,
          allQuestionsLength: allQuestions.length,
          normalizedCurrentIndex,
        });
      }

      // ИСПРАВЛЕНО: Когда мы возвращаемся к вопросу после инфо-экрана,
      // мы НЕ должны удалять ответ на этот вопрос, потому что мы уже ответили на него
      // Удаляем ответ только если мы переходим к другому вопросу (не к тому, после которого был инфо-экран)
      let nextAnswers = answers;
      const targetQ = allQuestions[validTargetIndex] ?? null;
      
      // Если мы возвращаемся к вопросу, после которого был показан инфо-экран,
      // не удаляем ответ на него. Удаляем ответ только если validTargetIndex отличается
      // от индекса вопроса, после которого был показан инфо-экран
      if (targetQ && showAfterQuestionCode && targetQ.code !== showAfterQuestionCode) {
        // Мы переходим к другому вопросу, удаляем ответ на текущий вопрос
        const currentQ = allQuestions[normalizedCurrentIndex] ?? null;
        if (currentQ) {
          nextAnswers = dropAnswer(answers, currentQ);
        }
      } else if (!targetQ || (showAfterQuestionCode && targetQ.code === showAfterQuestionCode)) {
        // Мы возвращаемся к вопросу, после которого был показан инфо-экран
        // НЕ удаляем ответ на него
        clientLogger.log('🔙 [handleBack] возвращаемся к вопросу после инфо-экрана, не удаляем ответ', {
          showAfterQuestionCode,
          targetQuestionIndex: validTargetIndex,
          targetQuestionCode: targetQ?.code,
        });
      }

      // сначала обновляем UI
      setAnswers(nextAnswers);
      updateQuestionIndex(validTargetIndex, undefined, setCurrentQuestionIndex);

      // потом сохраняем
      safeSessionStorageSet(scopedStorageKeys.CURRENT_QUESTION, String(validTargetIndex));
      void saveProgressSafely(saveProgress, nextAnswers, validTargetIndex, currentInfoScreenIndex);
      return;
    }

    // =========================================
    // 2) На первом вопросе: назад в инфо-экраны
    // =========================================
    if (currentQuestionIndex === 0 && allQuestions.length > 0) {
      // ИСПРАВЛЕНО: Всегда позволяем вернуться к начальным экранам с первого вопроса
      // Проверяем, находимся ли мы в потоке начальных экранов
      const isInInitialInfoFlow = currentInfoScreenIndex < initialInfoScreensLength;

      if (isInInitialInfoFlow && currentInfoScreenIndex > 0) {
        // Шаг назад по начальным экранам
        const newInfoScreenIndex = currentInfoScreenIndex - 1;
        clientLogger.log('🔙 handleBack: шаг назад по начальным экранам', {
          currentInfoScreenIndex,
          newInfoScreenIndex,
          initialInfoScreensLength,
        });
        updateInfoScreenIndex(newInfoScreenIndex, currentInfoScreenIndexRef, setCurrentInfoScreenIndex);
        // ИСПРАВЛЕНО: Синхронно очищаем ref перед установкой state в null
        if (pendingInfoScreenRef) {
          pendingInfoScreenRef.current = null;
        }
        setPendingInfoScreen(null);

        safeSessionStorageSet(scopedStorageKeys.CURRENT_INFO_SCREEN, String(newInfoScreenIndex));
        // ИСПРАВЛЕНО: Используем нормализованный индекс
        void saveProgressSafely(saveProgress, answers, normalizedCurrentIndex, newInfoScreenIndex);
        return;
      } else {
        // Переход к последнему начальному экрану (если мы после резюм-экрана или на первом вопросе)
        const newInfoScreenIndex = Math.max(0, initialInfoScreens.length - 1);
        clientLogger.log('🔙 handleBack: переход к последнему начальному экрану с первого вопроса', {
          currentQuestionIndex,
          normalizedCurrentIndex,
          currentInfoScreenIndex,
          newInfoScreenIndex,
          initialInfoScreensLength,
        });
        updateInfoScreenIndex(newInfoScreenIndex, currentInfoScreenIndexRef, setCurrentInfoScreenIndex);
        // ИСПРАВЛЕНО: Синхронно очищаем ref перед установкой state в null
        if (pendingInfoScreenRef) {
          pendingInfoScreenRef.current = null;
        }
        setPendingInfoScreen(null);

        safeSessionStorageSet(scopedStorageKeys.CURRENT_INFO_SCREEN, String(newInfoScreenIndex));
        // ИСПРАВЛЕНО: Используем нормализованный индекс
        void saveProgressSafely(saveProgress, answers, normalizedCurrentIndex, newInfoScreenIndex);
        return;
      }
    }

    // ======================
    // 3) Назад по вопросам
    // ======================
    if (isOnQuestionsValue && normalizedCurrentIndex > 0) {
      // ИСПРАВЛЕНО: Используем нормализованный индекс
      const currentQ = allQuestions[normalizedCurrentIndex] ?? null;
      const prevIndex = normalizedCurrentIndex - 1;
      const prevQ = allQuestions[prevIndex];

      const nextAnswers = dropAnswer(answers, currentQ);
      setAnswers(nextAnswers);

      // 3.1 если перед текущим вопросом есть цепочка инфо-экранов после prevQ — показываем последний в цепочке
      if (prevQ) {
        const first = getInfoScreenAfterQuestion(prevQ.code);
        if (first) {
          let last = first;
          let next = getNextInfoScreenAfterScreen(last.id);
          while (next) {
            last = next;
            next = getNextInfoScreenAfterScreen(last.id);
          }

          // ИСПРАВЛЕНО: Синхронно обновляем ref перед установкой state
          if (pendingInfoScreenRef) {
            pendingInfoScreenRef.current = last;
          }
          setPendingInfoScreen(last);
          updateQuestionIndex(prevIndex, undefined, setCurrentQuestionIndex);

          safeSessionStorageSet(scopedStorageKeys.CURRENT_QUESTION, String(prevIndex));
          void saveProgressSafely(saveProgress, nextAnswers, prevIndex, currentInfoScreenIndex);
          return;
        }
      }

      // 3.2 обычный шаг назад по вопросам
      updateQuestionIndex(prevIndex, undefined, setCurrentQuestionIndex);
      safeSessionStorageSet(scopedStorageKeys.CURRENT_QUESTION, String(prevIndex));
      void saveProgressSafely(saveProgress, nextAnswers, prevIndex, currentInfoScreenIndex);
      return;
    }

    // ============================
    // 4) Назад по initial info
    // ============================
    const effectiveInfoIdx =
      currentInfoScreenIndexRef.current >= 0 ? currentInfoScreenIndexRef.current : currentInfoScreenIndex;

    const onInitial =
      effectiveInfoIdx >= 0 && effectiveInfoIdx < initialInfoScreens.length;

    if (onInitial && effectiveInfoIdx > 0) {
      const newInfoScreenIndex = effectiveInfoIdx - 1;
      updateInfoScreenIndex(newInfoScreenIndex, currentInfoScreenIndexRef, setCurrentInfoScreenIndex);

      safeSessionStorageSet(scopedStorageKeys.CURRENT_INFO_SCREEN, String(newInfoScreenIndex));
      // ИСПРАВЛЕНО: Используем нормализованный индекс
      void saveProgressSafely(saveProgress, answers, normalizedCurrentIndex, newInfoScreenIndex);
      return;
    }

    // иначе — начало, ничего не делаем
    clientLogger.log('🔙 handleBack: at start, no-op');
  } finally {
    handleBackInProgressRef.current = false;
  }
}