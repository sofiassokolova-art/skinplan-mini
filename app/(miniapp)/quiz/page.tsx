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
  const router = useRouter();
  
  // Инициализация useTelegram (хук сам обрабатывает ошибки внутри)
  // ВАЖНО: хуки должны вызываться всегда в одном порядке, нельзя оборачивать в try-catch
  const { initialize, initData } = useTelegram();
  const [questionnaire, setQuestionnaire] = useState<Questionnaire | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentInfoScreenIndex, setCurrentInfoScreenIndex] = useState(0);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string | string[]>>({});
  const [showResumeScreen, setShowResumeScreen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pendingInfoScreen, setPendingInfoScreen] = useState<InfoScreen | null>(null); // Информационный экран между вопросами
  const [savedProgress, setSavedProgress] = useState<{
    answers: Record<number, string | string[]>;
    questionIndex: number;
    infoScreenIndex: number;
  } | null>(null);
  const [isRetakingQuiz, setIsRetakingQuiz] = useState(false); // Флаг: повторное прохождение анкеты (уже есть профиль)
  const [showRetakeScreen, setShowRetakeScreen] = useState(false); // Флаг: показывать экран выбора тем для повторного прохождения
  
  // Проверяем флаг из localStorage при монтировании
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const isRetakingFromStorage = localStorage.getItem('is_retaking_quiz') === 'true';
      const fullRetakeFromHome = localStorage.getItem('full_retake_from_home') === 'true';
      
      if (isRetakingFromStorage) {
        setIsRetakingQuiz(true);
        
        // ВАЖНО: При переходе с главной страницы показываем экран выбора тем с PaymentGate
        // НЕ пропускаем его, чтобы пользователь мог оплатить 49₽ или 99₽
        // Флаг full_retake_from_home используется только для логики, но экран выбора тем показываем
        // ВАЖНО: НЕ очищаем прогресс при установке флага перепрохождения
        // Прогресс должен сохраняться, если пользователь просто зашел на страницу анкеты
        if (fullRetakeFromHome) {
          // Очищаем флаг после использования (он больше не нужен)
          localStorage.removeItem('full_retake_from_home');
          console.log('✅ Полное перепрохождение с главной страницы - показываем экран выбора тем с оплатой');
        }
        
        // Всегда показываем экран выбора тем при перепрохождении
        setShowRetakeScreen(true);
        console.log('✅ Флаг перепрохождения найден в localStorage, показываем экран выбора тем');
        // ВАЖНО: НЕ очищаем quiz_progress здесь - прогресс должен сохраняться
      }
    }
  }, []);
  const [hasResumed, setHasResumed] = useState(false); // Флаг: пользователь нажал "Продолжить" и восстановил прогресс
  const hasResumedRef = useRef(false); // Синхронный ref для проверки в асинхронных функциях
  const [isStartingOver, setIsStartingOver] = useState(false); // Флаг: пользователь нажал "Начать заново"
  const isStartingOverRef = useRef(false); // Синхронный ref для проверки в асинхронных функциях
  const initCompletedRef = useRef(false); // Флаг: инициализация уже завершена
  const [debugLogs, setDebugLogs] = useState<Array<{ time: string; message: string; data?: any }>>([]);
  const [showDebugPanel, setShowDebugPanel] = useState(false);
  
  // ВАЖНО: Все хуки должны быть объявлены ПЕРЕД ранними return'ами
  // Автоматическая отправка ответов когда все вопросы отвечены
  const [autoSubmitTriggered, setAutoSubmitTriggered] = useState(false);
  const autoSubmitTriggeredRef = useRef(false);
  const isMountedRef = useRef(true);
  
  // Функция для добавления логов (только в development)
  // ВАЖНО: оборачиваем в useCallback, чтобы функция не менялась между рендерами
  // и не вызывала лишние пересчеты в useMemo
  const addDebugLog = useCallback((message: string, data?: any) => {
    const time = new Date().toLocaleTimeString();
    // Также логируем в консоль для тех, кто может ее открыть
    console.log(`[${time}] ${message}`, data || '');
    
    if (process.env.NODE_ENV === 'development' || process.env.NEXT_PUBLIC_DEBUG === 'true') {
      const log = {
        time,
        message,
        data: data ? JSON.stringify(data, null, 2) : undefined,
      };
      setDebugLogs(prev => [...prev.slice(-19), log]); // Храним последние 20 логов
    }
  }, []);

  useEffect(() => {
    // ВАЖНО: Если инициализация уже завершена и пользователь НЕ нажал "Начать заново",
    // не выполняем повторную инициализацию
    if (initCompletedRef.current && !isStartingOverRef.current) {
      console.log('⏸️ useEffect init: пропущено, так как инициализация уже завершена');
      return;
    }
    
    // ВАЖНО: Если пользователь уже продолжил анкету (hasResumed), не выполняем повторную инициализацию
    // Это предотвращает повторную загрузку прогресса после resumeQuiz
    if (hasResumedRef.current || hasResumed) {
      console.log('⏸️ useEffect init: пропущено, так как пользователь уже продолжил анкету (hasResumed = true)');
      return;
    }
    
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
          console.log('✅ Анкета уже загружена, пропускаем повторную загрузку после startOver');
          setLoading(false);
          setError(null);
          initCompletedRef.current = true;
          isStartingOverRef.current = false;
          setIsStartingOver(false);
          console.log('✅ Повторная инициализация завершена (анкета уже была загружена)');
          return;
        }
        
        // Инициализируем Telegram WebApp
        console.log('🔄 Initializing Telegram WebApp...');
        initialize();
        console.log('✅ Telegram WebApp initialized');
        
        // Ждем готовности Telegram WebApp
        console.log('⏳ Waiting for Telegram WebApp...');
        await waitForTelegram();
        console.log('✅ Telegram WebApp ready');

        // Сначала загружаем анкету (публичный маршрут)
        // Но только если она еще не загружена
        if (!questionnaire) {
        console.log('📥 Loading questionnaire...');
        await loadQuestionnaire();
        console.log('✅ Questionnaire loaded');
        } else {
          console.log('✅ Questionnaire already loaded, skipping');
        }
      
      // Проверяем, есть ли уже профиль (повторное прохождение анкеты)
      // ВАЖНО: Не проверяем профиль, если пользователь только что нажал "Начать заново"
      // ВАЖНО: Для новых пользователей (без профиля) показываем полную анкету, а не экран выбора тем
      // ВАЖНО: Экран "что хотите изменить?" показывается ТОЛЬКО если:
      // 1. Профиль существует
      // 2. Анкета полностью завершена (есть все ответы)
      // 3. Пользователь не нажал "Начать заново"
      if (typeof window !== 'undefined' && window.Telegram?.WebApp?.initData && !isStartingOverRef.current) {
        try {
          const profile = await api.getCurrentProfile();
          if (profile && (profile as any).id) {
            // Профиль существует - проверяем, завершена ли анкета
            if (!isStartingOverRef.current) {
              // Проверяем, есть ли ответы на анкету (завершена ли анкета)
              try {
                const progress = await api.getQuizProgress();
                // Проверяем, что есть ответы И что анкета завершена (все вопросы отвечены)
                const hasAnswers = progress && (progress as any).answers && Object.keys((progress as any).answers).length > 0;
                const isCompleted = progress && (progress as any).isCompleted;
                
                if (hasAnswers && isCompleted) {
                  // Анкета полностью завершена - проверяем, хочет ли пользователь перепроходить
                  // ВАЖНО: Проверяем флаг из localStorage, установленный при нажатии "Перепройти анкету"
                  const isRetakingFromStorage = typeof window !== 'undefined' && localStorage.getItem('is_retaking_quiz') === 'true';
                  if (isRetakingFromStorage) {
                    // Пользователь нажал "Перепройти анкету" - показываем экран выбора тем
                    setIsRetakingQuiz(true);
                    setShowRetakeScreen(true);
                    console.log('✅ Повторное прохождение анкеты - профиль и завершенная анкета существуют + флаг перепрохождения установлен, показываем экран выбора тем');
                  } else {
                    // Профиль есть, анкета завершена, но пользователь не хочет перепроходить
                    // Это может быть обычное продолжение или просто заход на страницу
                    console.log('ℹ️ Профиль и завершенная анкета существуют, но флаг перепрохождения не установлен');
                    setIsRetakingQuiz(false);
                    setShowRetakeScreen(false);
                  }
                } else {
                  // Профиль есть, но анкета не завершена - показываем полную анкету
                  console.log('ℹ️ Профиль есть, но анкета не завершена - показываем полную анкету', {
                    hasAnswers,
                    isCompleted,
                  });
                  setIsRetakingQuiz(false);
                  setShowRetakeScreen(false);
                }
              } catch (progressErr) {
                // Не удалось загрузить прогресс - показываем полную анкету
                console.log('ℹ️ Не удалось загрузить прогресс анкеты - показываем полную анкету', progressErr);
                setIsRetakingQuiz(false);
                setShowRetakeScreen(false);
              }
            } else {
              console.log('⏸️ Пропущена проверка профиля, так как isStartingOverRef = true');
            }
          }
        } catch (err: any) {
          // Профиля нет (404) - это первое прохождение, показываем полную анкету
          const isNotFound = err?.status === 404 || 
                            err?.message?.includes('404') || 
                            err?.message?.includes('No profile') ||
                            err?.message?.includes('Profile not found');
          
          if (isNotFound) {
            console.log('ℹ️ Первое прохождение анкеты - профиля еще нет (404), показываем полную анкету');
          } else {
            console.log('ℹ️ Ошибка при проверке профиля, показываем полную анкету', err);
          }
          setIsRetakingQuiz(false);
          setShowRetakeScreen(false);
        }
      } else if (isStartingOverRef.current) {
        console.log('⏸️ Пропущена проверка профиля в init, так как isStartingOverRef = true');
        // При "Начать заново" показываем полную анкету
        setIsRetakingQuiz(false);
        setShowRetakeScreen(false);
      } else {
        // Telegram WebApp не доступен - показываем полную анкету
        console.log('ℹ️ Telegram WebApp не доступен, показываем полную анкету');
        setIsRetakingQuiz(false);
        setShowRetakeScreen(false);
      }

      // Загружаем прогресс с сервера (только если Telegram WebApp доступен)
      // Важно: загружаем после загрузки анкеты, чтобы правильно вычислить totalQuestions
      // Проверка isStartingOver и hasResumed выполняется внутри loadSavedProgressFromServer
      // ВАЖНО: Не загружаем прогресс, если пользователь уже продолжил анкету
      if (typeof window !== 'undefined' && window.Telegram?.WebApp?.initData && !hasResumedRef.current && !hasResumed) {
        try {
          await loadSavedProgressFromServer();
          // loadSavedProgressFromServer сам устанавливает setShowResumeScreen(true) если есть прогресс
          // и очищает localStorage если прогресса нет на сервере
        } catch (err: any) {
          // Если ошибка 401 - это нормально, просто не используем серверный прогресс
          if (!err?.message?.includes('401') && !err?.message?.includes('Unauthorized')) {
            console.warn('Не удалось загрузить прогресс с сервера:', err);
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
      
      // Только после всех загрузок устанавливаем loading = false
      console.log('✅ Initialization complete, setting loading = false');
      setLoading(false);
      initCompletedRef.current = true; // Помечаем, что инициализация завершена
      
      // ВАЖНО: Если это была повторная инициализация после "Начать заново",
      // сбрасываем флаг isStartingOverRef, чтобы разрешить нормальную работу
      if (isStartingOverRef.current) {
        console.log('✅ Повторная инициализация завершена, сбрасываем isStartingOverRef');
        isStartingOverRef.current = false;
        setIsStartingOver(false);
      }
    } catch (initErr: any) {
        console.error('❌ Error in init function:', {
          error: initErr,
          message: initErr?.message,
          stack: initErr?.stack,
          name: initErr?.name,
        });
        setError('Ошибка загрузки. Пожалуйста, обновите страницу.');
        setLoading(false);
      }
    };
    
    init().catch((err) => {
      console.error('❌ Unhandled error in init promise:', {
        error: err,
        message: (err as any)?.message,
        stack: (err as any)?.stack,
        name: (err as any)?.name,
      });
      setError('Ошибка загрузки. Пожалуйста, обновите страницу.');
      setLoading(false);
    });
  }, []);

  // Загружаем предыдущие ответы при повторном прохождении анкеты
  // Этот useEffect срабатывает после того, как questionnaire загружен и isRetakingQuiz установлен
  useEffect(() => {
    if (isRetakingQuiz && questionnaire && typeof window !== 'undefined' && window.Telegram?.WebApp?.initData) {
      console.log('🔄 Загружаем предыдущие ответы для повторного прохождения...');
      // Вызываем функцию напрямую, не добавляя в зависимости, чтобы избежать проблем
      (async () => {
        const quiz = questionnaire;
        if (!quiz) {
          console.warn('⚠️ Cannot load previous answers: questionnaire not loaded');
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
              console.log('✅ Загружены предыдущие ответы для повторного прохождения:', Object.keys(data.progress.answers).length, 'ответов');
              setAnswers(data.progress.answers);
              if (data.progress.questionIndex !== undefined && data.progress.questionIndex >= 0) {
                setCurrentQuestionIndex(data.progress.questionIndex);
              }
            }
          }
        } catch (err: any) {
        console.warn('⚠️ Ошибка загрузки предыдущих ответов:', err);
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
      console.log('⏸️ loadSavedProgress: пропущено, так как hasResumed = true (пользователь уже продолжил)');
      return;
    }
    
    const saved = localStorage.getItem('quiz_progress');
    if (saved) {
      try {
        // ВАЖНО: Еще раз проверяем hasResumedRef перед установкой состояний
        if (hasResumedRef.current || hasResumed) {
          console.log('⏸️ loadSavedProgress: пропущено перед установкой состояний, так как hasResumed = true');
          return;
        }
        
        const progress = JSON.parse(saved);
        setSavedProgress(progress);
        // Показываем экран продолжения только если есть сохранённые ответы
        if (progress.answers && Object.keys(progress.answers).length > 0) {
          setShowResumeScreen(true);
          setLoading(false);
        }
      } catch (err) {
        console.error('Error loading saved progress:', err);
      }
    }
  };

  // Загружаем предыдущие ответы для повторного прохождения анкеты
  const loadPreviousAnswers = async (quizData?: Questionnaire) => {
    const quiz = quizData || questionnaire;
    if (!quiz) {
      console.warn('⚠️ Cannot load previous answers: questionnaire not loaded');
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
          console.log('✅ Загружены предыдущие ответы для повторного прохождения:', Object.keys(data.progress.answers).length, 'ответов');
          console.log('📝 Ответы:', data.progress.answers);
          // Заполняем форму предыдущими ответами
          setAnswers(data.progress.answers);
          // Устанавливаем индекс вопроса, если он есть (для перехода к нужному вопросу)
          if (data.progress.questionIndex !== undefined && data.progress.questionIndex >= 0) {
            setCurrentQuestionIndex(data.progress.questionIndex);
          }
        } else {
          console.log('⚠️ Нет сохраненных ответов для предзаполнения');
        }
      }
    } catch (err: any) {
      console.warn('⚠️ Не удалось загрузить предыдущие ответы:', err);
    }
  };

  // Загружаем прогресс с сервера (синхронизация между устройствами)
  const loadSavedProgressFromServer = async () => {
    // Если пользователь только что нажал "Начать заново", не загружаем прогресс
    // Используем ref для синхронной проверки, так как состояние обновляется асинхронно
    if (isStartingOverRef.current || isStartingOver) {
      console.log('⏸️ loadSavedProgressFromServer: пропущено, так как isStartingOver = true', {
        refValue: isStartingOverRef.current,
        stateValue: isStartingOver,
      });
      return;
    }
    // Если пользователь уже нажал "Продолжить" (hasResumed = true), не загружаем прогресс снова
    // Это предотвращает повторное появление экрана "Вы не завершили анкету"
    // Используем ref для синхронной проверки, так как состояние обновляется асинхронно
    if (hasResumedRef.current || hasResumed) {
      console.log('⏸️ loadSavedProgressFromServer: пропущено, так как hasResumed = true (пользователь уже продолжил)', {
        refValue: hasResumedRef.current,
        stateValue: hasResumed,
      });
      return;
    }
    // Проверяем, что Telegram WebApp доступен перед запросом
    if (typeof window === 'undefined' || !window.Telegram?.WebApp?.initData) {
      console.warn('Telegram WebApp не доступен, пропускаем загрузку прогресса с сервера');
      return;
    }

    try {
      const response = await api.getQuizProgress() as {
        progress?: {
          answers: Record<number, string | string[]>;
          questionIndex: number;
          infoScreenIndex: number;
          timestamp: number;
        } | null;
      };
      if (response?.progress && response.progress.answers && Object.keys(response.progress.answers).length > 0) {
        // ВАЖНО: Не загружаем прогресс, если пользователь уже нажал "Продолжить"
        // Это предотвращает повторное появление экрана "Вы не завершили анкету"
        // Используем ref для синхронной проверки, так как состояние обновляется асинхронно
        if (hasResumedRef.current || hasResumed) {
          console.log('⏸️ loadSavedProgressFromServer: пропущено после получения ответа, так как hasResumed = true', {
            refValue: hasResumedRef.current,
            stateValue: hasResumed,
          });
          return;
        }
        
        // ВАЖНО: Еще раз проверяем hasResumedRef ПЕРЕД установкой состояний
        // Это критично, так как запрос мог быть отправлен до установки hasResumedRef
        if (hasResumedRef.current || hasResumed) {
          console.log('⏸️ loadSavedProgressFromServer: пропущено перед установкой состояний, так как hasResumed = true', {
            refValue: hasResumedRef.current,
            stateValue: hasResumed,
          });
          return;
        }
        
        console.log('✅ Прогресс найден на сервере:', {
          answersCount: Object.keys(response.progress.answers).length,
          questionIndex: response.progress.questionIndex,
          infoScreenIndex: response.progress.infoScreenIndex,
        });
        setSavedProgress(response.progress);
        setShowResumeScreen(true);
        // НЕ вызываем setLoading(false) здесь - это сделает init() после загрузки questionnaire
        // Также сохраняем в localStorage для офлайн доступа
        if (typeof window !== 'undefined') {
          localStorage.setItem('quiz_progress', JSON.stringify(response.progress));
        }
      } else {
        console.log('ℹ️ Прогресс на сервере не найден или пуст');
        // ВАЖНО: НЕ очищаем localStorage автоматически, если прогресс не найден на сервере
        // Это может быть временная проблема с сервером, и локальный прогресс может быть валидным
        // Очищаем только если это не перепрохождение анкеты
        if (!isRetakingQuiz && typeof window !== 'undefined') {
          // Проверяем, есть ли локальный прогресс, который может быть валидным
          const localProgress = localStorage.getItem('quiz_progress');
          if (localProgress) {
            try {
              const parsed = JSON.parse(localProgress);
              // Если локальный прогресс старше 7 дней, очищаем его
              if (parsed.timestamp && Date.now() - parsed.timestamp > 7 * 24 * 60 * 60 * 1000) {
                console.log('⚠️ Локальный прогресс слишком старый, очищаем');
                localStorage.removeItem('quiz_progress');
              } else {
                console.log('ℹ️ Оставляем локальный прогресс, так как он может быть валидным');
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
      console.warn('Ошибка загрузки прогресса с сервера:', err);
      // Очищаем localStorage при любой ошибке - прогресс должен быть на сервере
      if (typeof window !== 'undefined') {
        localStorage.removeItem('quiz_progress');
      }
      setSavedProgress(null);
      setShowResumeScreen(false);
    }
  };

  // Сохраняем прогресс в localStorage и на сервер
  const saveProgress = async (newAnswers?: Record<number, string | string[]>, newQuestionIndex?: number, newInfoScreenIndex?: number) => {
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
    
    localStorage.setItem('quiz_progress', JSON.stringify(progress));
    
    // Синхронизируем позицию на сервер (только если Telegram WebApp доступен)
    if (questionnaire && typeof window !== 'undefined' && window.Telegram?.WebApp?.initData) {
      try {
        // Сохраняем позицию через специальный вызов (используем questionId = -1 как маркер)
        await api.saveQuizProgress(
          questionnaire.id,
          -1, // Маркер для метаданных позиции
          JSON.stringify({
            questionIndex: finalQuestionIndex,
            infoScreenIndex: finalInfoScreenIndex,
            timestamp: Date.now(),
          }),
          undefined,
          finalQuestionIndex,
          finalInfoScreenIndex
        );
      } catch (err: any) {
        // Если ошибка 401 - это нормально, прогресс сохранен локально
        if (!err?.message?.includes('401') && !err?.message?.includes('Unauthorized')) {
          console.warn('Ошибка сохранения позиции на сервер:', err);
        }
      }
    }
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
    
    // Также очищаем прогресс на сервере
    if (typeof window !== 'undefined' && window.Telegram?.WebApp?.initData) {
      try {
        await api.clearQuizProgress();
        console.log('✅ Прогресс очищен на сервере');
      } catch (err: any) {
        // Не критично, если не удалось очистить - прогресс просто не будет показываться
        console.warn('⚠️ Не удалось очистить прогресс на сервере:', err);
      }
    }
  };

  const loadQuestionnaire = async () => {
    try {
      const data = await api.getActiveQuestionnaire();
      const questionnaireData = data as Questionnaire;
      addDebugLog('📥 Questionnaire loaded', {
        questionnaireId: questionnaireData.id,
        name: questionnaireData.name,
        version: questionnaireData.version,
        groupsCount: questionnaireData.groups.length,
        questionsCount: questionnaireData.questions.length,
        totalQuestions: questionnaireData.groups.reduce((sum, g) => sum + g.questions.length, 0) + questionnaireData.questions.length,
        questionIds: [
          ...questionnaireData.groups.flatMap((g: any) => g.questions.map((q: Question) => q.id)),
          ...questionnaireData.questions.map((q: Question) => q.id),
        ],
      });
      setQuestionnaire(questionnaireData);
      setError(null); // Очищаем ошибки при успешной загрузке
      return questionnaireData; // Возвращаем загруженную анкету
    } catch (err: any) {
      addDebugLog('❌ Error loading questionnaire', { error: err.message });
      console.error('Ошибка загрузки анкеты:', err);
      // Если ошибка авторизации, не показываем её как критическую
      if (err?.message?.includes('Unauthorized') || err?.message?.includes('401')) {
        // Анкета публичная, эта ошибка не должна возникать
        console.warn('Неожиданная ошибка авторизации при загрузке анкеты');
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

    // Дополнительная валидация: проверяем, что вопрос существует в allQuestions
    const questionExists = allQuestions.some((q: Question) => q.id === questionId);
    if (!questionExists && allQuestions.length > 0) {
      console.error('❌ Question ID not found in allQuestions:', {
        questionId,
        allQuestionIds: allQuestions.map((q: Question) => q.id),
        currentQuestionId: currentQuestion?.id,
      });
      // Если вопрос не найден, не сохраняем ответ
      return;
    }

    const newAnswers = { ...answers, [questionId]: value };
    setAnswers(newAnswers);
    await saveProgress(newAnswers, currentQuestionIndex, currentInfoScreenIndex);
    
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
        console.log('✅ Successfully saved to server');
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

    // Получаем все вопросы с фильтрацией
    const allQuestionsRaw = [
      ...questionnaire.groups.flatMap((g) => g.questions),
      ...questionnaire.questions,
    ];
    
    // Фильтруем вопросы на основе ответов
    // Если пользователь выбрал пол "мужчина", пропускаем вопрос про беременность/кормление
    // При повторном прохождении исключаем вопросы про пол и возраст
    const allQuestions = allQuestionsRaw.filter((question) => {
      // При повторном прохождении исключаем вопросы про пол и возраст
      if (isRetakingQuiz && !showRetakeScreen) {
        if (question.code === 'gender' || question.code === 'GENDER' || 
            question.code === 'age' || question.code === 'AGE' ||
            question.text?.toLowerCase().includes('ваш пол') ||
            question.text?.toLowerCase().includes('сколько вам лет')) {
          return false;
        }
      }
      
      // Проверяем, является ли это вопросом про реакцию на ретинол (retinoid_reaction)
      // Этот вопрос должен показываться только если на вопрос retinoid_usage ответили "Да"
      const isRetinoidReactionQuestion = question.code === 'retinoid_reaction' ||
                                         question.text?.toLowerCase().includes('как кожа реагировала');
      
      if (isRetinoidReactionQuestion) {
        // Ищем ответ на вопрос о использовании ретинола (retinoid_usage)
        let retinoidUsageValue: string | undefined;
        let retinoidUsageQuestion: Question | undefined;
        
        for (const q of allQuestionsRaw) {
          if (q.code === 'retinoid_usage') {
            retinoidUsageQuestion = q;
            if (answers[q.id]) {
              const answerValue = Array.isArray(answers[q.id]) 
                ? (answers[q.id] as string[])[0] 
                : (answers[q.id] as string);
              
              retinoidUsageValue = answerValue;
              
              // Если это не похоже на текст (может быть ID), ищем опцию
              if (q.options && q.options.length > 0) {
                const matchingOption = q.options.find(opt => 
                  opt.id.toString() === answerValue || 
                  opt.value === answerValue ||
                  opt.value?.toLowerCase() === answerValue?.toLowerCase() ||
                  opt.label?.toLowerCase() === answerValue?.toLowerCase()
                );
                if (matchingOption) {
                  retinoidUsageValue = matchingOption.value || matchingOption.label || answerValue;
                }
              }
              break;
            }
          }
        }
        
        // Показываем вопрос только если на вопрос о ретиноле ответили "Да"
        const answeredYes = retinoidUsageValue?.toLowerCase().includes('да') ||
                            retinoidUsageValue?.toLowerCase() === 'yes' ||
                            retinoidUsageValue === 'Да' ||
                            (retinoidUsageQuestion?.options?.some(opt => 
                              (opt.value?.toLowerCase().includes('да') || 
                               opt.label?.toLowerCase().includes('да')) &&
                              (answers[retinoidUsageQuestion.id] === opt.value || 
                               answers[retinoidUsageQuestion.id] === opt.id.toString() ||
                               answers[retinoidUsageQuestion.id] === opt.label)
                            ));
        
        const shouldShow = answeredYes === true;
        if (!shouldShow) {
          console.log('🚫 Question filtered out (retinoid_reaction without "Да" on retinoid_usage):', question.code);
        }
        return shouldShow;
      }
      
      // Проверяем, является ли это вопросом про беременность/кормление
      const isPregnancyQuestion = question.code === 'pregnancy_breastfeeding' || 
                                  question.code === 'pregnancy' ||
                                  question.text?.toLowerCase().includes('беременн') ||
                                  question.text?.toLowerCase().includes('кормлен');
      
      if (!isPregnancyQuestion) {
        return true; // Показываем все остальные вопросы
      }
      
      // Для вопроса про беременность проверяем пол
      // Ищем ответ на вопрос о поле (gender) - проверяем как текущие ответы, так и сохраненные
      let genderValue: string | undefined;
      let genderQuestion: Question | undefined;
      
      for (const q of allQuestionsRaw) {
        if (q.code === 'gender' || q.code === 'GENDER') {
          genderQuestion = q;
          // Проверяем текущие ответы (могут быть еще не загружены при повторном прохождении)
          if (answers[q.id]) {
            const answerValue = Array.isArray(answers[q.id]) 
              ? (answers[q.id] as string[])[0] 
              : (answers[q.id] as string);
            
            // Проверяем, является ли ответ значением опции или ID опции
            genderValue = answerValue;
            
            // Если это не похоже на текст (может быть ID), ищем опцию
            if (q.options && q.options.length > 0) {
              const matchingOption = q.options.find(opt => 
                opt.id.toString() === answerValue || 
                opt.value === answerValue ||
                opt.value?.toLowerCase() === answerValue?.toLowerCase()
              );
              if (matchingOption) {
                genderValue = matchingOption.value || matchingOption.label || answerValue;
              }
            }
            break;
          }
        }
      }
      
      // Если пол "мужчина" или "male", не показываем вопрос про беременность
      const isMale = genderValue?.toLowerCase().includes('мужчин') || 
                     genderValue?.toLowerCase().includes('male') ||
                     genderValue === 'male' ||
                     genderValue === 'мужской' ||
                     genderValue?.toLowerCase() === 'мужской' ||
                     (genderQuestion?.options?.some(opt => 
                       (opt.value?.toLowerCase().includes('мужчин') || 
                        opt.label?.toLowerCase().includes('мужчин') ||
                        opt.value?.toLowerCase().includes('male')) &&
                       (answers[genderQuestion.id] === opt.value || 
                        answers[genderQuestion.id] === opt.id.toString())
                     ));
      
      return !isMale; // Показываем только если не мужчина
    });

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
      
      // Если нет следующего info screen, закрываем pending и переходим к следующему вопросу
      setPendingInfoScreen(null);
      
      // Проверяем, не последний ли это вопрос
      const isLastQuestion = currentQuestionIndex === allQuestions.length - 1;
      if (isLastQuestion) {
        await saveProgress(answers, currentQuestionIndex, currentInfoScreenIndex);
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
    if (currentQuestion && !isRetakingQuiz) {
      const infoScreen = getInfoScreenAfterQuestion(currentQuestion.code);
      if (infoScreen) {
        setPendingInfoScreen(infoScreen);
        await saveProgress(answers, currentQuestionIndex, currentInfoScreenIndex);
        return;
      }
    }

    // Проверяем, не последний ли это вопрос
    const isLastQuestion = currentQuestionIndex === allQuestions.length - 1;
    if (isLastQuestion) {
      // Это последний вопрос - проверяем, есть ли инфо-экраны после него
      // При повторном прохождении пропускаем info screens
      if (!isRetakingQuiz) {
        const infoScreen = getInfoScreenAfterQuestion(currentQuestion.code);
        if (infoScreen) {
          setPendingInfoScreen(infoScreen);
          await saveProgress(answers, currentQuestionIndex, currentInfoScreenIndex);
          return;
        }
      }
      await saveProgress(answers, currentQuestionIndex, currentInfoScreenIndex);
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

    // Если мы на первом начальном информационном экране, возвращаемся на главную
    if (currentInfoScreenIndex === 0) {
      router.push('/');
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

  // Флаг для отслеживания монтирования компонента (уже объявлен выше)
  const redirectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
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

  const submitAnswers = async () => {
    console.log('🚀 submitAnswers вызвана');
    
    if (!questionnaire) {
      console.error('❌ Анкета не загружена');
      if (isMountedRef.current) {
        setError('Анкета не загружена. Пожалуйста, обновите страницу.');
      }
      return;
    }

    if (isSubmitting) {
      console.warn('⚠️ Уже отправляется, игнорируем повторный вызов');
      return;
    }

    if (isMountedRef.current) {
      setIsSubmitting(true);
      setError(null);
    }

    try {
      // Проверяем, что приложение открыто через Telegram
      const initData = typeof window !== 'undefined' ? window.Telegram?.WebApp?.initData : null;
      const isInTelegram = typeof window !== 'undefined' && !!window.Telegram?.WebApp;
      
      console.log('📱 Проверка Telegram WebApp:', {
        hasWindow: typeof window !== 'undefined',
        hasTelegram: typeof window !== 'undefined' && !!window.Telegram,
        hasWebApp: isInTelegram,
        hasInitData: !!initData,
        initDataLength: initData?.length || 0,
      });

      // Если мы в Telegram, но initData нет - это может быть preview mode
      if (isInTelegram && !initData) {
        console.error('❌ Telegram WebApp доступен, но initData отсутствует (возможно, preview mode)');
        if (isMountedRef.current) {
          setError('Приложение открыто в режиме предпросмотра. Пожалуйста, откройте его через кнопку бота или используйте ссылку формата: https://t.me/your_bot?startapp=...');
          setIsSubmitting(false);
        }
        return;
      }

      if (!isInTelegram) {
        console.error('❌ Telegram WebApp не доступен');
        if (isMountedRef.current) {
          setError('Пожалуйста, откройте приложение через Telegram Mini App (не просто по ссылке, а через кнопку бота).');
          setIsSubmitting(false);
        }
        return;
      }

      if (!initData) {
        console.error('❌ Telegram WebApp initData не доступен');
        if (isMountedRef.current) {
          setError('Не удалось получить данные авторизации. Попробуйте обновить страницу.');
          setIsSubmitting(false);
        }
        return;
      }

      // Собираем ответы из state, если они пустые - пытаемся загрузить из localStorage
      let answersToSubmit = answers;
      console.log('📝 Текущие ответы в state:', Object.keys(answersToSubmit).length);
      
      if (Object.keys(answersToSubmit).length === 0) {
        console.log('📦 Ответы пустые, пытаемся загрузить из localStorage...');
        try {
          const savedProgressStr = localStorage.getItem('quiz_progress');
          if (savedProgressStr) {
            const savedProgress = JSON.parse(savedProgressStr);
            if (savedProgress.answers && Object.keys(savedProgress.answers).length > 0) {
              answersToSubmit = savedProgress.answers;
              if (isMountedRef.current) {
                setAnswers(savedProgress.answers);
              }
              console.log('✅ Загружены ответы из localStorage:', Object.keys(savedProgress.answers).length);
            }
          }
        } catch (e) {
          console.error('❌ Ошибка загрузки из localStorage:', e);
        }
      }

      if (Object.keys(answersToSubmit).length === 0) {
        console.error('❌ Нет ответов для отправки');
        if (isMountedRef.current) {
          setError('Нет ответов для отправки. Пожалуйста, пройдите анкету.');
          setIsSubmitting(false);
        }
        return;
      }

      const answerArray = Object.entries(answersToSubmit).map(([questionId, value]) => {
        const isArray = Array.isArray(value);
        return {
          questionId: parseInt(questionId),
          answerValue: isArray ? undefined : (value as string),
          answerValues: isArray ? (value as string[]) : undefined,
        };
      });

      console.log('📤 Отправка ответов на сервер:', {
        questionnaireId: questionnaire.id,
        answersCount: answerArray.length,
      });

      let result: any;
      try {
        result = await api.submitAnswers(questionnaire.id, answerArray) as any;
        console.log('✅ Ответы отправлены, профиль создан:', result);
      } catch (submitError: any) {
        // Если ошибка при отправке - это может быть нормально (дубликат, ошибка сети)
        // Все равно пытаемся редиректить, так как профиль мог быть создан
        console.warn('⚠️ Ошибка при отправке ответов (продолжаем редирект):', submitError);
        result = { success: true, error: submitError?.message }; // Помечаем как success для продолжения
      }
      
      // ВАЖНО: При перепрохождении анкеты НЕ устанавливаем флаг is_retaking_quiz в localStorage
      // Флаг должен быть очищен после успешной отправки, чтобы при следующем заходе показывалась обычная анкета
      // Если это перепрохождение анкеты, очищаем флаг после успешной отправки
      try {
        if (isRetakingQuiz && typeof window !== 'undefined') {
          localStorage.removeItem('is_retaking_quiz');
          localStorage.removeItem('full_retake_from_home');
          console.log('✅ Флаги перепрохождения очищены после успешной отправки ответов');
        }
      } catch (storageError) {
        console.warn('⚠️ Ошибка при очистке localStorage (некритично):', storageError);
      }
      
      // Если это дубликат отправки, все равно перенаправляем пользователя
      if (result?.isDuplicate) {
        console.log('⚠️ Обнаружена повторная отправка, перенаправляем на результаты...');
      }
      
      // Очищаем прогресс перед редиректом (безопасно)
      try {
        clearProgress();
      } catch (clearError) {
        console.warn('⚠️ Ошибка при очистке прогресса (некритично):', clearError);
      }
      
      // ВАЖНО: Не обновляем состояние после редиректа, чтобы избежать React Error #300
      // Сбрасываем флаг монтирования, чтобы предотвратить обновления состояния
      isMountedRef.current = false;
      
      // Небольшая задержка перед редиректом, чтобы профиль точно создался в БД
      console.log('⏳ Ожидание создания профиля...');
      
      // Используем setTimeout вместо await, чтобы не блокировать выполнение
      // и предотвратить обновления состояния после размонтирования
      if (typeof window !== 'undefined') {
        setTimeout(() => {
          try {
            // Редирект на страницу плана
            // ВАЖНО: Используем window.location.replace вместо href, чтобы избежать проблем с историей
            console.log('🔄 Редирект на /plan');
            window.location.replace('/plan');
          } catch (redirectError) {
            console.error('❌ Ошибка при редиректе:', redirectError);
            // Если редирект не сработал, пробуем через href (не используем router после размонтирования)
            try {
              window.location.href = '/plan';
            } catch (hrefError) {
              console.error('❌ Все методы редиректа не сработали:', hrefError);
            }
          }
        }, 1500);
      } else {
        // SSR режим - используем window.location вместо router после размонтирования
        try {
          const win = typeof window !== 'undefined' ? window : null;
          if (win?.location) {
            win.location.replace('/plan');
          }
        } catch (redirectError) {
          console.error('❌ Ошибка при редиректе (SSR):', redirectError);
        }
      }
    } catch (err: any) {
      // ВАЖНО: Все операции должны быть безопасными, чтобы не выбрасывать новые ошибки
      try {
        console.error('❌ Ошибка при отправке ответов:', err);
        console.error('   Error message:', err?.message);
        console.error('   Error stack:', err?.stack);
        console.error('   Error status:', err?.status);
      } catch (logError) {
        // Игнорируем ошибки логирования
      }
      
      // ВАЖНО: Проверяем, что компонент еще смонтирован перед обновлением состояния
      if (!isMountedRef.current) {
        console.warn('⚠️ Компонент размонтирован, пропускаем обновление состояния');
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
        console.log('⚠️ Ошибка при отправке ответов, но продолжаем показывать лоадер и редиректим на /plan');
        
        // Обработка различных типов ошибок - но все равно редиректим
        const errorMessage = err?.message || err?.error || '';
        if (errorMessage.includes('Unauthorized') || errorMessage.includes('401') || errorMessage.includes('initData')) {
          console.warn('⚠️ Ошибка авторизации, но продолжаем редирект');
        } else if (errorMessage.includes('уже была отправлена') || errorMessage.includes('301') || errorMessage.includes('302') || err?.status === 301 || err?.status === 302) {
          // Ошибка 301/302 - форма уже была отправлена - это нормально, редиректим
          console.log('✅ Форма уже была отправлена, редиректим на /plan');
        } else {
          // Другие ошибки - логируем, но все равно редиректим
          console.warn('⚠️ Ошибка при отправке ответов, но продолжаем редирект на /plan:', errorMessage);
        }
      } catch (logError) {
        // Игнорируем ошибки логирования
      }
      
      // ВАЖНО: НЕ устанавливаем setIsSubmitting(false) и НЕ устанавливаем setError
      // Продолжаем показывать лоадер и редиректим на /plan
      // План может генерироваться в фоне, даже если отправка ответов вернула ошибку
      // ВАЖНО: Используем setTimeout с проверкой isMountedRef, чтобы избежать React Error #300
      // Сбрасываем флаг монтирования перед редиректом
      isMountedRef.current = false;
      
      if (typeof window !== 'undefined') {
        try {
          setTimeout(() => {
            try {
              // Используем replace вместо href для предотвращения React Error #300
              console.log('🔄 Редирект на /plan после ошибки');
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
          const win = typeof window !== 'undefined' ? window : null;
          if (win?.location) {
            win.location.replace('/plan');
          }
        } catch (redirectError) {
          // Игнорируем ошибки
        }
      }
    }
  };

  // Продолжить с сохранённого места
  const resumeQuiz = () => {
    if (!savedProgress || !questionnaire) {
      console.error('❌ resumeQuiz: savedProgress or questionnaire is missing', { savedProgress: !!savedProgress, questionnaire: !!questionnaire });
      return;
    }
    
    const initialInfoScreens = INFO_SCREENS.filter(screen => !screen.showAfterQuestionCode);
    
    console.log('🔄 resumeQuiz: Восстанавливаем прогресс', {
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
      console.log('✅ initCompletedRef установлен в resumeQuiz для предотвращения повторной инициализации');
    }
    
    // ВАЖНО: Очищаем localStorage СРАЗУ, чтобы предотвратить повторную загрузку прогресса
    // из loadSavedProgress или loadSavedProgressFromServer
    if (typeof window !== 'undefined') {
      localStorage.removeItem('quiz_progress');
      console.log('✅ localStorage очищен от quiz_progress');
    }
    
    // ВАЖНО: Сохраняем копию savedProgress перед очисткой, так как мы будем использовать его данные
    const progressToRestore = { ...savedProgress };
    
    // ВАЖНО: Очищаем savedProgress СРАЗУ, чтобы предотвратить показ экрана "Вы не завершили анкету"
    // даже если loadSavedProgressFromServer установит setShowResumeScreen(true) позже
    setSavedProgress(null);
    
    // Восстанавливаем прогресс из сохраненной копии
    setAnswers(progressToRestore.answers);
    
    // ВАЖНО: Всегда пропускаем начальные экраны, если пользователь уже начал отвечать на вопросы
    // Если infoScreenIndex указывает на начальный экран, но вопрос уже начался - пропускаем начальные экраны
    if (progressToRestore.infoScreenIndex >= initialInfoScreens.length) {
      // Начальные экраны пройдены, переходим к вопросам
      console.log('✅ resumeQuiz: Начальные экраны пройдены, переходим к вопросу', progressToRestore.questionIndex);
      setCurrentQuestionIndex(progressToRestore.questionIndex);
      setCurrentInfoScreenIndex(progressToRestore.infoScreenIndex);
    } else if (progressToRestore.questionIndex > 0 || Object.keys(progressToRestore.answers).length > 0) {
      // Пользователь уже начал отвечать, но infoScreenIndex еще на начальных экранах
      // Пропускаем все начальные экраны и переходим к сохранённому вопросу
      console.log('✅ resumeQuiz: Пропускаем начальные экраны, переходим к вопросу', progressToRestore.questionIndex);
      setCurrentQuestionIndex(progressToRestore.questionIndex);
      setCurrentInfoScreenIndex(initialInfoScreens.length); // Пропускаем все начальные экраны
    } else {
      // Пользователь еще не начал отвечать, начинаем с начальных экранов
      console.log('✅ resumeQuiz: Начинаем с начальных экранов');
      setCurrentQuestionIndex(0);
      setCurrentInfoScreenIndex(progressToRestore.infoScreenIndex);
    }
    
    console.log('✅ resumeQuiz: Прогресс восстановлен, hasResumed = true, showResumeScreen = false, savedProgress = null, localStorage очищен');
  };

  // Начать заново
  const startOver = async () => {
    console.log('🔄 startOver: Начинаем сброс анкеты', {
      currentPath: typeof window !== 'undefined' ? window.location.pathname : 'unknown',
      initCompleted: initCompletedRef.current,
      isStartingOverRef: isStartingOverRef.current,
    });
    
    // ВАЖНО: Устанавливаем флаг ПЕРЕД очисткой прогресса, чтобы предотвратить загрузку прогресса
    // Используем ref для синхронной установки, чтобы асинхронные функции сразу видели новое значение
    isStartingOverRef.current = true;
    setIsStartingOver(true);
    console.log('🔒 isStartingOverRef установлен в true');
    
    // ВАЖНО: Сбрасываем initCompletedRef, чтобы позволить повторную инициализацию
    // но с правильными флагами (isStartingOverRef = true), чтобы не загружать прогресс
    initCompletedRef.current = false;
    console.log('🔄 initCompletedRef сброшен для повторной инициализации');
    
    // Очищаем весь прогресс (локальный и серверный)
    await clearProgress();
    console.log('✅ Прогресс очищен');
    
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
      console.log('✅ Анкета уже загружена, завершаем инициализацию без повторной загрузки');
      initCompletedRef.current = true;
      isStartingOverRef.current = false;
      setIsStartingOver(false);
      console.log('✅ startOver завершен, анкета уже была загружена');
      return;
    }
    
    // Проверяем путь после всех изменений состояния
    const currentPath = typeof window !== 'undefined' ? window.location.pathname : 'unknown';
    console.log('✅ Анкета начата заново, весь прогресс очищен, возвращаемся на первый экран', {
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
      console.warn('⚠️ Обнаружен редирект с /quiz, возвращаемся на страницу анкеты', {
        currentPath,
        expectedPath: '/quiz',
      });
      window.location.href = '/quiz';
      return;
    }
    
    // НЕ сбрасываем isStartingOverRef - оставляем его установленным
    // Это предотвратит повторную загрузку прогресса даже если компонент перерендерится
    // Флаг будет сброшен только после успешной инициализации анкеты (когда questionnaire загружен)
    console.log('✅ startOver завершен, isStartingOverRef остается true до следующей инициализации');
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
      console.log('⚠️ No questionnaire, allQuestionsRaw is empty');
      return [];
    }
      
      // Защита от ошибок при доступе к groups и questions
      const groups = questionnaire.groups || [];
      const questions = questionnaire.questions || [];
      
      const questionsFromGroups = groups.flatMap((g) => {
        try {
          return g?.questions || [];
        } catch (err) {
          console.error('❌ Error accessing group questions:', err, g);
          return [];
        }
      });
      
    const raw = [
        ...questionsFromGroups,
        ...questions,
    ];
      
      // Убираем вызов addDebugLog из useMemo, чтобы избежать проблем с хуками
      // Логируем только в консоль
      console.log('📋 allQuestionsRaw loaded', {
      total: raw.length,
        fromGroups: questionsFromGroups.length,
        fromQuestions: questions.length,
          questionIds: raw.map((q: Question) => q.id),
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
    
    return allQuestionsRaw.filter((question) => {
        try {
    // При повторном прохождении исключаем вопросы про пол и возраст
    // Эти данные уже записаны в профиле пользователя после первой анкеты
    if (isRetakingQuiz && !showRetakeScreen) {
      // Исключаем вопросы про пол и возраст при полном перепрохождении
      if (question.code === 'gender' || question.code === 'GENDER' || 
          question.code === 'age' || question.code === 'AGE' ||
          question.text?.toLowerCase().includes('ваш пол') ||
          question.text?.toLowerCase().includes('сколько вам лет')) {
        return false;
      }
    }
    
    // Проверяем, является ли это вопросом про реакцию на ретинол (retinoid_reaction)
    // Этот вопрос должен показываться только если на вопрос retinoid_usage ответили "Да"
    const isRetinoidReactionQuestion = question.code === 'retinoid_reaction' ||
                                       question.text?.toLowerCase().includes('как кожа реагировала');
    
    if (isRetinoidReactionQuestion) {
      // Ищем ответ на вопрос о использовании ретинола (retinoid_usage)
      let retinoidUsageValue: string | undefined;
      let retinoidUsageQuestion: Question | undefined;
      
      for (const q of allQuestionsRaw) {
        if (q.code === 'retinoid_usage') {
          retinoidUsageQuestion = q;
          if (answers[q.id]) {
            const answerValue = Array.isArray(answers[q.id]) 
              ? (answers[q.id] as string[])[0] 
              : (answers[q.id] as string);
            
            retinoidUsageValue = answerValue;
            
            // Если это не похоже на текст (может быть ID), ищем опцию
            if (q.options && q.options.length > 0) {
              const matchingOption = q.options.find(opt => 
                opt.id.toString() === answerValue || 
                opt.value === answerValue ||
                opt.value?.toLowerCase() === answerValue?.toLowerCase() ||
                opt.label?.toLowerCase() === answerValue?.toLowerCase()
              );
              if (matchingOption) {
                retinoidUsageValue = matchingOption.value || matchingOption.label || answerValue;
              }
            }
            break;
          }
        }
      }
      
      // Показываем вопрос только если на вопрос о ретиноле ответили "Да"
      const answeredYes = retinoidUsageValue?.toLowerCase().includes('да') ||
                          retinoidUsageValue?.toLowerCase() === 'yes' ||
                          retinoidUsageValue === 'Да' ||
                          (retinoidUsageQuestion?.options?.some(opt => 
                            (opt.value?.toLowerCase().includes('да') || 
                             opt.label?.toLowerCase().includes('да')) &&
                            (answers[retinoidUsageQuestion.id] === opt.value || 
                             answers[retinoidUsageQuestion.id] === opt.id.toString() ||
                             answers[retinoidUsageQuestion.id] === opt.label)
                          ));
      
      const shouldShow = answeredYes === true;
      if (!shouldShow) {
        console.log('🚫 Question filtered out (retinoid_reaction without "Да" on retinoid_usage):', question.code);
      }
      return shouldShow;
    }
    
    // Проверяем, является ли это вопросом про беременность/кормление
    const isPregnancyQuestion = question.code === 'pregnancy_breastfeeding' || 
                                question.code === 'pregnancy' ||
                                question.text?.toLowerCase().includes('беременн') ||
                                question.text?.toLowerCase().includes('кормлен');
    
    if (!isPregnancyQuestion) {
      return true; // Показываем все остальные вопросы
    }
    
    // Для вопроса про беременность проверяем пол
    // Ищем ответ на вопрос о поле (gender)
    const genderAnswer = Object.values(answers).find((_, idx) => {
      const questionId = Object.keys(answers)[idx];
      const q = allQuestionsRaw.find((q: Question) => q.id.toString() === questionId);
      return q?.code === 'gender';
    });
    
    // Или ищем по коду вопроса gender
    let genderValue: string | undefined;
    let genderQuestion: Question | undefined;
    
    for (const q of allQuestionsRaw) {
      if (q.code === 'gender') {
        genderQuestion = q;
        if (answers[q.id]) {
          const answerValue = Array.isArray(answers[q.id]) 
            ? (answers[q.id] as string[])[0] 
            : (answers[q.id] as string);
          
          // Проверяем, является ли ответ значением опции или ID опции
          genderValue = answerValue;
          
          // Если это не похоже на текст (может быть ID), ищем опцию
          if (q.options && q.options.length > 0) {
            const matchingOption = q.options.find(opt => 
              opt.id.toString() === answerValue || 
              opt.value === answerValue ||
              opt.value?.toLowerCase() === answerValue?.toLowerCase()
            );
            if (matchingOption) {
              genderValue = matchingOption.value || matchingOption.label || answerValue;
            }
          }
          break;
        }
      }
    }
    
    // Если пол "мужчина" или "male", не показываем вопрос про беременность
    const isMale = genderValue?.toLowerCase().includes('мужчин') || 
                   genderValue?.toLowerCase().includes('male') ||
                   genderValue === 'male' ||
                   genderValue === 'мужской' ||
                   genderValue?.toLowerCase() === 'мужской' ||
                   (genderQuestion?.options?.some(opt => 
                     (opt.value?.toLowerCase().includes('мужчин') || 
                      opt.label?.toLowerCase().includes('мужчин') ||
                      opt.value?.toLowerCase().includes('male')) &&
                     (answers[genderQuestion.id] === opt.value || 
                      answers[genderQuestion.id] === opt.id.toString())
                   ));
    
      const shouldShow = !isMale; // Показываем только если не мужчина
      if (!shouldShow) {
        console.log('🚫 Question filtered out (pregnancy question for male):', question.code);
      }
      return shouldShow;
        } catch (filterErr) {
          console.error('❌ Error filtering question:', filterErr, question);
          // В случае ошибки показываем вопрос (безопасный вариант)
          return true;
        }
      });
    } catch (err) {
      console.error('❌ Error computing allQuestions:', err, {
        allQuestionsRawLength: allQuestionsRaw?.length,
        answersKeys: Object.keys(answers || {}),
      });
      // В случае ошибки возвращаем все вопросы из allQuestionsRaw
      return allQuestionsRaw || [];
    }
  }, [allQuestionsRaw, answers, isRetakingQuiz, showRetakeScreen]);
  
  // Логируем результат фильтрации после вычисления
  useEffect(() => {
    if (allQuestions.length > 0) {
      // Логируем только в консоль, не используем addDebugLog чтобы избежать проблем с хуками
      console.log('✅ allQuestions after filtering', {
        total: allQuestions.length,
        questionIds: allQuestions.map((q: Question) => q.id),
        questionCodes: allQuestions.map((q: Question) => q.code),
      });
    }
  }, [allQuestions]);

  // Корректируем currentQuestionIndex после восстановления прогресса
  // Это важно, потому что после фильтрации вопросов индекс может стать невалидным
  useEffect(() => {
    if (!hasResumed || !questionnaire || allQuestions.length === 0) return;
    
    // Если currentQuestionIndex выходит за пределы массива, корректируем его
    if (currentQuestionIndex >= allQuestions.length) {
      // Логируем только в консоль, не используем addDebugLog чтобы избежать проблем с хуками
      console.log('⚠️ currentQuestionIndex выходит за пределы, корректируем', {
        currentQuestionIndex,
        allQuestionsLength: allQuestions.length,
      });
      setCurrentQuestionIndex(Math.max(0, allQuestions.length - 1));
    }
    
    // Также убеждаемся, что мы не на начальных экранах после восстановления
    const initialInfoScreens = INFO_SCREENS.filter(screen => !screen.showAfterQuestionCode);
    if (hasResumed && currentInfoScreenIndex < initialInfoScreens.length && currentQuestionIndex > 0) {
      console.log('✅ Корректируем infoScreenIndex после восстановления');
      setCurrentInfoScreenIndex(initialInfoScreens.length);
    }
  }, [hasResumed, allQuestions, currentQuestionIndex, currentInfoScreenIndex, questionnaire]);

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
    const allQuestionsRaw = [
      ...questionnaire.groups.flatMap((g) => g.questions),
      ...questionnaire.questions,
    ];
    
    // Фильтруем вопросы на основе ответов
    const allQuestions = allQuestionsRaw.filter((question) => {
      // При повторном прохождении исключаем вопросы про пол и возраст
      if (isRetakingQuiz && !showRetakeScreen) {
        if (question.code === 'gender' || question.code === 'GENDER' || 
            question.code === 'age' || question.code === 'AGE' ||
            question.text?.toLowerCase().includes('ваш пол') ||
            question.text?.toLowerCase().includes('сколько вам лет')) {
          return false;
        }
      }
      
      // Проверяем, является ли это вопросом про реакцию на ретинол (retinoid_reaction)
      const isRetinoidReactionQuestion = question.code === 'retinoid_reaction' ||
                                         question.text?.toLowerCase().includes('как кожа реагировала');
      
      if (isRetinoidReactionQuestion) {
        // Ищем ответ на вопрос о использовании ретинола (retinoid_usage)
        let retinoidUsageValue: string | undefined;
        let retinoidUsageQuestion: Question | undefined;
        
        for (const q of allQuestionsRaw) {
          if (q.code === 'retinoid_usage') {
            retinoidUsageQuestion = q;
            if (answers[q.id]) {
              const answerValue = Array.isArray(answers[q.id]) 
                ? (answers[q.id] as string[])[0] 
                : (answers[q.id] as string);
              
              retinoidUsageValue = answerValue;
              
              if (q.options && q.options.length > 0) {
                const matchingOption = q.options.find(opt => 
                  opt.id.toString() === answerValue || 
                  opt.value === answerValue ||
                  opt.value?.toLowerCase() === answerValue?.toLowerCase() ||
                  opt.label?.toLowerCase() === answerValue?.toLowerCase()
                );
                if (matchingOption) {
                  retinoidUsageValue = matchingOption.value || matchingOption.label || answerValue;
                }
              }
              break;
            }
          }
        }
        
        const answeredYes = retinoidUsageValue?.toLowerCase().includes('да') ||
                            retinoidUsageValue?.toLowerCase() === 'yes' ||
                            retinoidUsageValue === 'Да' ||
                            (retinoidUsageQuestion?.options?.some(opt => 
                              (opt.value?.toLowerCase().includes('да') || 
                               opt.label?.toLowerCase().includes('да')) &&
                              (answers[retinoidUsageQuestion.id] === opt.value || 
                               answers[retinoidUsageQuestion.id] === opt.id.toString() ||
                               answers[retinoidUsageQuestion.id] === opt.label)
                            ));
        
        return answeredYes === true;
      }
      
      const isPregnancyQuestion = question.code === 'pregnancy_breastfeeding' || 
                                  question.code === 'pregnancy' ||
                                  question.text?.toLowerCase().includes('беременн') ||
                                  question.text?.toLowerCase().includes('кормлен');
      
      if (!isPregnancyQuestion) {
        return true;
      }
      
      let genderValue: string | undefined;
      let genderQuestion: Question | undefined;
      
      for (const q of allQuestionsRaw) {
        if (q.code === 'gender' || q.code === 'GENDER') {
          genderQuestion = q;
          // Проверяем текущие ответы (включая сохраненные при повторном прохождении)
          if (answers[q.id]) {
            const answerValue = Array.isArray(answers[q.id]) 
              ? (answers[q.id] as string[])[0] 
              : (answers[q.id] as string);
            
            genderValue = answerValue;
            
            if (q.options && q.options.length > 0) {
              const matchingOption = q.options.find(opt => 
                opt.id.toString() === answerValue || 
                opt.value === answerValue ||
                opt.value?.toLowerCase() === answerValue?.toLowerCase()
              );
              if (matchingOption) {
                genderValue = matchingOption.value || matchingOption.label || answerValue;
              }
            }
            break;
          }
        }
      }
      
      const isMale = genderValue?.toLowerCase().includes('мужчин') || 
                     genderValue?.toLowerCase().includes('male') ||
                     genderValue === 'male' ||
                     genderValue === 'мужской' ||
                     genderValue?.toLowerCase() === 'мужской' ||
                     (genderQuestion?.options?.some(opt => 
                       (opt.value?.toLowerCase().includes('мужчин') || 
                        opt.label?.toLowerCase().includes('мужчин') ||
                        opt.value?.toLowerCase().includes('male')) &&
                       (answers[genderQuestion.id] === opt.value || 
                        answers[genderQuestion.id] === opt.id.toString())
                     ));
      
      return !isMale;
    });
    
    // ВАЖНО: При полном перепрохождении (isRetakingQuiz && !showRetakeScreen) пропускаем все инфо-экраны
    // Это включает как начальные инфо-экраны, так и инфо-экраны между вопросами
    if (allQuestions.length > 0 && isRetakingQuiz && !showRetakeScreen) {
      // Переходим сразу к первому вопросу, пропуская все начальные инфо-экраны
      const initialInfoScreensCount = INFO_SCREENS.filter(screen => !screen.showAfterQuestionCode).length;
      // ВАЖНО: Всегда устанавливаем currentInfoScreenIndex в initialInfoScreensCount при перепрохождении
      // Это гарантирует, что начальные инфо-экраны не будут показаны
      if (currentInfoScreenIndex < initialInfoScreensCount) {
        setCurrentInfoScreenIndex(initialInfoScreensCount);
        console.log('✅ Full retake: Setting currentInfoScreenIndex to skip all initial info screens');
      }
      // Если currentQuestionIndex = 0 и нет ответов, это начало перепрохождения
      if (currentQuestionIndex === 0 && Object.keys(answers).length === 0) {
        setCurrentQuestionIndex(0);
        setPendingInfoScreen(null); // Очищаем pending info screen
        console.log('✅ Full retake: Starting from first question, skipping all info screens');
      }
    }
  }, [isRetakingQuiz, questionnaire, currentInfoScreenIndex, currentQuestionIndex, showResumeScreen, savedProgress, hasResumed, answers, showRetakeScreen]);

  // Разделяем инфо-экраны на начальные (без showAfterQuestionCode) и те, что между вопросами
  const initialInfoScreens = useMemo(() => INFO_SCREENS.filter(screen => !screen.showAfterQuestionCode), []);

  // Определяем, показываем ли мы начальный инфо-экран
  // При повторном прохождении или после восстановления прогресса пропускаем все info screens
  // ВАЖНО: Если hasResumed = true, значит пользователь нажал "Продолжить" и мы не должны показывать начальные экраны
  // Также пропускаем, если пользователь уже начал отвечать (currentQuestionIndex > 0 или есть ответы)
  // ВАЖНО: Если есть savedProgress, значит пользователь должен продолжить, и мы не должны показывать начальные экраны
  const isShowingInitialInfoScreen = useMemo(() => {
    // Если показывается экран выбора тем при перепрохождении - не показываем начальные экраны
    if (showRetakeScreen && isRetakingQuiz) {
      return false;
    }
    // Если показывается экран продолжения - не показываем начальные экраны
    if (showResumeScreen) {
      return false;
    }
    // Если есть сохраненный прогресс (даже если еще не нажали "Продолжить") - не показываем начальные экраны
    // Это предотвращает показ начальных экранов на промежуточных рендерах после resumeQuiz
    if (savedProgress && savedProgress.answers && Object.keys(savedProgress.answers).length > 0) {
      return false;
    }
    // Если пользователь восстановил прогресс - не показываем начальные экраны
    if (hasResumed) {
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
      console.log('📺 isShowingInitialInfoScreen: true', {
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
  }, [showResumeScreen, showRetakeScreen, savedProgress, hasResumed, isRetakingQuiz, currentQuestionIndex, answers, currentInfoScreenIndex, initialInfoScreens.length]);
  
  const currentInitialInfoScreen = isShowingInitialInfoScreen ? initialInfoScreens[currentInfoScreenIndex] : null;
  
  // Текущий вопрос (показывается после начальных инфо-экранов)
  const currentQuestion = useMemo(() => {
    // Убираем все console.log из useMemo - они могут вызывать проблемы с рендерингом
    if (isShowingInitialInfoScreen || pendingInfoScreen) {
      return null;
    }
    if (currentQuestionIndex >= 0 && currentQuestionIndex < allQuestions.length) {
      return allQuestions[currentQuestionIndex];
    }
    return null;
  }, [isShowingInitialInfoScreen, pendingInfoScreen, currentQuestionIndex, allQuestions]);

  // ВАЖНО: Автоматически отправляем ответы когда все вопросы отвечены
  // Этот useEffect должен быть ВСЕГДА вызван, даже если есть ранние return'ы, чтобы соблюдать порядок хуков
  // ВАЖНО: submitAnswers объявлена позже, но это не проблема, так как useEffect выполняется после рендера
  useEffect(() => {
    // Автоматически отправляем ответы, если все вопросы отвечены и ответы есть
    if (!autoSubmitTriggeredRef.current && 
        questionnaire && 
        allQuestions.length > 0 && 
        currentQuestionIndex >= allQuestions.length &&
        Object.keys(answers).length > 0 &&
        !isSubmitting &&
        !hasResumed &&
        !showResumeScreen &&
        !error) {
      
      console.log('✅ Все вопросы отвечены, автоматически отправляем ответы через 5 секунд...');
      autoSubmitTriggeredRef.current = true;
      setAutoSubmitTriggered(true);
      
      // Показываем лоадер 5 секунд перед отправкой
      setIsSubmitting(true);
      
      // Используем setTimeout, чтобы submitAnswers была доступна к моменту выполнения
      setTimeout(() => {
        if (isMountedRef.current && typeof submitAnswers === 'function') {
          submitAnswers().catch((err) => {
            console.error('❌ Ошибка при автоматической отправке ответов:', err);
            if (isMountedRef.current) {
              autoSubmitTriggeredRef.current = false; // Разрешаем повторную попытку
              setAutoSubmitTriggered(false);
              setIsSubmitting(false);
              setError(err?.message || 'Ошибка отправки ответов');
            }
          });
        }
      }, 5000); // 5 секунд лоадера
    }
    // ВАЖНО: Не включаем submitAnswers в зависимости, так как она объявлена позже
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentQuestionIndex, allQuestions.length, Object.keys(answers).length, questionnaire, isSubmitting, hasResumed, showResumeScreen, autoSubmitTriggered, error]);

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
    return (
      <div style={{ padding: '20px' }}>
        <h1>Анкета не найдена</h1>
        <p>Активная анкета не найдена. Обратитесь к администратору.</p>
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
    
    console.log('🔄 Retake screen check:', {
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
        console.log('⚠️ Payment not completed for topic, showing payment gate');
        // PaymentGate будет показан для этой темы
        return;
      }
      
      console.log('✅ Payment completed for topic, allowing topic selection:', topic.id);
      // Сбрасываем флаг оплаты после выбора темы - каждая тема требует отдельной оплаты
      if (typeof window !== 'undefined') {
        localStorage.removeItem(topicPaymentKey);
        console.log('🔄 Payment flag cleared - next topic will require new payment');
      }
      // Перенаправляем на страницу обновления по теме только после оплаты
      router.push(`/quiz/update/${topic.id}`);
    };

    const handleFullRetake = () => {
      // Для полного перепрохождения нужна отдельная оплата 99₽
      if (!hasFullRetakePayment) {
        console.log('⚠️ Full retake payment not completed, showing payment gate');
        // Показываем PaymentGate для полного перепрохождения
        return;
      }
      console.log('✅ Full retake payment completed, allowing full retake');
      // Сбрасываем флаг оплаты после использования
      if (typeof window !== 'undefined') {
        localStorage.removeItem('payment_full_retake_completed');
        console.log('🔄 Full retake payment flag cleared');
      }
      // Полное перепрохождение - скрываем экран выбора тем и показываем все вопросы
      setShowRetakeScreen(false);
      // ВАЖНО: Устанавливаем флаг перепрохождения, чтобы пропустить все info screens
      setIsRetakingQuiz(true);
      // ВАЖНО: НЕ очищаем ответы при перепрохождении - пользователь может хотеть изменить только часть ответов
      // Очищаем только если пользователь явно выбрал "Пройти всю анкету заново"
      // setAnswers({}); // УДАЛЕНО - не очищаем ответы
      // Пропускаем все начальные info screens - переходим сразу к вопросам
      if (questionnaire) {
        const initialInfoScreens = INFO_SCREENS.filter(screen => !screen.showAfterQuestionCode);
        setCurrentInfoScreenIndex(initialInfoScreens.length);
        setCurrentQuestionIndex(0);
        // Очищаем pending info screen, если он был установлен
        setPendingInfoScreen(null);
        // ВАЖНО: НЕ очищаем сохраненный прогресс - он может содержать полезные данные
        // Очищаем только если пользователь явно выбрал "Пройти всю анкету заново"
        // if (typeof window !== 'undefined') {
        //   localStorage.removeItem('quiz_progress');
        // }
        console.log('✅ Full retake: Skipping all info screens, starting from first question (answers preserved)');
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
                      console.log('✅ Payment completed for topic, allowing selection');
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
                  console.log('✅ Full retake payment: Skipping all info screens, starting from first question');
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
    const allQuestionsRaw = questionnaire ? [
      ...questionnaire.groups.flatMap((g) => g.questions),
      ...questionnaire.questions,
    ] : [];
    
    // Фильтруем вопросы на основе ответов
    const allQuestions = allQuestionsRaw.filter((question) => {
      // Проверяем, является ли это вопросом про реакцию на ретинол (retinoid_reaction)
      const isRetinoidReactionQuestion = question.code === 'retinoid_reaction' ||
                                         question.text?.toLowerCase().includes('как кожа реагировала');
      
      if (isRetinoidReactionQuestion) {
        // Ищем ответ на вопрос о использовании ретинола (retinoid_usage)
        // Используем все ответы, включая сохраненные из savedProgress
        const allAnswers = { ...answers, ...(savedProgress?.answers || {}) };
        let retinoidUsageValue: string | undefined;
        let retinoidUsageQuestion: Question | undefined;
        
        for (const q of allQuestionsRaw) {
          if (q.code === 'retinoid_usage') {
            retinoidUsageQuestion = q;
            if (allAnswers[q.id]) {
              const answerValue = Array.isArray(allAnswers[q.id]) 
                ? (allAnswers[q.id] as string[])[0] 
                : (allAnswers[q.id] as string);
              
              retinoidUsageValue = answerValue;
              
              if (q.options && q.options.length > 0) {
                const matchingOption = q.options.find(opt => 
                  opt.id.toString() === answerValue || 
                  opt.value === answerValue ||
                  opt.value?.toLowerCase() === answerValue?.toLowerCase() ||
                  opt.label?.toLowerCase() === answerValue?.toLowerCase()
                );
                if (matchingOption) {
                  retinoidUsageValue = matchingOption.value || matchingOption.label || answerValue;
                }
              }
              break;
            }
          }
        }
        
        const answeredYes = retinoidUsageValue?.toLowerCase().includes('да') ||
                            retinoidUsageValue?.toLowerCase() === 'yes' ||
                            retinoidUsageValue === 'Да' ||
                            (retinoidUsageQuestion?.options?.some(opt => 
                              (opt.value?.toLowerCase().includes('да') || 
                               opt.label?.toLowerCase().includes('да')) &&
                              (allAnswers[retinoidUsageQuestion.id] === opt.value || 
                               allAnswers[retinoidUsageQuestion.id] === opt.id.toString() ||
                               allAnswers[retinoidUsageQuestion.id] === opt.label)
                            ));
        
        return answeredYes === true;
      }
      
      const isPregnancyQuestion = question.code === 'pregnancy_breastfeeding' || 
                                  question.code === 'pregnancy' ||
                                  question.text?.toLowerCase().includes('беременн') ||
                                  question.text?.toLowerCase().includes('кормлен');
      
      if (!isPregnancyQuestion) {
        return true;
      }
      
      // Проверяем пол из сохраненных ответов (включая ответы из savedProgress)
      let genderValue: string | undefined;
      let genderQuestion: Question | undefined;
      
      // Сначала проверяем savedProgress (может содержать сохраненные ответы)
      const allAnswers = { ...answers, ...(savedProgress?.answers || {}) };
      
      for (const q of allQuestionsRaw) {
        if (q.code === 'gender' || q.code === 'GENDER') {
          genderQuestion = q;
          // Проверяем как текущие ответы, так и сохраненные
          if (allAnswers[q.id]) {
            const answerValue = Array.isArray(allAnswers[q.id]) 
              ? (allAnswers[q.id] as string[])[0] 
              : (allAnswers[q.id] as string);
            
            genderValue = answerValue;
            
            if (q.options && q.options.length > 0) {
              const matchingOption = q.options.find(opt => 
                opt.id.toString() === answerValue || 
                opt.value === answerValue ||
                opt.value?.toLowerCase() === answerValue?.toLowerCase()
              );
              if (matchingOption) {
                genderValue = matchingOption.value || matchingOption.label || answerValue;
              }
            }
            break;
          }
        }
      }
      
      const isMale = genderValue?.toLowerCase().includes('мужчин') || 
                     genderValue?.toLowerCase().includes('male') ||
                     genderValue === 'male' ||
                     genderValue === 'мужской' ||
                     genderValue?.toLowerCase() === 'мужской' ||
                     (genderQuestion?.options?.some(opt => 
                       (opt.value?.toLowerCase().includes('мужчин') || 
                        opt.label?.toLowerCase().includes('мужчин') ||
                        opt.value?.toLowerCase().includes('male')) &&
                       (answers[genderQuestion.id] === opt.value || 
                        answers[genderQuestion.id] === opt.id.toString())
                     ));
      
      return !isMale;
    });
    
    const answeredCount = Object.keys(savedProgress.answers).length;
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
              {screen.content.map((testimonial: any, idx: number) => (
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
              {screen.content.map((product: any, idx: number) => (
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
                  console.log('🔘 handleGetPlan вызван');
                  
                  if (isSubmitting) {
                    console.warn('⚠️ Уже отправляется');
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
                  
                  console.log('📱 Проверка Telegram перед отправкой:', {
                    hasWindow: typeof window !== 'undefined',
                    hasTelegram: isInTelegram,
                    hasInitData: !!initData,
                    initDataLength: initData?.length || 0,
                  });
                  
                  if (!isInTelegram || !initData) {
                    console.error('❌ Telegram WebApp или initData недоступен');
                    setError('Пожалуйста, откройте приложение через Telegram Mini App и обновите страницу.');
                    return;
                  }
                  
                  console.log('🚀 Запуск submitAnswers...');
                  setIsSubmitting(true);
                  setError(null);
                  
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

  // Если показывается информационный экран между вопросами
  // При повторном прохождении пропускаем все info screens
  if (pendingInfoScreen && !isRetakingQuiz) {
    return renderInfoScreen(pendingInfoScreen);
  }

  // Если мы на начальном информационном экране
  // При повторном прохождении пропускаем все info screens
  if (isShowingInitialInfoScreen && currentInitialInfoScreen && !isRetakingQuiz) {
    return renderInfoScreen(currentInitialInfoScreen);
  }

  // Если вопрос не найден, но пользователь восстановил прогресс - это может быть временное состояние
  // Даем время на обновление состояния после resumeQuiz
  if (!currentQuestion && !hasResumed && !showResumeScreen) {
    // Если анкета загружена и есть вопросы, но currentQuestionIndex выходит за пределы
    if (questionnaire && allQuestions.length > 0) {
      // Проверяем, не выходит ли индекс за пределы
      if (currentQuestionIndex >= allQuestions.length) {
        // Это последний вопрос - автоматически показываем лоадер и отправляем ответы
        // Не показываем экран "Анкета завершена. Отправить ответы?" - сразу лоадер
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
    }
    
    // Если вопрос не найден и это не ожидаемое состояние - показываем ошибку
    if (questionnaire && allQuestions.length > 0) {
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
    
    // Если анкета еще не загружена - показываем загрузку
    if (loading) {
      return (
        <div style={{ padding: '20px', textAlign: 'center' }}>
          <div>Загрузка анкеты...</div>
        </div>
      );
    }
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
    // Если автоматическая отправка запущена - показываем лоадер
    if (isSubmitting && autoSubmitTriggered) {
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
    
    // Если есть ошибка, показываем её
    if (error) {
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
                  onClick={() => {
                    handleAnswer(currentQuestion.id, option.value);
                    // При повторном прохождении не делаем автопереход, только при первом прохождении
                    if (!isRetakingQuiz) {
                      if (isLastQuestion) {
                        const infoScreenAfter = getInfoScreenAfterQuestion(currentQuestion.code);
                        if (infoScreenAfter) {
                          setTimeout(handleNext, 300);
                        }
                      } else {
                        setTimeout(handleNext, 300);
                      }
                    }
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
    </div>
  );
}