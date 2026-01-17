// lib/quiz/handlers/startOver.ts
// Функция для начала анкеты заново

import { clientLogger } from '@/lib/client-logger';
import { QUIZ_CONFIG } from '@/lib/quiz/config/quizConfig';
import type { Questionnaire } from '@/lib/quiz/types';

export interface StartOverParams {
  scope: string;
  isStartingOverRef: React.MutableRefObject<boolean>;
  setIsStartingOver: React.Dispatch<React.SetStateAction<boolean>>;
  initCompletedRef: React.MutableRefObject<boolean>;
  setInitCompleted: React.Dispatch<React.SetStateAction<boolean>>;
  initCalledRef: React.MutableRefObject<boolean>;
  clearProgress: () => Promise<void>;
  setAnswers: React.Dispatch<React.SetStateAction<Record<number, string | string[]>>>;
  answersRef: React.MutableRefObject<Record<number, string | string[]>>;
  answersCountRef: React.MutableRefObject<number>;
  lastRestoredAnswersIdRef: React.MutableRefObject<string | null>;
  setCurrentQuestionIndex: React.Dispatch<React.SetStateAction<number>>;
  setCurrentInfoScreenIndex: React.Dispatch<React.SetStateAction<number>>;
  currentInfoScreenIndexRef: React.MutableRefObject<number>;
  setShowResumeScreen: React.Dispatch<React.SetStateAction<boolean>>;
  hasResumedRef: React.MutableRefObject<boolean>;
  setHasResumed: React.Dispatch<React.SetStateAction<boolean>>;
  setSavedProgress: React.Dispatch<React.SetStateAction<any>>;
  setPendingInfoScreen: React.Dispatch<React.SetStateAction<any>>;
  setIsRetakingQuiz: React.Dispatch<React.SetStateAction<boolean>>;
  setShowRetakeScreen: React.Dispatch<React.SetStateAction<boolean>>;
  firstScreenResetRef: React.MutableRefObject<boolean>;
  setLoading: React.Dispatch<React.SetStateAction<boolean>>;
  setError: React.Dispatch<React.SetStateAction<string | null>>;
  questionnaire: Questionnaire | null;
}

