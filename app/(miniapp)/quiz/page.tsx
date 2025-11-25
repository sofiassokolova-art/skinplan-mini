// app/(miniapp)/quiz/page.tsx
// Страница анкеты - базовая структура для миграции

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTelegram } from '@/lib/telegram-client';
import { api } from '@/lib/api';
import { INFO_SCREENS, getInfoScreenAfterQuestion, type InfoScreen } from './info-screens';

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
  const { initialize, isAvailable, initData } = useTelegram();
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

  useEffect(() => {
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
      // Инициализируем Telegram WebApp
      initialize();
      
      // Ждем готовности Telegram WebApp
      await waitForTelegram();
      
      // Автоматическая авторизация через Telegram
      let token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
      
      // Если токена нет, пытаемся авторизоваться через Telegram
      if (!token && typeof window !== 'undefined' && window.Telegram?.WebApp?.initData) {
        try {
          const telegramInitData = window.Telegram.WebApp.initData;
          console.log('🔐 Автоматическая авторизация через Telegram...');
          const authResult = await api.authTelegram(telegramInitData);
          if (authResult.token) {
            token = authResult.token;
            console.log('✅ Авторизованы через Telegram');
          }
        } catch (err) {
          console.error('❌ Ошибка автоматической авторизации:', err);
        }
      }

      // Загружаем анкету (публичный маршрут, не требует авторизации)
      await loadQuestionnaire();

      // Загружаем прогресс с сервера (требует авторизации)
      if (token) {
        try {
          await loadSavedProgressFromServer();
        } catch (err) {
          console.warn('Не удалось загрузить прогресс с сервера:', err);
          // Fallback на localStorage
          loadSavedProgress();
        }
      } else {
        // Если токена нет, загружаем только из localStorage
        loadSavedProgress();
      }
    };
    
    init().catch((err) => {
      console.error('Ошибка инициализации:', err);
      setError('Ошибка загрузки. Пожалуйста, обновите страницу.');
      setLoading(false);
    });
  }, []);

  // Загружаем сохранённый прогресс из localStorage (fallback)
  const loadSavedProgress = () => {
    if (typeof window === 'undefined') return;
    
    const saved = localStorage.getItem('quiz_progress');
    if (saved) {
      try {
        const progress = JSON.parse(saved);
        setSavedProgress(progress);
        // Показываем экран продолжения только если есть сохранённые ответы
        if (progress.answers && Object.keys(progress.answers).length > 0) {
          setShowResumeScreen(true);
        }
      } catch (err) {
        console.error('Error loading saved progress:', err);
      }
    }
  };

  // Загружаем прогресс с сервера (синхронизация между устройствами)
  const loadSavedProgressFromServer = async () => {
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
        setSavedProgress(response.progress);
        setShowResumeScreen(true);
        // Также сохраняем в localStorage для офлайн доступа
        if (typeof window !== 'undefined') {
          localStorage.setItem('quiz_progress', JSON.stringify(response.progress));
        }
      }
    } catch (err) {
      console.warn('Не удалось загрузить прогресс с сервера:', err);
      // Fallback на localStorage
      loadSavedProgress();
    }
  };

  // Сохраняем прогресс в localStorage
  const saveProgress = (newAnswers?: Record<number, string | string[]>, newQuestionIndex?: number, newInfoScreenIndex?: number) => {
    if (typeof window === 'undefined') return;
    
    const progress = {
      answers: newAnswers || answers,
      questionIndex: newQuestionIndex !== undefined ? newQuestionIndex : currentQuestionIndex,
      infoScreenIndex: newInfoScreenIndex !== undefined ? newInfoScreenIndex : currentInfoScreenIndex,
      timestamp: Date.now(),
    };
    
    localStorage.setItem('quiz_progress', JSON.stringify(progress));
  };

  // Очищаем сохранённый прогресс
  const clearProgress = () => {
    if (typeof window === 'undefined') return;
    localStorage.removeItem('quiz_progress');
    setSavedProgress(null);
    setShowResumeScreen(false);
  };

  const loadQuestionnaire = async () => {
    try {
      const data = await api.getActiveQuestionnaire();
      setQuestionnaire(data as Questionnaire);
      setError(null); // Очищаем ошибки при успешной загрузке
    } catch (err: any) {
      console.error('Ошибка загрузки анкеты:', err);
      // Если ошибка авторизации, не показываем её как критическую
      if (err?.message?.includes('Unauthorized') || err?.message?.includes('401')) {
        // Анкета публичная, эта ошибка не должна возникать
        console.warn('Неожиданная ошибка авторизации при загрузке анкеты');
      }
      setError(err?.message || 'Ошибка загрузки анкеты');
    } finally {
      setLoading(false);
    }
  };

  const handleAnswer = async (questionId: number, value: string | string[]) => {
    console.log('💾 Сохраняем ответ:', { questionId, value });
    const newAnswers = { ...answers, [questionId]: value };
    setAnswers(newAnswers);
    console.log('✅ Ответы обновлены:', newAnswers);
    
    // Сохраняем в localStorage
    saveProgress(newAnswers, currentQuestionIndex, currentInfoScreenIndex);
    
    // Сохраняем в БД для синхронизации между устройствами
    if (questionnaire) {
      try {
        const isArray = Array.isArray(value);
        await api.saveQuizProgress(
          questionnaire.id,
          questionId,
          isArray ? undefined : (value as string),
          isArray ? (value as string[]) : undefined
        );
        console.log('✅ Прогресс сохранён на сервере');
      } catch (err) {
        console.warn('⚠️ Не удалось сохранить прогресс на сервере:', err);
      }
    }
  };

  const handleNext = () => {
    if (!questionnaire) return;

    const allQuestions = [
      ...questionnaire.groups.flatMap((g) => g.questions),
      ...questionnaire.questions,
    ];

    // Если показывается информационный экран между вопросами, проверяем, есть ли следующий инфо-экран в цепочке
    if (pendingInfoScreen) {
      // Проверяем, есть ли следующий инфо-экран, который должен быть показан после текущего
      const nextInfoScreen = INFO_SCREENS.find(screen => screen.showAfterQuestionCode === pendingInfoScreen.id);
      if (nextInfoScreen) {
        // Показываем следующий инфо-экран в цепочке
        console.log('📱 Показываем следующий инфо-экран в цепочке:', nextInfoScreen.id);
        setPendingInfoScreen(nextInfoScreen);
        saveProgress(answers, currentQuestionIndex, currentInfoScreenIndex);
        return;
      }

      // Если следующего инфо-экрана нет - это последний инфо-экран (want_improve)
      // На последнем инфо-экране будет кнопка "Получить план"
      console.log('✅ Это последний инфо-экран, кнопка "Получить план" должна быть видна');
      saveProgress(answers, currentQuestionIndex, currentInfoScreenIndex);
      return;
    }

    const initialInfoScreens = INFO_SCREENS.filter(screen => !screen.showAfterQuestionCode);

    // Если мы на начальных информационных экранах, переходим к следующему или к вопросам
    if (currentInfoScreenIndex < initialInfoScreens.length - 1) {
      const newIndex = currentInfoScreenIndex + 1;
      setCurrentInfoScreenIndex(newIndex);
      saveProgress(answers, currentQuestionIndex, newIndex);
      return;
    }

    if (currentInfoScreenIndex === initialInfoScreens.length - 1) {
      // Переходим к первому вопросу
      const newInfoIndex = initialInfoScreens.length;
      setCurrentInfoScreenIndex(newInfoIndex);
      setCurrentQuestionIndex(0);
      saveProgress(answers, 0, newInfoIndex);
      return;
    }

    // Проверяем, нужно ли показать информационный экран после текущего вопроса
    const currentQuestion = allQuestions[currentQuestionIndex];
    if (currentQuestion) {
      const infoScreen = getInfoScreenAfterQuestion(currentQuestion.code);
      if (infoScreen) {
        // Показываем информационный экран перед следующим вопросом
        console.log('📱 Показываем информационный экран после вопроса', currentQuestion.code);
        setPendingInfoScreen(infoScreen);
        saveProgress(answers, currentQuestionIndex, currentInfoScreenIndex);
        return;
      }
    }

    // Проверяем, не последний ли это вопрос
    const isLastQuestion = currentQuestionIndex === allQuestions.length - 1;
    if (isLastQuestion) {
      // Это последний вопрос - проверяем, есть ли инфо-экраны после него
      const infoScreen = getInfoScreenAfterQuestion(currentQuestion.code);
      if (infoScreen) {
        // Есть инфо-экран после последнего вопроса - показываем его
        console.log('📱 После последнего вопроса показываем инфо-экран:', infoScreen.id);
        setPendingInfoScreen(infoScreen);
        saveProgress(answers, currentQuestionIndex, currentInfoScreenIndex);
        return;
      }
      // Нет инфо-экранов - это действительно конец, кнопка "Получить план" уже на последнем вопросе
      console.log('✅ Это последний вопрос без инфо-экранов, кнопка "Получить план" должна быть видна');
      saveProgress(answers, currentQuestionIndex, currentInfoScreenIndex);
      return;
    }

    // Переходим к следующему вопросу
    if (currentQuestionIndex < allQuestions.length - 1) {
      const newIndex = currentQuestionIndex + 1;
      console.log('➡️ Переход к вопросу', newIndex + 1, 'из', allQuestions.length);
      setCurrentQuestionIndex(newIndex);
      saveProgress(answers, newIndex, currentInfoScreenIndex);
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

  const submitAnswers = async () => {
    console.log('🚀 submitAnswers вызвана!');
    console.log('📊 Состояние:', { 
      hasQuestionnaire: !!questionnaire, 
      answersCount: Object.keys(answers).length,
      isSubmitting,
      questionnaireId: questionnaire?.id 
    });
    
    if (!questionnaire) {
      console.error('❌ Нет анкеты для отправки ответов');
      setError('Анкета не загружена. Пожалуйста, обновите страницу.');
      return;
    }

    if (isSubmitting) {
      console.warn('⚠️ Уже идет отправка, пропускаем');
      return;
    }

    console.log('📤 Начинаем отправку ответов...');
    console.log('📋 Анкета ID:', questionnaire.id);
    console.log('📝 Количество ответов:', Object.keys(answers).length);
    console.log('📊 Ответы:', answers);

    setIsSubmitting(true);
    setError(null);

    try {
      // Проверяем и обновляем токен перед отправкой
      let token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
      
      // Если токена нет, пытаемся авторизоваться через Telegram
      if (!token && typeof window !== 'undefined' && window.Telegram?.WebApp?.initData) {
        try {
          const telegramInitData = window.Telegram.WebApp.initData;
          console.log('🔐 Попытка авторизации перед отправкой ответов...');
          const authResult = await api.authTelegram(telegramInitData);
          if (authResult.token) {
            token = authResult.token;
            console.log('✅ Авторизованы через Telegram перед отправкой ответов');
          } else {
            setError('Не удалось получить токен авторизации. Пожалуйста, обновите страницу.');
            setIsSubmitting(false);
            return;
          }
        } catch (err) {
          console.error('❌ Ошибка авторизации через Telegram:', err);
          setError('Ошибка авторизации. Пожалуйста, обновите страницу и попробуйте снова.');
          setIsSubmitting(false);
          return;
        }
      }

      if (!token) {
        setError('Необходима авторизация. Пожалуйста, откройте приложение через Telegram.');
        setIsSubmitting(false);
        return;
      }

      const answerArray = Object.entries(answers).map(([questionId, value]) => {
        const isArray = Array.isArray(value);
        return {
          questionId: parseInt(questionId),
          answerValue: isArray ? undefined : (value as string),
          answerValues: isArray ? (value as string[]) : undefined,
        };
      });

      console.log('📤 Отправляем ответы на сервер...');
      console.log('📋 Массив ответов:', answerArray);
      
      const result = await api.submitAnswers(questionnaire.id, answerArray);
      console.log('✅ Ответы успешно отправлены:', result);
      
      // Очищаем сохранённый прогресс после успешной отправки
      clearProgress();
      console.log('🧹 Прогресс очищен');
      
      // Небольшая задержка для показа лоадера перед перенаправлением
      console.log('⏳ Ждем 1 секунду перед редиректом...');
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Перенаправление на страницу плана после успешного завершения
      console.log('🚀 Перенаправляем на /plan');
      console.log('🌐 URL для редиректа:', typeof window !== 'undefined' ? window.location.origin + '/plan' : '/plan');
      
      // Проверяем доступность плана перед редиректом
      try {
        console.log('🔍 Проверяем доступность плана перед редиректом...');
        const testResponse = await fetch('/api/debug/test-plan', {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });
        
        if (testResponse.ok) {
          const testData = await testResponse.json();
          console.log('✅ Проверка плана успешна:', testData);
        } else {
          const testError = await testResponse.json();
          console.warn('⚠️ Проблема с генерацией плана:', testError);
        }
      } catch (testErr) {
        console.warn('⚠️ Не удалось проверить план:', testErr);
      }
      
      // Используем window.location для более надежного редиректа
      if (typeof window !== 'undefined') {
        const planUrl = '/plan';
        console.log('🔗 Выполняем редирект на:', planUrl);
        console.log('📍 Текущий URL:', window.location.href);
        
        // Даем время для завершения всех операций
        setTimeout(() => {
          console.log('⏰ Таймаут истек, выполняем редирект...');
          try {
            window.location.href = planUrl;
            console.log('✅ Редирект выполнен');
          } catch (redirectErr) {
            console.error('❌ Ошибка при редиректе:', redirectErr);
            // Fallback на router
            router.push(planUrl);
          }
        }, 500); // Увеличиваем задержку для надежности
      } else {
        router.push('/plan');
      }
    } catch (err: any) {
      console.error('❌ Error submitting answers:', err);
      console.error('❌ Error details:', {
        message: err?.message,
        stack: err?.stack,
        response: err?.response,
      });
      
      setIsSubmitting(false);
      
      // Если ошибка авторизации, пытаемся обновить токен
      if (err?.message?.includes('Unauthorized') || err?.message?.includes('401')) {
        console.log('🔄 Попытка повторной авторизации...');
        if (typeof window !== 'undefined' && window.Telegram?.WebApp?.initData) {
          try {
            const telegramInitData = window.Telegram.WebApp.initData;
            const authResult = await api.authTelegram(telegramInitData);
            if (authResult.token) {
              console.log('✅ Авторизация обновлена, повторяем отправку...');
              // Повторяем отправку после обновления токена
              setTimeout(() => submitAnswers(), 500);
              return;
            }
          } catch (authErr) {
            console.error('❌ Error re-authenticating:', authErr);
          }
        }
        setError('Ошибка авторизации. Пожалуйста, обновите страницу и попробуйте снова.');
      } else {
        const errorMessage = err?.message || err?.error || 'Ошибка сохранения ответов. Попробуйте еще раз.';
        console.error('❌ Setting error message:', errorMessage);
        setError(errorMessage);
      }
    }
  };

  // Продолжить с сохранённого места
  const resumeQuiz = () => {
    if (!savedProgress) return;
    
    setAnswers(savedProgress.answers);
    setCurrentQuestionIndex(savedProgress.questionIndex);
    setCurrentInfoScreenIndex(savedProgress.infoScreenIndex);
    setShowResumeScreen(false);
  };

  // Начать заново
  const startOver = () => {
    clearProgress();
    setAnswers({});
    setCurrentQuestionIndex(0);
    setCurrentInfoScreenIndex(0);
    setShowResumeScreen(false);
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
        gap: '24px',
        background: 'linear-gradient(135deg, #F5FFFC 0%, #E8FBF7 100%)',
        padding: '20px'
      }}>
        <div style={{
          backgroundColor: 'rgba(255, 255, 255, 0.58)',
          backdropFilter: 'blur(26px)',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          borderRadius: '44px',
          padding: '48px 36px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '24px',
          boxShadow: '0 16px 48px rgba(0, 0, 0, 0.12), 0 8px 24px rgba(0, 0, 0, 0.08)',
        }}>
          {/* Анимированный лоадер */}
          <div style={{
            width: '80px',
            height: '80px',
            border: '4px solid rgba(10, 95, 89, 0.1)',
            borderTop: '4px solid #0A5F59',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite'
          }}></div>
          <div style={{
            fontFamily: "'Manrope', -apple-system, BlinkMacSystemFont, sans-serif",
            fontSize: '20px',
            fontWeight: 600,
            color: '#0A5F59',
            textAlign: 'center'
          }}>
            Формируем ваш план...
          </div>
          <div style={{
            fontFamily: "'Manrope', -apple-system, BlinkMacSystemFont, sans-serif",
            fontSize: '16px',
            color: '#475467',
            textAlign: 'center'
          }}>
            Это займёт всего несколько секунд
          </div>
          <style>{`
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `}</style>
        </div>
      </div>
    );
  }

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
          <p style={{ color: '#475467', marginBottom: '24px' }}>{error}</p>
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

  // Получаем все вопросы
  const allQuestions = [
    ...questionnaire.groups.flatMap((g) => g.questions),
    ...questionnaire.questions,
  ];

  // Разделяем инфо-экраны на начальные (без showAfterQuestionCode) и те, что между вопросами
  const initialInfoScreens = INFO_SCREENS.filter(screen => !screen.showAfterQuestionCode);
  const infoScreensBetweenQuestions = INFO_SCREENS.filter(screen => screen.showAfterQuestionCode);

  // Определяем, показываем ли мы начальный инфо-экран
  const isShowingInitialInfoScreen = currentInfoScreenIndex < initialInfoScreens.length;
  const currentInitialInfoScreen = isShowingInitialInfoScreen ? initialInfoScreens[currentInfoScreenIndex] : null;
  
  // Текущий вопрос (показывается после начальных инфо-экранов)
  const currentQuestion = !isShowingInitialInfoScreen && !pendingInfoScreen ? allQuestions[currentQuestionIndex] : null;

  // Экран продолжения анкеты
  if (showResumeScreen && savedProgress) {
    const allQuestions = questionnaire ? [
      ...questionnaire.groups.flatMap((g) => g.questions),
      ...questionnaire.questions,
    ] : [];
    
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
                  {benefit}
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
            
            <button
              onClick={startOver}
              style={{
                width: '100%',
                height: '48px',
                background: 'transparent',
                color: '#0A5F59',
                border: '1px solid rgba(10, 95, 89, 0.3)',
                borderRadius: '24px',
                fontFamily: "'Manrope', -apple-system, BlinkMacSystemFont, sans-serif",
                fontWeight: 500,
                fontSize: '16px',
                cursor: 'pointer',
              }}
            >
              Начать заново
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
      }}>
        <div style={{
          width: '88%',
          maxWidth: isTestimonialsScreen ? '90%' : '420px',
          backgroundColor: 'rgba(255, 255, 255, 0.58)',
          backdropFilter: 'blur(26px)',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          borderRadius: '44px',
          padding: '36px 28px 32px 28px',
          boxShadow: '0 16px 48px rgba(0, 0, 0, 0.12), 0 8px 24px rgba(0, 0, 0, 0.08)',
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
            {screen.title}
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
              {screen.subtitle}
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
                    "{testimonial.text}"
                  </p>
                  <p style={{ fontSize: '12px', color: '#0A5F59', fontWeight: 600 }}>
                    — {testimonial.author}
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
                  <div style={{ fontSize: '12px', fontWeight: 600, color: '#0A5F59', marginBottom: '4px' }}>{product.name}</div>
                  <div style={{ fontSize: '10px', color: '#475467' }}>{product.desc}</div>
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
                    console.log('🚀 Нажата кнопка "Получить план" на последнем инфо-экране:', screen.id);
                    console.log('📊 Состояние:', { isSubmitting, answersCount: Object.keys(answers).length });
                    
                    if (isSubmitting) {
                      console.warn('⚠️ Уже идет отправка, игнорируем клик');
                      return;
                    }
                    
                    submitAnswers().catch((err) => {
                      console.error('❌ Ошибка при отправке ответов:', err);
                      setError(err?.message || 'Ошибка отправки ответов');
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

            // Tinder-кнопки для других Tinder-экранов
            // Если это последний tinder-экран (want_improve), то кнопки вызывают submitAnswers
            if (isTinderScreen) {
              const isWantImproveScreen = screen.id === 'want_improve';
              
              // Для экрана want_improve обе кнопки всегда вызывают submitAnswers
              const shouldSubmit = isWantImproveScreen;
              
              console.log('🎯 Tinder screen rendered:', {
                screenId: screen.id,
                isWantImproveScreen,
                shouldSubmit,
                isSubmitting,
                answersCount: Object.keys(answers).length,
              });
              
              // Обработчик клика для кнопок
              const handleButtonClick = async (buttonType: 'yes' | 'no') => {
                console.log(`🚀 [${screen.id}] Нажата кнопка "${buttonType === 'yes' ? 'Да' : 'Нет'}"`);
                console.log('📊 Состояние перед обработкой:', {
                  screenId: screen.id,
                  isWantImproveScreen,
                  shouldSubmit,
                  isSubmitting,
                  hasQuestionnaire: !!questionnaire,
                  answersCount: Object.keys(answers).length,
                });
                
                // Явно проверяем, что это последний экран
                if (isSubmitting) {
                  console.warn('⚠️ Уже идет отправка, игнорируем клик');
                  return;
                }
                
                if (!questionnaire) {
                  console.error('❌ Нет анкеты для отправки ответов');
                  setError('Анкета не загружена. Пожалуйста, обновите страницу.');
                  return;
                }
                
                // На последнем экране обе кнопки вызывают submitAnswers
                if (isWantImproveScreen) {
                  console.log('✅ Это последний экран (want_improve), вызываем submitAnswers()');
                  console.log('📊 Данные для отправки:', {
                    questionnaireId: questionnaire?.id,
                    answersCount: Object.keys(answers).length,
                    answersKeys: Object.keys(answers),
                  });
                  
                  // Проверяем, что есть ответы
                  if (Object.keys(answers).length === 0) {
                    console.error('❌ Нет ответов для отправки!');
                    setError('Нет ответов для отправки. Пожалуйста, заполните анкету.');
                    return;
                  }
                  
                  console.log('🚀 Вызываем submitAnswers()...');
                  console.trace('Stack trace перед вызовом submitAnswers');
                  
                  // Вызываем submitAnswers напрямую и явно обрабатываем результат
                  try {
                    await submitAnswers();
                    console.log('✅ submitAnswers завершена успешно');
                  } catch (err: any) {
                    console.error('❌ Ошибка при отправке ответов:', err);
                    console.error('❌ Полная ошибка:', {
                      message: err?.message,
                      stack: err?.stack,
                      response: err?.response,
                      error: err,
                    });
                    setError(err?.message || 'Ошибка отправки ответов');
                    setIsSubmitting(false);
                  }
                } else {
                  console.log('➡️ Это не последний экран, переходим дальше через handleNext()');
                  handleNext();
                }
              };
              
              return (
                <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleButtonClick('no');
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
                      handleButtonClick('yes');
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
                  {screen.ctaText} →
                </button>
              ) : null
            );
          })()}
        </div>
      </div>
    );
  };

  // Если показывается информационный экран между вопросами
  if (pendingInfoScreen) {
    return renderInfoScreen(pendingInfoScreen);
  }

  // Если мы на начальном информационном экране
  if (isShowingInitialInfoScreen && currentInitialInfoScreen) {
    return renderInfoScreen(currentInitialInfoScreen);
  }

  if (!currentQuestion) {
    return (
      <div style={{ padding: '20px' }}>
        <h1>Анкета завершена</h1>
        <button onClick={submitAnswers}>Отправить ответы</button>
      </div>
    );
  }

  return (
    <div style={{ 
      padding: '20px',
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #F5FFFC 0%, #E8FBF7 100%)'
    }}>
      <div style={{
        backgroundColor: 'rgba(255, 255, 255, 0.56)',
        backdropFilter: 'blur(28px)',
        borderRadius: '24px',
        padding: '24px',
        maxWidth: '600px',
        margin: '0 auto',
      }}>
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

        <div style={{ marginBottom: '16px', color: '#0A5F59', fontSize: '14px' }}>
          Вопрос {currentQuestionIndex + 1} из {allQuestions.length}
          {process.env.NODE_ENV === 'development' && (
            <div style={{ fontSize: '10px', color: '#999', marginTop: '4px' }}>
              Debug: Question ID: {currentQuestion.id}, Code: {currentQuestion.code}, Type: {currentQuestion.type}
              {currentQuestionIndex === allQuestions.length - 1 && ' (ПОСЛЕДНИЙ ВОПРОС)'}
            </div>
          )}
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
                    console.log('📝 Выбран ответ на вопрос', currentQuestion.id, 'вариант:', option.value);
                    console.log('📊 Это последний вопрос?', isLastQuestion);
                    handleAnswer(currentQuestion.id, option.value);
                    if (isLastQuestion) {
                      // На последнем вопросе проверяем, есть ли инфо-экраны после него
                      const infoScreenAfter = getInfoScreenAfterQuestion(currentQuestion.code);
                      if (infoScreenAfter) {
                        // Есть инфо-экраны - переходим к ним через handleNext
                        console.log('📱 После последнего вопроса есть инфо-экраны, переходим к ним');
                        setTimeout(handleNext, 300);
                      } else {
                        // Нет инфо-экранов - показываем кнопку "Получить план"
                        console.log('✅ Это действительно последний экран, должна появиться кнопка "Получить план"');
                      }
                      return;
                    }
                    setTimeout(handleNext, 300);
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
            {/* Кнопка "Получить план" показывается только если это последний вопрос И нет инфо-экранов после него */}
            {currentQuestionIndex === allQuestions.length - 1 && 
             answers[currentQuestion.id] && 
             !getInfoScreenAfterQuestion(currentQuestion.code) && (
              <button
                onClick={async () => {
                  console.log('🚀 Нажата кнопка "Получить план" на последнем вопросе');
                  try {
                    await submitAnswers();
                  } catch (err) {
                    console.error('❌ Ошибка при отправке ответов:', err);
                  }
                }}
                disabled={isSubmitting}
                style={{
                  marginTop: '24px',
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
            {/* Кнопка "Получить план" показывается только если это последний вопрос И нет инфо-экранов после него */}
            {currentQuestionIndex === allQuestions.length - 1 && 
             !getInfoScreenAfterQuestion(currentQuestion.code) ? (
              <button
                onClick={submitAnswers}
                disabled={!answers[currentQuestion.id] || (Array.isArray(answers[currentQuestion.id]) && (answers[currentQuestion.id] as string[]).length === 0) || isSubmitting}
                style={{
                  marginTop: '24px',
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
            ) : (
              <button
                onClick={handleNext}
                disabled={!answers[currentQuestion.id] || (Array.isArray(answers[currentQuestion.id]) && (answers[currentQuestion.id] as string[]).length === 0)}
                style={{
                  marginTop: '24px',
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
            )}
          </div>
        )}
      </div>
    </div>
  );
}