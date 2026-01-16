// lib/quiz/handlers/resumeQuiz.ts
// Функция для восстановления прогресса анкеты

import { clientLogger } from '@/lib/client-logger';
import { QUIZ_CONFIG } from '@/lib/quiz/config/quizConfig';
import { getInitialInfoScreens } from '@/app/(miniapp)/quiz/info-screens';
import type { SavedProgress, Questionnaire } from '@/lib/quiz/types';

export interface ResumeQuizParams {
  savedProgress: SavedProgress | null;
  questionnaire: Questionnaire | null;
  allQuestions: any[]; // Массив всех вопросов для определения следующего неотвеченного
  redirectInProgressRef: React.MutableRefObject<boolean>;
  initCompletedRef: React.MutableRefObject<boolean>;
  setInitCompleted: React.Dispatch<React.SetStateAction<boolean>>;
  setLoading: React.Dispatch<React.SetStateAction<boolean>>;
  hasResumed: boolean;
  currentInfoScreenIndex: number;
  currentQuestionIndex: number;
  hasResumedRef: React.MutableRefObject<boolean>;
  setHasResumed: React.Dispatch<React.SetStateAction<boolean>>;
  setShowResumeScreen: React.Dispatch<React.SetStateAction<boolean>>;
  setSavedProgress: React.Dispatch<React.SetStateAction<SavedProgress | null>>;
  loadProgressInProgressRef: React.MutableRefObject<boolean>;
  progressLoadInProgressRef: React.MutableRefObject<boolean>;
  setAnswers: React.Dispatch<React.SetStateAction<Record<number, string | string[]>>>;
  setCurrentQuestionIndex: React.Dispatch<React.SetStateAction<number>>;
  setCurrentInfoScreenIndex: React.Dispatch<React.SetStateAction<number>>;
  setPendingInfoScreen?: React.Dispatch<React.SetStateAction<any | null>>; // ИСПРАВЛЕНО: Добавлено для очистки pendingInfoScreen
  resumeCompletedRef: React.MutableRefObject<boolean>;
}

