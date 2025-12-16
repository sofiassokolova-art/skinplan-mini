// app/(miniapp)/quiz/page.tsx
// Страница анкеты - базовая структура для миграции

'use client';

import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useTelegram } from '@/lib/telegram-client';
import { api } from '@/lib/api';
import { INFO_SCREENS, getInfoScreenAfterQuestion, type InfoScreen } from './info-screens';
import { getAllTopics } from '@/lib/quiz-topics';
import type { QuizTopic } from '@/lib/quiz-topics';
import { PaymentGate } from '@/components/PaymentGate';
import { clientLogger } from '@/lib/client-logger';
import { filterQuestions, getEffectiveAnswers } from '@/lib/quiz/filterQuestions';

interface Question {
  id: number;
  code: string;
  text: string;
  type: string;
  isRequired: boolean;
  options?: Array<{
    id: number;
    value: string;
    label: string;
  }>;
}

interface Questionnaire {
  id: number;
  name: string;
  version: number;
  groups: Array<{
    id: number;
    title: string;
    questions: Question[];
  }>;
  questions: Question[];
}

export default function QuizPage() {
  const isDev = process.env.NODE_ENV === 'development';
  const router = useRouter();
  
  // Инициализация useTelegram (хук сам обрабатывает ошибки внутри)
  // ВАЖНО: хуки должны вызываться всегда в одном порядке, нельзя оборачивать в try-catch
  const { initialize, initData } = useTelegram();
  const [questionnaire, setQuestionnaire] = useState<Questionnaire | null>(null);
  // ИСПРАВЛЕНО: Начинаем с loading = false, чтобы не показывать лоадер
  // Анкета загрузится сразу при монтировании, и пользователь увидит вопросы без задержки
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentInfoScreenIndex, setCurrentInfoScreenIndex] = useState(0);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string | string[]>>({});
  const [showResumeScreen, setShowResumeScreen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isSubmittingRef = useRef(false); // Ref для синхронной проверки в асинхронных функциях
  
  // ИСПРАВЛЕНО: Синхронизируем ref с state для предотвращения рассинхронизации
  useEffect(() => {
    isSubmittingRef.current = isSubmitting;
  }, [isSubmitting]);
  
  // Состояния для финализации с лоадером
  const [finalizing, setFinalizing] = useState(false);
  const [finalizingStep, setFinalizingStep] = useState<'answers' | 'plan' | 'done'>('answers');
  const [finalizeError, setFinalizeError] = useState<string | null>(null);
  const [pendingInfoScreen, setPendingInfoScreen] = useState<InfoScreen | null>(null); // Информационный экран между вопросами
  const [savedProgress, setSavedProgress] = useState<{
    answers: Record<number, string | string[]>;
    questionIndex: number;
    infoScreenIndex: number;
  } | null>(null);
  
  // ИСПРАВЛЕНО: Используем getEffectiveAnswers для подсчета общего количества ответов
  // Это включает как текущие ответы, так и сохраненные из savedProgress
  // Должен быть объявлен ПОСЛЕ savedProgress
  const effectiveAnswers = useMemo(() => 
    getEffectiveAnswers(answers, savedProgress?.answers), 
    [answers, savedProgress?.answers]
  );
  // ИСПРАВЛЕНО: Мемоизируем answersCount для стабильности зависимостей
  // Используем effectiveAnswers для точного подсчета
  const answersCount = useMemo(() => Object.keys(effectiveAnswers).length, [effectiveAnswers]);
  const [isRetakingQuiz, setIsRetakingQuiz] = useState(false); // Флаг: повторное прохождение анкеты (уже есть профиль)
  const [showRetakeScreen, setShowRetakeScreen] = useState(false); // Флаг: показывать экран выбора тем для повторного прохождения
  const [hasResumed, setHasResumed] = useState(false); // Флаг: пользователь нажал "Продолжить" и восстановил прогресс
  const hasResumedRef = useRef(false); // Синхронный ref для проверки в асинхронных функциях
  const [isStartingOver, setIsStartingOver] = useState(false);
  const [daysSincePlanGeneration, setDaysSincePlanGeneration] = useState<number | null>(null); // Дней с момента генерации плана // Флаг: пользователь нажал "Начать заново"
  const isStartingOverRef = useRef(false); // Синхронный ref для проверки в асинхронных функциях
  const initCompletedRef = useRef(false); // Флаг: инициализация уже завершена
  const [debugLogs, setDebugLogs] = useState<Array<{ time: string; message: string; data?: any }>>([]);
  const [showDebugPanel, setShowDebugPanel] = useState(false);
  const [autoSubmitTriggered, setAutoSubmitTriggered] = useState(false); // Автоматическая отправка ответов когда все вопросы отвечены
  const autoSubmitTriggeredRef = useRef(false);
  const isMountedRef = useRef(true);
  const redirectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const submitAnswersRef = useRef<(() => Promise<void>) | null>(null);
  const saveProgressTimeoutRef = useRef<NodeJS.Timeout | null>(null); // Дебаунсинг для сохранения метаданных позиции
  const lastSavedAnswerRef = useRef<{ questionId: number; answer: string | string[] } | null>(null); // Последний сохраненный ответ для дедупликации
  
  // ИСПРАВЛЕНО: Храним значения из localStorage в state после mount, чтобы избежать hydration mismatch
  const [paidTopics, setPaidTopics] = useState<Set<string>>(new Set());
  const [hasRetakingPayment, setHasRetakingPayment] = useState(false);
  const [hasFullRetakePayment, setHasFullRetakePayment] = useState(false);
  
  // ИСПРАВЛЕНО: Загружаем значения из localStorage после mount
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    // Загружаем оплаченные темы
    const topicKeys = ['payment_retaking_completed', 'payment_full_retake_completed'];
    const paidSet = new Set<string>();
    topicKeys.forEach(key => {
      if (localStorage.getItem(key) === 'true') {
        paidSet.add(key);
      }
    });
    setPaidTopics(paidSet);
    
    // Загружаем флаги оплаты
    setHasRetakingPayment(localStorage.getItem('payment_retaking_completed') === 'true');
    setHasFullRetakePayment(localStorage.getItem('payment_full_retake_completed') === 'true');
  }, []);
  
  // ВАЖНО: Все хуки должны быть объявлены ПЕРЕД ранними return'ами
  // ИСПРАВЛЕНО: Проверяем флаг из localStorage при монтировании
  // ВАЖНО: Проверяем наличие профиля перед показом экрана перепрохождения
  useEffect(() => {
    if (typeof window !== 'undefined' && window.Telegram?.WebApp?.initData) {
      const isRetakingFromStorage = localStorage.getItem('is_retaking_quiz') === 'true';
      const fullRetakeFromHome = localStorage.getItem('full_retake_from_home') === 'true';
      
      if (isRetakingFromStorage || fullRetakeFromHome) {
        // ИСПРАВЛЕНО: Проверяем наличие профиля перед показом экрана перепрохождения
        // Если профиля нет, но флаги установлены - это ошибка, очищаем флаги
        const checkProfileAndShowRetake = async () => {
          try {
            const profile = await api.getCurrentProfile();
            if (profile && profile.id) {
              // Профиль есть - это нормальное перепрохождение
              setIsRetakingQuiz(true);
              
              if (fullRetakeFromHome) {
                localStorage.removeItem('full_retake_from_home');
                clientLogger.log('✅ Полное перепрохождение с главной страницы - показываем экран выбора тем с оплатой');
              }
              
              setShowRetakeScreen(true);
              clientLogger.log('✅ Флаг перепрохождения найден и профиль существует - показываем экран выбора тем');
            } else {
              // Профиля нет, но флаги установлены - это ошибка, очищаем флаги
              clientLogger.log('⚠️ Флаги перепрохождения установлены, но профиля нет - очищаем флаги');
              localStorage.removeItem('is_retaking_quiz');
              localStorage.removeItem('full_retake_from_home');
            }
          } catch (err: any) {
            // Профиля нет - очищаем флаги
            const isNotFound = err?.status === 404 || 
                              err?.message?.includes('404') || 
                              err?.message?.includes('No profile') ||
                              err?.message?.includes('Profile not found');
            if (isNotFound) {
              clientLogger.log('⚠️ Профиля нет, но флаги перепрохождения установлены - очищаем флаги');
              localStorage.removeItem('is_retaking_quiz');
              localStorage.removeItem('full_retake_from_home');
            } else {
              clientLogger.warn('⚠️ Ошибка при проверке профиля для перепрохождения:', err);
            }
          }
        };
        
        checkProfileAndShowRetake().catch(() => {});
      }
    }
  }, []);
  
  // Функция для добавления логов (только в development)
  // ВАЖНО: оборачиваем в useCallback, чтобы функция не менялась между рендерами
  // и не вызывала лишние пересчеты в useMemo
  const addDebugLog = useCallback((message: string, data?: any) => {
    const time = new Date().toLocaleTimeString();
    // Также логируем в консоль для тех, кто может ее открыть
    clientLogger.log(`[${time}] ${message}`, data || '');
    
    if (process.env.NODE_ENV === 'development' || process.env.NEXT_PUBLIC_DEBUG === 'true') {
      const log = {
        time,
        message,
        data: data ? JSON.stringify(data, null, 2) : undefined,
      };
      setDebugLogs(prev => [...prev.slice(-19), log]); // Храним последние 20 логов
    }
  }, []);

  // Флаг для предотвращения множественных вызовов init
  const initInProgressRef = useRef(false);
  // Флаг для предотвращения повторных проверок профиля
  const profileCheckInProgressRef = useRef(false);
  // Флаг для предотвращения повторных загрузок прогресса
  const progressLoadInProgressRef = useRef(false);

  useEffect(() => {
    // ИСПРАВЛЕНО: Проверяем, не была ли анкета только что отправлена
    // КРИТИЧНО: Проверяем флаг quiz_just_submitted САМЫМ ПЕРВЫМ, до любых других проверок
    // Это предотвращает редирект на первый экран после отправки ответов
    if (typeof window !== 'undefined') {
      const justSubmitted = sessionStorage.getItem('quiz_just_submitted') === 'true';
      if (justSubmitted) {
        clientLogger.log('✅ Анкета только что отправлена, редиректим на /plan?state=generating (ранняя проверка)');
        // Очищаем флаг
        sessionStorage.removeItem('quiz_just_submitted');
        // Устанавливаем initCompletedRef, чтобы предотвратить повторную инициализацию
        initCompletedRef.current = true;
        setLoading(false);
        // Редиректим на /plan?state=generating СРАЗУ, без задержек
        window.location.replace('/plan?state=generating');
        return;
      }
      
      // ИСПРАВЛЕНО: Также проверяем, не находится ли пользователь на инфо-экране после последнего вопроса
      // Если да, не выполняем проверку профиля, которая может вызвать редирект
      const urlParams = new URLSearchParams(window.location.search);
      const isResuming = urlParams.get('resume') === 'true';
      if (isResuming || pendingInfoScreen) {
        clientLogger.log('ℹ️ Пользователь на инфо-экране или resume экране, пропускаем раннюю проверку профиля');
        // Продолжаем нормальную инициализацию без раннего редиректа
      }
    }
    
    // ИСПРАВЛЕНО: Проверяем флаг quiz_just_submitted ПЕРЕД проверкой профиля
    // Это критично, чтобы предотвратить редирект на первый экран после отправки ответов
    const justSubmitted = typeof window !== 'undefined' ? sessionStorage.getItem('quiz_just_submitted') === 'true' : false;
    if (justSubmitted) {
      clientLogger.log('✅ Флаг quiz_just_submitted установлен - пропускаем проверку профиля и редиректим на /plan?state=generating');
      // Очищаем флаг
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem('quiz_just_submitted');
      }
      // Устанавливаем initCompletedRef, чтобы предотвратить повторную инициализацию
      initCompletedRef.current = true;
      setLoading(false);
      // Редиректим на /plan?state=generating
      if (typeof window !== 'undefined') {
        window.location.replace('/plan?state=generating');
      }
      return;
    }
    
    // ИСПРАВЛЕНО: Проверяем, есть ли уже профиль (анкета завершена)
    // Если профиль есть и анкета завершена, не показываем начало анкеты, а редиректим на /plan
    // ВАЖНО: Проверяем синхронно, чтобы предотвратить показ первого экрана
    // ВАЖНО: НЕ проверяем профиль, если флаг quiz_just_submitted установлен (уже обработано выше)
    if (typeof window !== 'undefined' && window.Telegram?.WebApp?.initData && !initCompletedRef.current && !justSubmitted) {
      // ИСПРАВЛЕНО: Проверяем флаги перепрохождения ПЕРЕД проверкой профиля
      const isRetakingFromStorage = localStorage.getItem('is_retaking_quiz') === 'true';
      const fullRetakeFromHome = localStorage.getItem('full_retake_from_home') === 'true';
      
      // Если флаги перепрохождения установлены, но профиля нет - очищаем флаги
      // Это может быть остаточный флаг от предыдущей сессии
      if (isRetakingFromStorage || fullRetakeFromHome) {
        const checkProfile = async () => {
          try {
            const profile = await api.getCurrentProfile();
            if (!profile || !profile.id) {
              // Профиля нет, но флаги перепрохождения установлены - это ошибка
              clientLogger.log('⚠️ Флаги перепрохождения установлены, но профиля нет - очищаем флаги');
              localStorage.removeItem('is_retaking_quiz');
              localStorage.removeItem('full_retake_from_home');
              // Продолжаем как новый пользователь
              return;
            }
            // Профиль есть - это нормальное перепрохождение
          } catch (err: any) {
            // Профиля нет - очищаем флаги
            const isNotFound = err?.status === 404 || 
                              err?.message?.includes('404') || 
                              err?.message?.includes('No profile') ||
                              err?.message?.includes('Profile not found');
            if (isNotFound) {
              clientLogger.log('⚠️ Профиля нет, но флаги перепрохождения установлены - очищаем флаги');
              localStorage.removeItem('is_retaking_quiz');
              localStorage.removeItem('full_retake_from_home');
            }
          }
        };
        checkProfile().catch(() => {});
      } else {
        // Флагов перепрохождения нет - проверяем профиль и завершенность анкеты
        // ИСПРАВЛЕНО: Проверяем не только наличие профиля, но и завершенность анкеты
        // ВАЖНО: Эта проверка выполняется только один раз при первой инициализации
        // Если пользователь уже на инфо-экране или в процессе прохождения анкеты, не проверяем
        const checkProfileAndRedirect = async () => {
          // ИСПРАВЛЕНО: Не выполняем проверку, если пользователь находится на инфо-экране
          // Это предотвращает редирект во время показа инфо-экранов после последнего вопроса
          // ВАЖНО: Также проверяем флаг quiz_just_submitted еще раз (на случай, если он был установлен после начала проверки)
          const justSubmittedCheck = typeof window !== 'undefined' ? sessionStorage.getItem('quiz_just_submitted') === 'true' : false;
          if (justSubmittedCheck) {
            clientLogger.log('✅ Флаг quiz_just_submitted обнаружен во время проверки профиля - прерываем проверку');
            if (typeof window !== 'undefined') {
              sessionStorage.removeItem('quiz_just_submitted');
              window.location.replace('/plan');
            }
            return;
          }
          
          if (pendingInfoScreen || currentQuestionIndex >= allQuestions.length) {
            clientLogger.log('⏸️ Пропускаем проверку профиля: пользователь на инфо-экране или анкета завершена', {
              hasPendingInfoScreen: !!pendingInfoScreen,
              currentQuestionIndex,
              allQuestionsLength: allQuestions.length,
            });
            return;
          }
          
          try {
            const profile = await api.getCurrentProfile();
            if (profile && (profile as any).id) {
              // Профиль существует - проверяем, завершена ли анкета
              try {
                const response = await api.getQuizProgress();
                const progress = response?.progress;
                const hasAnswers = progress && progress.answers && Object.keys(progress.answers).length > 0;
                // ИСПРАВЛЕНО: isCompleted находится в корне ответа, а не в progress
                const isCompleted = response?.isCompleted === true;
                
                // Если анкета завершена и нет флага перепрохождения - редиректим на /plan
                if (isCompleted && !isRetakingFromStorage && !fullRetakeFromHome) {
                  clientLogger.log('✅ Профиль существует и анкета завершена - редиректим на /plan', {
                    hasAnswers,
                    isCompleted,
                  });
                  initCompletedRef.current = true;
                  setLoading(false);
                  window.location.replace('/plan');
                  return;
                }
              } catch (progressErr) {
                // Если не удалось проверить прогресс, но профиль есть - все равно редиректим
                // Это может быть сразу после отправки ответов, когда прогресс еще не обновился
                clientLogger.log('✅ Профиль существует (прогресс не проверен) - редиректим на /plan');
                initCompletedRef.current = true;
                setLoading(false);
                window.location.replace('/plan');
                return;
              }
            }
          } catch (err: any) {
            // Профиля нет - это нормально, продолжаем инициализацию
            const isNotFound = err?.status === 404 || 
                              err?.message?.includes('404') || 
                              err?.message?.includes('No profile') ||
                              err?.message?.includes('Profile not found');
            if (!isNotFound) {
              clientLogger.warn('⚠️ Ошибка при проверке профиля:', err);
            }
          }
        };
        // Выполняем проверку асинхронно, но не блокируем инициализацию
        checkProfileAndRedirect().catch(() => {});
      }
    }
    
    // ИСПРАВЛЕНО: Если инициализация уже завершена и пользователь НЕ нажал "Начать заново",
    // не выполняем повторную инициализацию
    // ВАЖНО: НЕ блокируем, если показывается pendingInfoScreen - это нормальный ход анкеты
    // ВАЖНО: Также НЕ блокируем, если currentQuestionIndex >= allQuestions.length (анкета завершена, ожидается автоотправка)
    if (initCompletedRef.current && !isStartingOverRef.current && !pendingInfoScreen && 
        (questionnaire ? currentQuestionIndex < allQuestions.length : true)) {
      if (loading) {
        setLoading(false);
      }
      return;
    }
    
    // ВАЖНО: Если пользователь уже продолжил анкету (hasResumed), не выполняем повторную инициализацию
    // Это предотвращает повторную загрузку прогресса после resumeQuiz
    if (hasResumedRef.current || hasResumed) {
      if (loading) {
        setLoading(false);
      }
      return;
    }

    // ВАЖНО: Предотвращаем множественные вызовы init
    if (initInProgressRef.current) {
      return;
    }
    initInProgressRef.current = true;
    
    // Если пользователь нажал "Начать заново", разрешаем повторную инициализацию
    // но с флагом isStartingOverRef = true, чтобы не загружать прогресс
    
    // Ждем готовности Telegram WebApp
    const waitForTelegram = (): Promise<void> => {
      return new Promise((resolve) => {
        if (typeof window === 'undefined') {
          resolve();
          return;
        }

        // Если уже доступен
        if (window.Telegram?.WebApp?.initData) {
          resolve();
          return;
        }

        // Ждем максимум 2 секунды
        let attempts = 0;
        const maxAttempts = 20; // 20 * 100ms = 2 секунды

        const checkInterval = setInterval(() => {
          attempts++;
          if (window.Telegram?.WebApp?.initData || attempts >= maxAttempts) {
            clearInterval(checkInterval);
            resolve();
          }
        }, 100);
      });
    };

    const init = async () => {
      try {
        // Если анкета уже загружена и это повторная инициализация после "Начать заново",
        // пропускаем загрузку анкеты и сразу устанавливаем loading = false
        if (questionnaire && isStartingOverRef.current) {
          clientLogger.log('✅ Анкета уже загружена, пропускаем повторную загрузку после startOver');
          setLoading(false);
          setError(null);
          initCompletedRef.current = true;
          isStartingOverRef.current = false;
          setIsStartingOver(false);
          clientLogger.log('✅ Повторная инициализация завершена (анкета уже была загружена)');
          return;
        }
        
        // Инициализируем Telegram WebApp
        clientLogger.log('🔄 Initializing Telegram WebApp...');
        initialize();
        clientLogger.log('✅ Telegram WebApp initialized');
        
        // Ждем готовности Telegram WebApp
        clientLogger.log('⏳ Waiting for Telegram WebApp...');
        await waitForTelegram();
        clientLogger.log('✅ Telegram WebApp ready');

        // Сначала загружаем анкету (публичный маршрут)
        // Но только если она еще не загружена
        // ИСПРАВЛЕНО: Не устанавливаем loading = true, чтобы не показывать лоадер
        // Анкета загрузится мгновенно, и пользователь увидит вопросы без задержки
        if (!questionnaire) {
          const loadedQuestionnaire = await loadQuestionnaire();
          // ИСПРАВЛЕНО: Очищаем ошибку при успешной загрузке анкеты
          // Это предотвращает показ временных ошибок, которые уже исправлены
          if (loadedQuestionnaire) {
            setError(null);
          } else {
            // Если анкета не загрузилась, показываем ошибку только если её еще нет
            // (чтобы не перезаписывать более важные ошибки)
            if (!error) {
              setError('Не удалось загрузить анкету. Пожалуйста, обновите страницу.');
            }
          }
        } else {
          // ИСПРАВЛЕНО: Если анкета уже загружена, очищаем ошибки загрузки
          // Это предотвращает показ старых ошибок, которые уже не актуальны
          if (error && (error.includes('загрузить анкету') || error.includes('Invalid questionnaire') || error.includes('Questionnaire has no questions'))) {
            setError(null);
          }
        }
      
      // Проверяем, есть ли уже профиль (повторное прохождение анкеты)
      // ВАЖНО: Не проверяем профиль, если пользователь только что нажал "Начать заново"
      // ВАЖНО: Для новых пользователей (без профиля) показываем полную анкету, а не экран выбора тем
      // ВАЖНО: Экран "что хотите изменить?" показывается ТОЛЬКО если:
      // 1. Профиль существует
      // 2. Анкета полностью завершена (есть все ответы)
      // 3. Пользователь не нажал "Начать заново"
      // ВАЖНО: Защита от повторных проверок профиля
      if (typeof window !== 'undefined' && window.Telegram?.WebApp?.initData && !isStartingOverRef.current && !profileCheckInProgressRef.current) {
        profileCheckInProgressRef.current = true;
        try {
          const profile = await api.getCurrentProfile();
          if (profile && profile.id) {
            // Профиль существует - проверяем, завершена ли анкета
            if (!isStartingOverRef.current) {
              // Проверяем, есть ли ответы на анкету (завершена ли анкета)
              try {
                const response = await api.getQuizProgress();
                const progress = response?.progress;
                // Проверяем, что есть ответы И что анкета завершена (все вопросы отвечены)
                const hasAnswers = progress && progress.answers && Object.keys(progress.answers).length > 0;
                // ИСПРАВЛЕНО: isCompleted находится в корне ответа, а не в progress
                const isCompleted = response?.isCompleted === true;
                
                if (hasAnswers && isCompleted) {
                  // Анкета полностью завершена - проверяем, хочет ли пользователь перепроходить
                  // ВАЖНО: Проверяем флаг из localStorage, установленный при нажатии "Перепройти анкету"
                  // ВАЖНО: Также проверяем наличие плана - если плана нет, не показываем экран "что хотите изменить?"
                  const isRetakingFromStorage = typeof window !== 'undefined' && localStorage.getItem('is_retaking_quiz') === 'true';
                  
                  // Проверяем наличие плана - если плана нет, не показываем экран перепрохождения
                  let hasPlan = false;
                  try {
                    const plan = await api.getPlan();
                    hasPlan = !!(plan && (plan.plan28 || plan.weeks));
                  } catch (planErr) {
                    // План не найден - это нормально для нового пользователя
                    hasPlan = false;
                  }
                  
                  // ИСПРАВЛЕНО: Если пользователь явно зашел на /quiz, всегда показываем анкету
                  // Это позволяет пользователю перепроходить анкету вручную, даже если она завершена
                  const isDirectQuizAccess = typeof window !== 'undefined' && 
                    (window.location.pathname === '/quiz' || window.location.pathname.startsWith('/quiz/'));
                  
                  if (isDirectQuizAccess) {
                    // ИСПРАВЛЕНО: Пользователь явно зашел на /quiz - показываем анкету для перепрохождения
                    clientLogger.log('✅ Прямой доступ к /quiz - показываем анкету для перепрохождения', {
                      isRetakingFromStorage,
                      hasPlan,
                      pathname: typeof window !== 'undefined' ? window.location.pathname : 'unknown',
                    });
                    setIsRetakingQuiz(true);
                    setShowRetakeScreen(false); // Показываем анкету напрямую, без экрана выбора тем
                  } else if (isRetakingFromStorage && hasPlan) {
                    // Пользователь нажал "Перепройти анкету" И план существует - показываем экран выбора тем
                    setIsRetakingQuiz(true);
                    setShowRetakeScreen(true);
                    clientLogger.log('✅ Повторное прохождение анкеты - профиль, завершенная анкета и план существуют + флаг перепрохождения установлен, показываем экран выбора тем');
                  } else {
                    // Профиль есть, анкета завершена, но:
                    // - либо пользователь не хочет перепроходить (флаг не установлен)
                    // - либо плана нет (значит, нужно пройти анкету заново)
                    // ИСПРАВЛЕНО: В этом случае тоже показываем анкету, чтобы пользователь мог её перепроходить
                    clientLogger.log('ℹ️ Профиль и завершенная анкета существуют, но пользователь зашел на /quiz - показываем анкету', {
                      isRetakingFromStorage,
                      hasPlan,
                      isDirectQuizAccess,
                    });
                    setIsRetakingQuiz(true);
                    setShowRetakeScreen(false); // Показываем анкету напрямую
                  }
                } else {
                  // Профиль есть, но анкета не завершена - показываем полную анкету
                  clientLogger.log('ℹ️ Профиль есть, но анкета не завершена - показываем полную анкету', {
                    hasAnswers,
                    isCompleted,
                  });
                  setIsRetakingQuiz(false);
                  setShowRetakeScreen(false);
                }
              } catch (progressErr) {
                // Не удалось загрузить прогресс - показываем полную анкету
                clientLogger.log('ℹ️ Не удалось загрузить прогресс анкеты - показываем полную анкету', progressErr);
                setIsRetakingQuiz(false);
                setShowRetakeScreen(false);
              }
            } else {
              clientLogger.log('⏸️ Пропущена проверка профиля, так как isStartingOverRef = true');
            }
          }
        } catch (err: any) {
          // Профиля нет (404) - проверяем, может быть анкета уже завершена, но профиль не создан
          const isNotFound = err?.status === 404 || 
                            err?.message?.includes('404') || 
                            err?.message?.includes('No profile') ||
                            err?.message?.includes('Profile not found');
          
          if (isNotFound) {
            clientLogger.log('ℹ️ Профиль не найден (404) - проверяем, завершена ли анкета');
            
            // ИСПРАВЛЕНО: Если анкета завершена, но профиль не найден - автоматически отправляем ответы для создания профиля
            try {
              const response = await api.getQuizProgress();
              const progress = response?.progress;
              const hasAnswers = progress && progress.answers && Object.keys(progress.answers).length > 0;
              const isCompleted = response?.isCompleted === true;
              
              if (hasAnswers && isCompleted && questionnaire) {
                clientLogger.log('⚠️ Анкета завершена, но профиль не найден - автоматически отправляем ответы для создания профиля');
                try {
                  // Преобразуем ответы в формат для submitAnswers
                  const answerArray = Object.entries(progress.answers).map(([questionId, value]) => {
                    const isArray = Array.isArray(value);
                    return {
                      questionId: parseInt(questionId),
                      answerValue: isArray ? undefined : (value as string),
                      answerValues: isArray ? (value as string[]) : undefined,
                    };
                  });
                  
                  clientLogger.log('📤 Автоматическая отправка ответов для создания профиля:', {
                    questionnaireId: questionnaire.id,
                    answersCount: answerArray.length,
                  });
                  
                  // Вызываем submitAnswers для создания профиля
                  await api.submitAnswers({
                    questionnaireId: questionnaire.id,
                    answers: answerArray,
                  });
                  clientLogger.log('✅ Профиль создан автоматически после обнаружения завершенной анкеты');
                  
                  // После создания профиля редиректим на /plan
                  initCompletedRef.current = true;
                  setLoading(false);
                  window.location.replace('/plan');
                  return;
                } catch (submitErr: any) {
                  console.error('❌ Ошибка при автоматической отправке ответов для создания профиля:', submitErr);
                  // Продолжаем выполнение - показываем анкету
                }
              } else {
                clientLogger.log('ℹ️ Первое прохождение анкеты - профиля еще нет (404), показываем полную анкету', {
                  hasAnswers,
                  isCompleted,
                  hasQuestionnaire: !!questionnaire,
                });
              }
            } catch (progressErr: any) {
              clientLogger.log('ℹ️ Не удалось проверить прогресс анкеты, показываем полную анкету', progressErr);
            }
          } else {
            clientLogger.log('ℹ️ Ошибка при проверке профиля, показываем полную анкету', err);
          }
          setIsRetakingQuiz(false);
          setShowRetakeScreen(false);
        } finally {
          profileCheckInProgressRef.current = false;
        }
      } else if (isStartingOverRef.current) {
        clientLogger.log('⏸️ Пропущена проверка профиля в init, так как isStartingOverRef = true');
        // При "Начать заново" показываем полную анкету
        setIsRetakingQuiz(false);
        setShowRetakeScreen(false);
      } else {
        // Telegram WebApp не доступен - показываем полную анкету
        clientLogger.log('ℹ️ Telegram WebApp не доступен, показываем полную анкету');
        setIsRetakingQuiz(false);
        setShowRetakeScreen(false);
      }

      // Загружаем прогресс с сервера (только если Telegram WebApp доступен)
      // Важно: загружаем после загрузки анкеты, чтобы правильно вычислить totalQuestions
      // Проверка isStartingOver и hasResumed выполняется внутри loadSavedProgressFromServer
      // ВАЖНО: Не загружаем прогресс, если пользователь уже продолжил анкету
      // ВАЖНО: Защита от повторных загрузок прогресса
      // ИСПРАВЛЕНО: Загружаем прогресс ДО установки loading = false, чтобы экран resume показался вовремя
      // ИСПРАВЛЕНО: Добавлена дополнительная проверка initCompletedRef, чтобы предотвратить повторные вызовы после инициализации
      // ИСПРАВЛЕНО: Добавлена дополнительная проверка hasResumed ПЕРЕД вызовом loadSavedProgressFromServer
      // ИСПРАВЛЕНО: Добавлена проверка loadProgressInProgressRef и progressLoadInProgressRef
      // Это предотвращает повторные вызовы в Telegram Mini App, где могут быть особенности с рендерингом
      if (typeof window !== 'undefined' && window.Telegram?.WebApp?.initData && 
          !hasResumedRef.current && !hasResumed && 
          !loadProgressInProgressRef.current && !progressLoadInProgressRef.current) {
          // ИСПРАВЛЕНО: Убрали проверку initCompletedRef, чтобы прогресс загружался даже после инициализации
          // Это важно для первого заполнения анкеты, когда пользователь возвращается
        // ИСПРАВЛЕНО: Дополнительная проверка hasResumed перед установкой progressLoadInProgressRef
        // Это предотвращает начало загрузки, если пользователь уже продолжил анкету
        if (hasResumedRef.current || hasResumed || loadProgressInProgressRef.current || progressLoadInProgressRef.current) {
          clientLogger.log('⏸️ Пропущена загрузка прогресса в init', {
            hasResumedRef: hasResumedRef.current,
            hasResumed,
            loadProgressInProgress: loadProgressInProgressRef.current,
            progressLoadInProgress: progressLoadInProgressRef.current,
          });
          return;
        }
        progressLoadInProgressRef.current = true;
        try {
          clientLogger.log('🔄 Загружаем прогресс с сервера...');
          await loadSavedProgressFromServer();
          // loadSavedProgressFromServer сам устанавливает setShowResumeScreen(true) если есть прогресс
          // и очищает localStorage если прогресса нет на сервере
          clientLogger.log('✅ Загрузка прогресса завершена', {
            showResumeScreen,
            hasSavedProgress: !!savedProgress,
          });
        } catch (err: any) {
          // Если ошибка 401 - это нормально, просто не используем серверный прогресс
          if (!err?.message?.includes('401') && !err?.message?.includes('Unauthorized')) {
            clientLogger.warn('⚠️ Не удалось загрузить прогресс с сервера:', err);
          }
          // НЕ используем fallback на localStorage - прогресс должен быть синхронизирован с сервером
          // Если на сервере нет прогресса, значит его не должно быть и локально
          // Но только если пользователь еще не продолжил анкету
          if (!hasResumedRef.current && !hasResumed) {
            if (typeof window !== 'undefined') {
              localStorage.removeItem('quiz_progress');
            }
            setSavedProgress(null);
            setShowResumeScreen(false);
          }
        } finally {
          // ИСПРАВЛЕНО: Не сбрасываем флаг, если пользователь уже продолжил анкету
          // Это предотвращает повторные вызовы в Telegram Mini App
          if (!hasResumedRef.current && !hasResumed) {
          progressLoadInProgressRef.current = false;
          } else {
            clientLogger.log('🔒 init: оставляем progressLoadInProgressRef установленным, так как hasResumed = true');
          }
        }
      } else {
        // Если Telegram WebApp не доступен или пользователь уже продолжил, очищаем localStorage (прогресс должен быть на сервере)
        // Но только если пользователь еще не продолжил анкету
        if (!hasResumedRef.current && !hasResumed) {
          if (typeof window !== 'undefined') {
            localStorage.removeItem('quiz_progress');
          }
          setSavedProgress(null);
          setShowResumeScreen(false);
        }
      }
      
      // ИСПРАВЛЕНО: Устанавливаем loading = false только после загрузки прогресса
      // Это гарантирует, что экран resume покажется до того, как пользователь увидит первый экран анкеты
      // ВАЖНО: Если showResumeScreen был установлен в loadSavedProgressFromServer, loading уже установлен в false там
      // Поэтому здесь проверяем, не был ли уже установлен loading = false
      // Используем setTimeout, чтобы дать время для установки showResumeScreen в loadSavedProgressFromServer
      setTimeout(() => {
        if (!showResumeScreen && !savedProgress) {
          setLoading(false);
        }
      }, 0);
      // ИСПРАВЛЕНО: Не устанавливаем initCompletedRef сразу, чтобы не блокировать загрузку прогресса при возврате
      // initCompletedRef.current = true;
      initInProgressRef.current = false;
      
      // ВАЖНО: Если это была повторная инициализация после "Начать заново",
      // сбрасываем флаг isStartingOverRef, чтобы разрешить нормальную работу
      if (isStartingOverRef.current) {
        clientLogger.log('✅ Повторная инициализация завершена, сбрасываем isStartingOverRef');
        isStartingOverRef.current = false;
        setIsStartingOver(false);
      }
    } catch (initErr: any) {
        console.error('❌ Error in init function:', initErr?.message);
        setError('Ошибка загрузки. Пожалуйста, обновите страницу.');
        setLoading(false);
        initInProgressRef.current = false;
      }
    };
    
    // ВАЖНО: Добавляем таймаут для init(), чтобы гарантировать, что loading всегда будет false
    const initTimeout = setTimeout(() => {
      if (loading) {
        clientLogger.warn('⚠️ Init timeout: forcing loading = false after 10 seconds');
        setLoading(false);
        setError('Таймаут загрузки. Пожалуйста, обновите страницу.');
      }
    }, 10000); // 10 секунд таймаут
    
    init()
      .catch((err) => {
        console.error('❌ Unhandled error in init promise:', err?.message);
        setError('Ошибка загрузки. Пожалуйста, обновите страницу.');
        setLoading(false);
        initInProgressRef.current = false;
      })
      .finally(() => {
        clearTimeout(initTimeout);
        setLoading(false);
        initInProgressRef.current = false;
      });
    
    // Очищаем таймауты при размонтировании
    return () => {
      clearTimeout(initTimeout);
      if (saveProgressTimeoutRef.current) {
        clearTimeout(saveProgressTimeoutRef.current);
        saveProgressTimeoutRef.current = null;
      }
      isMountedRef.current = false;
    };
  }, []);

  // Загружаем предыдущие ответы при повторном прохождении анкеты
  // Этот useEffect срабатывает после того, как questionnaire загружен и isRetakingQuiz установлен
  useEffect(() => {
    if (isRetakingQuiz && questionnaire && typeof window !== 'undefined' && window.Telegram?.WebApp?.initData) {
      clientLogger.log('🔄 Загружаем предыдущие ответы для повторного прохождения...');
      // Вызываем функцию напрямую, не добавляя в зависимости, чтобы избежать проблем
      (async () => {
        const quiz = questionnaire;
        if (!quiz) {
          clientLogger.warn('⚠️ Cannot load previous answers: questionnaire not loaded');
          return;
        }
        
        try {
          const response = await fetch(`/api/questionnaire/progress?retaking=true`, {
            headers: {
              'X-Telegram-Init-Data': typeof window !== 'undefined' && window.Telegram?.WebApp?.initData
                ? window.Telegram.WebApp.initData
                : '',
            },
          });

          if (response.ok) {
            const data = await response.json() as {
              progress?: {
                answers: Record<number, string | string[]>;
                questionIndex: number;
                infoScreenIndex: number;
              } | null;
            };
            
            if (data?.progress?.answers && Object.keys(data.progress.answers).length > 0) {
              clientLogger.log('✅ Загружены предыдущие ответы для повторного прохождения:', Object.keys(data.progress.answers).length, 'ответов');
              setAnswers(data.progress.answers);
              if (data.progress.questionIndex !== undefined && data.progress.questionIndex >= 0) {
                setCurrentQuestionIndex(data.progress.questionIndex);
              }
            }
          }
        } catch (err: any) {
        clientLogger.warn('⚠️ Ошибка загрузки предыдущих ответов:', err);
        }
      })();
    }
  }, [isRetakingQuiz, questionnaire]);

  // Устанавливаем query параметр для скрытия навигации в layout (вынесено на верхний уровень)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    if (showResumeScreen) {
      const url = new URL(window.location.href);
      url.searchParams.set('resume', 'true');
      window.history.replaceState({}, '', url.toString());
    } else {
      const url = new URL(window.location.href);
      url.searchParams.delete('resume');
      window.history.replaceState({}, '', url.toString());
    }
  }, [showResumeScreen]);

  // Корректируем currentQuestionIndex после восстановления прогресса
  // Это важно, потому что после фильтрации вопросов индекс может стать невалидным
  // ПЕРЕМЕЩЕНО НИЖЕ после объявления allQuestions

  // Загружаем сохранённый прогресс из localStorage (fallback)
  const loadSavedProgress = () => {
    if (typeof window === 'undefined') return;
    
    // ВАЖНО: Если пользователь уже нажал "Продолжить", не загружаем прогресс
    // Это предотвращает повторное появление экрана "Вы не завершили анкету"
    if (hasResumedRef.current || hasResumed) {
      clientLogger.log('⏸️ loadSavedProgress: пропущено, так как hasResumed = true (пользователь уже продолжил)');
      return;
    }
    
    const saved = localStorage.getItem('quiz_progress');
    if (saved) {
      try {
        // ВАЖНО: Еще раз проверяем hasResumedRef перед установкой состояний
        if (hasResumedRef.current || hasResumed) {
          clientLogger.log('⏸️ loadSavedProgress: пропущено перед установкой состояний, так как hasResumed = true');
          return;
        }
        
        // ИСПРАВЛЕНО: Безопасный парсинг с обработкой больших данных
        let progress;
        try {
          progress = JSON.parse(saved);
        } catch (parseError) {
          console.error('Error parsing saved progress:', parseError);
          // Очищаем поврежденные данные
          localStorage.removeItem('quiz_progress');
          return;
        }
        
        setSavedProgress(progress);
        // Показываем экран продолжения только если есть сохранённые ответы
        if (progress.answers && Object.keys(progress.answers).length > 0) {
          setShowResumeScreen(true);
          setLoading(false);
        }
      } catch (err) {
        console.error('Error loading saved progress:', err);
        // Очищаем поврежденные данные при любой ошибке
        try {
          localStorage.removeItem('quiz_progress');
        } catch (removeError) {
          console.error('Error removing corrupted progress:', removeError);
        }
      }
    }
  };

  // Загружаем предыдущие ответы для повторного прохождения анкеты
  const loadPreviousAnswers = async (quizData?: Questionnaire) => {
    const quiz = quizData || questionnaire;
    if (!quiz) {
      clientLogger.warn('⚠️ Cannot load previous answers: questionnaire not loaded');
      return;
    }
    
    try {
      // Загружаем с параметром retaking=true, чтобы получить ответы даже при наличии профиля
      const response = await fetch(`/api/questionnaire/progress?retaking=true`, {
        headers: {
          'X-Telegram-Init-Data': typeof window !== 'undefined' && window.Telegram?.WebApp?.initData
            ? window.Telegram.WebApp.initData
            : '',
        },
      });

      if (response.ok) {
        const data = await response.json() as {
          progress?: {
            answers: Record<number, string | string[]>;
            questionIndex: number;
            infoScreenIndex: number;
          } | null;
        };
        
        if (data?.progress?.answers && Object.keys(data.progress.answers).length > 0) {
          clientLogger.log('✅ Загружены предыдущие ответы для повторного прохождения:', Object.keys(data.progress.answers).length, 'ответов');
          clientLogger.log('📝 Ответы:', data.progress.answers);
          // Заполняем форму предыдущими ответами
          setAnswers(data.progress.answers);
          // Устанавливаем индекс вопроса, если он есть (для перехода к нужному вопросу)
          if (data.progress.questionIndex !== undefined && data.progress.questionIndex >= 0) {
            setCurrentQuestionIndex(data.progress.questionIndex);
          }
        } else {
          clientLogger.log('⚠️ Нет сохраненных ответов для предзаполнения');
        }
      }
    } catch (err: any) {
      clientLogger.warn('⚠️ Не удалось загрузить предыдущие ответы:', err);
    }
  };

  // Загружаем прогресс с сервера (синхронизация между устройствами)
  const loadProgressInProgressRef = useRef(false);

  const loadSavedProgressFromServer = async () => {
    // ИСПРАВЛЕНО: Логируем вызов для отладки в Telegram Mini App
    clientLogger.log('🔄 loadSavedProgressFromServer: вызов', {
      loadProgressInProgress: loadProgressInProgressRef.current,
      progressLoadInProgress: progressLoadInProgressRef.current,
      hasResumedRef: hasResumedRef.current,
      hasResumed,
      initCompleted: initCompletedRef.current,
      stack: new Error().stack?.split('\n').slice(1, 4).join('\n'),
    });
    
    // Защита от множественных вызовов
    if (loadProgressInProgressRef.current) {
      clientLogger.log('⏸️ loadSavedProgressFromServer: уже выполняется, пропускаем');
      return;
    }
    
    // ИСПРАВЛЕНО: Проверяем hasResumed ПЕРЕД установкой loadProgressInProgressRef
    // Это предотвращает начало загрузки, если пользователь уже продолжил анкету
    if (hasResumedRef.current || hasResumed) {
      clientLogger.log('⏸️ loadSavedProgressFromServer: hasResumed = true, пропускаем');
      return;
    }
    
    // ИСПРАВЛЕНО: Дополнительная проверка progressLoadInProgressRef
    // Это предотвращает повторные вызовы после resumeQuiz
    if (progressLoadInProgressRef.current) {
      clientLogger.log('⏸️ loadSavedProgressFromServer: progressLoadInProgressRef = true, пропускаем');
      return;
    }
    
    loadProgressInProgressRef.current = true;

    try {
      // Если пользователь только что нажал "Начать заново", не загружаем прогресс
      // Используем ref для синхронной проверки, так как состояние обновляется асинхронно
      if (isStartingOverRef.current || isStartingOver) {
        return;
      }
      // Если пользователь уже нажал "Продолжить" (hasResumed = true), не загружаем прогресс снова
      // Это предотвращает повторное появление экрана "Вы не завершили анкету"
      // Используем ref для синхронной проверки, так как состояние обновляется асинхронно
      // ИСПРАВЛЕНО: Проверяем еще раз перед API вызовом
      if (hasResumedRef.current || hasResumed) {
        clientLogger.log('⏸️ loadSavedProgressFromServer: hasResumed = true перед API вызовом, пропускаем');
        return;
      }
      // Проверяем, что Telegram WebApp доступен перед запросом
      if (typeof window === 'undefined' || !window.Telegram?.WebApp?.initData) {
        return;
      }
      const response = await api.getQuizProgress() as {
        progress?: {
          answers: Record<number, string | string[]>;
          questionIndex: number;
          infoScreenIndex: number;
          timestamp: number;
        } | null;
      };
      
      // ИСПРАВЛЕНО: Проверяем наличие профиля перед показом экрана "Вы не завершили анкету"
      // Если профиля нет, но есть ответы - это может быть старые данные, которые нужно очистить
      // Не показываем экран "Вы не завершили анкету" если профиля нет
      let hasProfile = false;
      try {
        const profile = await api.getCurrentProfile();
        hasProfile = !!(profile && profile.id);
      } catch (profileErr: any) {
        const isNotFound = profileErr?.status === 404 || 
                          profileErr?.message?.includes('404') || 
                          profileErr?.message?.includes('No profile') ||
                          profileErr?.message?.includes('Profile not found');
        if (isNotFound) {
          hasProfile = false;
        }
      }
      
      // ИСПРАВЛЕНО: Показываем экран "Вы не завершили анкету" если есть ответы, независимо от наличия профиля
      // Профиль создается только после завершения анкеты (отправки ответов)
      // Поэтому для незавершенной анкеты профиля быть не должно
      // ВАЖНО: Проверяем только наличие ответов, а не наличие профиля
      if (response?.progress && response.progress.answers && Object.keys(response.progress.answers).length > 0) {
        clientLogger.log('✅ Найдены сохраненные ответы, показываем экран продолжения', {
          answersCount: Object.keys(response.progress.answers).length,
          questionIndex: response.progress.questionIndex,
          hasProfile,
        });
        // ВАЖНО: Не загружаем прогресс, если пользователь уже нажал "Продолжить"
        // Это предотвращает повторное появление экрана "Вы не завершили анкету"
        // Используем ref для синхронной проверки, так как состояние обновляется асинхронно
        if (hasResumedRef.current || hasResumed) {
          clientLogger.log('⏸️ loadSavedProgressFromServer: пропущено после получения ответа, так как hasResumed = true', {
            refValue: hasResumedRef.current,
            stateValue: hasResumed,
          });
          return;
        }
        
        // ВАЖНО: Еще раз проверяем hasResumedRef ПЕРЕД установкой состояний
        // Это критично, так как запрос мог быть отправлен до установки hasResumedRef
        if (hasResumedRef.current || hasResumed) {
          clientLogger.log('⏸️ loadSavedProgressFromServer: пропущено перед установкой состояний, так как hasResumed = true', {
            refValue: hasResumedRef.current,
            stateValue: hasResumed,
          });
          return;
        }
        
        // ИСПРАВЛЕНО: Финальная проверка hasResumed ПЕРЕД установкой состояний
        // Это критично для предотвращения бесконечного цикла между экраном продолжения и первым экраном анкеты
        if (hasResumedRef.current || hasResumed) {
          clientLogger.log('⏸️ loadSavedProgressFromServer: hasResumed = true перед установкой состояний, пропускаем', {
            refValue: hasResumedRef.current,
            stateValue: hasResumed,
          });
          return;
        }
        
        clientLogger.log('✅ Прогресс найден на сервере, показываем экран продолжения:', {
          answersCount: Object.keys(response.progress.answers).length,
          questionIndex: response.progress.questionIndex,
          infoScreenIndex: response.progress.infoScreenIndex,
          hasProfile,
        });
        // ИСПРАВЛЕНО: Сначала устанавливаем showResumeScreen и savedProgress СИНХРОННО,
        // чтобы предотвратить показ начальных экранов на промежуточных рендерах
        setSavedProgress(response.progress);
        setShowResumeScreen(true);
        // ИСПРАВЛЕНО: Устанавливаем loading = false ПОСЛЕ установки showResumeScreen,
        // чтобы экран resume показался сразу и не было мигания начальных экранов
        // Это гарантирует, что пользователь увидит экран "Вы не завершили анкету" до первого экрана анкеты
        setLoading(false);
        // Также сохраняем в localStorage для офлайн доступа
        // ИСПРАВЛЕНО: Безопасное сохранение с обработкой ошибок
        if (typeof window !== 'undefined') {
          try {
            const progressStr = JSON.stringify(response.progress);
            if (progressStr.length > 5 * 1024 * 1024) {
              console.warn('Progress data from server is too large');
            }
            localStorage.setItem('quiz_progress', progressStr);
          } catch (storageError) {
            console.error('Error saving progress from server to localStorage:', storageError);
            // Не прерываем выполнение, так как это не критично
          }
        }
      } else {
        clientLogger.log('ℹ️ Прогресс на сервере не найден или пуст');
        // ВАЖНО: НЕ очищаем localStorage автоматически, если прогресс не найден на сервере
        // Это может быть временная проблема с сервером, и локальный прогресс может быть валидным
        // Очищаем только если это не перепрохождение анкеты
        if (!isRetakingQuiz && typeof window !== 'undefined') {
          // Проверяем, есть ли локальный прогресс, который может быть валидным
          const localProgress = localStorage.getItem('quiz_progress');
          if (localProgress) {
            try {
              // ИСПРАВЛЕНО: Безопасный парсинг с обработкой ошибок
              let parsed;
              try {
                parsed = JSON.parse(localProgress);
              } catch (parseError) {
                console.error('Error parsing local progress:', parseError);
                // Очищаем поврежденные данные
                localStorage.removeItem('quiz_progress');
                return;
              }
              // Если локальный прогресс старше 7 дней, очищаем его
              if (parsed.timestamp && Date.now() - parsed.timestamp > 7 * 24 * 60 * 60 * 1000) {
                clientLogger.log('⚠️ Локальный прогресс слишком старый, очищаем');
                localStorage.removeItem('quiz_progress');
              } else {
                clientLogger.log('ℹ️ Оставляем локальный прогресс, так как он может быть валидным');
              }
            } catch (e) {
              // Если не удалось распарсить, очищаем
              localStorage.removeItem('quiz_progress');
            }
          }
        }
        setSavedProgress(null);
        setShowResumeScreen(false);
        // Не вызываем loadSavedProgress(), так как прогресс должен быть синхронизирован с сервером
      }
    } catch (err: any) {
      // Если ошибка 401 - это нормально, просто не используем серверный прогресс
      if (err?.message?.includes('401') || err?.message?.includes('Unauthorized')) {
        // Не логируем 401 ошибки, так как это нормально, если пользователь не авторизован
        // Очищаем localStorage, так как прогресс должен быть синхронизирован с сервером
        if (typeof window !== 'undefined') {
          localStorage.removeItem('quiz_progress');
        }
        setSavedProgress(null);
        setShowResumeScreen(false);
        return;
      }
      clientLogger.warn('Ошибка загрузки прогресса с сервера:', err);
      // Очищаем localStorage при любой ошибке - прогресс должен быть на сервере
      if (typeof window !== 'undefined') {
        localStorage.removeItem('quiz_progress');
      }
      setSavedProgress(null);
      setShowResumeScreen(false);
    } finally {
      // ИСПРАВЛЕНО: Не сбрасываем флаги, если пользователь уже продолжил анкету
      // Это предотвращает повторные вызовы loadSavedProgressFromServer в Telegram Mini App
      if (!hasResumedRef.current && !hasResumed) {
      loadProgressInProgressRef.current = false;
      } else {
        // Если hasResumed = true, оставляем флаги установленными, чтобы предотвратить повторные вызовы
        clientLogger.log('🔒 loadSavedProgressFromServer: оставляем флаги установленными, так как hasResumed = true');
      }
      
      // ИСПРАВЛЕНО: Дополнительная проверка после завершения загрузки
      // Если hasResumed стал true во время загрузки, очищаем состояния
      if (hasResumedRef.current || hasResumed) {
        clientLogger.log('⏸️ loadSavedProgressFromServer: hasResumed = true после загрузки, очищаем состояния');
        setSavedProgress(null);
        setShowResumeScreen(false);
      }
    }
  };

  // Сохраняем прогресс в localStorage и на сервер
  const saveProgress = async (newAnswers?: Record<number, string | string[]>, newQuestionIndex?: number, newInfoScreenIndex?: number, skipDebounce?: boolean) => {
    if (typeof window === 'undefined') return;
    
    const finalQuestionIndex = newQuestionIndex !== undefined ? newQuestionIndex : currentQuestionIndex;
    const finalInfoScreenIndex = newInfoScreenIndex !== undefined ? newInfoScreenIndex : currentInfoScreenIndex;
    const finalAnswers = newAnswers || answers;
    
    const progress = {
      answers: finalAnswers,
      questionIndex: finalQuestionIndex,
      infoScreenIndex: finalInfoScreenIndex,
      timestamp: Date.now(),
    };
    
    // ИСПРАВЛЕНО: Безопасное сохранение с обработкой ошибок
    try {
      const progressStr = JSON.stringify(progress);
      // Проверяем размер данных перед сохранением (localStorage обычно ограничен ~5-10MB)
      if (progressStr.length > 5 * 1024 * 1024) {
        console.warn('Progress data is too large, truncating...');
        // В критическом случае можно сохранить только последние ответы
      }
      localStorage.setItem('quiz_progress', progressStr);
    } catch (storageError) {
      console.error('Error saving progress to localStorage:', storageError);
      // Не прерываем выполнение, так как это не критично для работы анкеты
    }
    
    // ОПТИМИЗАЦИЯ: Метаданные позиции (questionIndex, infoScreenIndex) больше НЕ отправляются на сервер
    // Они хранятся только локально в localStorage, так как сервер их не сохраняет в БД
    // Позицию можно вычислить на основе последнего отвеченного вопроса при загрузке прогресса
    // Это значительно уменьшает количество ненужных API вызовов
  };

  // Очищаем сохранённый прогресс
  const clearProgress = async () => {
    if (typeof window === 'undefined') return;
    
    // Очищаем локальный прогресс
    localStorage.removeItem('quiz_progress');
    setSavedProgress(null);
    setShowResumeScreen(false);
    // Сбрасываем флаги восстановления прогресса (и state, и ref)
    hasResumedRef.current = false;
    setHasResumed(false);
    // Сбрасываем кэш последнего сохраненного ответа
    lastSavedAnswerRef.current = null;
    
    // Также очищаем прогресс на сервере
    if (typeof window !== 'undefined' && window.Telegram?.WebApp?.initData) {
      try {
        await api.clearQuizProgress();
        clientLogger.log('✅ Прогресс очищен на сервере');
      } catch (err: any) {
        // Не критично, если не удалось очистить - прогресс просто не будет показываться
        clientLogger.warn('⚠️ Не удалось очистить прогресс на сервере:', err);
      }
    }
  };

  const loadQuestionnaire = async () => {
    try {
      // ВАЖНО: Добавляем таймаут для загрузки анкеты, чтобы не ждать бесконечно
      const loadPromise = api.getActiveQuestionnaire();
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Таймаут загрузки анкеты (10 секунд)')), 10000);
      });
      
      const data = await Promise.race([loadPromise, timeoutPromise]);
      const questionnaireData = data as Questionnaire;
      
      // ИСПРАВЛЕНО: Проверяем, что данные валидны
      if (!questionnaireData || !questionnaireData.id) {
        throw new Error('Invalid questionnaire data received from server');
      }
      
      // ИСПРАВЛЕНО: Добавляем проверку на существование groups и questions
      const groups = questionnaireData.groups || [];
      const questions = questionnaireData.questions || [];
      
      // ИСПРАВЛЕНО: Проверяем, что есть хотя бы один вопрос
      const totalQuestions = groups.reduce((sum, g) => sum + (g.questions?.length || 0), 0) + questions.length;
      if (totalQuestions === 0) {
        throw new Error('Questionnaire has no questions');
      }
      addDebugLog('📥 Questionnaire loaded', {
        questionnaireId: questionnaireData.id,
        name: questionnaireData.name,
        version: questionnaireData.version,
        groupsCount: groups.length,
        questionsCount: questions.length,
        totalQuestions: groups.reduce((sum, g) => sum + (g.questions?.length || 0), 0) + questions.length,
        questionIds: (() => {
          // ВАЖНО: Удаляем дубликаты questionId, так как вопросы могут быть и в groups, и в questions
          const allIds = [
            ...groups.flatMap((g: any) => (g.questions || []).map((q: Question) => q.id)),
            ...questions.map((q: Question) => q.id),
          ];
          return Array.from(new Set(allIds));
        })(),
      });
      setQuestionnaire(questionnaireData);
      // ИСПРАВЛЕНО: Очищаем ошибки при успешной загрузке
      // Это предотвращает показ временных ошибок, которые уже исправлены
      setError(null);
      return questionnaireData; // Возвращаем загруженную анкету
    } catch (err: any) {
      addDebugLog('❌ Error loading questionnaire', { error: err.message });
      console.error('Ошибка загрузки анкеты:', err);
      // Если ошибка авторизации, не показываем её как критическую
      if (err?.message?.includes('Unauthorized') || err?.message?.includes('401')) {
        // Анкета публичная, эта ошибка не должна возникать
        clientLogger.warn('Неожиданная ошибка авторизации при загрузке анкеты');
      }
      // Если таймаут - это критическая ошибка, но не блокируем загрузку
      if (err?.message?.includes('Таймаут')) {
        console.error('❌ Таймаут загрузки анкеты - возможно, проблема с сетью или сервером');
      }
      // Убеждаемся, что error всегда строка
      const errorMessage = String(err?.message || 'Ошибка загрузки анкеты');
      setError(errorMessage);
      return null;
    }
    // НЕ вызываем setLoading(false) здесь - это сделает init() после всех загрузок
  };

  const handleAnswer = async (questionId: number, value: string | string[]) => {
    addDebugLog('💾 handleAnswer called', { 
      questionId, 
      questionIdType: typeof questionId,
      value,
      currentQuestion: currentQuestion?.id,
      currentQuestionCode: currentQuestion?.code,
      questionnaireId: questionnaire?.id,
      allQuestionsLength: allQuestions.length,
      currentQuestionIndex,
    });

    // Валидация: проверяем, что questionId соответствует текущему вопросу
    if (currentQuestion && currentQuestion.id !== questionId) {
      console.error('⚠️ Question ID mismatch:', {
        currentQuestionId: currentQuestion.id,
        providedQuestionId: questionId,
        currentQuestionCode: currentQuestion.code,
      });
      // Используем ID текущего вопроса вместо переданного
      questionId = currentQuestion.id;
    }

    // ИСПРАВЛЕНО: Проверяем, что вопрос существует в анкете (не только в allQuestions)
    // allQuestions может быть отфильтрован (например, при повторном прохождении исключаются пол и возраст)
    // Но ответы на эти вопросы все равно должны сохраняться на сервер
    const questionExistsInAllQuestions = allQuestions.some((q: Question) => q.id === questionId);
    const questionExistsInQuestionnaire = questionnaire?.questions?.some((q: Question) => q.id === questionId) ||
                                         questionnaire?.groups?.some((g: any) => 
                                           g?.questions?.some((q: Question) => q.id === questionId)
                                         );
    
    // ВАЖНО: Если вопрос не найден в анкете, все равно сохраняем ответ в state и localStorage
    // Это важно, чтобы ответ не потерялся, даже если есть проблема с загрузкой анкеты
    // При отправке ответов на сервер сервер проверит валидность questionId
    if (!questionExistsInAllQuestions && !questionExistsInQuestionnaire && allQuestions.length > 0) {
      console.warn('⚠️ Question ID not found in questionnaire, but saving to state anyway:', {
        questionId,
        allQuestionIds: allQuestions.map((q: Question) => q.id),
        currentQuestionId: currentQuestion?.id,
        questionnaireId: questionnaire?.id,
      });
      // НЕ возвращаемся - продолжаем сохранение в state и localStorage
      // Сервер проверит валидность questionId при финальной отправке
    }
    
    // ВАЖНО: Если вопрос существует в анкете, но отфильтрован из allQuestions - все равно сохраняем
    // Это важно для вопросов про пол и возраст, которые фильтруются при повторном прохождении
    if (!questionExistsInAllQuestions && questionExistsInQuestionnaire) {
      clientLogger.log('⚠️ Question exists in questionnaire but filtered from allQuestions, saving anyway', {
        questionId,
        currentQuestionCode: currentQuestion?.code,
      });
    }

    // ОПТИМИЗАЦИЯ: Проверяем, изменился ли ответ
    // ИСПРАВЛЕНО: Безопасное сравнение с обработкой ошибок
    const currentAnswer = answers[questionId];
    let answerChanged = false;
    try {
      answerChanged = JSON.stringify(currentAnswer) !== JSON.stringify(value);
    } catch (compareError) {
      // Если сравнение не удалось, считаем что ответ изменился для безопасности
      console.warn('Error comparing answers, assuming changed:', compareError);
      answerChanged = true;
    }
    
    // ОПТИМИЗАЦИЯ: Дедупликация - проверяем, не сохраняли ли мы уже этот ответ на сервер
    // ИСПРАВЛЕНО: Безопасное сравнение с обработкой ошибок
    const lastSaved = lastSavedAnswerRef.current;
    let isDuplicateServerSave: boolean = false;
    try {
      if (lastSaved && lastSaved.questionId === questionId) {
        isDuplicateServerSave = JSON.stringify(lastSaved.answer) === JSON.stringify(value);
      }
    } catch (compareError) {
      // Если сравнение не удалось, считаем что это не дубликат для безопасности
      console.warn('Error checking duplicate save, assuming not duplicate:', compareError);
      isDuplicateServerSave = false;
    }
    
    // Всегда обновляем состояние и localStorage (даже если не изменилось, для консистентности)
    const newAnswers = { ...answers, [questionId]: value };
    setAnswers(newAnswers);
    await saveProgress(newAnswers, currentQuestionIndex, currentInfoScreenIndex, true);
    
    // Пропускаем сохранение на сервер, если это дубликат
    if (isDuplicateServerSave) {
      if (process.env.NODE_ENV === 'development') {
        clientLogger.log('⏭️ Skipping duplicate server save for question', questionId);
      }
      return;
    }
    
    // Сохраняем в БД для синхронизации между устройствами (только если Telegram WebApp доступен)
    if (questionnaire && typeof window !== 'undefined' && window.Telegram?.WebApp?.initData) {
      try {
        const isArray = Array.isArray(value);
        addDebugLog('📤 Saving to server', {
          questionnaireId: questionnaire.id,
          questionId,
          questionIdType: typeof questionId,
          hasValue: !!value,
          isArray,
        });
        await api.saveQuizProgress(
          questionnaire.id,
          questionId,
          isArray ? undefined : (value as string),
          isArray ? (value as string[]) : undefined,
          currentQuestionIndex,
          currentInfoScreenIndex
        );
        // Сохраняем информацию о последнем сохраненном ответе для дедупликации
        lastSavedAnswerRef.current = { questionId, answer: value };
        clientLogger.log('✅ Successfully saved to server');
      } catch (err: any) {
        // Если ошибка 401 - это нормально, прогресс сохранен локально
        if (!err?.message?.includes('401') && !err?.message?.includes('Unauthorized')) {
          console.error('❌ Ошибка сохранения прогресса на сервер:', {
            error: err.message,
            questionId,
            questionnaireId: questionnaire.id,
            errorDetails: err,
          });
        }
      }
    }
  };

  const handleNext = async () => {
    const initialInfoScreens = INFO_SCREENS.filter(screen => !screen.showAfterQuestionCode);

    // ВАЖНО: При повторном прохождении (isRetakingQuiz && !showRetakeScreen) пропускаем все начальные info screens
    // showRetakeScreen = true означает, что показывается экран выбора тем, и мы еще не начали перепрохождение
    if (isRetakingQuiz && !showRetakeScreen && currentInfoScreenIndex < initialInfoScreens.length) {
      if (!questionnaire) return;
      const newInfoIndex = initialInfoScreens.length;
      setCurrentInfoScreenIndex(newInfoIndex);
      // Если currentQuestionIndex = 0, начинаем с первого вопроса
      if (currentQuestionIndex === 0) {
        setCurrentQuestionIndex(0);
      }
      await saveProgress(answers, currentQuestionIndex, newInfoIndex);
      return;
    }

    // Если мы на начальных информационных экранах, переходим к следующему или к вопросам
    if (currentInfoScreenIndex < initialInfoScreens.length - 1) {
      const newIndex = currentInfoScreenIndex + 1;
      setCurrentInfoScreenIndex(newIndex);
      await saveProgress(answers, currentQuestionIndex, newIndex);
      return;
    }

    if (currentInfoScreenIndex === initialInfoScreens.length - 1) {
      if (!questionnaire) return;
      const newInfoIndex = initialInfoScreens.length;
      setCurrentInfoScreenIndex(newInfoIndex);
      setCurrentQuestionIndex(0);
      await saveProgress(answers, 0, newInfoIndex);
      return;
    }

    if (!questionnaire) return;

    // ИСПРАВЛЕНО: Используем мемоизированный allQuestions из компонента вместо локального вычисления
    // Это гарантирует, что мы используем тот же массив вопросов, что и в остальном компоненте
    // Локальное вычисление может привести к несоответствию индексов после изменения фильтрации
    // (например, после ответа на вопрос про бюджет)
    
    // Проверяем, что currentQuestionIndex валиден для текущего allQuestions
    if (currentQuestionIndex >= allQuestions.length && allQuestions.length > 0) {
      clientLogger.warn('⚠️ currentQuestionIndex выходит за пределы allQuestions, корректируем', {
        currentQuestionIndex,
        allQuestionsLength: allQuestions.length,
        questionIds: allQuestions.map((q: Question) => q.id),
      });
      // Корректируем индекс на последний валидный вопрос
      const correctedIndex = Math.max(0, allQuestions.length - 1);
      setCurrentQuestionIndex(correctedIndex);
      await saveProgress(answers, correctedIndex, currentInfoScreenIndex);
      return;
        }
        
    // Проверяем, что текущий вопрос существует в allQuestions
    const currentQuestionInAllQuestions = allQuestions[currentQuestionIndex];
    if (!currentQuestionInAllQuestions && allQuestions.length > 0) {
      clientLogger.warn('⚠️ Текущий вопрос не найден в allQuestions, ищем правильный индекс', {
        currentQuestionIndex,
        allQuestionsLength: allQuestions.length,
        allQuestionIds: allQuestions.map((q: Question) => q.id),
      });
      
      // ИСПРАВЛЕНО: Если вопрос не найден по индексу, корректируем на последний валидный индекс
      // Это может произойти после изменения фильтрации (например, после ответа на вопрос про бюджет)
      const correctedIndex = Math.max(0, allQuestions.length - 1);
      setCurrentQuestionIndex(correctedIndex);
      await saveProgress(answers, correctedIndex, currentInfoScreenIndex);
      return;
      }
      
    // ИСПРАВЛЕНО: Больше не вычисляем allQuestions локально - используем мемоизированный из компонента
    // Это гарантирует консистентность индексов и предотвращает проблемы после изменения фильтрации

    // Если показывается информационный экран между вопросами, проверяем, есть ли следующий инфо-экран в цепочке
    // При повторном прохождении пропускаем все info screens
    if (pendingInfoScreen && !isRetakingQuiz) {
      // Проверяем, есть ли следующий инфо-экран, который должен быть показан после текущего
      const nextInfoScreen = INFO_SCREENS.find(screen => screen.showAfterQuestionCode === pendingInfoScreen.id);
      if (nextInfoScreen) {
        setPendingInfoScreen(nextInfoScreen);
        await saveProgress(answers, currentQuestionIndex, currentInfoScreenIndex);
        return;
      }
      
      // ИСПРАВЛЕНО: Проверяем, не последний ли это вопрос ДО закрытия инфо-экрана
      const isLastQuestion = currentQuestionIndex === allQuestions.length - 1;
      const isWantImproveScreen = pendingInfoScreen?.id === 'want_improve';
      
      // ВАЖНО: Если это последний инфо-экран (want_improve), НЕ закрываем его автоматически
      // Пользователь должен нажать кнопку "Получить план ухода" для отправки ответов
      if (isWantImproveScreen && isLastQuestion) {
        clientLogger.log('ℹ️ Это последний инфо-экран want_improve - ждем нажатия кнопки "Получить план ухода"');
        // НЕ закрываем экран, НЕ меняем индекс - просто возвращаемся
        // Кнопка "Получить план ухода" должна вызвать handleGetPlan, который вызовет submitAnswers
        return;
      }
      
      // Если нет следующего info screen, закрываем pending и переходим к следующему вопросу
      setPendingInfoScreen(null);
      
      if (isLastQuestion) {
        // ИСПРАВЛЕНО: После закрытия последнего инфо-экрана (но не want_improve) увеличиваем индекс для запуска автоотправки
        // ВАЖНО: Сначала сохраняем прогресс, потом увеличиваем индекс, чтобы избежать проблем с редиректом
        await saveProgress(answers, currentQuestionIndex, currentInfoScreenIndex);
        // ИСПРАВЛЕНО: Устанавливаем индекс синхронно, но с небольшой задержкой для безопасности
        // Это гарантирует, что автоотправка сработает после закрытия инфо-экрана
        setTimeout(() => {
          clientLogger.log('🔄 Закрыт последний инфо-экран, устанавливаем currentQuestionIndex для автоотправки', {
            currentIndex: currentQuestionIndex,
            targetIndex: allQuestions.length,
          });
          setCurrentQuestionIndex(allQuestions.length);
        }, 100); // Небольшая задержка, чтобы состояния успели обновиться
        return;
      }
      
      // Переходим к следующему вопросу
      const newIndex = currentQuestionIndex + 1;
      setCurrentQuestionIndex(newIndex);
      await saveProgress(answers, newIndex, currentInfoScreenIndex);
      return;
    }

    // Проверяем, нужно ли показать информационный экран после текущего вопроса
    // При повторном прохождении пропускаем все info screens
    const currentQuestion = allQuestions[currentQuestionIndex];
    const isLastQuestion = currentQuestionIndex === allQuestions.length - 1;
    
    if (currentQuestion && !isRetakingQuiz) {
      const infoScreen = getInfoScreenAfterQuestion(currentQuestion.code);
      if (infoScreen) {
        setPendingInfoScreen(infoScreen);
        await saveProgress(answers, currentQuestionIndex, currentInfoScreenIndex);
        clientLogger.log('✅ Показан инфо-экран после вопроса:', {
          questionCode: currentQuestion.code,
          questionIndex: currentQuestionIndex,
          infoScreenId: infoScreen.id,
          isLastQuestion,
        });
        return;
      }
    }

    // ИСПРАВЛЕНО: Проверяем последний вопрос отдельно, так как логика отличается
    if (isLastQuestion) {
      // Это последний вопрос - проверяем, есть ли инфо-экраны после него
      // При повторном прохождении пропускаем info screens
      if (!isRetakingQuiz && currentQuestion) {
        const infoScreen = getInfoScreenAfterQuestion(currentQuestion.code);
        if (infoScreen) {
          setPendingInfoScreen(infoScreen);
          // ИСПРАВЛЕНО: НЕ увеличиваем currentQuestionIndex, чтобы не запустить автоотправку
          // Автоотправка запустится только после закрытия инфо-экрана или при нажатии кнопки "Получить план"
          await saveProgress(answers, currentQuestionIndex, currentInfoScreenIndex);
          clientLogger.log('✅ Показан инфо-экран после последнего вопроса:', {
            questionCode: currentQuestion.code,
            infoScreenId: infoScreen.id,
            currentQuestionIndex,
            allQuestionsLength: allQuestions.length,
          });
          return;
        }
      }
      // ВАЖНО: Если это последний вопрос и нет инфо-экрана, увеличиваем currentQuestionIndex
      // чтобы сработала автоматическая отправка ответов (проверка currentQuestionIndex >= allQuestions.length)
      await saveProgress(answers, currentQuestionIndex, currentInfoScreenIndex);
      clientLogger.log('✅ Последний вопрос отвечен, нет инфо-экранов, увеличиваем индекс для автоотправки');
      // Увеличиваем индекс, чтобы выйти за пределы массива вопросов и запустить автоматическую отправку
      setCurrentQuestionIndex(allQuestions.length);
      return;
    }

    // Переходим к следующему вопросу
    if (currentQuestionIndex < allQuestions.length - 1) {
      const newIndex = currentQuestionIndex + 1;
      setCurrentQuestionIndex(newIndex);
      await saveProgress(answers, newIndex, currentInfoScreenIndex);
    }
  };

  const handleBack = () => {
    if (!questionnaire) return;

    const initialInfoScreens = INFO_SCREENS.filter(screen => !screen.showAfterQuestionCode);

    // Если показывается инфо-экран между вопросами, просто закрываем его
    if (pendingInfoScreen) {
      setPendingInfoScreen(null);
      return;
    }

    // ИСПРАВЛЕНО: Если мы на первом начальном информационном экране, НЕ возвращаемся на главную
    // Пользователь может нажать "Назад" в браузере или закрыть анкету вручную
    // Если пользователь явно зашел на /quiz, он должен видеть анкету, а не быть редиректнутым
    if (currentInfoScreenIndex === 0) {
      // Вместо редиректа на главную, просто ничего не делаем или показываем предупреждение
      // Пользователь может закрыть анкету вручную, если хочет
      clientLogger.log('ℹ️ Пользователь на первом экране анкеты, но нажал "Назад" - остаемся на странице анкеты');
      // НЕ делаем редирект - пользователь уже на /quiz и должен видеть анкету
      return;
    }

    // Если мы на первом вопросе, возвращаемся к последнему начальному инфо-экрану
    if (currentInfoScreenIndex === initialInfoScreens.length && currentQuestionIndex === 0) {
      setCurrentInfoScreenIndex(initialInfoScreens.length - 1);
      return;
    }

    // Если мы на начальных информационных экранах, переходим к предыдущему
    if (currentInfoScreenIndex > 0 && currentInfoScreenIndex < initialInfoScreens.length) {
      setCurrentInfoScreenIndex(currentInfoScreenIndex - 1);
      return;
    }

    // Если мы на вопросах, переходим к предыдущему
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1);
    }
  };

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      // Очищаем таймаут редиректа при размонтировании компонента
      if (redirectTimeoutRef.current) {
        clearTimeout(redirectTimeoutRef.current);
        redirectTimeoutRef.current = null;
      }
    };
  }, []);

  // Вспомогательная функция для получения initData с ожиданием
  const getInitData = async (): Promise<string | null> => {
    // Сначала пробуем использовать initData из хука
    if (initData) {
      return initData;
    }
    
    // Если не доступен, ждем его готовности
    if (typeof window !== 'undefined' && window.Telegram?.WebApp) {
      await new Promise((resolve) => {
        let attempts = 0;
        const maxAttempts = 10; // 10 * 100ms = 1 секунда
        const checkInterval = setInterval(() => {
          attempts++;
          const data = window.Telegram?.WebApp?.initData || null;
          if (data || attempts >= maxAttempts) {
            clearInterval(checkInterval);
            resolve(undefined);
          }
        }, 100);
      });
      return window.Telegram?.WebApp?.initData || null;
    }
    
    return null;
  };


  const submitAnswers = useCallback(async () => {
    clientLogger.log('🚀 submitAnswers вызвана');
    
    // КРИТИЧНО: Устанавливаем флаг quiz_just_submitted СРАЗУ, синхронно, ДО любых асинхронных операций
    // Это защита от редиректа на первый экран, если что-то пойдет не так
    if (typeof window !== 'undefined') {
      try {
        sessionStorage.setItem('quiz_just_submitted', 'true');
        clientLogger.log('✅ Флаг quiz_just_submitted установлен СРАЗУ при вызове submitAnswers');
      } catch (storageError) {
        clientLogger.warn('⚠️ Не удалось установить флаг quiz_just_submitted:', storageError);
      }
    }
    
    // ВАЖНО: Логируем вызов submitAnswers на сервер
    // ИСПРАВЛЕНО: Используем синхронный доступ к initData, чтобы не блокировать выполнение
    let currentInitData: string | null = null;
    try {
      // Сначала пробуем использовать initData из хука (синхронно)
      if (initData) {
        currentInitData = initData;
      } else if (typeof window !== 'undefined' && window.Telegram?.WebApp?.initData) {
        currentInitData = window.Telegram?.WebApp?.initData;
      }
      
      // ВАЖНО: Логируем на сервер асинхронно, но не блокируем выполнение
      const logPromise = (async () => {
        try {
          if (currentInitData) {
            const logResponse = await fetch('/api/logs', {
              method: 'POST',
              headers: { 
                'Content-Type': 'application/json',
                'X-Telegram-Init-Data': currentInitData,
              },
              body: JSON.stringify({
                level: 'info',
                message: 'submitAnswers called',
                context: {
                  timestamp: new Date().toISOString(),
                  hasQuestionnaire: !!questionnaire,
                  answersCount: Object.keys(answers).length,
                },
                url: typeof window !== 'undefined' ? window.location.href : undefined,
                userAgent: typeof window !== 'undefined' ? navigator.userAgent : undefined,
              }),
            });
            
            if (!logResponse.ok) {
              const errorText = await logResponse.text().catch(() => 'Unknown error');
              console.error('❌ Ошибка сохранения лога (submitAnswers called):', {
                status: logResponse.status,
                statusText: logResponse.statusText,
                error: errorText,
              });
            }
          } else {
            // Отправляем анонимно
            await fetch('/api/logs', {
              method: 'POST',
              headers: { 
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                level: 'info',
                message: 'submitAnswers called (no initData)',
                context: {
                  timestamp: new Date().toISOString(),
                  hasQuestionnaire: !!questionnaire,
                  answersCount: Object.keys(answers).length,
                  hasInitData: false,
                },
                url: typeof window !== 'undefined' ? window.location.href : undefined,
                userAgent: typeof window !== 'undefined' ? navigator.userAgent : undefined,
              }),
            }).catch(() => {});
          }
        } catch (logError) {
          // Игнорируем ошибки логирования, чтобы не блокировать выполнение
          console.warn('⚠️ Ошибка при логировании (submitAnswers called):', logError);
        }
      })();
      
      // НЕ ждем завершения логирования - продолжаем выполнение
      // logPromise будет выполняться в фоне
    } catch (logError) {
      // Игнорируем ошибки логирования, чтобы не блокировать выполнение
      console.warn('⚠️ Ошибка при подготовке логирования (submitAnswers called):', logError);
    }
    
    // ВАЖНО: Логируем, что продолжаем выполнение после логирования
    clientLogger.log('✅ Логирование submitAnswers called завершено, продолжаем выполнение');
    
    // ВАЖНО: Отправляем критичный лог на сервер (неблокирующе)
    // ИСПРАВЛЕНО: Не ждем завершения логирования, чтобы не блокировать выполнение
    const syncInitData = typeof window !== 'undefined' ? window.Telegram?.WebApp?.initData : null;
    if (syncInitData) {
      // Отправляем логирование асинхронно, не блокируя выполнение
      fetch('/api/logs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Telegram-Init-Data': syncInitData,
        },
        body: JSON.stringify({
          level: 'info',
          message: '✅ Логирование submitAnswers called завершено, продолжаем выполнение',
          context: {
            timestamp: new Date().toISOString(),
            hasQuestionnaire: !!questionnaire,
            questionnaireId: questionnaire?.id,
          },
          url: typeof window !== 'undefined' ? window.location.href : undefined,
        }),
      }).catch(() => {}); // Игнорируем ошибки логирования
    }
    
    // Сохраняем функцию в ref для использования в setTimeout
    submitAnswersRef.current = submitAnswers;
    
    // ВАЖНО: Логируем сразу после установки ref
    clientLogger.log('✅ submitAnswersRef.current установлен, продолжаем выполнение');
    
    // ВАЖНО: Отправляем критичный лог на сервер (неблокирующе)
    // ИСПРАВЛЕНО: Не ждем завершения логирования, чтобы не блокировать выполнение
    if (syncInitData) {
      // Отправляем логирование асинхронно, не блокируя выполнение
      fetch('/api/logs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Telegram-Init-Data': syncInitData,
        },
        body: JSON.stringify({
          level: 'info',
          message: '✅ submitAnswersRef.current установлен, продолжаем выполнение',
          context: {
            timestamp: new Date().toISOString(),
            hasQuestionnaire: !!questionnaire,
            questionnaireId: questionnaire?.id,
          },
          url: typeof window !== 'undefined' ? window.location.href : undefined,
        }),
      }).catch(() => {}); // Игнорируем ошибки логирования
    }
    
    // ВАЖНО: Логируем перед проверкой questionnaire
    clientLogger.log('🔍 Проверка questionnaire перед продолжением:', {
      hasQuestionnaire: !!questionnaire,
      questionnaireId: questionnaire?.id,
    });
    
    // ВАЖНО: Отправляем критичный лог на сервер (неблокирующе)
    if (syncInitData) {
      // Отправляем логирование асинхронно, не блокируя выполнение
      fetch('/api/logs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Telegram-Init-Data': syncInitData,
        },
        body: JSON.stringify({
          level: 'info',
          message: '🔍 Проверка questionnaire перед продолжением',
          context: {
            timestamp: new Date().toISOString(),
            hasQuestionnaire: !!questionnaire,
            questionnaireId: questionnaire?.id,
          },
          url: typeof window !== 'undefined' ? window.location.href : undefined,
        }),
      }).catch(() => {}); // Игнорируем ошибки логирования
    }
    
    if (!questionnaire) {
      clientLogger.error('❌ Анкета не загружена - блокируем отправку');
      
      // ВАЖНО: Отправляем критичный лог на сервер (неблокирующе)
      const syncInitData = typeof window !== 'undefined' ? window.Telegram?.WebApp?.initData : null;
      if (syncInitData) {
        fetch('/api/logs', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Telegram-Init-Data': syncInitData,
          },
          body: JSON.stringify({
            level: 'error',
            message: '❌ Анкета не загружена - блокируем отправку',
            context: {
              timestamp: new Date().toISOString(),
              hasQuestionnaire: false,
            },
            url: typeof window !== 'undefined' ? window.location.href : undefined,
          }),
        }).catch(() => {}); // Игнорируем ошибки логирования
      }
      
      if (isMountedRef.current) {
        setError('Анкета не загружена. Пожалуйста, обновите страницу.');
        // ИСПРАВЛЕНО: Устанавливаем state, ref синхронизируется автоматически через useEffect
        setIsSubmitting(false);
      }
      return;
    }

    // Защита от множественных вызовов: проверяем state (ref синхронизирован через useEffect)
    // ИСПРАВЛЕНО: Используем только state для проверки, так как ref синхронизирован автоматически
    if (isSubmitting) {
      // ИСПРАВЛЕНО: Если state = true, но ref = false - это рассинхронизация (редкий случай)
      // Синхронизируем ref и игнорируем повторный вызов
      if (!isSubmittingRef.current) {
        clientLogger.warn('⚠️ Обнаружена рассинхронизация: isSubmitting=true, но isSubmittingRef=false. Синхронизируем ref', {
          isSubmitting,
          isSubmittingRef: isSubmittingRef.current,
        });
        isSubmittingRef.current = true;
      }
      // Оба флага true - действительно идет отправка
      clientLogger.warn('⚠️ Уже отправляется, игнорируем повторный вызов', {
        isSubmitting,
        isSubmittingRef: isSubmittingRef.current,
      });
      // ВАЖНО: Логируем на сервер для диагностики (неблокирующе)
      const currentInitData = typeof window !== 'undefined' ? window.Telegram?.WebApp?.initData : null;
      if (currentInitData) {
        fetch('/api/logs', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Telegram-Init-Data': currentInitData,
          },
          body: JSON.stringify({
            level: 'warn',
            message: '⚠️ Уже отправляется, игнорируем повторный вызов',
            context: {
              isSubmitting,
              isSubmittingRef: isSubmittingRef.current,
              timestamp: new Date().toISOString(),
            },
            url: typeof window !== 'undefined' ? window.location.href : undefined,
          }),
        }).catch(() => {}); // Игнорируем ошибки логирования
      }
      return;
    }

    if (isMountedRef.current) {
      // ИСПРАВЛЕНО: Устанавливаем state, ref синхронизируется автоматически через useEffect
      setIsSubmitting(true);
      setError(null);
      setLoading(false); // ВАЖНО: Устанавливаем loading = false, чтобы не показывался лоадер "Загрузка анкеты..."
      
      // Устанавливаем состояния для финализации с лоадером
      setFinalizing(true);
      setFinalizingStep('answers');
      setFinalizeError(null);
      
      clientLogger.log('✅ Флаг isSubmitting установлен, продолжаем выполнение submitAnswers');
    } else {
      clientLogger.warn('⚠️ Компонент размонтирован, но продолжаем выполнение submitAnswers');
    }

    try {
      // Проверяем, что приложение открыто через Telegram
      const initData = typeof window !== 'undefined' ? window.Telegram?.WebApp?.initData : null;
      const isInTelegram = typeof window !== 'undefined' && !!window.Telegram?.WebApp;
      
      clientLogger.log('📱 Проверка Telegram WebApp:', {
        hasWindow: typeof window !== 'undefined',
        hasTelegram: typeof window !== 'undefined' && !!window.Telegram,
        hasWebApp: isInTelegram,
        hasInitData: !!initData,
        initDataLength: initData?.length || 0,
      });
      
      // ВАЖНО: Логируем перед каждой проверкой
      clientLogger.log('🔍 Проверка условий перед отправкой ответов:', {
        hasQuestionnaire: !!questionnaire,
        questionnaireId: questionnaire?.id,
        answersCount: Object.keys(answers).length,
        isInTelegram,
        hasInitData: !!initData,
      });

      // Если мы в Telegram, но initData нет - это может быть preview mode
      // В development не блокируем, чтобы можно было тестировать локально без Mini App
      if (isInTelegram && !initData && !isDev) {
        clientLogger.error('❌ Telegram WebApp доступен, но initData отсутствует (возможно, preview mode)');
        if (isMountedRef.current) {
          setError('Приложение открыто в режиме предпросмотра. Пожалуйста, откройте его через кнопку бота или используйте ссылку формата: https://t.me/your_bot?startapp=...');
          // ИСПРАВЛЕНО: Устанавливаем state, ref синхронизируется автоматически через useEffect
          setIsSubmitting(false);
        }
        return;
      }

      if (!isInTelegram && !isDev) {
        clientLogger.error('❌ Telegram WebApp не доступен - блокируем отправку');
        if (isMountedRef.current) {
          setError('Пожалуйста, откройте приложение через Telegram Mini App (не просто по ссылке, а через кнопку бота).');
          // ИСПРАВЛЕНО: Устанавливаем state, ref синхронизируется автоматически через useEffect
          setIsSubmitting(false);
        }
        return;
      }

      if (!initData && !isDev) {
        clientLogger.error('❌ Telegram WebApp initData не доступен - блокируем отправку');
        if (isMountedRef.current) {
          setError('Не удалось получить данные авторизации. Попробуйте обновить страницу.');
          // ИСПРАВЛЕНО: Устанавливаем state, ref синхронизируется автоматически через useEffect
          setIsSubmitting(false);
        }
        return;
      }
      
      clientLogger.log('✅ Все проверки пройдены, продолжаем формирование answerArray');
      
      // ВАЖНО: Отправляем критичный лог на сервер (неблокирующе)
      const currentInitData = typeof window !== 'undefined' ? window.Telegram?.WebApp?.initData : null;
      if (currentInitData) {
        fetch('/api/logs', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Telegram-Init-Data': currentInitData,
          },
          body: JSON.stringify({
            level: 'info',
            message: '✅ Все проверки пройдены, продолжаем формирование answerArray',
            context: {
              timestamp: new Date().toISOString(),
              hasQuestionnaire: !!questionnaire,
              answersCount: Object.keys(answers).length,
            },
            url: typeof window !== 'undefined' ? window.location.href : undefined,
          }),
        }).catch(() => {}); // Игнорируем ошибки логирования
      }

      // Собираем ответы из state, если они пустые - пытаемся загрузить из localStorage
      let answersToSubmit = answers;
      clientLogger.log('📝 Текущие ответы в state:', Object.keys(answersToSubmit).length);
      
      // ВАЖНО: Отправляем критичный лог на сервер (неблокирующе)
      const currentInitDataForLog1 = typeof window !== 'undefined' ? window.Telegram?.WebApp?.initData : null;
      if (currentInitDataForLog1) {
        fetch('/api/logs', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Telegram-Init-Data': currentInitDataForLog1,
          },
          body: JSON.stringify({
            level: 'info',
            message: '📝 Текущие ответы в state',
            context: {
              timestamp: new Date().toISOString(),
              answersCount: Object.keys(answersToSubmit).length,
              answersInState: Object.keys(answers).length,
            },
            url: typeof window !== 'undefined' ? window.location.href : undefined,
          }),
        }).catch(() => {}); // Игнорируем ошибки логирования
      }
      
      if (Object.keys(answersToSubmit).length === 0) {
        clientLogger.log('📦 Ответы пустые, пытаемся загрузить из localStorage...');
        try {
          const savedProgressStr = localStorage.getItem('quiz_progress');
          if (savedProgressStr) {
            const savedProgress = JSON.parse(savedProgressStr);
            if (savedProgress.answers && Object.keys(savedProgress.answers).length > 0) {
              answersToSubmit = savedProgress.answers;
              if (isMountedRef.current) {
                setAnswers(savedProgress.answers);
              }
              clientLogger.log('✅ Загружены ответы из localStorage:', Object.keys(savedProgress.answers).length);
            }
          }
        } catch (e) {
          console.error('❌ Ошибка загрузки из localStorage:', e);
        }
      }

      if (Object.keys(answersToSubmit).length === 0) {
        console.error('❌ Нет ответов для отправки');
        clientLogger.error('❌ Нет ответов для отправки - блокируем вызов API', {
          answersToSubmitKeys: Object.keys(answersToSubmit),
          answersToSubmitCount: Object.keys(answersToSubmit).length,
          answersInState: Object.keys(answers).length,
        });
        if (isMountedRef.current) {
          setError('Нет ответов для отправки. Пожалуйста, пройдите анкету.');
          // ИСПРАВЛЕНО: Устанавливаем state, ref синхронизируется автоматически через useEffect
          setIsSubmitting(false);
        }
        return;
      }

      // ВАЖНО: Логируем все ответы перед формированием массива
      clientLogger.log('📝 Формирование answerArray из answersToSubmit:', {
        answersToSubmitKeys: Object.keys(answersToSubmit),
        answersToSubmitCount: Object.keys(answersToSubmit).length,
        answersToSubmitEntries: Object.entries(answersToSubmit).slice(0, 5).map(([k, v]) => ({
          key: k,
          keyType: typeof k,
          value: v,
          valueType: typeof v,
          isArray: Array.isArray(v),
        })),
      });

      const answerArray = Object.entries(answersToSubmit)
        .filter(([questionId, value]) => {
          // ВАЖНО: Фильтруем только валидные ответы
          // Игнорируем ответы с questionId = -1 (метаданные позиции)
          const qId = parseInt(questionId, 10);
          if (isNaN(qId) || qId <= 0) {
            clientLogger.warn('⚠️ Пропущен невалидный questionId:', {
              questionId,
              value,
              parsed: qId,
            });
            return false;
          }
          // ВАЖНО: Пустые строки и null - это валидные ответы (пользователь может намеренно не отвечать)
          // Игнорируем только undefined, так как это означает отсутствие ответа
          if (value === undefined) {
            clientLogger.warn('⚠️ Пропущен ответ с undefined:', {
              questionId: qId,
              value,
            });
            return false;
          }
          // null и пустая строка - это валидные ответы, сохраняем их
          return true;
        })
        .map(([questionId, value]) => {
          const isArray = Array.isArray(value);
          const qId = parseInt(questionId, 10);
          // ВАЖНО: Сохраняем все ответы, включая пустые строки и null
          // Пустая строка - это валидный ответ (пользователь может намеренно не отвечать)
          return {
            questionId: qId,
            // ВАЖНО: Преобразуем null в undefined для совместимости с API
            // null и пустая строка - это валидные ответы
            answerValue: isArray ? undefined : (value === null ? undefined : (value as string)),
            answerValues: isArray ? (value as string[]) : undefined,
          };
        });

      clientLogger.log('📤 Отправка ответов на сервер:', {
        questionnaireId: questionnaire.id,
        answersCount: answerArray.length,
        answerArrayQuestionIds: answerArray.map(a => a.questionId),
        answerArraySample: answerArray.slice(0, 5),
      });
      
      // ВАЖНО: Отправляем критичный лог на сервер (неблокирующе)
      const currentInitDataForLog2 = typeof window !== 'undefined' ? window.Telegram?.WebApp?.initData : null;
      if (currentInitDataForLog2) {
        fetch('/api/logs', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Telegram-Init-Data': currentInitDataForLog2,
          },
          body: JSON.stringify({
            level: 'info',
            message: '📤 Отправка ответов на сервер',
            context: {
              timestamp: new Date().toISOString(),
              questionnaireId: questionnaire.id,
              answersCount: answerArray.length,
              answerArrayQuestionIds: answerArray.map(a => a.questionId),
            },
            url: typeof window !== 'undefined' ? window.location.href : undefined,
          }),
        }).catch(() => {}); // Игнорируем ошибки логирования
      }
      
      // ВАЖНО: Проверяем, что answerArray не пустой
      if (answerArray.length === 0) {
        clientLogger.error('❌ answerArray пустой после фильтрации - блокируем вызов API', {
          answersToSubmitCount: Object.keys(answersToSubmit).length,
          answerArrayLength: answerArray.length,
        });
        if (isMountedRef.current) {
          setError('Нет валидных ответов для отправки. Пожалуйста, пройдите анкету.');
          // ИСПРАВЛЕНО: Устанавливаем state, ref синхронизируется автоматически через useEffect
          setIsSubmitting(false);
        }
        return;
      }

      let result: any;
      try {
        // ВАЖНО: Логируем перед вызовом API
        clientLogger.log('📤 Вызываем api.submitAnswers:', {
          questionnaireId: questionnaire.id,
          answersCount: answerArray.length,
          answerQuestionIds: answerArray.map(a => a.questionId),
          answerArraySample: answerArray.slice(0, 3),
        });
        
        // ВАЖНО: Проверяем, что initData доступен перед вызовом API
        const currentInitData = typeof window !== 'undefined' ? window.Telegram?.WebApp?.initData : null;
        clientLogger.log('🔍 Проверка initData перед вызовом API:', {
          hasInitData: !!currentInitData,
          initDataLength: currentInitData?.length || 0,
          hasTelegram: typeof window !== 'undefined' && !!window.Telegram,
          hasWebApp: typeof window !== 'undefined' && !!window.Telegram?.WebApp,
        });
        
        if (!currentInitData) {
          clientLogger.error('❌ initData не доступен перед вызовом api.submitAnswers');
          throw new Error('initData не доступен. Пожалуйста, обновите страницу.');
        }
        
        // ВАЖНО: Логируем непосредственно перед вызовом API
        clientLogger.log('🚀 Вызываем api.submitAnswers СЕЙЧАС:', {
          questionnaireId: questionnaire.id,
          answersCount: answerArray.length,
          hasInitData: !!currentInitData,
          answerQuestionIds: answerArray.map(a => a.questionId),
        });
        
        // ВАЖНО: Логируем на сервер перед вызовом API (неблокирующе)
        if (currentInitData) {
          fetch('/api/logs', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Telegram-Init-Data': currentInitData,
            },
            body: JSON.stringify({
              level: 'info',
              message: '🚀 About to call api.submitAnswers',
              context: {
                questionnaireId: questionnaire.id,
                answersCount: answerArray.length,
                answerQuestionIds: answerArray.map(a => a.questionId),
                timestamp: new Date().toISOString(),
              },
              url: typeof window !== 'undefined' ? window.location.href : undefined,
            }),
          }).catch(() => {}); // Игнорируем ошибки логирования
        }
        
        result = await api.submitAnswers({
          questionnaireId: questionnaire.id,
          answers: answerArray,
        });
        
        // ВАЖНО: Логируем на сервер после получения ответа (неблокирующе)
        if (currentInitData) {
          fetch('/api/logs', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Telegram-Init-Data': currentInitData,
            },
            body: JSON.stringify({
              level: result?.profile?.id ? 'info' : 'error',
              message: result?.profile?.id ? '✅ api.submitAnswers completed with profile' : '❌ api.submitAnswers completed without profile',
              context: {
                hasResult: !!result,
                hasProfile: !!result?.profile,
                profileId: result?.profile?.id,
                resultKeys: result ? Object.keys(result) : [],
                timestamp: new Date().toISOString(),
              },
              url: typeof window !== 'undefined' ? window.location.href : undefined,
            }),
          }).catch(() => {}); // Игнорируем ошибки логирования
        }
        
        // ВАЖНО: Логируем сразу после получения ответа
        clientLogger.log('📥 Получен ответ от api.submitAnswers:', {
          hasResult: !!result,
          resultType: typeof result,
          resultKeys: result ? Object.keys(result) : [],
        });
        
        clientLogger.log('✅ Ответы отправлены, профиль создан:', {
          result,
          success: result?.success,
          hasResult: !!result,
          resultType: typeof result,
          resultKeys: result ? Object.keys(result) : [],
          resultString: JSON.stringify(result).substring(0, 200),
          profileId: result?.profile?.id,
        });
        
        // ВАЖНО: Проверяем, что профиль действительно был создан
        // Если профиль не был создан, не продолжаем редирект
        if (!result?.profile?.id) {
          console.error('❌ КРИТИЧЕСКАЯ ОШИБКА: Профиль не был создан после отправки ответов:', {
            result,
            hasProfile: !!result?.profile,
            profileId: result?.profile?.id,
            resultKeys: result ? Object.keys(result) : [],
          });
          clientLogger.error('❌ Профиль не был создан после отправки ответов', {
            result,
            hasProfile: !!result?.profile,
            profileId: result?.profile?.id,
          });
          
          // ВАЖНО: Очищаем флаг quiz_just_submitted, чтобы не происходил редирект на /plan без профиля
          // Это предотвратит редирект на первый экран при следующей загрузке страницы
          if (typeof window !== 'undefined') {
            try {
              sessionStorage.removeItem('quiz_just_submitted');
              clientLogger.log('✅ Флаг quiz_just_submitted очищен, так как профиль не был создан');
            } catch (storageError) {
              clientLogger.warn('⚠️ Не удалось очистить флаг quiz_just_submitted:', storageError);
            }
          }
          
          // Не продолжаем редирект, если профиль не создан
          if (isMountedRef.current) {
            setError('Не удалось создать профиль. Пожалуйста, попробуйте еще раз.');
            setFinalizeError('Не удалось создать профиль');
            // ИСПРАВЛЕНО: Устанавливаем state, ref синхронизируется автоматически через useEffect
            setIsSubmitting(false);
            setFinalizing(false);
          }
          return;
        }
        
        // ВАЖНО: Очищаем кэш профиля после успешного создания, чтобы при редиректе на /plan
        // профиль загрузился заново из БД, а не из старого кэша
        if (typeof window !== 'undefined') {
          try {
            // Очищаем кэш профиля в sessionStorage
            sessionStorage.removeItem('profile_check_cache');
            sessionStorage.removeItem('profile_check_cache_timestamp');
            clientLogger.log('✅ Кэш профиля очищен после создания профиля');
          } catch (cacheError) {
            clientLogger.warn('⚠️ Не удалось очистить кэш профиля:', cacheError);
          }
        }
      } catch (submitError: any) {
        // ИСПРАВЛЕНО: Логируем ошибку более детально и НЕ продолжаем редирект, если профиль не создан
        console.error('❌ КРИТИЧЕСКАЯ ОШИБКА при отправке ответов:', {
          error: submitError,
          message: submitError?.message,
          status: submitError?.status,
          stack: submitError?.stack,
          questionnaireId: questionnaire.id,
          answersCount: answerArray.length,
        });
        clientLogger.error('❌ Ошибка при отправке ответов:', {
          error: submitError,
          message: submitError?.message,
          status: submitError?.status,
          stack: submitError?.stack?.substring(0, 500),
          questionnaireId: questionnaire.id,
          answersCount: answerArray.length,
          errorName: submitError?.name,
          errorType: typeof submitError,
        });
        
        // ВАЖНО: Логируем на сервер для диагностики (неблокирующе)
        const currentInitDataForError = typeof window !== 'undefined' ? window.Telegram?.WebApp?.initData : null;
        if (currentInitDataForError) {
          fetch('/api/logs', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Telegram-Init-Data': currentInitDataForError,
            },
            body: JSON.stringify({
              level: 'error',
              message: `Error in submitAnswers: ${submitError?.message || 'Unknown error'}`,
              context: {
                error: submitError?.message || String(submitError),
                status: submitError?.status,
                questionnaireId: questionnaire.id,
                answersCount: answerArray.length,
                stack: submitError?.stack?.substring(0, 500),
              },
              url: typeof window !== 'undefined' ? window.location.href : undefined,
            }),
          }).catch(() => {}); // Игнорируем ошибки логирования
        }
        
        // Если это не дубликат и не временная ошибка сети, показываем ошибку пользователю
        const isDuplicate = submitError?.message?.includes('duplicate') || 
                           submitError?.message?.includes('already submitted') ||
                           submitError?.status === 409;
        const isNetworkError = submitError?.message?.includes('fetch') || 
                              submitError?.message?.includes('network') ||
                              !submitError?.status;
        
        if (isDuplicate) {
          clientLogger.log('⚠️ Обнаружена повторная отправка (дубликат), проверяем наличие профиля');
          
          // Проверяем, существует ли профиль, даже если это дубликат
          try {
            const profileCheck = await api.getCurrentProfile() as any;
            if (profileCheck && profileCheck.id) {
              // Профиль существует - продолжаем редирект
              clientLogger.log('✅ Профиль существует при дубликате, продолжаем редирект');
              result = { success: true, profile: profileCheck, isDuplicate: true, error: submitError?.message };
            } else {
              // Профиль не существует - это странно для дубликата, но показываем ошибку и очищаем флаг
              clientLogger.error('❌ Профиль не существует при дубликате отправки');
              
              // ВАЖНО: Очищаем флаг quiz_just_submitted, чтобы не происходил редирект на /plan без профиля
              if (typeof window !== 'undefined') {
                try {
                  sessionStorage.removeItem('quiz_just_submitted');
                  clientLogger.log('✅ Флаг quiz_just_submitted очищен, так как профиль не найден при дубликате');
                } catch (storageError) {
                  clientLogger.warn('⚠️ Не удалось очистить флаг quiz_just_submitted:', storageError);
                }
              }
              
              if (isMountedRef.current) {
                setError('Обнаружена повторная отправка, но профиль не найден. Пожалуйста, попробуйте еще раз.');
                // ИСПРАВЛЕНО: Устанавливаем state, ref синхронизируется автоматически через useEffect
                setIsSubmitting(false);
              }
              return;
            }
          } catch (profileCheckError) {
            // Не удалось проверить профиль - для дубликата продолжаем редирект (профиль мог быть создан ранее)
            clientLogger.warn('⚠️ Не удалось проверить профиль при дубликате, продолжаем редирект');
            result = { success: true, isDuplicate: true, error: submitError?.message };
          }
        } else if (isNetworkError) {
          // Ошибка сети - проверяем, был ли профиль создан, перед редиректом
          clientLogger.warn('⚠️ Ошибка сети при отправке, проверяем наличие профиля перед редиректом');
          
          // Пытаемся проверить, был ли профиль создан, делая запрос к API
          try {
            const profileCheck = await api.getCurrentProfile() as any;
            if (profileCheck && profileCheck.id) {
              // Профиль существует - продолжаем редирект
              clientLogger.log('✅ Профиль существует после ошибки сети, продолжаем редирект');
              result = { success: true, profile: profileCheck, error: submitError?.message };
            } else {
              // Профиль не существует - показываем ошибку и очищаем флаг
              clientLogger.error('❌ Профиль не был создан после ошибки сети');
              
              // ВАЖНО: Очищаем флаг quiz_just_submitted, чтобы не происходил редирект на /plan без профиля
              if (typeof window !== 'undefined') {
                try {
                  sessionStorage.removeItem('quiz_just_submitted');
                  clientLogger.log('✅ Флаг quiz_just_submitted очищен, так как профиль не был создан после ошибки сети');
                } catch (storageError) {
                  clientLogger.warn('⚠️ Не удалось очистить флаг quiz_just_submitted:', storageError);
                }
              }
              
              if (isMountedRef.current) {
                setError('Ошибка сети при отправке ответов. Профиль не был создан. Пожалуйста, попробуйте еще раз.');
                // ИСПРАВЛЕНО: Устанавливаем state, ref синхронизируется автоматически через useEffect
                setIsSubmitting(false);
              }
              return;
            }
          } catch (profileCheckError) {
            // Не удалось проверить профиль - показываем ошибку
            clientLogger.error('❌ Не удалось проверить наличие профиля после ошибки сети', profileCheckError);
            if (isMountedRef.current) {
              setError('Ошибка сети при отправке ответов. Не удалось проверить создание профиля. Пожалуйста, попробуйте еще раз.');
              // ИСПРАВЛЕНО: Устанавливаем state, ref синхронизируется автоматически через useEffect
              setIsSubmitting(false);
            }
            return;
          }
        } else {
          // Другая ошибка - проверяем, не является ли это ошибкой создания профиля (500)
          // Если это ошибка 500, проверяем, был ли профиль создан несмотря на ошибку
          const isProfileCreationError = submitError?.status === 500 && 
                                        (submitError?.message?.includes('Profile was not created') ||
                                         submitError?.message?.includes('profile') ||
                                         submitError?.message?.includes('Profile'));
          
          if (isProfileCreationError) {
            clientLogger.warn('⚠️ Ошибка создания профиля (500), проверяем наличие профиля');
            
            // Проверяем, был ли профиль создан, несмотря на ошибку
            try {
              const profileCheck = await api.getCurrentProfile() as any;
              if (profileCheck && profileCheck.id) {
                // Профиль существует - продолжаем редирект
                clientLogger.log('✅ Профиль существует после ошибки создания, продолжаем редирект');
                result = { success: true, profile: profileCheck, error: submitError?.message };
              } else {
                // Профиль не существует - показываем ошибку и очищаем флаг
                clientLogger.error('❌ Профиль не был создан после ошибки 500');
                
                // ВАЖНО: Очищаем флаг quiz_just_submitted, чтобы не происходил редирект на /plan без профиля
                if (typeof window !== 'undefined') {
                  try {
                    sessionStorage.removeItem('quiz_just_submitted');
                    clientLogger.log('✅ Флаг quiz_just_submitted очищен, так как профиль не был создан после ошибки 500');
                  } catch (storageError) {
                    clientLogger.warn('⚠️ Не удалось очистить флаг quiz_just_submitted:', storageError);
                  }
                }
                
                if (isMountedRef.current) {
                  setError('Не удалось создать профиль. Пожалуйста, попробуйте еще раз.');
                  // ИСПРАВЛЕНО: Устанавливаем state, ref синхронизируется автоматически через useEffect
                  setIsSubmitting(false);
                }
                return;
              }
            } catch (profileCheckError) {
              // Не удалось проверить профиль - показываем ошибку
              clientLogger.error('❌ Не удалось проверить наличие профиля после ошибки 500', profileCheckError);
              if (isMountedRef.current) {
                setError('Ошибка при создании профиля. Пожалуйста, попробуйте еще раз.');
                // ИСПРАВЛЕНО: Устанавливаем state, ref синхронизируется автоматически через useEffect
                setIsSubmitting(false);
              }
              return;
            }
          } else {
            // Другая ошибка - проверяем, был ли профиль создан, перед показом ошибки
            // ВАЖНО: Флаг quiz_just_submitted уже установлен, не очищаем его
            // Это защита от редиректа на первый экран, даже если произошла ошибка
            clientLogger.warn('⚠️ Другая ошибка при отправке ответов, проверяем наличие профиля');
            
            // Проверяем, был ли профиль создан, несмотря на ошибку
            try {
              const profileCheck = await api.getCurrentProfile() as any;
              if (profileCheck && profileCheck.id) {
                // Профиль существует - продолжаем редирект, несмотря на ошибку
                clientLogger.log('✅ Профиль существует после другой ошибки, продолжаем редирект');
                result = { success: true, profile: profileCheck, error: submitError?.message };
                // Продолжаем выполнение - редирект произойдет ниже
              } else {
                // Профиль не существует - показываем ошибку и очищаем флаг quiz_just_submitted
                // Это предотвратит редирект на /plan без профиля и редирект на первый экран
                clientLogger.error('❌ Профиль не был создан после другой ошибки');
                
                // ВАЖНО: Очищаем флаг quiz_just_submitted, чтобы не происходил редирект на /plan без профиля
                if (typeof window !== 'undefined') {
                  try {
                    sessionStorage.removeItem('quiz_just_submitted');
                    clientLogger.log('✅ Флаг quiz_just_submitted очищен, так как профиль не был создан после ошибки');
                  } catch (storageError) {
                    clientLogger.warn('⚠️ Не удалось очистить флаг quiz_just_submitted:', storageError);
                  }
                }
                
                if (isMountedRef.current) {
                  setError(submitError?.message || 'Ошибка отправки ответов. Пожалуйста, попробуйте еще раз.');
                  // ИСПРАВЛЕНО: Устанавливаем state, ref синхронизируется автоматически через useEffect
                  setIsSubmitting(false);
                }
                return;
              }
            } catch (profileCheckError) {
              // Не удалось проверить профиль - показываем ошибку, но НЕ очищаем флаг
              clientLogger.error('❌ Не удалось проверить наличие профиля после другой ошибки', profileCheckError);
              if (isMountedRef.current) {
                setError(submitError?.message || 'Ошибка отправки ответов. Пожалуйста, попробуйте еще раз.');
                // ИСПРАВЛЕНО: Устанавливаем state, ref синхронизируется автоматически через useEffect
                setIsSubmitting(false);
              }
              // ВАЖНО: НЕ очищаем флаг quiz_just_submitted - он будет очищен только после успешного редиректа
              return;
            }
          }
        }
      }
      
      // ВАЖНО: При перепрохождении анкеты НЕ устанавливаем флаг is_retaking_quiz в localStorage
      // Флаг должен быть очищен после успешной отправки, чтобы при следующем заходе показывалась обычная анкета
      // ВАЖНО: Очищаем флаг ПЕРЕД редиректом, чтобы при возврате на /quiz не показывался экран "что хотите изменить?"
      try {
        if (typeof window !== 'undefined') {
          // Очищаем флаги перепрохождения независимо от isRetakingQuiz, чтобы избежать показа экрана "что хотите изменить?" после редиректа
          localStorage.removeItem('is_retaking_quiz');
          localStorage.removeItem('full_retake_from_home');
          clientLogger.log('✅ Флаги перепрохождения очищены после успешной отправки ответов');
        }
      } catch (storageError) {
        clientLogger.warn('⚠️ Ошибка при очистке localStorage (некритично):', storageError);
      }
      
      // Если это дубликат отправки, все равно перенаправляем пользователя
      if (result?.isDuplicate) {
        clientLogger.log('⚠️ Обнаружена повторная отправка, перенаправляем на результаты...');
      }
      
      // ВАЖНО: НЕ очищаем прогресс (ответы) сразу после отправки!
      // Ответы нужны для генерации плана, они будут удалены только после успешной генерации
      // ВАЖНО: НЕ очищаем localStorage и НЕ сбрасываем состояния ДО редиректа,
      // чтобы избежать перерендера и показа первого экрана анкеты
      // Очистка будет выполнена после редиректа или на странице /plan
      
      // ВАЖНО: Устанавливаем loading = false ПЕРЕД генерацией плана, чтобы скрыть лоадер "Загрузка анкеты..."
      // Лоадер "Создаем ваш план ухода..." уже показывается через isSubmitting = true
      if (isMountedRef.current) {
        setLoading(false);
      }
      
      // ИСПРАВЛЕНО: Устанавливаем флаг quiz_just_submitted ДО генерации плана
      // Это защита на случай, если генерация плана займет время или произойдет ошибка
      // Флаг предотвратит редирект на первый экран анкеты при возврате на /quiz
      if (typeof window !== 'undefined') {
        try {
          sessionStorage.setItem('quiz_just_submitted', 'true');
          // ОПТИМИЗАЦИЯ: Очищаем кэш профиля, чтобы новый профиль был доступен сразу после создания
          sessionStorage.removeItem('profile_check_cache');
          sessionStorage.removeItem('profile_check_cache_timestamp');
          clientLogger.log('✅ Флаг quiz_just_submitted установлен ДО генерации плана');
        } catch (storageError) {
          clientLogger.warn('⚠️ Не удалось установить флаг quiz_just_submitted:', storageError);
        }
      }
      
      // ИСПРАВЛЕНО: Генерируем план ПЕРЕД редиректом, чтобы план был готов
      // Это критично, так как после редиректа код не выполняется
      clientLogger.log('🔍 Проверка result перед генерацией плана:', {
        result,
        success: result?.success,
        hasResult: !!result,
        resultKeys: result ? Object.keys(result) : [],
      });
      
      // ИСПРАВЛЕНО: Проверяем, нужно ли генерировать план
      // ApiResponse.success() возвращает объект с данными напрямую
      // В /api/questionnaire/answers возвращается {success: true, profile: {...}, answersCount: number}
      // Проверяем наличие result, отсутствие поля error и что success не false
      // result может быть просто объектом с данными, поэтому проверяем отсутствие ошибки
      // ВАЖНО: Также проверяем, что профиль существует
      const hasProfileId = result?.profile?.id;
      const shouldGeneratePlan = result && !result.error && result.success !== false && hasProfileId;
      
      // ИСПРАВЛЕНО: Показываем лоадер СРАЗУ после отправки ответов, ДО генерации плана
      // Это гарантирует, что пользователь увидит экран "Подбираем персональный уход" во время генерации
      // ВАЖНО: Устанавливаем isSubmitting ДО проверки shouldGeneratePlan, чтобы лоадер показался сразу
      if (isMountedRef.current) {
        setIsSubmitting(true);
        clientLogger.log('🔄 Показываем лоадер ДО генерации плана');
      }
      
      // Логируем для диагностики (включая отправку на сервер)
      const logData = {
        hasResult: !!result,
        hasError: !!result?.error,
        success: result?.success,
        successType: typeof result?.success,
        hasProfileId,
        profileId: result?.profile?.id,
        shouldGeneratePlan,
        resultKeys: result ? Object.keys(result) : [],
        resultPreview: result ? JSON.stringify(result).substring(0, 300) : 'null',
      };
      clientLogger.log('🔍 Проверка shouldGeneratePlan:', logData);
      
      // ВАЖНО: Отправляем лог на сервер для диагностики (неблокирующе)
      const logPromise = (async () => {
        try {
          const currentInitData = await getInitData();
          if (currentInitData) {
            await fetch('/api/logs', {
              method: 'POST',
              headers: { 
                'Content-Type': 'application/json',
                'X-Telegram-Init-Data': currentInitData,
              },
              body: JSON.stringify({
                level: 'info',
                message: 'shouldGeneratePlan check result',
                context: logData,
              }),
            }).catch(() => {});
          }
        } catch (logError) {
          // Игнорируем ошибки логирования
        }
      })();
      
      // ВАЖНО: Генерация плана теперь происходит на бэкенде в submitAnswers
      // Не нужно генерировать план на клиенте - просто редиректим на /plan?state=generating
      clientLogger.log('✅ Профиль создан, генерация плана запущена на бэкенде, редиректим на /plan?state=generating');
      
      // ВАЖНО: Очищаем флаги перепрохождения ПЕРЕД редиректом, чтобы при возврате на /quiz не показывался экран "что хотите изменить?"
      try {
        if (typeof window !== 'undefined') {
          localStorage.removeItem('is_retaking_quiz');
          localStorage.removeItem('full_retake_from_home');
          clientLogger.log('✅ Флаги перепрохождения очищены перед редиректом на /plan');
        }
      } catch (storageError) {
        clientLogger.warn('⚠️ Ошибка при очистке localStorage перед редиректом (некритично):', storageError);
      }
      
      // Устанавливаем этап "done" перед редиректом
      if (isMountedRef.current) {
        setFinalizingStep('done');
      }
      
      // Небольшая задержка для видимости этапа "done"
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Редирект на страницу плана с состоянием generating
      clientLogger.log('🔄 Редирект на /plan?state=generating', {
        hasResult: !!result,
        resultSuccess: result?.success,
        hasError: !!result?.error,
        answersCount: Object.keys(answers).length,
      });
      
      // ИСПРАВЛЕНО: Логируем на сервер перед редиректом для диагностики
      try {
        const currentInitData = await getInitData();
        if (currentInitData) {
          fetch('/api/logs', {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'X-Telegram-Init-Data': currentInitData,
            },
            body: JSON.stringify({
              level: 'info',
              message: 'Redirecting to /plan after submitAnswers',
              context: {
                hasResult: !!result,
                resultSuccess: result?.success,
                hasError: !!result?.error,
                answersCount: Object.keys(answers).length,
                timestamp: new Date().toISOString(),
              },
            }),
          }).catch(() => {});
        }
      } catch (logError) {
        // Игнорируем ошибки логирования
      }
      
      // ИСПРАВЛЕНО: Лоадер уже показан выше (isSubmitting = true установлен ДО генерации плана)
      // Теперь просто редиректим на /plan после того, как план готов
      // ВАЖНО: Редирект должен произойти после готовности плана
      // Это предотвращает перерендер компонента и показ первого экрана анкеты
      // ИСПРАВЛЕНО: Добавляем небольшую задержку перед редиректом, чтобы лоадер был виден
      // И устанавливаем isMountedRef.current = false только непосредственно перед редиректом
      // Закрываем лоадер финализации перед редиректом
      if (isMountedRef.current) {
        setFinalizing(false);
        setIsSubmitting(false);
      }
      
      if (typeof window !== 'undefined') {
        try {
          // ИСПРАВЛЕНО: Устанавливаем isMountedRef.current = false только непосредственно перед редиректом
          // Это гарантирует, что лоадер успеет показаться
          isMountedRef.current = false;
          
          // Редирект на страницу плана с состоянием generating
          // ВАЖНО: Используем window.location.replace вместо href, чтобы избежать проблем с историей
          clientLogger.log('🔄 Редирект на /plan?state=generating после показа лоадера');
          window.location.replace('/plan?state=generating');
          // После редиректа код не должен выполняться, но на всякий случай выходим
          return;
        } catch (redirectError) {
          console.error('❌ Ошибка при редиректе:', redirectError);
          // Если редирект не сработал, пробуем через href (не используем router после размонтирования)
          try {
            window.location.href = '/plan';
            return;
          } catch (hrefError) {
            console.error('❌ Все методы редиректа не сработали:', hrefError);
            if (isMountedRef.current) {
              setIsSubmitting(false); // Сбрасываем лоадер только если редирект не сработал
            }
          }
        }
      } else {
        // SSR режим - используем window.location вместо router после размонтирования
        try {
          if (typeof window !== 'undefined') {
            (window as Window).location.replace('/plan');
            return;
          }
        } catch (redirectError) {
          console.error('❌ Ошибка при редиректе (SSR):', redirectError);
        }
      }
    } catch (err: any) {
      // ВАЖНО: Все операции должны быть безопасными, чтобы не выбрасывать новые ошибки
      // Закрываем лоадер финализации при любой ошибке
      if (isMountedRef.current) {
        setFinalizing(false);
        setIsSubmitting(false);
        setFinalizeError(err?.message || 'Произошла ошибка при обработке ответов');
      }
      
      try {
        console.error('❌ Ошибка при отправке ответов:', err);
        console.error('   Error message:', err?.message);
        console.error('   Error stack:', err?.stack);
        console.error('   Error status:', err?.status);
      } catch (logError) {
        // Игнорируем ошибки логирования
      }
      
      // ВАЖНО: Проверяем, был ли профиль создан, перед установкой флага quiz_just_submitted
      // Если профиль не создан, не устанавливаем флаг, чтобы не происходил редирект на /plan без профиля
      let profileExists = false;
      try {
        const profileCheck = await api.getCurrentProfile() as any;
        if (profileCheck && profileCheck.id) {
          profileExists = true;
          clientLogger.log('✅ Профиль существует после ошибки в catch блоке, устанавливаем флаг quiz_just_submitted');
        } else {
          clientLogger.error('❌ Профиль не существует после ошибки в catch блоке, НЕ устанавливаем флаг quiz_just_submitted');
        }
      } catch (profileCheckError) {
        clientLogger.warn('⚠️ Не удалось проверить профиль после ошибки в catch блоке, НЕ устанавливаем флаг quiz_just_submitted');
      }
      
      // ИСПРАВЛЕНО: Устанавливаем флаг в sessionStorage ПЕРЕД редиректом ТОЛЬКО если профиль существует
      if (profileExists && typeof window !== 'undefined') {
        try {
          sessionStorage.setItem('quiz_just_submitted', 'true');
          // ОПТИМИЗАЦИЯ: Очищаем кэш профиля, чтобы новый профиль был доступен сразу после создания
          sessionStorage.removeItem('profile_check_cache');
          sessionStorage.removeItem('profile_check_cache_timestamp');
        } catch (storageError) {
          clientLogger.warn('⚠️ Не удалось установить флаг quiz_just_submitted:', storageError);
        }
      } else {
        // Профиль не существует - очищаем флаг, если он был установлен ранее
        if (typeof window !== 'undefined') {
          try {
            sessionStorage.removeItem('quiz_just_submitted');
            clientLogger.log('✅ Флаг quiz_just_submitted очищен, так как профиль не существует после ошибки');
          } catch (storageError) {
            clientLogger.warn('⚠️ Не удалось очистить флаг quiz_just_submitted:', storageError);
          }
        }
      }
      
      // ВАЖНО: Проверяем, что компонент еще смонтирован перед обновлением состояния
      if (!isMountedRef.current) {
        clientLogger.warn('⚠️ Компонент размонтирован, пропускаем обновление состояния');
        // Все равно пытаемся редиректить, даже если компонент размонтирован
        if (typeof window !== 'undefined') {
          setTimeout(() => {
            try {
              window.location.replace('/plan');
            } catch (e) {
              // Игнорируем ошибки редиректа
            }
          }, 500);
        }
        return;
      }
      
      // ВАЖНО: Вместо показа ошибки продолжаем показывать лоадер и редиректим на /plan
      // Это обеспечивает лучший UX - пользователь видит лоадер, а не экран ошибки
      // План может генерироваться в фоне, даже если отправка ответов вернула ошибку
      try {
        clientLogger.log('⚠️ Ошибка при отправке ответов, но продолжаем показывать лоадер и редиректим на /plan');
        
        // ВАЖНО: Устанавливаем loading = false, чтобы не было бесконечного лоадера "Загрузка анкеты..."
        setIsSubmitting(true); // Показываем лоадер "Создаем ваш план ухода..."
        setLoading(false); // Скрываем лоадер "Загрузка анкеты..."
        
        // Обработка различных типов ошибок - но все равно редиректим
        const errorMessage = err?.message || err?.error || '';
        if (errorMessage.includes('Unauthorized') || errorMessage.includes('401') || errorMessage.includes('initData')) {
          clientLogger.warn('⚠️ Ошибка авторизации, но продолжаем редирект');
        } else if (errorMessage.includes('уже была отправлена') || errorMessage.includes('301') || errorMessage.includes('302') || err?.status === 301 || err?.status === 302) {
          // Ошибка 301/302 - форма уже была отправлена - это нормально, редиректим
          clientLogger.log('✅ Форма уже была отправлена, редиректим на /plan');
        } else {
          // Другие ошибки - логируем, но все равно редиректим
          clientLogger.warn('⚠️ Ошибка при отправке ответов, но продолжаем редирект на /plan:', errorMessage);
        }
      } catch (logError) {
        // Игнорируем ошибки логирования
      }
      
      // ВАЖНО: Устанавливаем loading = false, чтобы скрыть лоадер "Загрузка анкеты..."
      // Продолжаем показывать лоадер "Создаем ваш план ухода..." через isSubmitting
      setIsSubmitting(true); // Показываем лоадер "Создаем ваш план ухода..."
      setLoading(false); // Скрываем лоадер "Загрузка анкеты..."
      
      // ВАЖНО: НЕ устанавливаем setIsSubmitting(false) и НЕ устанавливаем setError
      // Продолжаем показывать лоадер и редиректим на /plan
      // План может генерироваться в фоне, даже если отправка ответов вернула ошибку
      // ИСПРАВЛЕНО: Устанавливаем флаг в sessionStorage ПЕРЕД редиректом
      if (typeof window !== 'undefined') {
        try {
          sessionStorage.setItem('quiz_just_submitted', 'true');
          // ОПТИМИЗАЦИЯ: Очищаем кэш профиля, чтобы новый профиль был доступен сразу после создания
          sessionStorage.removeItem('profile_check_cache');
          sessionStorage.removeItem('profile_check_cache_timestamp');
        } catch (storageError) {
          clientLogger.warn('⚠️ Не удалось установить флаг quiz_just_submitted:', storageError);
        }
      }
      
      // ВАЖНО: Используем setTimeout с проверкой isMountedRef, чтобы избежать React Error #300
      // Сбрасываем флаг монтирования перед редиректом
      isMountedRef.current = false;
      
      if (typeof window !== 'undefined') {
        try {
          setTimeout(() => {
            try {
              // Используем replace вместо href для предотвращения React Error #300
              clientLogger.log('🔄 Редирект на /plan после ошибки');
              window.location.replace('/plan');
            } catch (redirectError) {
              // Если replace не сработал, пробуем href
              try {
                window.location.href = '/plan';
              } catch (hrefError) {
                console.error('❌ Все методы редиректа не сработали:', hrefError);
              }
            }
          }, 1500); // Небольшая задержка, чтобы пользователь увидел лоадер
        } catch (timeoutError) {
          // Если setTimeout не сработал, пробуем сразу
          try {
            window.location.replace('/plan');
          } catch (e) {
            // Игнорируем ошибки
          }
        }
      } else {
        // SSR режим - используем window.location вместо router после размонтирования
        try {
          if (typeof window !== 'undefined') {
            (window as Window).location.replace('/plan');
          }
        } catch (redirectError) {
          // Игнорируем ошибки
        }
      }
    } finally {
      // ИСПРАВЛЕНО: Гарантированно сбрасываем флаг isSubmitting только если компонент смонтирован
      // Ref синхронизируется автоматически через useEffect
      // Это предотвращает блокировку повторных попыток отправки
      if (isMountedRef.current) {
        // Сбрасываем state только если он еще true (не был сброшен в catch блоке)
        // Если state уже false, значит он был сброшен в catch блоке, ничего не делаем
        if (isSubmitting) {
          setIsSubmitting(false);
          clientLogger.log('✅ Флаг isSubmitting сброшен в finally блоке');
        }
      } else {
        // Компонент размонтирован - сбрасываем флаг принудительно
        isSubmittingRef.current = false;
        clientLogger.log('✅ Флаг isSubmittingRef сброшен в finally (компонент размонтирован)');
      }
    }
  }, [questionnaire, answers, isSubmitting, isRetakingQuiz, isMountedRef, clearProgress]);

  // Продолжить с сохранённого места
  const resumeQuiz = () => {
    // КРИТИЧНО: Проверяем флаг quiz_just_submitted ПЕРЕД восстановлением прогресса
    // Это предотвращает редирект на первый экран после отправки ответов
    const justSubmitted = typeof window !== 'undefined' ? sessionStorage.getItem('quiz_just_submitted') === 'true' : false;
    if (justSubmitted) {
      clientLogger.log('⚠️ resumeQuiz: Флаг quiz_just_submitted установлен, пропускаем восстановление прогресса и редиректим на /plan');
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem('quiz_just_submitted');
        initCompletedRef.current = true;
        setLoading(false);
        window.location.replace('/plan');
      }
      return;
    }
    
    if (!savedProgress || !questionnaire) {
      console.error('❌ resumeQuiz: savedProgress or questionnaire is missing', { savedProgress: !!savedProgress, questionnaire: !!questionnaire });
      return;
    }
    
    const initialInfoScreens = INFO_SCREENS.filter(screen => !screen.showAfterQuestionCode);
    
    clientLogger.log('🔄 resumeQuiz: Восстанавливаем прогресс', {
      questionIndex: savedProgress.questionIndex,
      infoScreenIndex: savedProgress.infoScreenIndex,
      answersCount: Object.keys(savedProgress.answers).length,
      initialInfoScreensLength: initialInfoScreens.length,
      currentHasResumed: hasResumed, // Логируем текущее состояние для отладки
    });
    
    // ВАЖНО: Сначала устанавливаем hasResumed и showResumeScreen СИНХРОННО,
    // чтобы предотвратить повторную загрузку прогресса и показ экрана "Вы не завершили анкету"
    // Используем ref для синхронной установки, чтобы асинхронные функции сразу видели новое значение
    hasResumedRef.current = true;
    setHasResumed(true);
    setShowResumeScreen(false); // Устанавливаем сразу, чтобы предотвратить повторное появление экрана
    
    // ВАЖНО: Устанавливаем initCompletedRef, чтобы предотвратить повторную инициализацию
    // после того, как пользователь продолжил анкету
    if (!initCompletedRef.current) {
      initCompletedRef.current = true;
      clientLogger.log('✅ initCompletedRef установлен в resumeQuiz для предотвращения повторной инициализации');
    }
    
    // ВАЖНО: Очищаем localStorage СРАЗУ, чтобы предотвратить повторную загрузку прогресса
    // из loadSavedProgress или loadSavedProgressFromServer
    if (typeof window !== 'undefined') {
      localStorage.removeItem('quiz_progress');
      clientLogger.log('✅ localStorage очищен от quiz_progress');
    }
    
    // ВАЖНО: Сохраняем копию savedProgress перед очисткой, так как мы будем использовать его данные
    const progressToRestore = { ...savedProgress };
    
    // ВАЖНО: Очищаем savedProgress СРАЗУ, чтобы предотвратить показ экрана "Вы не завершили анкету"
    // даже если loadSavedProgressFromServer установит setShowResumeScreen(true) позже
    setSavedProgress(null);
    
    // ИСПРАВЛЕНО: Устанавливаем флаги, чтобы предотвратить повторные вызовы loadSavedProgressFromServer
    // Это критично для Telegram Mini App, где могут быть особенности с рендерингом
    loadProgressInProgressRef.current = true;
    progressLoadInProgressRef.current = true;
    clientLogger.log('🔒 Установлены флаги для предотвращения повторных загрузок прогресса');
    
    // Восстанавливаем прогресс из сохраненной копии
    setAnswers(progressToRestore.answers);
    
    // ВАЖНО: Всегда пропускаем начальные экраны, если пользователь уже начал отвечать на вопросы
    // Если infoScreenIndex указывает на начальный экран, но вопрос уже начался - пропускаем начальные экраны
    if (progressToRestore.infoScreenIndex >= initialInfoScreens.length) {
      // Начальные экраны пройдены, переходим к вопросам
      clientLogger.log('✅ resumeQuiz: Начальные экраны пройдены, переходим к вопросу', progressToRestore.questionIndex);
      setCurrentQuestionIndex(progressToRestore.questionIndex);
      setCurrentInfoScreenIndex(progressToRestore.infoScreenIndex);
    } else if (progressToRestore.questionIndex > 0 || Object.keys(progressToRestore.answers).length > 0) {
      // Пользователь уже начал отвечать, но infoScreenIndex еще на начальных экранах
      // Пропускаем все начальные экраны и переходим к сохранённому вопросу
      clientLogger.log('✅ resumeQuiz: Пропускаем начальные экраны, переходим к вопросу', progressToRestore.questionIndex);
      setCurrentQuestionIndex(progressToRestore.questionIndex);
      setCurrentInfoScreenIndex(initialInfoScreens.length); // Пропускаем все начальные экраны
    } else {
      // Пользователь еще не начал отвечать, начинаем с начальных экранов
      // ВАЖНО: Проверяем флаг quiz_just_submitted перед сбросом currentQuestionIndex
      const justSubmitted = typeof window !== 'undefined' ? sessionStorage.getItem('quiz_just_submitted') === 'true' : false;
      if (justSubmitted) {
        clientLogger.log('⚠️ resumeQuiz: Флаг quiz_just_submitted установлен, пропускаем восстановление прогресса и редиректим на /plan');
        if (typeof window !== 'undefined') {
          sessionStorage.removeItem('quiz_just_submitted');
          window.location.replace('/plan');
        }
        return;
      }
      
      clientLogger.log('✅ resumeQuiz: Начинаем с начальных экранов');
      setCurrentQuestionIndex(0);
      setCurrentInfoScreenIndex(progressToRestore.infoScreenIndex);
    }
    
    clientLogger.log('✅ resumeQuiz: Прогресс восстановлен, hasResumed = true, showResumeScreen = false, savedProgress = null, localStorage очищен');
  };

  // Начать заново
  const startOver = async () => {
    clientLogger.log('🔄 startOver: Начинаем сброс анкеты', {
      currentPath: typeof window !== 'undefined' ? window.location.pathname : 'unknown',
      initCompleted: initCompletedRef.current,
      isStartingOverRef: isStartingOverRef.current,
    });
    
    // ВАЖНО: Устанавливаем флаг ПЕРЕД очисткой прогресса, чтобы предотвратить загрузку прогресса
    // Используем ref для синхронной установки, чтобы асинхронные функции сразу видели новое значение
    isStartingOverRef.current = true;
    setIsStartingOver(true);
    clientLogger.log('🔒 isStartingOverRef установлен в true');
    
    // ВАЖНО: Сбрасываем initCompletedRef, чтобы позволить повторную инициализацию
    // но с правильными флагами (isStartingOverRef = true), чтобы не загружать прогресс
    initCompletedRef.current = false;
    clientLogger.log('🔄 initCompletedRef сброшен для повторной инициализации');
    
    // Очищаем весь прогресс (локальный и серверный)
    await clearProgress();
    clientLogger.log('✅ Прогресс очищен');
    
    // Сбрасываем все состояния полностью
    setAnswers({});
    setCurrentQuestionIndex(0);
    setCurrentInfoScreenIndex(0);
    setShowResumeScreen(false);
    // ВАЖНО: Сбрасываем и state, и ref для hasResumed
    hasResumedRef.current = false;
    setHasResumed(false);
    setSavedProgress(null);
    setPendingInfoScreen(null); // ВАЖНО: очищаем pendingInfoScreen
    setIsRetakingQuiz(false); // Сбрасываем флаг перепрохождения
    setShowRetakeScreen(false); // Сбрасываем экран выбора тем
    
    // ВАЖНО: Убеждаемся, что loading = false, чтобы показать контент анкеты
    // и error = null, чтобы не показывать ошибку
    setLoading(false);
    setError(null);
    
    // Если анкета уже загружена, сразу завершаем инициализацию
    // и сбрасываем флаги, чтобы не вызывать повторную инициализацию
    if (questionnaire) {
      clientLogger.log('✅ Анкета уже загружена, завершаем инициализацию без повторной загрузки');
      initCompletedRef.current = true;
      isStartingOverRef.current = false;
      setIsStartingOver(false);
      clientLogger.log('✅ startOver завершен, анкета уже была загружена');
      return;
    }
    
    // Проверяем путь после всех изменений состояния
    const currentPath = typeof window !== 'undefined' ? window.location.pathname : 'unknown';
    clientLogger.log('✅ Анкета начата заново, весь прогресс очищен, возвращаемся на первый экран', {
      hasResumedRef: hasResumedRef.current,
      isStartingOverRef: isStartingOverRef.current,
      loading: false,
      initCompleted: initCompletedRef.current,
      currentPath,
      questionnaireLoaded: !!questionnaire,
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
  };

  // Лоадер при отправке ответов
  if (isSubmitting) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        flexDirection: 'column',
        gap: '40px',
        background: '#FFFFFF',
        padding: '20px'
      }}>
        {/* Анимированный лоадер */}
        <div style={{
          width: '60px',
          height: '60px',
          border: '3px solid #E5E7EB',
          borderTop: '3px solid #000000',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }}></div>
        
        {/* Заголовок */}
        <div style={{
          fontFamily: "'Manrope', -apple-system, BlinkMacSystemFont, sans-serif",
          fontSize: '24px',
          fontWeight: 700,
          color: '#000000',
          textAlign: 'center',
          lineHeight: '1.3'
        }}>
          Подбираем персональный уход
        </div>
        
        {/* Подзаголовок */}
        <div style={{
          fontFamily: "'Manrope', -apple-system, BlinkMacSystemFont, sans-serif",
          fontSize: '16px',
          color: '#6B7280',
          textAlign: 'center',
          lineHeight: '1.5',
          maxWidth: '320px'
        }}>
          Анализируем ваши ответы и состояние кожи, чтобы собрать план ухода по шагам.
        </div>
        
        {/* Прогресс-бар */}
        <div style={{
          width: '100%',
          maxWidth: '320px',
          height: '4px',
          backgroundColor: '#E5E7EB',
          borderRadius: '2px',
          overflow: 'hidden',
          position: 'relative'
        }}>
          <div style={{
            width: '35%',
            height: '100%',
            backgroundColor: '#000000',
            borderRadius: '2px',
            animation: 'progress 2s ease-in-out infinite'
          }}></div>
        </div>
        
        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
          @keyframes progress {
            0% { width: 30%; }
            50% { width: 45%; }
            100% { width: 30%; }
          }
        `}</style>
      </div>
    );
  }

  // Получаем все вопросы с фильтрацией (мемоизируем для оптимизации)
  // ВАЖНО: все хуки должны вызываться до любых условных return'ов
  const allQuestionsRaw = useMemo(() => {
    try {
    if (!questionnaire) {
      clientLogger.log('⚠️ No questionnaire, allQuestionsRaw is empty');
      return [];
    }
      
      // Защита от ошибок при доступе к groups и questions
      const groups = questionnaire.groups || [];
      const questions = questionnaire.questions || [];
      
      // ИСПРАВЛЕНО: Сохраняем порядок групп и вопросов БЕЗ дополнительной сортировки
      // Groups уже отсортированы по position в API, вопросы внутри групп тоже отсортированы
      // flatMap сохраняет порядок: сначала все вопросы из первой группы, потом из второй и т.д.
      // НЕ сортируем по position, так как это нарушает порядок групп!
      const questionsFromGroups: Question[] = [];
      const seenIds = new Set<number>();
      
      // Проходим по группам в порядке их position (groups уже отсортированы в API)
      groups.forEach((g) => {
        try {
          const groupQuestions = g?.questions || [];
          // Вопросы внутри группы уже отсортированы по position в API
          groupQuestions.forEach((q: Question) => {
            if (q && q.id && !seenIds.has(q.id)) {
              questionsFromGroups.push(q);
              seenIds.add(q.id);
            }
          });
        } catch (err) {
          console.error('❌ Error accessing group questions:', err, g);
        }
      });
      
    // ВАЖНО: Удаляем дубликаты по questionId, сохраняя исходный порядок из API
    // Используем Map для сохранения первого вхождения каждого вопроса
    // ВАЖНО: Сначала добавляем вопросы из groups (они имеют приоритет), затем из questions
    const questionsMap = new Map<number, Question>();
    
    // Сначала добавляем вопросы из groups в порядке их появления (уже отсортированы по группам и position)
    questionsFromGroups.forEach((q: Question) => {
      if (q && q.id && !questionsMap.has(q.id)) {
        questionsMap.set(q.id, q);
      }
    });
    
    // Затем добавляем вопросы из questions (если их еще нет)
    questions.forEach((q: Question) => {
      if (q && q.id && !questionsMap.has(q.id)) {
        questionsMap.set(q.id, q);
      }
    });
    
    // ИСПРАВЛЕНО: НЕ сортируем по position, так как это нарушает порядок групп!
    // Map сохраняет порядок вставки в современных версиях JavaScript
    // Groups уже отсортированы по position в API, вопросы внутри групп тоже отсортированы
    // Сохраняем порядок из Map без дополнительной сортировки
    const raw = Array.from(questionsMap.values());
      
      // Убираем вызов addDebugLog из useMemo, чтобы избежать проблем с хуками
      // Логируем только в консоль
      clientLogger.log('📋 allQuestionsRaw loaded', {
      total: raw.length,
        fromGroups: questionsFromGroups.length,
        fromQuestions: questions.length,
        uniqueQuestionIds: raw.map((q: Question) => q.id),
        duplicatesRemoved: (questionsFromGroups.length + questions.length) - raw.length,
    });
    return raw;
    } catch (err) {
      console.error('❌ Error computing allQuestionsRaw:', err, {
        questionnaire,
        hasGroups: !!questionnaire?.groups,
        hasQuestions: !!questionnaire?.questions,
      });
      return [];
    }
  }, [questionnaire]);
  
  // Фильтруем вопросы на основе ответов (мемоизируем)
  // Если пользователь выбрал пол "мужчина", пропускаем вопрос про беременность/кормление
  // При повторном прохождении исключаем вопросы про пол и возраст (они уже записаны в профиле)
  const allQuestions = useMemo<Question[]>(() => {
    try {
    if (!allQuestionsRaw || allQuestionsRaw.length === 0) return [];
    
    // ИСПРАВЛЕНО: Используем единую функцию filterQuestions вместо дублирующей логики
    return filterQuestions({
      questions: allQuestionsRaw,
      answers,
      savedProgressAnswers: savedProgress?.answers,
      isRetakingQuiz,
      showRetakeScreen,
    });
    } catch (err) {
      console.error('❌ Error computing allQuestions:', err, {
        allQuestionsRawLength: allQuestionsRaw?.length,
        answersKeys: Object.keys(answers || {}),
      });
      // В случае ошибки возвращаем все вопросы из allQuestionsRaw (уже отсортированные)
      return allQuestionsRaw || [];
    }
  }, [allQuestionsRaw, answers, savedProgress?.answers, isRetakingQuiz, showRetakeScreen]);
  
  // Логируем результат фильтрации после вычисления
  useEffect(() => {
    if (allQuestions.length > 0) {
      // Логируем только в консоль, не используем addDebugLog чтобы избежать проблем с хуками
      clientLogger.log('✅ allQuestions after filtering', {
        total: allQuestions.length,
        questionIds: allQuestions.map((q: Question) => q.id),
        questionCodes: allQuestions.map((q: Question) => q.code),
      });
    }
  }, [allQuestions]);

  // ИСПРАВЛЕНО: Обработка edge case - когда allQuestions.length === 0
  // Показываем явное сообщение вместо поломанного UI
  useEffect(() => {
    if (!questionnaire || loading) return;
    
    // ИСПРАВЛЕНО: Если после фильтрации не осталось вопросов, но есть ответы - это проблема
    if (allQuestions.length === 0 && Object.keys(answers).length > 0) {
      clientLogger.error('⚠️ Edge case: allQuestions.length === 0 but answers exist', {
        answersCount: Object.keys(answers).length,
        questionnaireId: questionnaire.id,
        allQuestionsRawLength: questionnaire.groups?.flatMap(g => g.questions || []).length + (questionnaire.questions || []).length,
      });
      // Не показываем ошибку пользователю, просто логируем - возможно это временная ситуация
    }
    
    if (allQuestions.length === 0) return;
    
    // ИСПРАВЛЕНО: Проверяем и корректируем currentQuestionIndex, если он выходит за пределы
    // Это может произойти при неправильно сохраненном прогрессе, после фильтрации вопросов или при первой загрузке
    if (currentQuestionIndex >= allQuestions.length && !isSubmitting && !showResumeScreen) {
      // Если все вопросы отвечены, устанавливаем индекс на последний вопрос
      // Это позволит автоматической отправке сработать корректно
      const correctedIndex = allQuestions.length > 0 ? Math.max(0, allQuestions.length - 1) : 0;
      
      clientLogger.warn('⚠️ currentQuestionIndex выходит за пределы, корректируем', {
        currentQuestionIndex,
        allQuestionsLength: allQuestions.length,
        correctedIndex,
        answersCount: Object.keys(answers).length,
        isSubmitting,
        hasResumed,
        showResumeScreen,
      });
      
      setCurrentQuestionIndex(correctedIndex);
      return;
    }
  }, [questionnaire, allQuestions, currentQuestionIndex, isSubmitting, loading, hasResumed, showResumeScreen, answers]);

  // Корректируем currentQuestionIndex после восстановления прогресса
  // Это важно, потому что после фильтрации вопросов индекс может стать невалидным
  useEffect(() => {
    if (!questionnaire || allQuestions.length === 0) return;
    
    // ИСПРАВЛЕНО: Проверяем, что currentQuestionIndex валиден для текущего allQuestions
    // Это важно после изменения фильтрации (например, после ответа на вопрос про бюджет)
    // Проверяем независимо от hasResumed, так как фильтрация может измениться в любой момент
    if (currentQuestionIndex >= allQuestions.length && !isSubmitting && !showResumeScreen) {
      // Если все вопросы отвечены, устанавливаем индекс на последний вопрос
      // Это позволит автоматической отправке сработать корректно
      const correctedIndex = allQuestions.length > 0 ? Math.max(0, allQuestions.length - 1) : 0;
      
      clientLogger.log('⚠️ currentQuestionIndex выходит за пределы после фильтрации, корректируем', {
        currentQuestionIndex,
        allQuestionsLength: allQuestions.length,
        correctedIndex,
        hasResumed,
        questionIds: allQuestions.map((q: Question) => q.id),
      });
      setCurrentQuestionIndex(correctedIndex);
      return;
    }
    
    // ИСПРАВЛЕНО: Проверяем, что текущий вопрос существует в allQuestions
    // Если вопрос был отфильтрован, корректируем индекс
    const currentQuestionInAllQuestions = allQuestions[currentQuestionIndex];
    if (!currentQuestionInAllQuestions && allQuestions.length > 0) {
      clientLogger.warn('⚠️ Текущий вопрос не найден в allQuestions, корректируем индекс', {
        currentQuestionIndex,
        allQuestionsLength: allQuestions.length,
        allQuestionIds: allQuestions.map((q: Question) => q.id),
      });
      
      // Корректируем на последний валидный индекс
      const correctedIndex = Math.max(0, allQuestions.length - 1);
      setCurrentQuestionIndex(correctedIndex);
      return;
    }
    
    // Также убеждаемся, что мы не на начальных экранах после восстановления
    const initialInfoScreens = INFO_SCREENS.filter(screen => !screen.showAfterQuestionCode);
    if (hasResumed && currentInfoScreenIndex < initialInfoScreens.length && currentQuestionIndex > 0) {
      clientLogger.log('✅ Корректируем infoScreenIndex после восстановления');
      setCurrentInfoScreenIndex(initialInfoScreens.length);
    }
  }, [hasResumed, allQuestions, currentQuestionIndex, questionnaire]); // ИСПРАВЛЕНО: Убрали currentQuestion из зависимостей, используем allQuestions[currentQuestionIndex] внутри

  // При повторном прохождении сразу переходим к вопросам
  // ВАЖНО: Эта логика должна выполняться только один раз при инициализации, а не при каждом рендере
  // Также не должна выполняться, если пользователь продолжает анкету (showResumeScreen был показан)
  // ВАЖНО: Этот useEffect должен быть ВСЕГДА вызван, даже если есть ранние return'ы, чтобы соблюдать порядок хуков
  useEffect(() => {
    // Определяем initialInfoScreens внутри useEffect
    const initialInfoScreens = INFO_SCREENS.filter(screen => !screen.showAfterQuestionCode);
    
    // Пропускаем, если пользователь продолжает анкету (не повторное прохождение)
    // savedProgress или hasResumed означает, что пользователь нажал "Продолжить" и мы не должны сбрасывать состояние
    if (showResumeScreen || savedProgress || hasResumed) {
      return;
    }
    
    // Пропускаем, если уже на вопросах или если нет анкеты
    if (!isRetakingQuiz || !questionnaire || currentInfoScreenIndex >= initialInfoScreens.length) {
      return;
    }
    
    // Пропускаем, если уже не на первом вопросе (пользователь уже начал отвечать)
    // Или если есть сохраненные ответы (пользователь уже отвечал)
    if (currentQuestionIndex > 0 || Object.keys(answers).length > 0) {
      return;
    }
    
    // Получаем все вопросы с фильтрацией
    // ИСПРАВЛЕНО: Добавляем проверку на существование groups и questions
    const groups = questionnaire.groups || [];
    const questions = questionnaire.questions || [];
    const allQuestionsRaw = [
      ...groups.flatMap((g) => g.questions || []),
      ...questions,
    ];
    
    // ИСПРАВЛЕНО: Используем единую функцию filterQuestions вместо дублирующей логики
    // В этом контексте savedProgress уже проверен выше (если он есть, мы return), поэтому он null здесь
    const allQuestions = filterQuestions({
      questions: allQuestionsRaw,
      answers,
      savedProgressAnswers: undefined, // В этом контексте savedProgress всегда null (проверено выше)
      isRetakingQuiz,
      showRetakeScreen,
    });
    
    // ВАЖНО: При полном перепрохождении (isRetakingQuiz && !showRetakeScreen) пропускаем все инфо-экраны
    // Это включает как начальные инфо-экраны, так и инфо-экраны между вопросами
    if (allQuestions.length > 0 && isRetakingQuiz && !showRetakeScreen) {
      // Переходим сразу к первому вопросу, пропуская все начальные инфо-экраны
      const initialInfoScreensCount = INFO_SCREENS.filter(screen => !screen.showAfterQuestionCode).length;
      // ВАЖНО: Всегда устанавливаем currentInfoScreenIndex в initialInfoScreensCount при перепрохождении
      // Это гарантирует, что начальные инфо-экраны не будут показаны
      // ИСПРАВЛЕНО: Используем функциональное обновление, чтобы избежать stale closure
      setCurrentInfoScreenIndex((prev) => {
        if (prev < initialInfoScreensCount) {
          clientLogger.log('✅ Full retake: Setting currentInfoScreenIndex to skip all initial info screens');
          return initialInfoScreensCount;
        }
        return prev;
      });
      // Если currentQuestionIndex = 0 и нет ответов, это начало перепрохождения
      if (currentQuestionIndex === 0 && Object.keys(answers).length === 0) {
        setCurrentQuestionIndex(0);
        setPendingInfoScreen(null); // Очищаем pending info screen
        clientLogger.log('✅ Full retake: Starting from first question, skipping all info screens');
      }
    }
  }, [isRetakingQuiz, questionnaire, currentQuestionIndex, showResumeScreen, savedProgress, hasResumed, answers, showRetakeScreen]); // ИСПРАВЛЕНО: Убрали currentInfoScreenIndex из зависимостей, чтобы избежать бесконечного цикла

  // Разделяем инфо-экраны на начальные (без showAfterQuestionCode) и те, что между вопросами
  const initialInfoScreens = useMemo(() => INFO_SCREENS.filter(screen => !screen.showAfterQuestionCode), []);

  // Определяем, показываем ли мы начальный инфо-экран
  // При повторном прохождении или после восстановления прогресса пропускаем все info screens
  // ВАЖНО: Если hasResumed = true, значит пользователь нажал "Продолжить" и мы не должны показывать начальные экраны
  // Также пропускаем, если пользователь уже начал отвечать (currentQuestionIndex > 0 или есть ответы)
  // ВАЖНО: Если есть savedProgress, значит пользователь должен продолжить, и мы не должны показывать начальные экраны
  const isShowingInitialInfoScreen = useMemo(() => {
    // ИСПРАВЛЕНО: Если пользователь уже продолжил анкету (hasResumedRef), никогда не показываем начальные экраны
    // Это критично для предотвращения бесконечного цикла между экраном продолжения и первым экраном
    if (hasResumedRef.current || hasResumed) {
      return false;
    }
    // Если показывается экран выбора тем при перепрохождении - не показываем начальные экраны
    if (showRetakeScreen && isRetakingQuiz) {
      return false;
    }
    // ИСПРАВЛЕНО: Проверяем showResumeScreen ПЕРВЫМ, чтобы предотвратить показ начальных экранов
    // даже если savedProgress еще не установлен (во время асинхронной загрузки прогресса)
    if (showResumeScreen) {
      return false;
    }
    // ИСПРАВЛЕНО: Если есть сохраненный прогресс (даже если еще не нажали "Продолжить") - не показываем начальные экраны
    // Это предотвращает показ начальных экранов на промежуточных рендерах после resumeQuiz
    // ВАЖНО: Проверяем savedProgress ДО проверки currentInfoScreenIndex, чтобы предотвратить мигание
    if (savedProgress && savedProgress.answers && Object.keys(savedProgress.answers).length > 0) {
      return false;
    }
    // ИСПРАВЛЕНО: Если loading = true, не показываем начальные экраны, чтобы предотвратить мигание
    // во время загрузки прогресса с сервера
    if (loading) {
      return false;
    }
    // ВАЖНО: Если повторное прохождение БЕЗ экрана выбора тем - не показываем начальные экраны
    // Это означает, что пользователь уже выбрал "Пройти всю анкету заново" и оплатил
    if (isRetakingQuiz && !showRetakeScreen) {
      return false;
    }
    // Если currentInfoScreenIndex уже прошел все начальные экраны - не показываем их
    if (currentInfoScreenIndex >= initialInfoScreens.length) {
      return false;
    }
    // Если пользователь уже начал отвечать - не показываем начальные экраны
    if (currentQuestionIndex > 0 || Object.keys(answers).length > 0) {
      return false;
    }
    // Иначе показываем, если currentInfoScreenIndex < initialInfoScreens.length
    const shouldShow = currentInfoScreenIndex < initialInfoScreens.length;
    
    // Логирование для отладки (только в development)
    if (process.env.NODE_ENV === 'development' && shouldShow) {
      clientLogger.log('📺 isShowingInitialInfoScreen: true', {
        currentInfoScreenIndex,
        initialInfoScreensLength: initialInfoScreens.length,
        showResumeScreen,
        showRetakeScreen,
        hasSavedProgress: !!savedProgress,
        hasResumed,
        isRetakingQuiz,
        currentQuestionIndex,
        answersCount: Object.keys(answers).length,
      });
    }
    
    return shouldShow;
  }, [showResumeScreen, showRetakeScreen, savedProgress, hasResumed, isRetakingQuiz, currentQuestionIndex, answers, currentInfoScreenIndex, initialInfoScreens.length, loading]);
  
  const currentInitialInfoScreen = isShowingInitialInfoScreen ? initialInfoScreens[currentInfoScreenIndex] : null;
  
  // Текущий вопрос (показывается после начальных инфо-экранов)
  const currentQuestion = useMemo(() => {
    // Убираем все console.log из useMemo - они могут вызывать проблемы с рендерингом
    // ВАЖНО: При перепрохождении (retake) мы пропускаем info screens,
    // поэтому pendingInfoScreen не должен блокировать отображение вопросов.
    if (isShowingInitialInfoScreen || (pendingInfoScreen && !isRetakingQuiz)) {
      return null;
    }
    if (currentQuestionIndex >= 0 && currentQuestionIndex < allQuestions.length) {
      return allQuestions[currentQuestionIndex];
    }
    return null;
  }, [isShowingInitialInfoScreen, pendingInfoScreen, isRetakingQuiz, currentQuestionIndex, allQuestions]);

  // ВАЖНО: Обновляем ref для submitAnswers, чтобы она была доступна в setTimeout
  useEffect(() => {
    submitAnswersRef.current = submitAnswers;
  }, [submitAnswers]);
  
  // ВАЖНО: Автоматически отправляем ответы когда все вопросы отвечены
  // Этот useEffect должен быть ВСЕГДА вызван, даже если есть ранние return'ы, чтобы соблюдать порядок хуков
  // ВАЖНО: Используем submitAnswersRef вместо submitAnswers в зависимостях, чтобы избежать проблем с порядком хуков
  // ИСПРАВЛЕНО: Убрали проверку !hasResumed, так как она может блокировать отправку после завершения анкеты
  useEffect(() => {
    // Автоматически отправляем ответы, если все вопросы отвечены и ответы есть
    // ИСПРАВЛЕНО: Убрали !hasResumed из условий, чтобы автоотправка работала даже после восстановления прогресса
    if (!autoSubmitTriggeredRef.current && 
        questionnaire && 
        allQuestions.length > 0 && 
        currentQuestionIndex >= allQuestions.length &&
        Object.keys(answers).length > 0 &&
        !isSubmitting &&
        !showResumeScreen &&
        !error &&
        !pendingInfoScreen) { // ИСПРАВЛЕНО: Не запускаем автоотправку, если показывается info screen (кнопка "Получить план" будет вызвать submitAnswers вручную)
      
      clientLogger.log('✅ Все вопросы отвечены, автоматически отправляем ответы через 5 секунд...', {
        currentQuestionIndex,
        allQuestionsLength: allQuestions.length,
        answersCount: Object.keys(answers).length,
        hasPendingInfoScreen: !!pendingInfoScreen,
      });
      autoSubmitTriggeredRef.current = true;
      setAutoSubmitTriggered(true);
      
      // Показываем лоадер 5 секунд перед отправкой
      setIsSubmitting(true);
      
      // Используем setTimeout, чтобы submitAnswers была доступна к моменту выполнения
      // ВАЖНО: Сохраняем ID таймера для очистки при размонтировании
      // ВАЖНО: Используем ref для submitAnswers, чтобы избежать проблем с зависимостями useEffect
      const timeoutId = setTimeout(() => {
        // ИСПРАВЛЕНО: Проверяем, что компонент еще смонтирован, questionnaire существует, и нет активной отправки
        if (isMountedRef.current && submitAnswersRef.current && questionnaire && !isSubmittingRef.current) {
          // ИСПРАВЛЕНО: Устанавливаем флаг перед вызовом, чтобы предотвратить двойную отправку
          isSubmittingRef.current = true;
          // ВАЖНО: Не обновляем состояние после вызова submitAnswers, чтобы избежать React Error #300
          submitAnswersRef.current().catch((err) => {
            console.error('❌ Ошибка при автоматической отправке ответов:', err);
            // ВАЖНО: Не обновляем состояние, если компонент размонтирован
            if (isMountedRef.current) {
              try {
                autoSubmitTriggeredRef.current = false; // Разрешаем повторную попытку
                setAutoSubmitTriggered(false);
                // ИСПРАВЛЕНО: Устанавливаем state, ref синхронизируется автоматически через useEffect
                setIsSubmitting(false);
                setError(err?.message || 'Ошибка отправки ответов');
              } catch (stateError) {
                // Игнорируем ошибки обновления состояния после размонтирования
                clientLogger.warn('⚠️ Не удалось обновить состояние (компонент размонтирован):', stateError);
              }
            }
          });
        } else {
          clientLogger.warn('⚠️ Пропускаем автоматическую отправку: компонент размонтирован или questionnaire отсутствует');
        }
      }, 5000); // 5 секунд лоадера
      
      // Очищаем таймер при размонтировании компонента
      return () => {
        clearTimeout(timeoutId);
      };
    }
  }, [currentQuestionIndex, allQuestions.length, answersCount, questionnaire, isSubmitting, showResumeScreen, autoSubmitTriggered, error, pendingInfoScreen]);

  // ВАЖНО: ранние return'ы должны быть ПОСЛЕ всех хуков
  // Проверяем состояние загрузки, ошибку и наличие анкеты после вызова всех хуков
  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        flexDirection: 'column',
        gap: '16px',
        background: 'linear-gradient(135deg, #F5FFFC 0%, #E8FBF7 100%)'
      }}>
        <div style={{
          width: '48px',
          height: '48px',
          border: '4px solid rgba(10, 95, 89, 0.2)',
          borderTop: '4px solid #0A5F59',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }}></div>
        <div style={{ color: '#0A5F59', fontSize: '16px' }}>Загрузка анкеты...</div>
        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  if (error && !questionnaire) {
    return (
      <div style={{ 
        padding: '20px',
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        background: 'linear-gradient(135deg, #F5FFFC 0%, #E8FBF7 100%)'
      }}>
        <div style={{
          backgroundColor: 'rgba(255, 255, 255, 0.56)',
          backdropFilter: 'blur(28px)',
          borderRadius: '24px',
          padding: '24px',
          maxWidth: '400px',
          textAlign: 'center',
        }}>
          <h1 style={{ color: '#0A5F59', marginBottom: '16px' }}>Ошибка</h1>
          <p style={{ color: '#475467', marginBottom: '24px' }}>
            {error || 'Произошла неизвестная ошибка'}
          </p>
          <button
            onClick={() => {
              setError(null);
              setLoading(true);
              window.location.reload();
            }}
            style={{
              padding: '12px 24px',
              borderRadius: '12px',
              backgroundColor: '#0A5F59',
              color: 'white',
              border: 'none',
              cursor: 'pointer',
              fontSize: '16px',
              fontWeight: 'bold',
            }}
          >
            Обновить страницу
          </button>
        </div>
      </div>
    );
  }

  if (!questionnaire) {
    // Фолбэк, когда анкета ещё не успела загрузиться (например, после холодного старта сервера)
    // Вместо жёсткой ошибки показываем экран "подготовки" с мягким текстом.
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px',
          background: 'linear-gradient(135deg, #F5FFFC 0%, #E8FBF7 100%)',
        }}
      >
        <div
          style={{
            width: '56px',
            height: '56px',
            borderRadius: '50%',
            border: '4px solid rgba(10, 95, 89, 0.15)',
            borderTop: '4px solid #0A5F59',
            animation: 'spin 1s linear infinite',
            marginBottom: '24px',
          }}
        />
        <h1
          style={{
            fontSize: '22px',
            fontWeight: 700,
            color: '#0A5F59',
            marginBottom: '8px',
            textAlign: 'center',
          }}
        >
          Подготавливаем анкету
        </h1>
        <p
          style={{
            fontSize: '14px',
            color: '#475467',
            textAlign: 'center',
            maxWidth: '320px',
            lineHeight: '1.5',
          }}
        >
          Это может занять несколько секунд при первом запуске.
          Если экран не пропадает долго, обновите страницу или напишите в поддержку.
        </p>
        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  // Экран продолжения анкеты
  // Экран выбора тем при повторном прохождении анкеты
  if (showRetakeScreen && isRetakingQuiz) {
    const retakeTopics = getAllTopics();
    
    // Проверяем, оплатил ли пользователь перепрохождение (тема - 49₽, полное - 99₽)
    const hasRetakingPayment = typeof window !== 'undefined' 
      ? localStorage.getItem('payment_retaking_completed') === 'true'
      : false;
    const hasFullRetakePayment = typeof window !== 'undefined'
      ? localStorage.getItem('payment_full_retake_completed') === 'true'
      : false;
    
    clientLogger.log('🔄 Retake screen check:', {
      showRetakeScreen,
      isRetakingQuiz,
      hasRetakingPayment,
      paymentKey: typeof window !== 'undefined' ? localStorage.getItem('payment_retaking_completed') : 'N/A',
    });
    
    const handleTopicSelect = (topic: QuizTopic) => {
      // Проверяем, оплатил ли пользователь перепрохождение темы
      const topicPaymentKey = `payment_topic_${topic.id}_completed`;
      const hasTopicPayment = typeof window !== 'undefined' 
        ? localStorage.getItem(topicPaymentKey) === 'true'
        : false;
      
      if (!hasTopicPayment) {
        clientLogger.log('⚠️ Payment not completed for topic, showing payment gate');
        // PaymentGate будет показан для этой темы
        return;
      }
      
      clientLogger.log('✅ Payment completed for topic, allowing topic selection:', topic.id);
      // Сбрасываем флаг оплаты после выбора темы - каждая тема требует отдельной оплаты
      if (typeof window !== 'undefined') {
        localStorage.removeItem(topicPaymentKey);
        clientLogger.log('🔄 Payment flag cleared - next topic will require new payment');
      }
      // Перенаправляем на страницу обновления по теме только после оплаты
      router.push(`/quiz/update/${topic.id}`);
    };

    const handleFullRetake = () => {
      // Для полного перепрохождения нужна отдельная оплата 99₽
      if (!hasFullRetakePayment) {
        clientLogger.log('⚠️ Full retake payment not completed, showing payment gate');
        // Показываем PaymentGate для полного перепрохождения
        return;
      }

      clientLogger.log('✅ Full retake payment completed, starting full questionnaire reset');

      // Сбрасываем флаг оплаты после использования
      if (typeof window !== 'undefined') {
        localStorage.removeItem('payment_full_retake_completed');
        clientLogger.log('🔄 Full retake payment flag cleared');
      }

      // Полное перепрохождение:
      // - скрываем экран выбора тем
      // - очищаем ответы и сохранённый прогресс
      // - сбрасываем индексы и флаги "продолжить"
      setShowRetakeScreen(false);
      setIsRetakingQuiz(true); // остаёмся в режиме перепрохождения, но с чистой анкетой

      // Отмечаем, что пользователь начинает заново
      setIsStartingOver(true);
      isStartingOverRef.current = true;

      // Полный сброс ответов и прогресса
      setAnswers({});
      setSavedProgress(null);
      setShowResumeScreen(false);
      setHasResumed(false);
      hasResumedRef.current = false;

      autoSubmitTriggeredRef.current = false;
      setAutoSubmitTriggered(false);
      setError(null);

      if (typeof window !== 'undefined') {
        // Очищаем локальный прогресс и флаги перепрохождения
        localStorage.removeItem('quiz_progress');
        localStorage.removeItem('is_retaking_quiz');
        localStorage.removeItem('full_retake_from_home');
      }

      // Начинаем анкету с самого начала
      if (questionnaire) {
        setCurrentInfoScreenIndex(0); // показываем все инфо-экраны заново
        setCurrentQuestionIndex(0);
        setPendingInfoScreen(null);
        clientLogger.log('✅ Full retake: answers and progress cleared, starting from first info screen');
      }
    };

    const retakeScreenContent = (
      <div style={{
        minHeight: '100vh',
        padding: '20px',
        background: 'linear-gradient(135deg, #F5FFFC 0%, #E8FBF7 100%)',
      }}>
        {/* Логотип */}
        <div style={{
          padding: '20px',
          textAlign: 'center',
        }}>
          <button
            onClick={() => router.push('/')}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 0,
              display: 'inline-block',
            }}
          >
          <img
            src="/skiniq-logo.png"
            alt="SkinIQ"
            style={{
              height: '140px',
              marginTop: '8px',
              marginBottom: '8px',
                transition: 'transform 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'scale(1.05)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'scale(1)';
            }}
          />
          </button>
        </div>

        {/* Заголовок */}
        <div style={{
          textAlign: 'center',
          marginBottom: '32px',
        }}>
          <h1 style={{
            fontSize: '28px',
            fontWeight: 'bold',
            color: '#0A5F59',
            marginBottom: '12px',
          }}>
            Что хотите изменить?
          </h1>
          <p style={{
            fontSize: '16px',
            color: '#6B7280',
            lineHeight: '1.6',
          }}>
            Выберите тему, которую хотите обновить, или пройдите анкету полностью
          </p>
        </div>

        {/* Список тем */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          marginBottom: '24px',
        }}>
          {retakeTopics.map((topic) => {
            const topicPaymentKey = `payment_topic_${topic.id}_completed`;
            const hasTopicPayment = typeof window !== 'undefined' 
              ? localStorage.getItem(topicPaymentKey) === 'true'
              : false;
            
            const topicButton = (
              <button
                key={topic.id}
                onClick={() => handleTopicSelect(topic)}
                style={{
                  padding: '20px',
                  borderRadius: '16px',
                  backgroundColor: 'white',
                  border: '1px solid #E5E7EB',
                  textAlign: 'left',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  boxShadow: '0 2px 4px rgba(0, 0, 0, 0.05)',
                  width: '100%',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = '#0A5F59';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(10, 95, 89, 0.15)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = '#E5E7EB';
                  e.currentTarget.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.05)';
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <div style={{
                    fontSize: '32px',
                    width: '48px',
                    height: '48px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    {topic.icon || '📝'}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{
                      fontSize: '18px',
                      fontWeight: '600',
                      color: '#111827',
                      marginBottom: '4px',
                    }}>
                      {topic.title}
                    </div>
                    <div style={{
                      fontSize: '14px',
                      color: '#6B7280',
                    }}>
                      {topic.description}
                    </div>
                  </div>
                  <div style={{
                    fontSize: '24px',
                    color: '#9CA3AF',
                  }}>
                    →
                  </div>
                </div>
              </button>
            );
            
            // Если оплата не пройдена, оборачиваем в PaymentGate
            if (!hasTopicPayment) {
              return (
                <PaymentGate
                  key={topic.id}
                  price={49}
                  isRetaking={true}
                  onPaymentComplete={() => {
                    if (typeof window !== 'undefined') {
                      localStorage.setItem(topicPaymentKey, 'true');
                      // После оплаты разрешаем выбор темы
                      clientLogger.log('✅ Payment completed for topic, allowing selection');
                    }
                  }}
                >
                  {topicButton}
                </PaymentGate>
              );
            }
            
            return topicButton;
          })}
        </div>

        {/* Кнопка полного перепрохождения */}
        {!hasFullRetakePayment ? (
          <PaymentGate
            price={99}
            isRetaking={true}
            onPaymentComplete={() => {
              if (typeof window !== 'undefined') {
                localStorage.setItem('payment_full_retake_completed', 'true');
                // После оплаты разрешаем полное перепрохождение
                setShowRetakeScreen(false);
                // Устанавливаем флаг перепрохождения, чтобы пропустить все info screens
                setIsRetakingQuiz(true);
                // Пропускаем все начальные info screens - переходим сразу к вопросам
                if (questionnaire) {
                  const initialInfoScreens = INFO_SCREENS.filter(screen => !screen.showAfterQuestionCode);
                  setCurrentInfoScreenIndex(initialInfoScreens.length);
                  setCurrentQuestionIndex(0);
                  setPendingInfoScreen(null);
                  clientLogger.log('✅ Full retake payment: Skipping all info screens, starting from first question');
                }
              }
            }}
          >
            <div style={{ width: '100%', marginTop: '8px' }}>
              <button
                style={{
                  width: '100%',
                  padding: '16px',
                  borderRadius: '16px',
                  backgroundColor: 'rgba(255, 255, 255, 0.8)',
                  border: '2px solid #0A5F59',
                  color: '#0A5F59',
                  fontSize: '16px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#0A5F59';
                  e.currentTarget.style.color = 'white';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.8)';
                  e.currentTarget.style.color = '#0A5F59';
                }}
              >
                Пройти всю анкету заново (99 ₽)
              </button>
            </div>
          </PaymentGate>
        ) : (
        <button
          onClick={handleFullRetake}
          style={{
            width: '100%',
            padding: '16px',
            borderRadius: '16px',
            backgroundColor: 'rgba(255, 255, 255, 0.8)',
            border: '2px solid #0A5F59',
            color: '#0A5F59',
            fontSize: '16px',
            fontWeight: '600',
            cursor: 'pointer',
            transition: 'all 0.2s',
            marginTop: '8px',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#0A5F59';
            e.currentTarget.style.color = 'white';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.8)';
            e.currentTarget.style.color = '#0A5F59';
          }}
        >
          Пройти всю анкету заново
        </button>
        )}

        {/* Кнопка отмены */}
        <div style={{ textAlign: 'center', marginTop: '24px' }}>
          <button
            onClick={() => router.push('/plan')}
            style={{
              padding: '12px 24px',
              borderRadius: '12px',
              backgroundColor: 'transparent',
              border: '1px solid #D1D5DB',
              color: '#6B7280',
              fontSize: '14px',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = '#9CA3AF';
              e.currentTarget.style.color = '#111827';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = '#D1D5DB';
              e.currentTarget.style.color = '#6B7280';
            }}
          >
            Отмена
          </button>
        </div>
      </div>
    );

    // Показываем экран выбора тем
    // Каждая тема и кнопка "Пройти всю анкету" обернуты в свой PaymentGate
    return retakeScreenContent;
  }

  // ВАЖНО: Не показываем экран "Вы не завершили анкету", если пользователь нажал "Начать заново"
  // или уже продолжил анкету
  if (showResumeScreen && savedProgress && !isStartingOverRef.current && !hasResumedRef.current) {
    // Получаем все вопросы с фильтрацией
    // ИСПРАВЛЕНО: Добавляем проверку на существование groups и questions
    const allQuestionsRaw = questionnaire ? [
      ...(questionnaire.groups || []).flatMap((g) => g.questions || []),
      ...(questionnaire.questions || []),
    ] : [];
    
    // ИСПРАВЛЕНО: Используем единую функцию filterQuestions вместо дублирующей логики
    // filterQuestions уже использует allAnswers (answers + savedProgress.answers) внутри
    const allQuestions = filterQuestions({
      questions: allQuestionsRaw,
      answers,
      savedProgressAnswers: savedProgress?.answers,
      isRetakingQuiz,
      showRetakeScreen,
    });
    
    // ИСПРАВЛЕНО: Считаем только ответы на вопросы, которые остались в allQuestions после фильтрации
    // Это предотвращает завышение прогресса, когда часть вопросов была отфильтрована (например, pregnancy для мужчин)
    const relevantQuestionIds = new Set(allQuestions.map(q => q.id.toString()));
    const answeredCount = Object.keys(savedProgress.answers).filter(
      questionId => relevantQuestionIds.has(questionId)
    ).length;
    const totalQuestions = allQuestions.length;
    const progressPercent = totalQuestions > 0 ? Math.round((answeredCount / totalQuestions) * 100) : 0;

    return (
      <div style={{ 
        padding: '20px',
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #F5FFFC 0%, #E8FBF7 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <div style={{
          width: '88%',
          maxWidth: '420px',
          backgroundColor: 'rgba(255, 255, 255, 0.58)',
          backdropFilter: 'blur(26px)',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          borderRadius: '44px',
          padding: '36px 28px 32px 28px',
          boxShadow: '0 16px 48px rgba(0, 0, 0, 0.12), 0 8px 24px rgba(0, 0, 0, 0.08)',
        }}>
          <h1 style={{
            fontFamily: "'Satoshi', 'Manrope', -apple-system, BlinkMacSystemFont, sans-serif",
            fontWeight: 700,
            fontSize: '32px',
            lineHeight: '38px',
            color: '#0A5F59',
            margin: '0 0 16px 0',
            textAlign: 'center',
          }}>
            Вы не завершили анкету
          </h1>

          <p style={{
            fontFamily: "'Manrope', -apple-system, BlinkMacSystemFont, sans-serif",
            fontWeight: 400,
            fontSize: '18px',
            lineHeight: '1.5',
            color: '#475467',
            margin: '0 0 24px 0',
            textAlign: 'center',
          }}>
            Продолжите, чтобы получить персональный план ухода
          </p>

          {/* Прогресс */}
          <div style={{
            marginBottom: '28px',
            padding: '16px',
            backgroundColor: 'rgba(10, 95, 89, 0.08)',
            borderRadius: '16px',
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginBottom: '8px',
              fontSize: '14px',
              color: '#0A5F59',
              fontWeight: 600,
            }}>
              <span>Прогресс</span>
              <span>{answeredCount} из {totalQuestions} вопросов</span>
            </div>
            <div style={{
              width: '100%',
              height: '8px',
              backgroundColor: 'rgba(10, 95, 89, 0.2)',
              borderRadius: '4px',
              overflow: 'hidden',
            }}>
              <div style={{
                width: `${progressPercent}%`,
                height: '100%',
                backgroundColor: '#0A5F59',
                transition: 'width 0.3s ease',
              }} />
            </div>
          </div>

          {/* Выгоды */}
          <div style={{
            marginBottom: '28px',
            padding: '0',
          }}>
            <h3 style={{
              fontSize: '16px',
              fontWeight: 600,
              color: '#0A5F59',
              marginBottom: '12px',
            }}>
              Что вы получите:
            </h3>
            {[
              'Персональный план ухода на 12 недель',
              'Рекомендации от косметолога-дерматолога',
              'Точная диагностика типа и состояния кожи',
            ].map((benefit, index) => (
              <div key={index} style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '12px',
                marginBottom: index < 2 ? '12px' : '0',
              }}>
                <div style={{
                  width: '20px',
                  height: '20px',
                  borderRadius: '50%',
                  backgroundColor: '#0A5F59',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  marginTop: '2px',
                }}>
                  <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
                <span style={{
                  fontSize: '15px',
                  color: '#1F2A44',
                  lineHeight: '1.5',
                }}>
                  {String(benefit || '')}
                </span>
              </div>
            ))}
          </div>

          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}>
            <button
              onClick={resumeQuiz}
              style={{
                width: '100%',
                height: '64px',
                background: '#0A5F59',
                color: 'white',
                border: 'none',
                borderRadius: '32px',
                fontFamily: "'Manrope', -apple-system, BlinkMacSystemFont, sans-serif",
                fontWeight: 500,
                fontSize: '19px',
                boxShadow: '0 8px 24px rgba(10, 95, 89, 0.3), 0 4px 12px rgba(10, 95, 89, 0.2)',
                cursor: 'pointer',
              }}
            >
              Продолжить с вопроса {savedProgress.questionIndex + 1} →
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Функция для рендеринга инфо-экрана с поддержкой специальных типов
  const renderInfoScreen = (screen: InfoScreen) => {
    const isTinderScreen = screen.type === 'tinder';
    const isTestimonialsScreen = screen.type === 'testimonials';
    const isComparisonScreen = screen.type === 'comparison';
    const isProductsScreen = screen.type === 'products';

    // Разбиваем subtitle на строки для многострочного отображения
    const subtitleLines = screen.subtitle?.split('\n').filter(line => line.trim()) || [];

    return (
      <div style={{ 
        padding: '20px',
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #F5FFFC 0%, #E8FBF7 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
      }}>
        {/* Логотип на фоне по центру вверху */}
        <div style={{
          position: 'absolute',
          top: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 0,
          opacity: 0.15,
        }}>
          <img
            src="/skiniq-logo.png"
            alt="SkinIQ"
            style={{
              height: '120px',
            }}
          />
        </div>
        <div style={{
          width: '88%',
          maxWidth: isTestimonialsScreen ? '90%' : '420px',
          backgroundColor: 'rgba(255, 255, 255, 0.58)',
          backdropFilter: 'blur(26px)',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          borderRadius: '44px',
          padding: '36px 28px 32px 28px',
          boxShadow: '0 16px 48px rgba(0, 0, 0, 0.12), 0 8px 24px rgba(0, 0, 0, 0.08)',
          position: 'relative',
          zIndex: 1,
          marginTop: '80px',
        }}>
          {/* Изображение */}
          {screen.image && !isTinderScreen && (
            <div style={{
              width: '100%',
              height: '320px',
              borderRadius: '32px 32px 0 0',
              overflow: 'hidden',
              marginBottom: '24px',
            }}>
              <img
                src={screen.image}
                alt={screen.title}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                }}
              />
            </div>
          )}

          {/* Tinder-экран с изображением */}
          {isTinderScreen && screen.image && (
            <div style={{
              width: '100%',
              height: '400px',
              borderRadius: '32px',
              overflow: 'hidden',
              marginBottom: '24px',
              position: 'relative',
            }}>
              <img
                src={screen.image}
                alt={screen.title}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                }}
              />
            </div>
          )}
          
          {/* Заголовок */}
          <h1 style={{
            fontFamily: "'Satoshi', 'Manrope', -apple-system, BlinkMacSystemFont, sans-serif",
            fontWeight: 700,
            fontSize: '36px',
            lineHeight: '42px',
            color: '#0A5F59',
            margin: '0 0 16px 0',
            textAlign: 'center',
          }}>
            {String(screen.title || '')}
          </h1>

          {/* Подзаголовок - многострочный */}
              {screen.subtitle && (
                <div style={{
                  fontFamily: "'Manrope', -apple-system, BlinkMacSystemFont, sans-serif",
                  fontWeight: 400,
                  fontSize: '18px',
                  lineHeight: '1.6',
                  color: '#475467',
                  margin: '0 0 28px 0',
                  textAlign: 'center',
                  whiteSpace: 'pre-line',
                }}>
                  {String(screen.subtitle || '')}
                </div>
              )}

              {/* Отображение ошибок */}
              {error && (
                <div style={{
                  backgroundColor: '#FEE2E2',
                  border: '1px solid #FCA5A5',
                  borderRadius: '12px',
                  padding: '16px',
                  marginBottom: '20px',
                  textAlign: 'center',
                }}>
                  <div style={{
                    color: '#DC2626',
                    fontWeight: '600',
                    marginBottom: '4px',
                    fontSize: '14px',
                  }}>
                    ❌ Ошибка
                  </div>
                  <div style={{ 
                    color: '#991B1B', 
                    fontSize: '14px',
                    lineHeight: '1.4',
                  }}>
                    {error || 'Произошла ошибка'}
                  </div>
                </div>
              )}

          {/* Отзывы с горизонтальным скроллом */}
          {isTestimonialsScreen && screen.content && Array.isArray(screen.content) && (
            <div style={{ 
              display: 'flex', 
              gap: '16px', 
              overflowX: 'auto',
              padding: '8px 0',
              marginBottom: '28px',
              scrollbarWidth: 'thin',
              WebkitOverflowScrolling: 'touch',
              msOverflowStyle: '-ms-autohiding-scrollbar',
            }}>
              {screen.content.map((testimonial, idx: number) => (
                <div key={idx} style={{
                  minWidth: '280px',
                  backgroundColor: 'rgba(255, 255, 255, 0.8)',
                  borderRadius: '20px',
                  padding: '20px',
                  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
                  flexShrink: 0,
                }}>
                  <div style={{ fontSize: '18px', marginBottom: '12px' }}>
                    {'⭐'.repeat(testimonial.stars || 5)}
                  </div>
                  <p style={{ fontSize: '14px', color: '#475467', marginBottom: '16px', lineHeight: '1.5' }}>
                    "{String(testimonial.text || '')}"
                  </p>
                  <p style={{ fontSize: '12px', color: '#0A5F59', fontWeight: 600 }}>
                    — {String(testimonial.author || 'Пользователь')}
                  </p>
                </div>
              ))}
            </div>
          )}

          {/* Продукты (карточки) */}
          {isProductsScreen && screen.content && Array.isArray(screen.content) && (
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', marginBottom: '20px', flexWrap: 'wrap' }}>
              {screen.content.map((product, idx: number) => (
                <div key={idx} style={{
                  flex: '1 1 100px',
                  minWidth: '100px',
                  maxWidth: '120px',
                  backgroundColor: 'rgba(255, 255, 255, 0.8)',
                  borderRadius: '16px',
                  padding: '16px',
                  textAlign: 'center',
                }}>
                  {product.icon && (
                    <img src={product.icon} alt={product.name} style={{ width: '60px', height: '60px', marginBottom: '8px', objectFit: 'contain' }} />
                  )}
                  <div style={{ fontSize: '12px', fontWeight: 600, color: '#0A5F59', marginBottom: '4px' }}>
                    {String(product.name || 'Продукт')}
                  </div>
                  <div style={{ fontSize: '10px', color: '#475467' }}>
                    {String(product.desc || '')}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Сравнение (comparison) */}
          {isComparisonScreen && (
            <div style={{ marginBottom: '28px' }}>
              {/* Текст уже в subtitle, здесь можем добавить визуальные элементы если нужно */}
            </div>
          )}

          {/* Кнопки действий */}
          {(() => {
            // Проверяем, является ли это последним инфо-экраном (want_improve)
            const isLastInfoScreen = screen.id === 'want_improve';
            const nextInfoScreen = INFO_SCREENS.find(s => s.showAfterQuestionCode === screen.id);
            
            // Для последнего tinder-экрана кнопки обрабатываются отдельно ниже
            // Если это не tinder-экран, но последний - показываем кнопку "Получить план"
            if (isLastInfoScreen && !nextInfoScreen && !isTinderScreen) {
              return (
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (isSubmitting) return;
                    submitAnswers().catch((err) => {
                      console.error('Error submitting answers:', err);
                      // Убеждаемся, что error всегда строка
                      const errorMessage = String(err?.message || 'Ошибка отправки ответов');
                      setError(errorMessage);
                      // ИСПРАВЛЕНО: Устанавливаем state, ref синхронизируется автоматически через useEffect
                      setIsSubmitting(false);
                    });
                  }}
                  disabled={isSubmitting}
                  style={{
                    width: '100%',
                    height: '64px',
                    background: '#0A5F59',
                    color: 'white',
                    border: 'none',
                    borderRadius: '32px',
                    fontFamily: "'Manrope', -apple-system, BlinkMacSystemFont, sans-serif",
                    fontWeight: 600,
                    fontSize: '18px',
                    cursor: isSubmitting ? 'not-allowed' : 'pointer',
                    boxShadow: '0 8px 24px rgba(10, 95, 89, 0.3), 0 4px 12px rgba(10, 95, 89, 0.2)',
                    opacity: isSubmitting ? 0.7 : 1,
                    marginTop: '20px',
                  }}
                >
                  {isSubmitting ? 'Отправка...' : 'Получить план →'}
                </button>
              );
            }

            // Tinder-кнопки
            if (isTinderScreen) {
              const isWantImproveScreen = screen.id === 'want_improve';
              
              // Для экрана "Хотите улучшить состояние кожи?" показываем только одну кнопку "Получить план ухода"
              if (isWantImproveScreen) {
                const handleGetPlan = async () => {
                  clientLogger.log('🔘 handleGetPlan вызван');
                  
                  if (isSubmitting) {
                    clientLogger.warn('⚠️ Уже отправляется');
                    return;
                  }
                  
                  if (!questionnaire) {
                    console.error('❌ Анкета не загружена');
                    setError('Анкета не загружена. Пожалуйста, обновите страницу.');
                    return;
                  }
                  
                  // Проверяем наличие initData перед отправкой
                  const initData = typeof window !== 'undefined' ? window.Telegram?.WebApp?.initData : null;
                  const isInTelegram = typeof window !== 'undefined' && !!window.Telegram?.WebApp;
                  
                  clientLogger.log('📱 Проверка Telegram перед отправкой:', {
                    hasWindow: typeof window !== 'undefined',
                    hasTelegram: isInTelegram,
                    hasInitData: !!initData,
                    initDataLength: initData?.length || 0,
                  });
                  
                  if ((!isInTelegram || !initData) && !isDev) {
                    console.error('❌ Telegram WebApp или initData недоступен');
                    setError('Пожалуйста, откройте приложение через Telegram Mini App и обновите страницу.');
                    return;
                  }
                  
                  clientLogger.log('🚀 Запуск submitAnswers...');
                  // ИСПРАВЛЕНО: Устанавливаем isSubmitting СИНХРОННО перед вызовом submitAnswers
                  // Это гарантирует, что лоадер покажется сразу после нажатия кнопки
                  isSubmittingRef.current = true;
                  setIsSubmitting(true);
                  setError(null);
                  setLoading(false); // Убираем лоадер "Загрузка анкеты..." если он показывался
                  
                  try {
                    await submitAnswers();
                  } catch (err: any) {
                    console.error('❌ Ошибка в handleGetPlan:', err);
                    console.error('   Error message:', err?.message);
                    console.error('   Error stack:', err?.stack);
                    
                    let errorMessage = 'Ошибка отправки ответов. Пожалуйста, попробуйте еще раз.';
                    
                    if (err?.message?.includes('Unauthorized') || 
                        err?.message?.includes('401') || 
                        err?.message?.includes('initData') ||
                        err?.message?.includes('авторизации')) {
                      errorMessage = 'Ошибка авторизации. Пожалуйста, обновите страницу и убедитесь, что приложение открыто через Telegram Mini App.';
                    } else if (err?.message) {
                      errorMessage = err.message;
                    }
                    
                    // Убеждаемся, что errorMessage всегда строка
                    const safeErrorMessage = String(errorMessage || 'Ошибка отправки ответов. Попробуйте еще раз.');
                    setError(safeErrorMessage);
                    // ИСПРАВЛЕНО: Устанавливаем state, ref синхронизируется автоматически через useEffect
                    setIsSubmitting(false);
                  }
                };
                
                return (
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleGetPlan();
                    }}
                    disabled={isSubmitting}
                    style={{
                      width: '100%',
                      height: '64px',
                      background: '#0A5F59',
                      color: 'white',
                      border: 'none',
                      borderRadius: '32px',
                      fontFamily: "'Manrope', -apple-system, BlinkMacSystemFont, sans-serif",
                      fontWeight: 600,
                      fontSize: '18px',
                      cursor: isSubmitting ? 'not-allowed' : 'pointer',
                      boxShadow: '0 8px 24px rgba(10, 95, 89, 0.3), 0 4px 12px rgba(10, 95, 89, 0.2)',
                      opacity: isSubmitting ? 0.7 : 1,
                      marginTop: '20px',
                    }}
                  >
                    {isSubmitting ? 'Отправка...' : 'Получить план ухода'}
                  </button>
                );
              }
              
              // Для других tinder-экранов оставляем старую логику
              const handleButtonClick = async () => {
                if (isSubmitting) return;
                if (!questionnaire) {
                  setError('Анкета не загружена. Пожалуйста, обновите страницу.');
                  return;
                }
                handleNext();
              };
              
              return (
                <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleButtonClick();
                    }}
                    disabled={isSubmitting}
                    style={{
                      flex: 1,
                      height: '64px',
                      background: 'rgba(255, 255, 255, 0.8)',
                      color: '#0A5F59',
                      border: '2px solid rgba(10, 95, 89, 0.3)',
                      borderRadius: '32px',
                      fontFamily: "'Manrope', -apple-system, BlinkMacSystemFont, sans-serif",
                      fontWeight: 600,
                      fontSize: '18px',
                      cursor: isSubmitting ? 'not-allowed' : 'pointer',
                      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
                      opacity: isSubmitting ? 0.7 : 1,
                    }}
                  >
                    {isSubmitting ? 'Отправка...' : '❌ Нет'}
                  </button>
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleButtonClick();
                    }}
                    disabled={isSubmitting}
                    style={{
                      flex: 1,
                      height: '64px',
                      background: '#0A5F59',
                      color: 'white',
                      border: 'none',
                      borderRadius: '32px',
                      fontFamily: "'Manrope', -apple-system, BlinkMacSystemFont, sans-serif",
                      fontWeight: 600,
                      fontSize: '18px',
                      cursor: isSubmitting ? 'not-allowed' : 'pointer',
                      boxShadow: '0 8px 24px rgba(10, 95, 89, 0.3), 0 4px 12px rgba(10, 95, 89, 0.2)',
                      opacity: isSubmitting ? 0.7 : 1,
                    }}
                  >
                    {isSubmitting ? 'Отправка...' : '✅ Да'}
                  </button>
                </div>
              );
            }

            // Обычная кнопка "Продолжить"
            return (
              screen.ctaText ? (
                <button
                  onClick={handleNext}
                  style={{
                    width: '100%',
                    height: '64px',
                    background: '#0A5F59',
                    color: 'white',
                    border: 'none',
                    borderRadius: '32px',
                    fontFamily: "'Manrope', -apple-system, BlinkMacSystemFont, sans-serif",
                    fontWeight: 500,
                    fontSize: '19px',
                    boxShadow: '0 8px 24px rgba(10, 95, 89, 0.3), 0 4px 12px rgba(10, 95, 89, 0.2)',
                    cursor: 'pointer',
                    marginTop: '20px',
                  }}
                >
                  {String(screen.ctaText || 'Продолжить')} →
                </button>
              ) : null
            );
          })()}
        </div>
      </div>
    );
  };

  // ИСПРАВЛЕНО: Проверяем showResumeScreen ПЕРЕД isShowingInitialInfoScreen,
  // чтобы предотвратить мигание начальных экранов перед показом экрана продолжения
  // Это критично, так как showResumeScreen устанавливается асинхронно после загрузки прогресса
  // ВАЖНО: showResumeScreen уже проверяется выше в коде (строка 3900), но добавляем дополнительную проверку здесь
  // для гарантии правильного порядка рендеринга

  // Если показывается информационный экран между вопросами
  // При повторном прохождении пропускаем все info screens
  if (pendingInfoScreen && !isRetakingQuiz) {
    return renderInfoScreen(pendingInfoScreen);
  }

  // ИСПРАВЛЕНО: Проверяем showResumeScreen перед isShowingInitialInfoScreen,
  // чтобы предотвратить показ начальных экранов, если должен показываться экран продолжения
  // ВАЖНО: НЕ возвращаем null здесь, так как экран прогресса уже отрендерен выше (строка 3903)
  // Просто пропускаем показ начальных экранов, если showResumeScreen = true

  // Если мы на начальном информационном экране
  // При повторном прохождении пропускаем все info screens
  // ИСПРАВЛЕНО: Добавлена дополнительная проверка showResumeScreen для предотвращения мигания
  if (isShowingInitialInfoScreen && currentInitialInfoScreen && !isRetakingQuiz && !showResumeScreen) {
    return renderInfoScreen(currentInitialInfoScreen);
  }

  // Если вопрос не найден, но пользователь восстановил прогресс - это может быть временное состояние
  // Даем время на обновление состояния после resumeQuiz
  // ИСПРАВЛЕНО: Не проверяем это условие, если показывается pendingInfoScreen
  if (!currentQuestion && !hasResumed && !showResumeScreen && !pendingInfoScreen) {
    // Если анкета загружена и есть вопросы, но currentQuestionIndex выходит за пределы
    if (questionnaire && allQuestions.length > 0) {
      // ИСПРАВЛЕНО: Если индекс выходит за пределы и нет ответов - показываем сообщение "Начать заново"
      // Это состояние может возникнуть при неправильно сохраненном прогрессе
      if (currentQuestionIndex >= allQuestions.length) {
        const answersCount = Object.keys(answers || {}).length;
        if (answersCount === 0) {
          return (
            <div style={{ 
              padding: '20px',
              minHeight: '100vh',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              background: 'linear-gradient(135deg, #F5FFFC 0%, #E8FBF7 100%)'
            }}>
              <div style={{
                backgroundColor: 'rgba(255, 255, 255, 0.56)',
                backdropFilter: 'blur(28px)',
                borderRadius: '24px',
                padding: '24px',
                maxWidth: '460px',
                textAlign: 'center',
              }}>
                <h2 style={{ color: '#0A5F59', marginBottom: '12px', fontSize: '18px', fontWeight: 'bold' }}>
                  Не удалось загрузить вопросы
                </h2>
                <p style={{ color: '#475467', fontSize: '14px', lineHeight: '1.6', marginBottom: '16px' }}>
                  Похоже, прогресс анкеты сохранился некорректно. Нажмите «Начать заново», чтобы увидеть вопросы.
                </p>
                <button
                  onClick={() => {
                    startOver().catch((err) => {
                      console.error('startOver failed:', err);
                      window.location.reload();
                    });
                  }}
                  style={{
                    padding: '12px 20px',
                    borderRadius: '12px',
                    backgroundColor: '#0A5F59',
                    color: 'white',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: 'bold',
                  }}
                >
                  Начать заново
                </button>
              </div>
            </div>
          );
        }
        // Если индекс вышел за пределы, но есть ответы - это нормальное состояние после завершения анкеты
        // Продолжаем выполнение, чтобы показать лоадер ниже
      } else if (currentQuestionIndex < allQuestions.length) {
        // Индекс в пределах массива, но вопрос не найден - это ошибка
        console.error('❌ currentQuestion is null but should exist', {
          currentQuestionIndex,
          allQuestionsLength: allQuestions.length,
          hasResumed,
          showResumeScreen,
          currentInfoScreenIndex,
          isShowingInitialInfoScreen,
          pendingInfoScreen: !!pendingInfoScreen,
        });
        return (
          <div style={{ padding: '20px' }}>
            <h1>Ошибка загрузки вопроса</h1>
            <p>Попробуйте обновить страницу</p>
            <button onClick={() => window.location.reload()}>Обновить страницу</button>
          </div>
        );
      }
    }
    
    // ИСПРАВЛЕНО: Убрали лоадер "Загрузка анкеты..."
    // Анкета загружается мгновенно, пользователь увидит вопросы без задержки
  }
  
  // Если вопрос не найден, но hasResumed = true - это временное состояние, показываем загрузку
  if (!currentQuestion && hasResumed) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <div>Загрузка вопроса...</div>
      </div>
    );
  }
  
  // Если вопрос все еще не найден после всех проверок
  // ВАЖНО: Проверяем, есть ли ошибка - если есть, показываем её, а не экран "Анкета завершена"
  if (!currentQuestion) {
    // ИСПРАВЛЕНО: Показываем ошибку только если анкета не загружена И ошибка связана с загрузкой анкеты
    // Это предотвращает показ временных ошибок, которые уже исправлены
    if (!questionnaire && !loading && error && (error.includes('загрузить анкету') || error.includes('Invalid questionnaire') || error.includes('Questionnaire has no questions'))) {
      return (
        <div style={{ 
          padding: '20px', 
          textAlign: 'center',
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          background: 'linear-gradient(135deg, #F5FFFC 0%, #E8FBF7 100%)'
        }}>
          <div style={{
            backgroundColor: 'rgba(255, 255, 255, 0.9)',
            borderRadius: '24px',
            padding: '32px',
            maxWidth: '500px',
            width: '100%',
            textAlign: 'center',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
          }}>
            <h2 style={{ color: '#0A5F59', marginBottom: '12px', fontSize: '20px', fontWeight: 'bold' }}>
              Ошибка загрузки анкеты
            </h2>
            <p style={{ color: '#475467', marginBottom: '24px', lineHeight: '1.6' }}>
              {error}
            </p>
            <button
              onClick={() => window.location.reload()}
              style={{
                width: '100%',
                padding: '16px 24px',
                borderRadius: '12px',
                backgroundColor: '#0A5F59',
                color: 'white',
                border: 'none',
                cursor: 'pointer',
                fontSize: '16px',
                fontWeight: 'bold',
                boxShadow: '0 4px 12px rgba(10, 95, 89, 0.3)',
              }}
            >
              Обновить страницу
            </button>
          </div>
        </div>
      );
    }

    const answersCount = Object.keys(answers || {}).length;
    const looksLikeCompletion =
      questionnaire !== null &&
      !loading &&
      allQuestions.length > 0 &&
      currentQuestionIndex >= allQuestions.length &&
      answersCount > 0;

    // ИСПРАВЛЕНО: Показываем лоадер "Создаем ваш план ухода..." только если:
    // 1. НЕТ pendingInfoScreen (инфо-экран уже закрыт или его нет)
    // 2. isSubmitting === true (ответы отправлены)
    // 3. loading === false (анкета уже загружена)
    // 4. questionnaire !== null (анкета существует)
    // Это предотвращает показ лоадера при загрузке анкеты или пока показывается инфо-экран
    if (!pendingInfoScreen && ((isSubmitting && !loading && questionnaire !== null) || looksLikeCompletion)) {
      return (
        <div style={{ 
          padding: '20px',
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          background: 'linear-gradient(135deg, #F5FFFC 0%, #E8FBF7 100%)'
        }}>
          <div style={{
            backgroundColor: 'rgba(255, 255, 255, 0.56)',
            backdropFilter: 'blur(28px)',
            borderRadius: '24px',
            padding: '48px',
            maxWidth: '400px',
            textAlign: 'center',
          }}>
            <div style={{
              width: '64px',
              height: '64px',
              border: '4px solid #0A5F59',
              borderTop: '4px solid transparent',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              margin: '0 auto 24px',
            }} />
            <h2 style={{ color: '#0A5F59', marginBottom: '12px', fontSize: '20px', fontWeight: 'bold' }}>
              Создаем ваш план ухода...
            </h2>
            <p style={{ color: '#475467', fontSize: '16px', lineHeight: '1.5' }}>
              Это займет несколько секунд
            </p>
          </div>
        </div>
      );
    }
    
    // ИСПРАВЛЕНО: Показываем ошибку только если это не ошибка загрузки анкеты (которая уже исправлена)
    // Если анкета загружена, но есть ошибка - это может быть ошибка отправки ответов, показываем её
    if (error && (!error.includes('загрузить анкету') && !error.includes('Invalid questionnaire') && !error.includes('Questionnaire has no questions'))) {
      return (
        <div style={{ 
          padding: '20px',
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          background: 'linear-gradient(135deg, #F5FFFC 0%, #E8FBF7 100%)'
        }}>
          <div style={{
            backgroundColor: 'rgba(255, 255, 255, 0.56)',
            backdropFilter: 'blur(28px)',
            borderRadius: '24px',
            padding: '24px',
            maxWidth: '400px',
            textAlign: 'center',
          }}>
            <h1 style={{ color: '#DC2626', marginBottom: '16px', fontSize: '24px' }}>😔 Что-то пошло не так</h1>
            <p style={{ color: '#475467', marginBottom: '24px', fontSize: '16px', lineHeight: '1.5' }}>
              {String(error || 'Произошла неожиданная ошибка. Попробуйте обновить страницу.')}
            </p>
            <p style={{ color: '#6B7280', marginBottom: '24px', fontSize: '14px' }}>
              Ошибка сохранена в системе. Техподдержка уже получила уведомление.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <button
                onClick={() => {
                  setError(null);
                  submitAnswers().catch((err) => {
                    console.error('Error submitting answers:', err);
                    const errorMessage = String(err?.message || 'Ошибка отправки ответов');
                    setError(errorMessage);
                  });
                }}
                style={{
                  padding: '12px 24px',
                  borderRadius: '12px',
                  backgroundColor: '#0A5F59',
                  color: 'white',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '16px',
                  fontWeight: 'bold',
                }}
              >
                Попробовать снова
              </button>
              <button
                onClick={() => window.location.reload()}
                style={{
                  padding: '12px 24px',
                  borderRadius: '12px',
                  backgroundColor: 'transparent',
                  color: '#0A5F59',
                  border: '1px solid #0A5F59',
                  cursor: 'pointer',
                  fontSize: '16px',
                  fontWeight: 'bold',
                }}
              >
                Обновить страницу
              </button>
            </div>
          </div>
        </div>
      );
    }

    // ИСПРАВЛЕНО: Показываем лоадер только если действительно идет отправка ответов или все вопросы пройдены с ответами
    // Случай когда индекс вышел за пределы и нет ответов уже обработан выше
    // answersCount уже объявлен выше в этом блоке
    if (isSubmitting || (questionnaire && allQuestions.length > 0 && currentQuestionIndex >= allQuestions.length && answersCount > 0)) {
      // Если нет ошибки, но все вопросы пройдены - автоматически показываем лоадер и отправляем
      // Это заменяет экран "Анкета завершена. Отправить ответы?" на автоматическую отправку
      return (
        <div style={{ 
          padding: '20px',
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          background: 'linear-gradient(135deg, #F5FFFC 0%, #E8FBF7 100%)'
        }}>
          <div style={{
            backgroundColor: 'rgba(255, 255, 255, 0.56)',
            backdropFilter: 'blur(28px)',
            borderRadius: '24px',
            padding: '48px',
            maxWidth: '400px',
            textAlign: 'center',
          }}>
            <style>{`
              @keyframes spin {
                from { transform: rotate(0deg); }
                to { transform: rotate(360deg); }
              }
            `}</style>
            <div style={{
              width: '64px',
              height: '64px',
              border: '4px solid #0A5F59',
              borderTop: '4px solid transparent',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              margin: '0 auto 24px',
            }} />
            <h2 style={{ color: '#0A5F59', marginBottom: '12px', fontSize: '20px', fontWeight: 'bold' }}>
              Создаем ваш план ухода...
            </h2>
            <p style={{ color: '#475467', fontSize: '16px', lineHeight: '1.5' }}>
              Это займет несколько секунд
            </p>
          </div>
        </div>
      );
    }

    // ИСПРАВЛЕНО: Убрали лоадер "Загружаем вопросы..."
    // Показываем ошибку только если анкета не загружена И ошибка связана с загрузкой анкеты
    // Это предотвращает показ временных ошибок, которые уже исправлены
    if (!questionnaire && error && (error.includes('загрузить анкету') || error.includes('Invalid questionnaire') || error.includes('Questionnaire has no questions'))) {
      // Показываем ошибку только если она есть
      return (
        <div style={{ 
          padding: '20px',
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          background: 'linear-gradient(135deg, #F5FFFC 0%, #E8FBF7 100%)'
        }}>
          <div style={{
            backgroundColor: 'rgba(255, 255, 255, 0.56)',
            backdropFilter: 'blur(28px)',
            borderRadius: '24px',
            padding: '48px',
            maxWidth: '400px',
            textAlign: 'center',
          }}>
            <h2 style={{ color: '#D32F2F', marginBottom: '12px', fontSize: '20px', fontWeight: 'bold' }}>
              Ошибка загрузки анкеты
            </h2>
            <p style={{ color: '#475467', fontSize: '16px', lineHeight: '1.5', marginBottom: '24px' }}>
              {error}
            </p>
            <button
              onClick={() => window.location.reload()}
              style={{
                padding: '12px 20px',
                borderRadius: '12px',
                backgroundColor: '#0A5F59',
                color: 'white',
                border: 'none',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: 'bold',
              }}
            >
              Обновить страницу
            </button>
          </div>
        </div>
      );
    }

    // ИСПРАВЛЕНО: Убрали лоадер "Загружаем вопросы..."
    // Если анкета загружена и есть вопросы, но вопрос еще не найден - это временное состояние
    // Вместо лоадера просто показываем пустой экран или первый вопрос
    // (вопрос должен найтись сразу после загрузки анкеты)
  }

  return (
    <div style={{ 
      padding: '20px',
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #F5FFFC 0%, #E8FBF7 100%)',
      position: 'relative',
    }}>
      {/* Debug Panel (только в development) */}
      {(process.env.NODE_ENV === 'development' || process.env.NEXT_PUBLIC_DEBUG === 'true') && (
        <div style={{
          position: 'fixed',
          bottom: '20px',
          right: '20px',
          zIndex: 10000,
        }}>
          <button
            onClick={() => setShowDebugPanel(!showDebugPanel)}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              backgroundColor: showDebugPanel ? '#0A5F59' : 'rgba(10, 95, 89, 0.7)',
              color: 'white',
              border: 'none',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: 'bold',
            }}
          >
            {showDebugPanel ? '🔽 Скрыть логи' : '🔺 Показать логи'}
          </button>
          {showDebugPanel && (
            <div style={{
              position: 'absolute',
              bottom: '40px',
              right: '0',
              width: '300px',
              maxHeight: '400px',
              backgroundColor: 'rgba(0, 0, 0, 0.9)',
              color: '#0f0',
              padding: '12px',
              borderRadius: '8px',
              fontSize: '11px',
              fontFamily: 'monospace',
              overflow: 'auto',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
            }}>
              <div style={{ marginBottom: '8px', fontWeight: 'bold', color: '#fff' }}>
                Debug Logs ({debugLogs.length})
              </div>
              {debugLogs.map((log, idx) => (
                <div key={idx} style={{ marginBottom: '8px', borderBottom: '1px solid #333', paddingBottom: '4px' }}>
                  <div style={{ color: '#0f0', fontWeight: 'bold' }}>
                    [{log.time}] {log.message}
                  </div>
                  {log.data && (
                    <pre style={{ 
                      marginTop: '4px', 
                      color: '#ccc', 
                      fontSize: '10px',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-all',
                    }}>
                      {log.data}
                    </pre>
                  )}
                </div>
              ))}
              {debugLogs.length === 0 && (
                <div style={{ color: '#666', fontStyle: 'italic' }}>
                  Логи появятся здесь...
                </div>
              )}
            </div>
          )}
        </div>
      )}
      <div style={{
        backgroundColor: 'rgba(255, 255, 255, 0.56)',
        backdropFilter: 'blur(28px)',
        borderRadius: '24px',
        padding: '24px',
        maxWidth: '600px',
        margin: '0 auto',
      }}>
        {/* Проверка на существование вопроса */}
        {!currentQuestion ? (
          <div style={{ textAlign: 'center', padding: '40px 20px' }}>
            <div style={{ color: '#0A5F59', fontSize: '18px', marginBottom: '12px' }}>
              Вопрос не найден
            </div>
            <div style={{ color: '#6B7280', fontSize: '14px' }}>
              Попробуйте обновить страницу
            </div>
          </div>
        ) : (
          <>
        {/* Кнопка "Назад" - скрыта на первом вопросе */}
        {(currentQuestionIndex > 0 || currentInfoScreenIndex > 0) && (
          <button
            onClick={handleBack}
            style={{
              marginBottom: '16px',
              padding: '8px 16px',
              borderRadius: '12px',
              border: '1px solid rgba(10, 95, 89, 0.2)',
              backgroundColor: 'rgba(255, 255, 255, 0.5)',
              color: '#0A5F59',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 500,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(10, 95, 89, 0.1)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.5)';
            }}
          >
            <span>←</span>
            <span>Назад</span>
          </button>
        )}

        {/* Прогресс-бар */}
        <div style={{ marginBottom: '24px' }}>
          <div style={{
            width: '100%',
            height: '6px',
            backgroundColor: 'rgba(10, 95, 89, 0.1)',
            borderRadius: '3px',
            overflow: 'hidden',
            position: 'relative',
          }}>
            <div style={{
              width: `${((currentQuestionIndex + 1) / allQuestions.length) * 100}%`,
              height: '100%',
              backgroundColor: '#0A5F59',
              borderRadius: '3px',
              transition: 'width 0.3s ease',
              boxShadow: '0 2px 8px rgba(10, 95, 89, 0.3)',
            }} />
          </div>
        </div>

        <h2 style={{ 
          fontSize: '24px', 
          fontWeight: 'bold', 
          color: '#0A5F59',
          marginBottom: '24px'
        }}>
          {currentQuestion.text}
        </h2>

        {currentQuestion.type === 'single_choice' && currentQuestion.options && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {currentQuestion.options.map((option) => {
              const isLastQuestion = currentQuestionIndex === allQuestions.length - 1;
              const isSelected = answers[currentQuestion.id] === option.value;
              
              return (
                <button
                  key={option.id}
                  onClick={async () => {
                    await handleAnswer(currentQuestion.id, option.value);
                    // ВАЖНО: Всегда переходим к следующему вопросу после выбора ответа
                    // Для последнего вопроса: если есть инфо-экран, показываем его через handleNext
                    // Если инфо-экрана нет, все равно вызываем handleNext, который обработает завершение анкеты
                    setTimeout(() => handleNext(), 300);
                  }}
                  style={{
                    padding: '16px',
                    borderRadius: '16px',
                    border: '1px solid rgba(10, 95, 89, 0.2)',
                    backgroundColor: isSelected
                      ? 'rgba(10, 95, 89, 0.1)'
                      : 'rgba(255, 255, 255, 0.5)',
                    cursor: 'pointer',
                    textAlign: 'left',
                    fontSize: '16px',
                    color: '#0A5F59',
                    transition: 'all 0.2s',
                  }}
                >
                  {option.label}
                </button>
              );
            })}
            {/* Кнопки навигации */}
            {currentQuestionIndex === allQuestions.length - 1 && 
             answers[currentQuestion.id] && 
             (isRetakingQuiz || !getInfoScreenAfterQuestion(currentQuestion.code)) ? (
              // Последний вопрос - показываем "Получить план"
              <div style={{ marginTop: '24px' }}>
                <button
                  onClick={() => {
                    submitAnswers().catch((err) => {
                      console.error('Error submitting answers:', err);
                    });
                  }}
                  disabled={isSubmitting}
                  style={{
                    width: '100%',
                    padding: '18px',
                    borderRadius: '16px',
                    backgroundColor: '#0A5F59',
                    color: 'white',
                    border: 'none',
                    cursor: isSubmitting ? 'not-allowed' : 'pointer',
                    fontSize: '18px',
                    fontWeight: 'bold',
                    boxShadow: '0 8px 24px rgba(10, 95, 89, 0.3), 0 4px 12px rgba(10, 95, 89, 0.2)',
                    transition: 'all 0.2s',
                    opacity: isSubmitting ? 0.7 : 1,
                  }}
                >
                  {isSubmitting ? 'Отправка...' : 'Получить план →'}
                </button>
                {!isRetakingQuiz && (
                  <p style={{
                    marginTop: '12px',
                    fontSize: '11px',
                    color: '#6B7280',
                    textAlign: 'center',
                    lineHeight: '1.4',
                  }}>
                    Нажимая «Получить план», вы соглашаетесь с{' '}
                    <Link
                      href="/terms"
                      style={{
                        color: '#0A5F59',
                        textDecoration: 'underline',
                      }}
                    >
                      пользовательским соглашением
                    </Link>
                  </p>
                )}
              </div>
            ) : (
              // Не последний вопрос или есть инфо-экраны - показываем "Далее"
              // При первом прохождении (!isRetakingQuiz) для single_choice кнопка не нужна - есть автопереход
              answers[currentQuestion.id] && isRetakingQuiz && (
                <button
                  onClick={handleNext}
                  disabled={!answers[currentQuestion.id] || (Array.isArray(answers[currentQuestion.id]) && (answers[currentQuestion.id] as string[]).length === 0)}
                  style={{
                    marginTop: '24px',
                    width: '100%',
                    padding: '16px',
                    borderRadius: '16px',
                    backgroundColor: '#0A5F59',
                    color: 'white',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '16px',
                    fontWeight: 'bold',
                    opacity: (!answers[currentQuestion.id] || (Array.isArray(answers[currentQuestion.id]) && (answers[currentQuestion.id] as string[]).length === 0)) ? 0.5 : 1,
                  }}
                >
                  Далее
                </button>
              )
            )}
          </div>
        )}

        {currentQuestion.type === 'free_text' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <input
              type="text"
              value={(answers[currentQuestion.id] as string) || ''}
              onChange={(e) => {
                handleAnswer(currentQuestion.id, e.target.value);
              }}
              placeholder="Введите ваше имя"
              style={{
                padding: '16px',
                borderRadius: '16px',
                border: '1px solid rgba(10, 95, 89, 0.2)',
                backgroundColor: 'rgba(255, 255, 255, 0.8)',
                fontSize: '16px',
                color: '#0A5F59',
                fontFamily: "'Manrope', -apple-system, BlinkMacSystemFont, sans-serif",
                outline: 'none',
                transition: 'all 0.2s',
              }}
              onFocus={(e) => {
                e.target.style.borderColor = '#0A5F59';
                e.target.style.backgroundColor = 'rgba(255, 255, 255, 1)';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = 'rgba(10, 95, 89, 0.2)';
                e.target.style.backgroundColor = 'rgba(255, 255, 255, 0.8)';
              }}
            />
            {/* Кнопка "Далее" для текстового вопроса */}
            {answers[currentQuestion.id] && String(answers[currentQuestion.id]).trim().length > 0 && (
              <button
                onClick={handleNext}
                style={{
                  marginTop: '12px',
                  width: '100%',
                  padding: '16px',
                  borderRadius: '16px',
                  backgroundColor: '#0A5F59',
                  color: 'white',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '16px',
                  fontWeight: 'bold',
                }}
              >
                Далее
              </button>
            )}
          </div>
        )}

        {currentQuestion.type === 'multi_choice' && currentQuestion.options && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {currentQuestion.options.map((option) => {
              const currentAnswers = (answers[currentQuestion.id] as string[]) || [];
              const isSelected = currentAnswers.includes(option.value);
              
              return (
                <button
                  key={option.id}
                  onClick={() => {
                    const newAnswers = isSelected
                      ? currentAnswers.filter((v) => v !== option.value)
                      : [...currentAnswers, option.value];
                    handleAnswer(currentQuestion.id, newAnswers);
                  }}
                  style={{
                    padding: '16px',
                    borderRadius: '16px',
                    border: '1px solid rgba(10, 95, 89, 0.2)',
                    backgroundColor: isSelected
                      ? 'rgba(10, 95, 89, 0.1)'
                      : 'rgba(255, 255, 255, 0.5)',
                    cursor: 'pointer',
                    textAlign: 'left',
                    fontSize: '16px',
                    color: '#0A5F59',
                    transition: 'all 0.2s',
                  }}
                >
                  {option.label}
                </button>
              );
            })}
            {/* Кнопки навигации */}
            {currentQuestionIndex === allQuestions.length - 1 && 
             (isRetakingQuiz || !getInfoScreenAfterQuestion(currentQuestion.code)) ? (
              // Последний вопрос - показываем "Получить план"
              <div style={{ marginTop: '24px' }}>
                <button
                  onClick={submitAnswers}
                  disabled={!answers[currentQuestion.id] || (Array.isArray(answers[currentQuestion.id]) && (answers[currentQuestion.id] as string[]).length === 0) || isSubmitting}
                  style={{
                    width: '100%',
                    padding: '18px',
                    borderRadius: '16px',
                    backgroundColor: '#0A5F59',
                    color: 'white',
                    border: 'none',
                    cursor: (!answers[currentQuestion.id] || (Array.isArray(answers[currentQuestion.id]) && (answers[currentQuestion.id] as string[]).length === 0) || isSubmitting) ? 'not-allowed' : 'pointer',
                    fontSize: '18px',
                    fontWeight: 'bold',
                    boxShadow: '0 8px 24px rgba(10, 95, 89, 0.3), 0 4px 12px rgba(10, 95, 89, 0.2)',
                    opacity: (!answers[currentQuestion.id] || (Array.isArray(answers[currentQuestion.id]) && (answers[currentQuestion.id] as string[]).length === 0) || isSubmitting) ? 0.5 : 1,
                    transition: 'all 0.2s',
                  }}
                >
                  {isSubmitting ? 'Отправка...' : 'Получить план →'}
                </button>
                {!isRetakingQuiz && (
                  <p style={{
                    marginTop: '12px',
                    fontSize: '11px',
                    color: '#6B7280',
                    textAlign: 'center',
                    lineHeight: '1.4',
                  }}>
                    Нажимая «Получить план», вы соглашаетесь с{' '}
                    <Link
                      href="/terms"
                      style={{
                        color: '#0A5F59',
                        textDecoration: 'underline',
                      }}
                    >
                      пользовательским соглашением
                    </Link>
                  </p>
                )}
              </div>
            ) : (
              // Не последний вопрос или есть инфо-экраны - показываем "Далее"
              answers[currentQuestion.id] && (
                <button
                  onClick={handleNext}
                  disabled={!answers[currentQuestion.id] || (Array.isArray(answers[currentQuestion.id]) && (answers[currentQuestion.id] as string[]).length === 0)}
                  style={{
                    marginTop: '24px',
                    width: '100%',
                    padding: '16px',
                    borderRadius: '16px',
                    backgroundColor: '#0A5F59',
                    color: 'white',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '16px',
                    fontWeight: 'bold',
                    opacity: (!answers[currentQuestion.id] || (Array.isArray(answers[currentQuestion.id]) && (answers[currentQuestion.id] as string[]).length === 0)) ? 0.5 : 1,
                  }}
                >
                  Далее
                </button>
              )
            )}
          </div>
        )}
          </>
        )}
      </div>
      
      {/* Full-screen overlay лоадер для финализации */}
      {finalizing && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center">
          <div className="rounded-2xl bg-white/10 border border-white/20 p-6 text-white w-[320px] backdrop-blur-md">
            <div className="text-lg font-semibold mb-2">Собираем ваш план…</div>
            <div className="mt-2 text-sm opacity-80 mb-4">
              {finalizingStep === 'answers' && 'Сохраняем ответы'}
              {finalizingStep === 'plan' && 'Подбираем средства и строим план'}
              {finalizingStep === 'done' && 'Готово!'}
            </div>
            <div className="mt-4 h-2 w-full bg-white/20 rounded-full overflow-hidden">
              <div 
                className="h-2 bg-white rounded-full transition-all duration-300"
                style={{
                  width: finalizingStep === 'answers' ? '33%' : finalizingStep === 'plan' ? '66%' : '100%'
                }}
              />
            </div>
            {finalizeError && (
              <div className="mt-4 text-sm text-red-300">
                {finalizeError}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}