export async function startOver(params: StartOverParams): Promise<void> {
  const { scope } = params;

  clientLogger.log('🔄 startOver: Начинаем сброс анкеты', {
    scope,
    currentPath: typeof window !== 'undefined' ? window.location.pathname : 'unknown',
    initCompleted: params.initCompletedRef.current,
    isStartingOverRef: params.isStartingOverRef.current,
  });
  
  // ВАЖНО: Устанавливаем флаг ПЕРЕД очисткой прогресса, чтобы предотвратить загрузку прогресса
  // Используем ref для синхронной установки, чтобы асинхронные функции сразу видели новое значение
  params.isStartingOverRef.current = true;
  params.setIsStartingOver(true);
  clientLogger.log('🔒 isStartingOverRef установлен в true');
  
  // ВАЖНО: Сбрасываем initCompletedRef и initCalledRef, чтобы позволить повторную инициализацию
  // но с правильными флагами (isStartingOverRef = true), чтобы не загружать прогресс
  params.initCompletedRef.current = false;
  params.setInitCompleted(false);
  params.initCalledRef.current = false; // ИСПРАВЛЕНО: Сбрасываем initCalledRef для повторной инициализации
  
  // ФИКС: Очищаем флаг quiz_initCalled из sessionStorage при startOver
  if (typeof window !== 'undefined') {
    try {
      sessionStorage.removeItem(QUIZ_CONFIG.STORAGE_KEYS.INIT_CALLED);
    } catch (err) {
      // Игнорируем ошибки sessionStorage
    }
  }
  
  clientLogger.log('🔄 initCompletedRef и initCalledRef сброшены для повторной инициализации');
  
  // Очищаем весь прогресс (локальный и серверный)
  await params.clearProgress();
  clientLogger.log('✅ Прогресс очищен');
  
  // Сбрасываем все состояния полностью
  params.setAnswers({});
  params.answersRef.current = {};
  params.answersCountRef.current = 0;
  params.lastRestoredAnswersIdRef.current = null;
  params.setCurrentQuestionIndex(0);
  params.setCurrentInfoScreenIndex(0);
  params.currentInfoScreenIndexRef.current = 0;
  // ФИКС: Очищаем sessionStorage при очистке прогресса (scoped ключи)
  if (typeof window !== 'undefined') {
    try {
      // Очищаем скоупленные ключи
      sessionStorage.removeItem(QUIZ_CONFIG.getScopedKey('quiz_answers_backup', scope));
      sessionStorage.removeItem(QUIZ_CONFIG.getScopedKey(QUIZ_CONFIG.STORAGE_KEYS.CURRENT_INFO_SCREEN, scope));
      sessionStorage.removeItem(QUIZ_CONFIG.getScopedKey(QUIZ_CONFIG.STORAGE_KEYS.CURRENT_QUESTION_CODE, scope));
      sessionStorage.removeItem(QUIZ_CONFIG.getScopedKey(QUIZ_CONFIG.STORAGE_KEYS.QUIZ_COMPLETED, scope));
      sessionStorage.removeItem(QUIZ_CONFIG.getScopedKey(QUIZ_CONFIG.STORAGE_KEYS.JUST_SUBMITTED, scope));
      sessionStorage.removeItem(QUIZ_CONFIG.getScopedKey(QUIZ_CONFIG.STORAGE_KEYS.INIT_CALLED, scope));

      // Устанавливаем железный флаг блокировки восстановления
      sessionStorage.setItem(QUIZ_CONFIG.getScopedKey('quiz_progress_cleared', scope), 'true');
    } catch (err) {
      clientLogger.warn('⚠️ Не удалось очистить quiz данные из sessionStorage', err);
    }
  }
  params.setShowResumeScreen(false);
  // ВАЖНО: Сбрасываем и state, и ref для hasResumed
  params.hasResumedRef.current = false;
  params.setHasResumed(false);
  params.setSavedProgress(null);
  params.setPendingInfoScreen(null); // ВАЖНО: очищаем pendingInfoScreen
  params.setIsRetakingQuiz(false); // Сбрасываем флаг перепрохождения
  params.setShowRetakeScreen(false); // Сбрасываем экран выбора тем
  // ФИКС: Сбрасываем firstScreenResetRef, чтобы можно было начать заново
  params.firstScreenResetRef.current = false;
  
  // ВАЖНО: Убеждаемся, что loading = false, чтобы показать контент анкеты
  // и error = null, чтобы не показывать ошибку
  params.setLoading(false);
  params.setError(null);
  
  // Если анкета уже загружена, сразу завершаем инициализацию
  // но НЕ сбрасываем isStartingOverRef - оставляем его true для защиты от восстановления прогресса
  if (params.questionnaire) {
    clientLogger.log('✅ Анкета уже загружена, завершаем инициализацию без повторной загрузки');
    params.initCompletedRef.current = true;
    params.setInitCompleted(true);
    // ФИКС: НЕ сбрасываем isStartingOverRef даже если questionnaire загружена
    // Это защитит от восстановления прогресса из React Query кэша в Step 2
    clientLogger.log('✅ startOver завершен, анкета уже была загружена, isStartingOverRef остается true');
    return;
  }
  
  // Проверяем путь после всех изменений состояния
  const currentPath = typeof window !== 'undefined' ? window.location.pathname : 'unknown';
  clientLogger.log('✅ Анкета начата заново, весь прогресс очищен, возвращаемся на первый экран', {
    hasResumedRef: params.hasResumedRef.current,
    isStartingOverRef: params.isStartingOverRef.current,
    loading: false,
    initCompleted: params.initCompletedRef.current,
    currentPath,
    questionnaireLoaded: !!params.questionnaire,
    showResumeScreen: false,
    showRetakeScreen: false,
    isRetakingQuiz: false,
  });
  
  // ВАЖНО: Убеждаемся, что мы остаемся на странице анкеты
  // Если по какой-то причине произошел редирект, возвращаемся на /quiz
  if (typeof window !== 'undefined' && !currentPath.includes('/quiz')) {
    clientLogger.warn('⚠️ Обнаружен редирект с /quiz, возвращаемся на страницу анкеты', {
      currentPath,
      expectedPath: '/quiz',
    });
    window.location.href = '/quiz';
    return;
  }
  
  // НЕ сбрасываем isStartingOverRef - оставляем его установленным
  // Это предотвратит повторную загрузку прогресса даже если компонент перерендерится
  // Флаг будет сброшен только после успешной инициализации анкеты (когда questionnaire загружен)
  clientLogger.log('✅ startOver завершен, isStartingOverRef остается true до следующей инициализации');
}

