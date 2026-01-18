// lib/quiz/handlers/handleBack.ts

import { clientLogger } from '@/lib/client-logger';
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

function setSessionIndex(key: string, value: number) {
  try {
    if (typeof window === 'undefined') return;
    sessionStorage.setItem(key, String(value));
  } catch {
    // ignore
  }
}

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

    // ===============================
    // 1) BACK внутри pendingInfoScreen
    // ===============================
    if (pendingInfoScreen) {
      // 1.1 если есть цепочка showAfterInfoScreenId — идём на предыдущий экран цепочки
      if (pendingInfoScreen.showAfterInfoScreenId) {
        const prev = INFO_SCREENS.find(s => s.id === pendingInfoScreen.showAfterInfoScreenId);
        if (prev) {
          setPendingInfoScreen(prev);
          // индексы не меняем, только сохраняем
          void saveProgressSafely(saveProgress, answers, currentQuestionIndex, currentInfoScreenIndex);
          return;
        }
      }

      // 1.2 иначе закрываем pending и возвращаемся к вопросу “после которого он был”
      setPendingInfoScreen(null);

      let targetQuestionIndex = -1;
      if (pendingInfoScreen.showAfterQuestionCode && allQuestions.length > 0) {
        targetQuestionIndex = allQuestions.findIndex(q => q.code === pendingInfoScreen.showAfterQuestionCode);
      }
      if (targetQuestionIndex === -1) {
        if (currentQuestionIndex > 0) targetQuestionIndex = currentQuestionIndex - 1;
        else return;
      }

      const currentQ = allQuestions[currentQuestionIndex] ?? null;
      const nextAnswers = dropAnswer(answers, currentQ);

      // сначала обновляем UI
      setAnswers(nextAnswers);
      updateQuestionIndex(targetQuestionIndex, undefined, setCurrentQuestionIndex);

      // потом сохраняем
      setSessionIndex(scopedStorageKeys.CURRENT_QUESTION, targetQuestionIndex);
      void saveProgressSafely(saveProgress, nextAnswers, targetQuestionIndex, currentInfoScreenIndex);
      return;
    }

    // =========================================
    // 2) На первом вопросе: назад в инфо-экраны
    // =========================================
    if (currentQuestionIndex === 0 && allQuestions.length > 0) {
      // Check if we're in initial info flow - if so, step back instead of jumping to last
      const isInInitialInfoFlow = isShowingInitialInfoScreen && currentInfoScreenIndex < initialInfoScreensLength;

      if (isInInitialInfoFlow && currentInfoScreenIndex > 0) {
        // Step back through initial info screens
        const newInfoScreenIndex = currentInfoScreenIndex - 1;
        updateInfoScreenIndex(newInfoScreenIndex, currentInfoScreenIndexRef, setCurrentInfoScreenIndex);
        setPendingInfoScreen(null);

        setSessionIndex(scopedStorageKeys.CURRENT_INFO_SCREEN, newInfoScreenIndex);
        void saveProgressSafely(saveProgress, answers, currentQuestionIndex, newInfoScreenIndex);
        return;
      } else {
        // Jump to last initial info screen (existing behavior)
        const newInfoScreenIndex = Math.max(0, initialInfoScreens.length - 1);
        updateInfoScreenIndex(newInfoScreenIndex, currentInfoScreenIndexRef, setCurrentInfoScreenIndex);
        setPendingInfoScreen(null);

        setSessionIndex(scopedStorageKeys.CURRENT_INFO_SCREEN, newInfoScreenIndex);
        void saveProgressSafely(saveProgress, answers, currentQuestionIndex, newInfoScreenIndex);
        return;
      }
    }

    // ======================
    // 3) Назад по вопросам
    // ======================
    if (isOnQuestionsValue && currentQuestionIndex > 0) {
      const currentQ = allQuestions[currentQuestionIndex] ?? null;
      const prevIndex = currentQuestionIndex - 1;
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

          setPendingInfoScreen(last);
          updateQuestionIndex(prevIndex, undefined, setCurrentQuestionIndex);

          setSessionIndex(scopedStorageKeys.CURRENT_QUESTION, prevIndex);
          void saveProgressSafely(saveProgress, nextAnswers, prevIndex, currentInfoScreenIndex);
          return;
        }
      }

      // 3.2 обычный шаг назад по вопросам
      updateQuestionIndex(prevIndex, undefined, setCurrentQuestionIndex);
      setSessionIndex(scopedStorageKeys.CURRENT_QUESTION, prevIndex);
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

      setSessionIndex(scopedStorageKeys.CURRENT_INFO_SCREEN, newInfoScreenIndex);
      void saveProgressSafely(saveProgress, answers, currentQuestionIndex, newInfoScreenIndex);
      return;
    }

    // иначе — начало, ничего не делаем
    clientLogger.log('🔙 handleBack: at start, no-op');
  } finally {
    handleBackInProgressRef.current = false;
  }
}