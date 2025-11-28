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

      // Сначала загружаем анкету (публичный маршрут)
      await loadQuestionnaire();
      
      // Проверяем, есть ли уже профиль (повторное прохождение анкеты)
      // isRetakingQuiz будет установлен в отдельном useEffect после загрузки questionnaire
      if (typeof window !== 'undefined' && window.Telegram?.WebApp?.initData) {
        try {
          const profile = await api.getCurrentProfile();
          if (profile && (profile as any).id) {
            // Профиль существует - это повторное прохождение, пропускаем все info screens
            setIsRetakingQuiz(true);
            console.log('✅ Повторное прохождение анкеты - профиль уже существует, пропускаем info screens');
          }
        } catch (err: any) {
          // Профиля нет - это первое прохождение, показываем info screens как обычно
          console.log('ℹ️ Первое прохождение анкеты - профиля еще нет');
        }
      }

      // Загружаем прогресс с сервера (только если Telegram WebApp доступен)
      if (typeof window !== 'undefined' && window.Telegram?.WebApp?.initData) {
        try {
          await loadSavedProgressFromServer();
        } catch (err: any) {
          // Если ошибка 401 - это нормально, просто используем localStorage
          if (!err?.message?.includes('401') && !err?.message?.includes('Unauthorized')) {
            console.warn('Не удалось загрузить прогресс с сервера:', err);
          }
          // Fallback на localStorage
          loadSavedProgress();
        }
      } else {
        // Если Telegram WebApp не доступен, используем только localStorage
        loadSavedProgress();
      }
    };
    
    init().catch((err) => {
      console.error('Ошибка инициализации:', err);
      setError('Ошибка загрузки. Пожалуйста, обновите страницу.');
      setLoading(false);
    });
  }, []);

  // Загружаем предыдущие ответы при повторном прохождении анкеты
  // Этот useEffect срабатывает после того, как questionnaire загружен и isRetakingQuiz установлен
  useEffect(() => {
    if (isRetakingQuiz && questionnaire && typeof window !== 'undefined' && window.Telegram?.WebApp?.initData) {
      console.log('🔄 Загружаем предыдущие ответы для повторного прохождения...');
      loadPreviousAnswers(questionnaire).catch((err) => {
        console.warn('⚠️ Ошибка загрузки предыдущих ответов:', err);
      });
    }
  }, [isRetakingQuiz, questionnaire]);

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
        setSavedProgress(response.progress);
        setShowResumeScreen(true);
        // Также сохраняем в localStorage для офлайн доступа
        if (typeof window !== 'undefined') {
          localStorage.setItem('quiz_progress', JSON.stringify(response.progress));
        }
      }
    } catch (err: any) {
      // Если ошибка 401 - это нормально, просто не используем серверный прогресс
      if (err?.message?.includes('401') || err?.message?.includes('Unauthorized')) {
        // Не логируем 401 ошибки, так как это нормально, если пользователь не авторизован
        return;
      }
      console.warn('Ошибка загрузки прогресса с сервера:', err);
      // Не вызываем loadSavedProgress() здесь, чтобы избежать множественных вызовов
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
    
    // Также очищаем прогресс на сервере (опционально, если нужна явная очистка)
    // Но обычно прогресс очищается автоматически при создании профиля
  };

  const loadQuestionnaire = async () => {
    try {
      const data = await api.getActiveQuestionnaire();
      setQuestionnaire(data as Questionnaire);
      setError(null); // Очищаем ошибки при успешной загрузке
      return data as Questionnaire; // Возвращаем загруженную анкету
    } catch (err: any) {
      console.error('Ошибка загрузки анкеты:', err);
      // Если ошибка авторизации, не показываем её как критическую
      if (err?.message?.includes('Unauthorized') || err?.message?.includes('401')) {
        // Анкета публичная, эта ошибка не должна возникать
        console.warn('Неожиданная ошибка авторизации при загрузке анкеты');
      }
      setError(err?.message || 'Ошибка загрузки анкеты');
      return null;
    } finally {
      setLoading(false);
    }
  };

  const handleAnswer = async (questionId: number, value: string | string[]) => {
    const newAnswers = { ...answers, [questionId]: value };
    setAnswers(newAnswers);
    await saveProgress(newAnswers, currentQuestionIndex, currentInfoScreenIndex);
    
    // Сохраняем в БД для синхронизации между устройствами (только если Telegram WebApp доступен)
    if (questionnaire && typeof window !== 'undefined' && window.Telegram?.WebApp?.initData) {
      try {
        const isArray = Array.isArray(value);
        await api.saveQuizProgress(
          questionnaire.id,
          questionId,
          isArray ? undefined : (value as string),
          isArray ? (value as string[]) : undefined,
          currentQuestionIndex,
          currentInfoScreenIndex
        );
      } catch (err: any) {
        // Если ошибка 401 - это нормально, прогресс сохранен локально
        if (!err?.message?.includes('401') && !err?.message?.includes('Unauthorized')) {
          console.warn('Ошибка сохранения прогресса на сервер:', err);
        }
      }
    }
  };

  const handleNext = async () => {
    const initialInfoScreens = INFO_SCREENS.filter(screen => !screen.showAfterQuestionCode);

    // При повторном прохождении пропускаем все начальные info screens
    if (isRetakingQuiz && currentInfoScreenIndex < initialInfoScreens.length) {
      if (!questionnaire) return;
      const newInfoIndex = initialInfoScreens.length;
      setCurrentInfoScreenIndex(newInfoIndex);
      setCurrentQuestionIndex(0);
      await saveProgress(answers, 0, newInfoIndex);
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
    const allQuestions = allQuestionsRaw.filter((question) => {
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
            // Сначала проверяем само значение
            genderValue = answerValue;
            
            // Если это не похоже на текст (может быть ID), ищем опцию
            if (q.options && q.options.length > 0) {
              const matchingOption = q.options.find(opt => 
                opt.id.toString() === answerValue || 
                opt.value === answerValue ||
                opt.value?.toLowerCase() === answerValue?.toLowerCase()
              );
              if (matchingOption) {
                genderValue = matchingOption.value || matchingOption.text || answerValue;
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
                        opt.text?.toLowerCase().includes('мужчин') ||
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

  const submitAnswers = async () => {
    console.log('🚀 submitAnswers вызвана');
    
    if (!questionnaire) {
      console.error('❌ Анкета не загружена');
      setError('Анкета не загружена. Пожалуйста, обновите страницу.');
      return;
    }

    if (isSubmitting) {
      console.warn('⚠️ Уже отправляется, игнорируем повторный вызов');
      return;
    }

    setIsSubmitting(true);
    setError(null);

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
        setError('Приложение открыто в режиме предпросмотра. Пожалуйста, откройте его через кнопку бота или используйте ссылку формата: https://t.me/your_bot?startapp=...');
        setIsSubmitting(false);
        return;
      }

      if (!isInTelegram) {
        console.error('❌ Telegram WebApp не доступен');
        setError('Пожалуйста, откройте приложение через Telegram Mini App (не просто по ссылке, а через кнопку бота).');
        setIsSubmitting(false);
        return;
      }

      if (!initData) {
        console.error('❌ Telegram WebApp initData не доступен');
        setError('Не удалось получить данные авторизации. Попробуйте обновить страницу.');
        setIsSubmitting(false);
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
              setAnswers(savedProgress.answers);
              console.log('✅ Загружены ответы из localStorage:', Object.keys(savedProgress.answers).length);
            }
          }
        } catch (e) {
          console.error('❌ Ошибка загрузки из localStorage:', e);
        }
      }

      if (Object.keys(answersToSubmit).length === 0) {
        console.error('❌ Нет ответов для отправки');
        setError('Нет ответов для отправки. Пожалуйста, пройдите анкету.');
        setIsSubmitting(false);
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

      const result = await api.submitAnswers(questionnaire.id, answerArray);
      console.log('✅ Ответы отправлены, профиль создан:', result);
      clearProgress();
      
      // Небольшая задержка перед редиректом, чтобы профиль точно создался в БД
      console.log('⏳ Ожидание создания профиля...');
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Редирект на страницу плана
      console.log('🔄 Редирект на /plan');
      if (typeof window !== 'undefined') {
        // Используем window.location для гарантированного редиректа
        window.location.href = '/plan';
      } else {
        router.push('/plan');
      }
    } catch (err: any) {
      console.error('❌ Ошибка при отправке ответов:', err);
      console.error('   Error message:', err?.message);
      console.error('   Error stack:', err?.stack);
      setIsSubmitting(false);
      
      if (err?.message?.includes('Unauthorized') || err?.message?.includes('401') || err?.message?.includes('initData')) {
        setError('Ошибка идентификации. Пожалуйста, откройте приложение через Telegram и обновите страницу.');
      } else {
        setError(err?.message || err?.error || 'Ошибка сохранения ответов. Попробуйте еще раз.');
      }
    }
  };

  // Продолжить с сохранённого места
  const resumeQuiz = () => {
    if (!savedProgress || !questionnaire) return;
    
    const initialInfoScreens = INFO_SCREENS.filter(screen => !screen.showAfterQuestionCode);
    
    // Восстанавливаем прогресс
    setAnswers(savedProgress.answers);
    
    // Если infoScreenIndex указывает на начальный экран, который уже пройден - пропускаем
    // Если вопрос уже начался (infoScreenIndex >= initialInfoScreens.length), используем сохранённые значения
    if (savedProgress.infoScreenIndex >= initialInfoScreens.length) {
      // Начальные экраны пройдены, переходим к вопросам
      setCurrentQuestionIndex(savedProgress.questionIndex);
      setCurrentInfoScreenIndex(savedProgress.infoScreenIndex);
    } else {
      // Начальные экраны ещё не все пройдены, но вопрос уже начался
      // В этом случае пропускаем начальные экраны и идём к вопросам
      setCurrentQuestionIndex(savedProgress.questionIndex);
      setCurrentInfoScreenIndex(initialInfoScreens.length); // Пропускаем все начальные экраны
    }
    
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

  // Получаем все вопросы с фильтрацией
  const allQuestionsRaw = [
    ...questionnaire.groups.flatMap((g) => g.questions),
    ...questionnaire.questions,
  ];
  
  // Фильтруем вопросы на основе ответов
  // Если пользователь выбрал пол "мужчина", пропускаем вопрос про беременность/кормление
  const allQuestions = allQuestionsRaw.filter((question) => {
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
      const q = allQuestionsRaw.find(q => q.id.toString() === questionId);
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
              genderValue = matchingOption.value || matchingOption.text || answerValue;
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
                      opt.text?.toLowerCase().includes('мужчин') ||
                      opt.value?.toLowerCase().includes('male')) &&
                     (answers[genderQuestion.id] === opt.value || 
                      answers[genderQuestion.id] === opt.id.toString())
                   ));
    
    return !isMale; // Показываем только если не мужчина
  });

  // Разделяем инфо-экраны на начальные (без showAfterQuestionCode) и те, что между вопросами
  const initialInfoScreens = INFO_SCREENS.filter(screen => !screen.showAfterQuestionCode);

  // Определяем, показываем ли мы начальный инфо-экран
  // При повторном прохождении пропускаем все info screens
  const isShowingInitialInfoScreen = !isRetakingQuiz && currentInfoScreenIndex < initialInfoScreens.length;
  const currentInitialInfoScreen = isShowingInitialInfoScreen ? initialInfoScreens[currentInfoScreenIndex] : null;
  
  // Текущий вопрос (показывается после начальных инфо-экранов)
  const currentQuestion = !isShowingInitialInfoScreen && !pendingInfoScreen ? allQuestions[currentQuestionIndex] : null;

  // Экран продолжения анкеты
  if (showResumeScreen && savedProgress) {
    // Получаем все вопросы с фильтрацией
    const allQuestionsRaw = questionnaire ? [
      ...questionnaire.groups.flatMap((g) => g.questions),
      ...questionnaire.questions,
    ] : [];
    
    // Фильтруем вопросы на основе ответов
    const allQuestions = allQuestionsRaw.filter((question) => {
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
        if (q.code === 'gender') {
          genderQuestion = q;
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
                genderValue = matchingOption.value || matchingOption.text || answerValue;
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
                        opt.text?.toLowerCase().includes('мужчин') ||
                        opt.value?.toLowerCase().includes('male')) &&
                       (answers[genderQuestion.id] === opt.value || 
                        answers[genderQuestion.id] === opt.id.toString())
                     ));
      
      return !isMale;
    });
    
    const answeredCount = Object.keys(savedProgress.answers).length;
    const totalQuestions = allQuestions.length;
    const progressPercent = totalQuestions > 0 ? Math.round((answeredCount / totalQuestions) * 100) : 0;

    // Устанавливаем query параметр для скрытия навигации в layout
    useEffect(() => {
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
                    {error}
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
                    if (isSubmitting) return;
                    submitAnswers().catch((err) => {
                      console.error('Error submitting answers:', err);
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

            // Tinder-кнопки
            if (isTinderScreen) {
              const isWantImproveScreen = screen.id === 'want_improve';
              
              // Общий обработчик для кнопок want_improve
              const handleWantImproveClick = async (answer: 'yes' | 'no') => {
                console.log('🔘 handleWantImproveClick вызван с ответом:', answer);
                
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
                  console.error('❌ Ошибка в handleWantImproveClick:', err);
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
                  
                  setError(errorMessage);
                  setIsSubmitting(false);
                }
              };
              
              // Обработчик для других tinder-экранов
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
                      if (isWantImproveScreen) {
                        handleWantImproveClick('no');
                      } else {
                        handleButtonClick();
                      }
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
                      if (isWantImproveScreen) {
                        handleWantImproveClick('yes');
                      } else {
                        handleButtonClick();
                      }
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
  // При повторном прохождении пропускаем все info screens
  if (pendingInfoScreen && !isRetakingQuiz) {
    return renderInfoScreen(pendingInfoScreen);
  }

  // Если мы на начальном информационном экране
  // При повторном прохождении пропускаем все info screens
  if (isShowingInitialInfoScreen && currentInitialInfoScreen && !isRetakingQuiz) {
    return renderInfoScreen(currentInitialInfoScreen);
  }
  
  // При повторном прохождении сразу переходим к вопросам
  if (isRetakingQuiz && questionnaire && currentInfoScreenIndex < initialInfoScreens.length) {
    // Получаем все вопросы с фильтрацией
    const allQuestionsRaw = [
      ...questionnaire.groups.flatMap((g) => g.questions),
      ...questionnaire.questions,
    ];
    
    // Фильтруем вопросы на основе ответов
    const allQuestions = allQuestionsRaw.filter((question) => {
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
        if (q.code === 'gender') {
          genderQuestion = q;
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
                genderValue = matchingOption.value || matchingOption.text || answerValue;
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
                        opt.text?.toLowerCase().includes('мужчин') ||
                        opt.value?.toLowerCase().includes('male')) &&
                       (answers[genderQuestion.id] === opt.value || 
                        answers[genderQuestion.id] === opt.id.toString())
                     ));
      
      return !isMale;
    });
    if (allQuestions.length > 0) {
      // Переходим сразу к первому вопросу
      if (currentQuestionIndex === 0 && currentInfoScreenIndex < initialInfoScreens.length) {
        setCurrentInfoScreenIndex(initialInfoScreens.length);
        // Продолжаем рендер, показывая вопрос
      }
    }
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
            {/* Кнопка "Получить план" показывается только если это последний вопрос И нет инфо-экранов после него */}
            {/* При повторном прохождении всегда показываем кнопку (пропускаем info screens) */}
            {currentQuestionIndex === allQuestions.length - 1 && 
             answers[currentQuestion.id] && 
             (isRetakingQuiz || !getInfoScreenAfterQuestion(currentQuestion.code)) && (
              <button
                onClick={() => {
                  submitAnswers().catch((err) => {
                    console.error('Error submitting answers:', err);
                  });
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
             (isRetakingQuiz || !getInfoScreenAfterQuestion(currentQuestion.code)) ? (
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