export function resumeQuiz(params: ResumeQuizParams): void {
  // КРИТИЧНО: Проверяем флаг quiz_just_submitted ПЕРЕД восстановлением прогресса
  // Это предотвращает редирект на первый экран после отправки ответов
  const justSubmitted = typeof window !== 'undefined' ? sessionStorage.getItem(QUIZ_CONFIG.STORAGE_KEYS.JUST_SUBMITTED) === 'true' : false;
  if (justSubmitted) {
    // ИСПРАВЛЕНО: Guard против множественных редиректов
    if (params.redirectInProgressRef.current) {
      return; // Редирект уже в процессе
    }
    params.redirectInProgressRef.current = true;
    clientLogger.log('⚠️ resumeQuiz: Флаг quiz_just_submitted установлен, пропускаем восстановление прогресса и редиректим на /plan');
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem(QUIZ_CONFIG.STORAGE_KEYS.JUST_SUBMITTED);
      sessionStorage.removeItem('quiz_init_done');
      params.initCompletedRef.current = true;
      params.setInitCompleted(true);
      params.setLoading(false);
      window.location.replace('/plan');
    }
    return;
  }
  
  if (!params.savedProgress || !params.questionnaire) {
    console.error('❌ resumeQuiz: savedProgress or questionnaire is missing', { savedProgress: !!params.savedProgress, questionnaire: !!params.questionnaire });
    return;
  }
  
  // ФИКС: Начальные экраны - это только те, которые не имеют showAfterQuestionCode И не имеют showAfterInfoScreenId
  const initialInfoScreens = getInitialInfoScreens();
  
  // ФИКС: Всегда логируем resumeQuiz (warn уровень для сохранения в БД)
  clientLogger.warn('🔄 resumeQuiz: Восстанавливаем прогресс', {
    questionIndex: params.savedProgress.questionIndex,
    infoScreenIndex: params.savedProgress.infoScreenIndex,
    answersCount: Object.keys(params.savedProgress.answers).length,
    initialInfoScreensLength: initialInfoScreens.length,
    currentHasResumed: params.hasResumed,
    currentInfoScreenIndex: params.currentInfoScreenIndex,
    currentQuestionIndex: params.currentQuestionIndex,
  });
  
  // ВАЖНО: Сначала устанавливаем hasResumed и showResumeScreen СИНХРОННО,
  // чтобы предотвратить повторную загрузку прогресса и показ экрана "Вы не завершили анкету"
  // Используем ref для синхронной установки, чтобы асинхронные функции сразу видели новое значение
  params.hasResumedRef.current = true;
  params.setHasResumed(true);
  params.setShowResumeScreen(false); // Устанавливаем сразу, чтобы предотвратить повторное появление экрана
  // ИСПРАВЛЕНО: Очищаем pendingInfoScreen при resume, чтобы он не блокировал показ вопроса
  if (params.setPendingInfoScreen) {
    params.setPendingInfoScreen(null);
    clientLogger.log('✅ resumeQuiz: Очищен pendingInfoScreen для показа вопроса');
  }
  
  // ВАЖНО: Устанавливаем initCompletedRef, чтобы предотвратить повторную инициализацию
  // после того, как пользователь продолжил анкету
  if (!params.initCompletedRef.current) {
    params.initCompletedRef.current = true;
    params.setInitCompleted(true);
    clientLogger.log('✅ initCompletedRef установлен в resumeQuiz для предотвращения повторной инициализации');
  }
  
  // ВАЖНО: Очищаем localStorage СРАЗУ, чтобы предотвратить повторную загрузку прогресса
  // ИСПРАВЛЕНО: Прогресс хранится в БД, localStorage больше не используется
  clientLogger.log('✅ Прогресс хранится в БД');
  
  // ВАЖНО: Сохраняем копию savedProgress перед очисткой, так как мы будем использовать его данные
  const progressToRestore = { ...params.savedProgress };
  
  // ВАЖНО: Очищаем savedProgress СРАЗУ, чтобы предотвратить показ экрана "Вы не завершили анкету"
  // даже если loadSavedProgressFromServer установит setShowResumeScreen(true) позже
  params.setSavedProgress(null);
  
  // ИСПРАВЛЕНО: Устанавливаем флаги, чтобы предотвратить повторные вызовы loadSavedProgressFromServer
  // Это критично для Telegram Mini App, где могут быть особенности с рендерингом
  params.loadProgressInProgressRef.current = true;
  params.progressLoadInProgressRef.current = true;
  clientLogger.log('🔒 Установлены флаги для предотвращения повторных загрузок прогресса');
  
  // Восстанавливаем прогресс из сохраненной копии
  params.setAnswers(progressToRestore.answers);
  
  // ИСПРАВЛЕНО: Определяем следующий неотвеченный вопрос
  // Вместо того чтобы показывать последний заполненный вопрос, показываем следующий после него
  const answeredQuestionIds = Object.keys(progressToRestore.answers).map(id => Number(id));
  let nextQuestionIndex = 0;
  
  // ИСПРАВЛЕНО: Проверяем, что allQuestions загружен перед определением следующего вопроса
  if (!params.allQuestions || params.allQuestions.length === 0) {
    clientLogger.warn('⚠️ resumeQuiz: allQuestions пустой, используем сохраненный индекс', {
      allQuestionsLength: params.allQuestions?.length || 0,
      savedQuestionIndex: progressToRestore.questionIndex,
    });
    // Если allQuestions еще не загружен, используем сохраненный индекс
    nextQuestionIndex = progressToRestore.questionIndex;
  } else {
    // Находим индекс первого вопроса, на который еще не ответили
    const nextUnansweredQuestion = params.allQuestions.find((q, index) => {
      return !answeredQuestionIds.includes(q.id) && index >= progressToRestore.questionIndex;
    });
    
    if (nextUnansweredQuestion) {
      nextQuestionIndex = params.allQuestions.findIndex(q => q.id === nextUnansweredQuestion.id);
    } else {
      // Если все вопросы после сохраненного индекса отвечены, ищем первый неотвеченный с начала
      const firstUnansweredQuestion = params.allQuestions.find((q, index) => {
        return !answeredQuestionIds.includes(q.id);
      });
      if (firstUnansweredQuestion) {
        nextQuestionIndex = params.allQuestions.findIndex(q => q.id === firstUnansweredQuestion.id);
      } else {
        // Если все вопросы отвечены, переходим к последнему
        nextQuestionIndex = params.allQuestions.length - 1;
      }
    }
    
    // Если nextQuestionIndex получился -1 (не найден), используем сохраненный индекс + 1
    if (nextQuestionIndex === -1) {
        nextQuestionIndex = Math.min(progressToRestore.questionIndex + 1, params.allQuestions.length - 1);
      }
    }
  
  // КРИТИЧНО: Проверяем, что nextQuestionIndex валиден перед восстановлением
  // Это предотвращает ошибку "Вопрос не найден" при повторном заходе
  const allQuestionsLength = params.allQuestions?.length || 0;
  const isValidNextQuestionIndex = nextQuestionIndex >= 0 && nextQuestionIndex < allQuestionsLength;
  
  clientLogger.log('🔍 resumeQuiz: Определен следующий вопрос', {
    savedQuestionIndex: progressToRestore.questionIndex,
    nextQuestionIndex,
    answeredQuestionIds,
    allQuestionsLength,
    isValidNextQuestionIndex,
    nextQuestionExists: isValidNextQuestionIndex ? !!params.allQuestions?.[nextQuestionIndex] : false,
  });
  
  // КРИТИЧНО: Если nextQuestionIndex невалиден, корректируем его
  if (!isValidNextQuestionIndex) {
    clientLogger.warn('⚠️ resumeQuiz: nextQuestionIndex невалиден, корректируем', {
      nextQuestionIndex,
      allQuestionsLength,
      savedQuestionIndex: progressToRestore.questionIndex,
    });
    // Корректируем индекс: если он выходит за пределы, используем последний валидный индекс
    nextQuestionIndex = Math.max(0, Math.min(nextQuestionIndex, allQuestionsLength - 1));
    clientLogger.log('✅ resumeQuiz: скорректирован nextQuestionIndex', {
      correctedIndex: nextQuestionIndex,
    });
  }
  
  // ВАЖНО: Всегда пропускаем начальные экраны, если пользователь уже начал отвечать на вопросы
  // Если infoScreenIndex указывает на начальный экран, но вопрос уже начался - пропускаем начальные экраны
  if (progressToRestore.infoScreenIndex >= initialInfoScreens.length) {
    // Начальные экраны пройдены, переходим к следующему вопросу после последнего заполненного
    clientLogger.log('✅ resumeQuiz: Начальные экраны пройдены, переходим к следующему вопросу', {
      savedQuestionIndex: progressToRestore.questionIndex,
      nextQuestionIndex,
      nextQuestionCode: params.allQuestions?.[nextQuestionIndex]?.code || null,
    });
    params.setCurrentQuestionIndex(nextQuestionIndex);
    // ФИКС: Сохраняем currentQuestionIndex в sessionStorage при восстановлении прогресса
    if (typeof window !== 'undefined') {
      try {
        sessionStorage.setItem(QUIZ_CONFIG.STORAGE_KEYS.CURRENT_QUESTION, String(nextQuestionIndex));
      } catch (err) {
        clientLogger.warn('⚠️ Не удалось сохранить currentQuestionIndex в sessionStorage', err);
      }
    }
    params.setCurrentInfoScreenIndex(progressToRestore.infoScreenIndex);
  } else if (progressToRestore.questionIndex > 0 || Object.keys(progressToRestore.answers).length > 0) {
    // Пользователь уже начал отвечать, но infoScreenIndex еще на начальных экранах
    // Пропускаем все начальные экраны и переходим к следующему вопросу
    // КРИТИЧНО: Проверяем валидность nextQuestionIndex перед установкой
    const isValidIndex = nextQuestionIndex >= 0 && nextQuestionIndex < allQuestionsLength;
    if (!isValidIndex) {
      clientLogger.warn('⚠️ resumeQuiz: nextQuestionIndex невалиден при пропуске начальных экранов, корректируем', {
        nextQuestionIndex,
        allQuestionsLength,
        savedQuestionIndex: progressToRestore.questionIndex,
      });
      nextQuestionIndex = Math.max(0, Math.min(nextQuestionIndex, allQuestionsLength - 1));
    }
    clientLogger.log('✅ resumeQuiz: Пропускаем начальные экраны, переходим к следующему вопросу', {
      savedQuestionIndex: progressToRestore.questionIndex,
      nextQuestionIndex,
      nextQuestionCode: params.allQuestions?.[nextQuestionIndex]?.code || null,
    });
    params.setCurrentQuestionIndex(nextQuestionIndex);
    // ФИКС: Сохраняем currentQuestionIndex в sessionStorage при восстановлении прогресса
    if (typeof window !== 'undefined') {
      try {
        sessionStorage.setItem(QUIZ_CONFIG.STORAGE_KEYS.CURRENT_QUESTION, String(nextQuestionIndex));
      } catch (err) {
        clientLogger.warn('⚠️ Не удалось сохранить currentQuestionIndex в sessionStorage', err);
      }
    }
    params.setCurrentInfoScreenIndex(initialInfoScreens.length); // Пропускаем все начальные экраны
  } else {
    // Пользователь еще не начал отвечать, начинаем с начальных экранов
    // ВАЖНО: Проверяем флаг quiz_just_submitted перед сбросом currentQuestionIndex
    const justSubmitted = typeof window !== 'undefined' ? sessionStorage.getItem(QUIZ_CONFIG.STORAGE_KEYS.JUST_SUBMITTED) === 'true' : false;
    if (justSubmitted) {
      // ИСПРАВЛЕНО: Guard против множественных редиректов
      if (params.redirectInProgressRef.current) {
        return; // Редирект уже в процессе
      }
      params.redirectInProgressRef.current = true;
      clientLogger.log('⚠️ resumeQuiz: Флаг quiz_just_submitted установлен, пропускаем восстановление прогресса и редиректим на /plan');
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem(QUIZ_CONFIG.STORAGE_KEYS.JUST_SUBMITTED);
        window.location.replace('/plan');
      }
      return;
    }
    
    // ФИКС: Если infoScreenIndex = 0, но пользователь уже нажал "Продолжить",
    // пропускаем начальные экраны и переходим к вопросам, чтобы не редиректить на первый экран
    // Это предотвращает циклические редиректы после нажатия "Продолжить"
    if (progressToRestore.infoScreenIndex === 0) {
      // ФИКС: Всегда логируем (warn уровень для сохранения в БД)
      clientLogger.warn('✅ resumeQuiz: infoScreenIndex = 0, но пользователь уже нажал "Продолжить" - пропускаем начальные экраны', {
        infoScreenIndex: progressToRestore.infoScreenIndex,
        questionIndex: progressToRestore.questionIndex,
        initialInfoScreensLength: initialInfoScreens.length,
        settingCurrentInfoScreenIndex: initialInfoScreens.length,
      });
      params.setCurrentQuestionIndex(0);
      params.setCurrentInfoScreenIndex(initialInfoScreens.length); // Пропускаем все начальные экраны
    } else {
      // ФИКС: Всегда логируем (warn уровень для сохранения в БД)
      clientLogger.warn('✅ resumeQuiz: Начинаем с начальных экранов', {
        infoScreenIndex: progressToRestore.infoScreenIndex,
        questionIndex: progressToRestore.questionIndex,
        initialInfoScreensLength: initialInfoScreens.length,
      });
      params.setCurrentQuestionIndex(0);
      params.setCurrentInfoScreenIndex(progressToRestore.infoScreenIndex);
    }
  }
  
  // ФИКС: Всегда логируем завершение resumeQuiz (warn уровень для сохранения в БД)
  clientLogger.warn('✅ resumeQuiz: Прогресс восстановлен', {
    hasResumed: true,
    showResumeScreen: false,
    savedProgress: null,
    currentInfoScreenIndex: params.currentInfoScreenIndex,
    currentQuestionIndex: params.currentQuestionIndex,
    questionIndex: progressToRestore.questionIndex,
    infoScreenIndex: progressToRestore.infoScreenIndex,
    answersCount: Object.keys(progressToRestore.answers).length,
    settingCurrentInfoScreenIndex: progressToRestore.infoScreenIndex === 0 ? initialInfoScreens.length : progressToRestore.infoScreenIndex,
  });
  
  // ФИКС: Защита от сброса currentInfoScreenIndex после resumeQuiz
  // Устанавливаем ref, чтобы другие useEffect знали, что resumeQuiz уже выполнен
  // и не должны сбрасывать currentInfoScreenIndex на 0
  params.resumeCompletedRef.current = true;
  
  // ФИКС: Небольшая задержка для проверки, что состояние установлено правильно
  setTimeout(() => {
    if (params.resumeCompletedRef.current && params.currentInfoScreenIndex === 0 && progressToRestore.infoScreenIndex === 0) {
      // Если после resumeQuiz currentInfoScreenIndex все еще 0, значит что-то сбросило его
      // Восстанавливаем правильное значение
      clientLogger.warn('🔧 ФИКС: currentInfoScreenIndex сброшен на 0 после resumeQuiz, восстанавливаем', {
        currentInfoScreenIndex: params.currentInfoScreenIndex,
        progressToRestoreInfoScreenIndex: progressToRestore.infoScreenIndex,
        settingTo: initialInfoScreens.length,
      });
      params.setCurrentInfoScreenIndex(initialInfoScreens.length);
    }
  }, 200);
}

