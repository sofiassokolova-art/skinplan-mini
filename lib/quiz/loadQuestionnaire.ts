// lib/quiz/loadQuestionnaire.ts
// Вынесена функция loadQuestionnaire из quiz/page.tsx для улучшения читаемости и поддержки

import { api } from '@/lib/api';
import { clientLogger } from '@/lib/client-logger';

// Используем any для Questionnaire, так как в page.tsx используется локальный интерфейс с type: string
// вместо строгого QuestionType из types.ts
type Questionnaire = any;

export interface LoadQuestionnaireParams {
  // Refs
  questionnaireRef: React.MutableRefObject<Questionnaire | null>;
  loadQuestionnaireInProgressRef: React.MutableRefObject<boolean>;
  loadQuestionnaireAttemptedRef: React.MutableRefObject<boolean>;
  redirectInProgressRef: React.MutableRefObject<boolean>;
  initCompletedRef: React.MutableRefObject<boolean>;
  setInitCompleted: React.Dispatch<React.SetStateAction<boolean>>;
  
  // State getters
  questionnaire: Questionnaire | null;
  loading: boolean;
  error: string | null;
  isRetakingQuiz: boolean;
  showRetakeScreen: boolean;
  savedProgress: {
    answers: Record<number, string | string[]>;
    questionIndex: number;
    infoScreenIndex: number;
  } | null;
  currentQuestionIndex: number;
  hasResumed: boolean;
  
  // State setters
  setQuestionnaire: React.Dispatch<React.SetStateAction<Questionnaire | null>>;
  setLoading: React.Dispatch<React.SetStateAction<boolean>>;
  setError: React.Dispatch<React.SetStateAction<string | null>>;
  setCurrentQuestionIndex: React.Dispatch<React.SetStateAction<number>>;
  setUserPreferencesData: (data: any) => void;
  setIsRetakingQuiz: React.Dispatch<React.SetStateAction<boolean>>;
  setShowRetakeScreen: React.Dispatch<React.SetStateAction<boolean>>;
  setHasRetakingPayment: React.Dispatch<React.SetStateAction<boolean>>;
  setHasFullRetakePayment: React.Dispatch<React.SetStateAction<boolean>>;
  
  // Utils
  isDev: boolean;
  userPreferences: any;
  addDebugLog: (message: string, data?: any) => void;
}

export async function loadQuestionnaire(params: LoadQuestionnaireParams): Promise<Questionnaire | null> {
  const {
    questionnaireRef,
    loadQuestionnaireInProgressRef,
    loadQuestionnaireAttemptedRef,
    redirectInProgressRef,
    initCompletedRef,
    setInitCompleted,
    questionnaire,
    loading,
    error,
    isRetakingQuiz,
    showRetakeScreen,
    savedProgress,
    currentQuestionIndex,
    hasResumed,
    setQuestionnaire,
    setLoading,
    setError,
    setCurrentQuestionIndex,
    setUserPreferencesData,
    setIsRetakingQuiz,
    setShowRetakeScreen,
    setHasRetakingPayment,
    setHasFullRetakePayment,
    isDev,
    userPreferences,
    addDebugLog,
  } = params;

  // ДЕТАЛЬНОЕ ЛОГИРОВАНИЕ: Логируем начало функции
  clientLogger.log('🔵 loadQuestionnaire() CALLED', {
    timestamp: new Date().toISOString(),
    loadQuestionnaireInProgress: loadQuestionnaireInProgressRef.current,
    loadQuestionnaireAttempted: loadQuestionnaireAttemptedRef.current,
    hasRef: !!questionnaireRef.current,
    hasState: !!questionnaire,
    questionnaireId: questionnaireRef.current?.id || questionnaire?.id || null,
    loading,
    error: error || null,
    stackTrace: new Error().stack?.substring(0, 500),
  });
  
  // ИСПРАВЛЕНО: Guard против множественных вызовов loadQuestionnaire
  // КРИТИЧНО: Проверяем и устанавливаем флаги атомарно, чтобы предотвратить race conditions
  // Используем двойную проверку для надежности
  if (loadQuestionnaireInProgressRef.current) {
    clientLogger.log('⛔ loadQuestionnaire() skipped: already in progress', {
      attempted: loadQuestionnaireAttemptedRef.current,
      hasRef: !!questionnaireRef.current,
      hasState: !!questionnaire,
      stackTrace: new Error().stack?.substring(0, 300),
    });
    return null;
  }
  // ИСПРАВЛЕНО: Проверяем ref вместо state, чтобы избежать race conditions
  // Это предотвращает повторные вызовы даже если state еще не обновился
  if (loadQuestionnaireAttemptedRef.current && questionnaireRef.current) {
    clientLogger.log('⛔ loadQuestionnaire() skipped: already attempted and questionnaire exists in ref', {
      questionnaireId: questionnaireRef.current?.id,
      hasState: !!questionnaire,
      stackTrace: new Error().stack?.substring(0, 300),
    });
    return null;
  }
  
  // КРИТИЧНО: Устанавливаем флаги СРАЗУ, до любых асинхронных операций
  // Это предотвращает параллельные вызовы
  // ВАЖНО: Устанавливаем оба флага одновременно для атомарности
  loadQuestionnaireInProgressRef.current = true;
  loadQuestionnaireAttemptedRef.current = true;
  
  // ИСПРАВЛЕНО: Логируем с log для диагностики (warn только для реальных проблем)
  clientLogger.log('🔄 loadQuestionnaire() started', {
    hasQuestionnaire: !!questionnaireRef.current,
    questionnaireId: questionnaireRef.current?.id,
    hasQuestionnaireState: !!questionnaire,
  });

  try {
    // ИСПРАВЛЕНО: НЕ устанавливаем loading=true здесь, так как init() уже управляет loading
    // Это предотвращает мигание лоадера из-за множественных изменений состояния
    setError(null);
      
    // ИСПРАВЛЕНО: Проверяем Telegram initData перед загрузкой анкеты
    // ИСПРАВЛЕНО: Делаем проверку более мягкой - не блокируем загрузку, а только логируем предупреждение
    // Анкета может быть публичной и загружаться без initData
    if (!isDev && typeof window !== 'undefined') {
      const hasInitData = !!window.Telegram?.WebApp?.initData;
      if (!hasInitData) {
        clientLogger.warn('⚠️ Telegram initData not available, but continuing to load questionnaire...');
      }
    }
    
    // ВАЖНО: Добавляем таймаут для загрузки анкеты, чтобы не ждать бесконечно
    // ИСПРАВЛЕНО: Оборачиваем в try-catch для правильной обработки ошибок
    let data: any;
    try {
      const loadPromise = api.getActiveQuestionnaire();
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Таймаут загрузки анкеты (10 секунд)')), 10000);
      });
      
      data = await Promise.race([loadPromise, timeoutPromise]) as any;
    } catch (apiError: any) {
      // ИСПРАВЛЕНО: Если это 500 ошибка от API, обрабатываем её отдельно
      if (apiError?.status === 500 || apiError?.response?.status === 500) {
        const errorData = apiError?.response?.data || apiError?.data || {};
        const errorMessage = errorData.message || errorData.error || 'Анкета временно недоступна';
        clientLogger.error('❌ Backend returned 500 error (empty questionnaire)', {
          status: apiError?.status || apiError?.response?.status,
          message: errorMessage,
          questionnaireId: errorData?.questionnaireId,
        });
        
        // ИСПРАВЛЕНО: Для нового пользователя создаем минимальную анкету даже при 500 ошибке
        // Это позволяет показать инфо-экраны и дать пользователю понять, что происходит
        // Проверяем, является ли это новым пользователем (нет initData)
        const hasInitData = typeof window !== 'undefined' && !!window.Telegram?.WebApp?.initData;
        const isNewUser = !hasInitData;
        if (isNewUser) {
          clientLogger.log('ℹ️ New user (no initData) - creating minimal questionnaire despite 500 error to allow info screens', {
            hasInitData: false,
          });
          const minimalQuestionnaire = {
            id: errorData?.questionnaireId || 0,
            name: 'Questionnaire',
            version: '1.0',
            groups: [],
            questions: [],
          };
          questionnaireRef.current = minimalQuestionnaire;
          setQuestionnaire(minimalQuestionnaire);
          setLoading(false);
          loadQuestionnaireInProgressRef.current = false;
          clientLogger.log('✅ Created minimal questionnaire for new user despite 500 error', {
            questionnaireId: minimalQuestionnaire.id,
          });
          return minimalQuestionnaire;
        }
        
        // Для существующих пользователей показываем ошибку
        setError(errorMessage || 'Анкета временно недоступна. Пожалуйста, попробуйте позже.');
        setLoading(false);
        questionnaireRef.current = null;
        loadQuestionnaireAttemptedRef.current = false;
        loadQuestionnaireInProgressRef.current = false;
        return null;
      }
      // Для других ошибок пробрасываем дальше в основной catch блок
      throw apiError;
    }
    
    // ИСПРАВЛЕНО: Логируем сырой ответ от API для диагностики
    const groupsCount = data?.groups?.length || 0;
    const questionsCount = data?.questions?.length || 0;
    const groupsWithQuestionsCount = data?.groups?.reduce((sum: number, g: any) => sum + (g?.questions?.length || 0), 0) || 0;
    const totalQuestionsInResponse = groupsWithQuestionsCount + questionsCount;
    
    // КРИТИЧНО: Детальное логирование структуры данных
    clientLogger.log('📥 Raw API response received', {
      hasData: !!data,
      dataType: typeof data,
      dataKeys: data && typeof data === 'object' ? Object.keys(data) : [],
      hasId: data?.id !== undefined,
      hasGroups: data?.groups !== undefined,
      hasQuestions: data?.questions !== undefined,
      hasMeta: data?._meta !== undefined,
      groupsCount,
      questionsCount,
      groupsWithQuestionsCount,
      totalQuestionsInResponse,
    });
    
    // КРИТИЧНО: Проверяем, что данные действительно содержат вопросы
    // ИСПРАВЛЕНО: Логируем как предупреждение, а не ошибку, так как это может быть нормально для нового пользователя
    if (totalQuestionsInResponse === 0) {
      clientLogger.warn('⚠️ API returned questionnaire with ZERO questions', {
        data,
        groupsCount,
        questionsCount,
        groupsWithQuestionsCount,
        hasMeta: !!data?._meta,
        hasProfile: data?._meta?.hasProfile ?? false,
        isNewUser: !(data?._meta?.hasProfile ?? false),
        fullData: JSON.stringify(data, null, 2).substring(0, 1000), // Ограничиваем размер для производительности
      });
      
      // ИСПРАВЛЕНО: Если API вернул анкету с 0 вопросов, но есть _meta, создаем минимальную анкету
      // Это предотвращает зависание на лоадере для нового пользователя
      const hasMeta = !!data?._meta;
      const hasProfileFromMeta = data?._meta?.hasProfile ?? false;
      const isNewUserFromMeta = !hasProfileFromMeta;
      
      if (hasMeta && isNewUserFromMeta) {
        clientLogger.log('ℹ️ API returned questionnaire with 0 questions but has _meta for new user - creating minimal questionnaire', {
          hasMeta,
          hasProfileFromMeta,
          isNewUserFromMeta,
          questionnaireId: data?.id || 0,
        });
        const minimalQuestionnaire = {
          id: data?.id || 0,
          name: data?.name || 'Questionnaire',
          version: data?.version || '1.0',
          groups: [],
          questions: [],
        };
        questionnaireRef.current = minimalQuestionnaire;
        setQuestionnaire(minimalQuestionnaire);
        setLoading(false);
        loadQuestionnaireInProgressRef.current = false;
        clientLogger.log('✅ Created minimal questionnaire for new user (from zero questions response)', {
          questionnaireId: minimalQuestionnaire.id,
        });
        return minimalQuestionnaire;
      }
    }
    
    // ИСПРАВЛЕНО: Проверяем метаданные от бэкенда - нужно ли редиректить на /plan
    const _meta = (data as any)?._meta;
    if (_meta?.shouldRedirectToPlan && !isRetakingQuiz && !showRetakeScreen) {
      // ИСПРАВЛЕНО: Guard против множественных редиректов
      if (redirectInProgressRef.current) {
        return null; // Редирект уже в процессе
      }
      
      const justSubmittedCheck = typeof window !== 'undefined' ? sessionStorage.getItem('quiz_just_submitted') === 'true' : false;
      const retakeCheck = typeof window !== 'undefined' ? sessionStorage.getItem('quiz_retake') === 'true' : false;
      const fullRetakeCheck = typeof window !== 'undefined' ? sessionStorage.getItem('quiz_full_retake_from_home') === 'true' : false;
      
      if (!justSubmittedCheck && !retakeCheck && !fullRetakeCheck) {
        redirectInProgressRef.current = true; // Помечаем, что редирект начат
        clientLogger.log('✅ Бэкенд сообщил, что анкета завершена - редиректим на /plan', {
          isCompleted: _meta.isCompleted,
          hasProfile: _meta.hasProfile,
        });
        initCompletedRef.current = true;
        setInitCompleted(true);
        setLoading(false);
        if (typeof window !== 'undefined') {
          window.location.replace('/plan');
          // ФИКС: Сбрасываем redirectInProgressRef через задержку после редиректа
          setTimeout(() => {
            redirectInProgressRef.current = false;
          }, 1000);
        }
        return null;
      }
    }
    
    // ИСПРАВЛЕНО: Проверяем, что данные не пустые
    // При перепрохождении API может вернуть пустой объект - пробуем загрузить еще раз
    // ВАЖНО: Проверяем не только наличие данных, но и наличие groups/questions
    const hasGroups = data?.groups && Array.isArray(data.groups) && data.groups.length > 0;
    const hasQuestions = data?.questions && Array.isArray(data.questions) && data.questions.length > 0;
    const hasGroupsWithQuestions = hasGroups && data.groups.some((g: any) => g.questions && Array.isArray(g.questions) && g.questions.length > 0);
    const hasAnyQuestions = hasGroupsWithQuestions || hasQuestions;
    
    // ИСПРАВЛЕНО: Обрабатываем "no profile" без ошибки
    // Для нового пользователя (без профиля) API вернет анкету, но профиля не будет
    // Это нормально - начинаем анкету с дефолтными info-экранами
    const hasProfile = data?._meta?.hasProfile ?? false;
    const isNewUser = !hasProfile;
    
    // ИСПРАВЛЕНО: Детальная проверка с логированием
    // КРИТИЧНО: Проверяем не только пустоту объекта, но и наличие ключевых полей
    const hasId = data?.id !== undefined && data?.id !== null;
    const hasMeta = data?._meta !== undefined;
    const isEmptyObject = !data || (typeof data === 'object' && Object.keys(data).length === 0);
    const hasNoKeyFields = !hasId && !hasMeta;
    
    // ИСПРАВЛЕНО: Если есть _meta, но нет вопросов, это может быть нормально для нового пользователя
    // Проверяем _meta.hasProfile для определения нового пользователя
    const hasProfileFromMeta = data?._meta?.hasProfile ?? false;
    const isNewUserFromMeta = !hasProfileFromMeta;
    
    // ИСПРАВЛЕНО: Если есть _meta, но нет id и нет вопросов, создаем минимальную анкету для нового пользователя
    // Это обрабатывает случай, когда API вернул данные с _meta, но без вопросов
    if (hasMeta && !hasId && totalQuestionsInResponse === 0 && isNewUserFromMeta) {
      clientLogger.log('ℹ️ API returned data with _meta but no id/questions - creating minimal questionnaire for new user', {
        hasMeta,
        hasId,
        totalQuestionsInResponse,
        isNewUserFromMeta,
        hasProfileFromMeta,
      });
      const minimalQuestionnaire = {
        id: 0,
        name: 'Questionnaire',
        version: '1.0',
        groups: [],
        questions: [],
      };
      questionnaireRef.current = minimalQuestionnaire;
      setQuestionnaire(minimalQuestionnaire);
      setLoading(false);
      loadQuestionnaireInProgressRef.current = false;
      clientLogger.log('✅ Created minimal questionnaire for new user (from _meta)', {
        questionnaireId: minimalQuestionnaire.id,
      });
      return minimalQuestionnaire;
    }
    
    if (isEmptyObject || (hasNoKeyFields && !hasMeta)) {
      // ИСПРАВЛЕНО: Логируем детали для диагностики
      clientLogger.error('❌ Empty or null data received from API', {
        data,
        dataType: typeof data,
        dataKeys: data && typeof data === 'object' ? Object.keys(data) : [],
        hasId,
        hasMeta,
        isEmptyObject,
        hasNoKeyFields,
        // Проверяем, может ли это быть ошибка 500, которая уже обработана выше
        is500Error: false, // Эта проверка происходит до обработки 500 ошибок
      });
      
      // ИСПРАВЛЕНО: Для нового пользователя (без initData) создаем минимальную анкету даже при пустых данных
      // Это предотвращает зависание на лоадере
      const hasInitData = typeof window !== 'undefined' && !!window.Telegram?.WebApp?.initData;
      const isNewUser = !hasInitData;
      
      if (isNewUser) {
        clientLogger.log('ℹ️ New user (no initData) - creating minimal questionnaire despite empty data', {
          hasInitData: false,
          isEmptyObject,
          hasNoKeyFields,
        });
        const minimalQuestionnaire = {
          id: 0,
          name: 'Questionnaire',
          version: '1.0',
          groups: [],
          questions: [],
        };
        questionnaireRef.current = minimalQuestionnaire;
        setQuestionnaire(minimalQuestionnaire);
        setLoading(false);
        loadQuestionnaireInProgressRef.current = false;
        clientLogger.log('✅ Created minimal questionnaire for new user (from empty data)', {
          questionnaireId: minimalQuestionnaire.id,
        });
        return minimalQuestionnaire;
      }
      
      // КРИТИЧНО: Если данные пустые, это ошибка бэкенда
      // Но не логируем как критическую ошибку, если это может быть нормально для нового пользователя
      clientLogger.warn('⚠️ Empty or null data received - this is a backend issue, not retrying', {
        hasInitData: typeof window !== 'undefined' && !!window.Telegram?.WebApp?.initData,
        isNewUser: !(typeof window !== 'undefined' && window.Telegram?.WebApp?.initData),
      });
      
      setError('Анкета временно недоступна. Пожалуйста, попробуйте позже.');
      // ИСПРАВЛЕНО: НЕ устанавливаем loading=false здесь, init() управляет loading
      loadQuestionnaireInProgressRef.current = false;
      loadQuestionnaireAttemptedRef.current = false; // Сбрасываем, чтобы можно было попробовать снова
      return null;
    }
    
    // ИСПРАВЛЕНО: Если есть _meta, но нет id и нет вопросов, создаем минимальную анкету для нового пользователя
    if (hasMeta && !hasId && totalQuestionsInResponse === 0 && isNewUserFromMeta) {
      clientLogger.log('ℹ️ API returned data with _meta but no id/questions - creating minimal questionnaire for new user', {
        hasMeta,
        hasId,
        totalQuestionsInResponse,
        isNewUserFromMeta,
      });
      const minimalQuestionnaire = {
        id: 0,
        name: 'Questionnaire',
        version: '1.0',
        groups: [],
        questions: [],
      };
      questionnaireRef.current = minimalQuestionnaire;
      setQuestionnaire(minimalQuestionnaire);
      setLoading(false);
      loadQuestionnaireInProgressRef.current = false;
      clientLogger.log('✅ Created minimal questionnaire for new user (from _meta)', {
        questionnaireId: minimalQuestionnaire.id,
      });
      return minimalQuestionnaire;
    }
    
    if (!hasAnyQuestions) {
      // ИСПРАВЛЕНО: Для нового пользователя (no profile) это нормально - начинаем анкету
      // Не бросаем error, а продолжаем с дефолтными info-экранами
      // КРИТИЧНО: Проверяем isNewUserFromMeta, так как hasProfile может быть undefined
      const isNewUserFinal = isNewUser || isNewUserFromMeta;
      if (isNewUserFinal) {
        clientLogger.log('ℹ️ New user (no profile) - questionnaire has no questions, will start with default info screens', {
          hasGroups,
          hasQuestions,
          hasGroupsWithQuestions,
          hasAnyQuestions,
          groupsCount,
          questionsCount,
          groupsWithQuestionsCount,
          totalQuestionsInResponse,
          hasProfile,
          isNewUser,
          isNewUserFromMeta,
          isNewUserFinal,
        });
        // ИСПРАВЛЕНО: Создаем минимальный объект анкеты для нового пользователя
        // Это гарантирует, что questionnaireRef.current будет установлен
        const minimalQuestionnaire = {
          id: data?.id || 0,
          name: data?.name || 'Questionnaire',
          version: data?.version || '1.0',
          groups: [],
          questions: [],
        };
        questionnaireRef.current = minimalQuestionnaire;
        setQuestionnaire(minimalQuestionnaire);
        setLoading(false);
        loadQuestionnaireInProgressRef.current = false;
        clientLogger.log('✅ Created minimal questionnaire for new user', {
          questionnaireId: minimalQuestionnaire.id,
        });
        return minimalQuestionnaire;
      } else {
        clientLogger.error('❌ Questionnaire has no questions in response', {
          hasGroups,
          hasQuestions,
          hasGroupsWithQuestions,
          hasAnyQuestions,
          groupsCount,
          questionsCount,
          groupsWithQuestionsCount,
          totalQuestionsInResponse,
          hasProfile,
          isNewUser,
        });
        
        // КРИТИЧНО: Если анкета пустая и это не новый пользователь, это ошибка
        clientLogger.error('❌ Questionnaire has no questions - this is a backend issue, not retrying');
        setError('Анкета временно недоступна. Пожалуйста, попробуйте позже.');
        // ИСПРАВЛЕНО: НЕ устанавливаем loading=false здесь, init() управляет loading
        loadQuestionnaireInProgressRef.current = false;
        loadQuestionnaireAttemptedRef.current = false; // Сбрасываем, чтобы можно было попробовать снова
        questionnaireRef.current = null; // ИСПРАВЛЕНО: Сбрасываем ref при ошибке
        return null;
      }
    }
    
    // ИСПРАВЛЕНО: Убираем _meta из данных перед обработкой
    const { _meta: _, ...dataWithoutMeta } = data as any;
    const cleanData = dataWithoutMeta;
    
    // ИСПРАВЛЕНО: API может возвращать данные в обертке (success/data)
    // Проверяем, есть ли обертка, и извлекаем данные
    let questionnaireData: Questionnaire | null = null;
    
    if (cleanData && typeof cleanData === 'object') {
      // Проверяем, есть ли обертка ApiResponse (success/data)
      if ('success' in cleanData && 'data' in cleanData && (cleanData as any).success === true) {
        questionnaireData = (cleanData as any).data as Questionnaire;
        clientLogger.log('✅ Extracted questionnaire from success/data wrapper');
      } else if ('data' in cleanData && !('success' in cleanData)) {
        // Только data без success
        questionnaireData = (cleanData as any).data as Questionnaire;
        clientLogger.log('✅ Extracted questionnaire from data wrapper');
      } else if ('id' in cleanData || 'groups' in cleanData || 'questions' in cleanData) {
        // Данные напрямую (без обертки) - проверяем наличие ключевых полей
        questionnaireData = cleanData as Questionnaire;
        clientLogger.log('✅ Using cleanData directly as questionnaire');
      } else {
        // Неизвестный формат - логируем для диагностики
        clientLogger.warn('⚠️ Unknown questionnaire data format', {
          dataKeys: Object.keys(cleanData),
          hasId: 'id' in cleanData,
          hasGroups: 'groups' in cleanData,
          hasQuestions: 'questions' in cleanData,
          hasSuccess: 'success' in cleanData,
          hasData: 'data' in cleanData,
          dataPreview: JSON.stringify(cleanData).substring(0, 300),
        });
      }
    }
    
    if (!questionnaireData) {
      clientLogger.error('❌ Could not extract questionnaire data from API response', { 
        data,
        dataType: typeof data,
        dataKeys: data && typeof data === 'object' ? Object.keys(data) : [],
        dataPreview: typeof data === 'object' ? JSON.stringify(data).substring(0, 500) : String(data),
      });
      throw new Error('Invalid questionnaire data: could not extract data from response');
    }
    
    // ИСПРАВЛЕНО: Проверяем, что данные валидны
    if (!questionnaireData.id) {
      clientLogger.error('❌ Questionnaire data missing id', { 
        data,
        hasId: !!questionnaireData.id,
        dataKeys: Object.keys(questionnaireData),
      });
      throw new Error('Invalid questionnaire data: missing id field');
    }
    
    // ИСПРАВЛЕНО: Добавляем проверку на существование groups и questions
    const groups = questionnaireData.groups || [];
    const questions = questionnaireData.questions || [];
    
    // ИСПРАВЛЕНО: Проверяем, что есть хотя бы один вопрос
    const totalQuestions = groups.reduce((sum: number, g: any) => sum + (g.questions?.length || 0), 0) + questions.length;
    if (totalQuestions === 0) {
      clientLogger.error('❌ Questionnaire has no questions', {
        questionnaireId: questionnaireData.id,
        groupsCount: groups.length,
        questionsCount: questions.length,
      });
      throw new Error('Questionnaire has no questions');
    }
    
    addDebugLog('📥 Questionnaire loaded', {
      questionnaireId: questionnaireData.id,
      name: questionnaireData.name,
      version: questionnaireData.version,
      groupsCount: groups.length,
      questionsCount: questions.length,
      totalQuestions,
    });
    
    clientLogger.log('📦 Questionnaire loaded from API (before validation)', {
      questionnaireId: questionnaireData?.id,
      hasGroups: !!questionnaireData?.groups,
      groupsCount: questionnaireData?.groups?.length || 0,
      hasQuestions: !!questionnaireData?.questions,
      questionsCount: questionnaireData?.questions?.length || 0,
    });
    
    // КРИТИЧНО: Создаем новый объект, чтобы React обновил state (reference equality)
    // ИСПРАВЛЕНО: Используем spread operator для создания нового объекта
    const questionnaireToSet = {
      ...questionnaireData,
      groups: [...(questionnaireData.groups || [])],
      questions: [...(questionnaireData.questions || [])],
    };
    
    // ИСПРАВЛЕНО: Обновляем ref ПЕРЕД установкой state, чтобы guards работали корректно
    clientLogger.log('🟢 SETTING questionnaireRef.current', {
      timestamp: new Date().toISOString(),
      questionnaireId: questionnaireToSet.id,
      questionnaireName: questionnaireToSet.name,
      totalQuestions,
      groupsCount: questionnaireToSet.groups?.length || 0,
      questionsCount: questionnaireToSet.questions?.length || 0,
      previousRefId: questionnaireRef.current?.id || null,
    });
    questionnaireRef.current = questionnaireToSet;
    clientLogger.log('✅ questionnaireRef.current SET', {
      timestamp: new Date().toISOString(),
      questionnaireId: questionnaireRef.current?.id,
      verified: questionnaireRef.current === questionnaireToSet,
    });
    
    // КРИТИЧНО: Устанавливаем state
    // ИСПРАВЛЕНО: Используем функциональную форму setQuestionnaire для гарантированного обновления
    // ИСПРАВЛЕНО: Логируем перед вызовом setQuestionnaire для диагностики
    clientLogger.log('🔄 [loadQuestionnaire] About to call setQuestionnaire (via State Machine wrapper)', {
      questionnaireId: questionnaireToSet.id,
      previousQuestionnaireId: questionnaire?.id || null,
      hasQuestionnaireRef: !!questionnaireRef.current,
      questionnaireRefId: questionnaireRef.current?.id || null,
    });
    setQuestionnaire((prevQuestionnaire: Questionnaire | null) => {
      // ИСПРАВЛЕНО: Проверяем, действительно ли данные изменились
      // Если ID совпадает и анкета уже установлена, не создаем новый объект
      // Это предотвращает лишние пересчеты useMemo
      if (prevQuestionnaire?.id === questionnaireToSet.id && prevQuestionnaire) {
        // Данные не изменились - возвращаем предыдущий объект, чтобы не вызывать лишние пересчеты
        if (isDev) {
          clientLogger.log('✅ setQuestionnaire: same ID, returning prev (no re-render)', {
            questionnaireId: questionnaireToSet.id,
          });
        }
        return prevQuestionnaire;
      }
      
      // Данные изменились или анкета еще не установлена - обновляем
      if (isDev) {
        clientLogger.log('✅ setQuestionnaire callback EXECUTED', {
          timestamp: new Date().toISOString(),
          questionnaireId: questionnaireToSet.id,
          totalQuestions,
          prevQuestionnaireId: prevQuestionnaire?.id,
          isNew: !prevQuestionnaire || prevQuestionnaire.id !== questionnaireToSet.id,
        });
      }
      
      return questionnaireToSet;
    });
    
    // КРИТИЧНО: Принудительно сбрасываем loading сразу после установки state
    // Это гарантирует, что анкета отобразится сразу после загрузки
    setLoading(false);
    
    // ИСПРАВЛЕНО: Используем preferences из метаданных вместо отдельных вызовов API
    // ИСПРАВЛЕНО: Обрабатываем preferences в try-catch, чтобы ошибки не прерывали загрузку анкеты
    try {
      const prefs = _meta?.preferences;
      if (prefs) {
        // Сохраняем preferences в state для использования в других местах
        setUserPreferencesData(prefs);
        
        // Устанавливаем флаги перепрохождения из метаданных
        if (prefs.isRetakingQuiz !== undefined) {
          setIsRetakingQuiz(prefs.isRetakingQuiz);
        }
        if (prefs.fullRetakeFromHome !== undefined) {
          if (prefs.fullRetakeFromHome) {
            setShowRetakeScreen(true);
            setIsRetakingQuiz(true);
            // Очищаем флаг после использования
            // ИСПРАВЛЕНО: Обрабатываем ошибку очистки флага, чтобы она не прерывала загрузку
            userPreferences.setFullRetakeFromHome(false).catch((err: any) => {
              clientLogger.warn('⚠️ Failed to clear fullRetakeFromHome flag (non-critical)', err);
            });
          }
        }
        if (prefs.paymentRetakingCompleted !== undefined) {
          setHasRetakingPayment(prefs.paymentRetakingCompleted);
        }
        if (prefs.paymentFullRetakeCompleted !== undefined) {
          setHasFullRetakePayment(prefs.paymentFullRetakeCompleted);
        }
        
        clientLogger.log('✅ Preferences loaded from questionnaire metadata', prefs);
      }
    } catch (prefsErr: any) {
      // ИСПРАВЛЕНО: Ошибки при обработке preferences не должны прерывать загрузку анкеты
      clientLogger.warn('⚠️ Error processing preferences (non-critical, continuing)', {
        error: prefsErr?.message,
        errorStack: prefsErr?.stack?.substring(0, 200),
      });
    }
    // ИСПРАВЛЕНО: Очищаем ошибки при успешной загрузке
    // Это предотвращает показ временных ошибок, которые уже исправлены
    setError(null);
    
    // ИСПРАВЛЕНО: Для нового пользователя без сохраненного прогресса гарантируем, что currentQuestionIndex = 0
    // Это предотвращает проблему с невалидным индексом после загрузки анкеты
    const hasNoSavedProgress = !savedProgress || !savedProgress.answers || Object.keys(savedProgress.answers).length === 0;
    if (hasNoSavedProgress && currentQuestionIndex !== 0 && !isRetakingQuiz && !hasResumed) {
      clientLogger.log('🔄 Сбрасываем currentQuestionIndex на 0 после загрузки анкеты для нового пользователя', {
        currentQuestionIndex,
        hasNoSavedProgress,
        isRetakingQuiz,
        hasResumed,
      });
      setCurrentQuestionIndex(0);
    }
    
    clientLogger.log('✅ Questionnaire loaded successfully, setting loading=false IMMEDIATELY', {
      timestamp: new Date().toISOString(),
      questionnaireId: questionnaireData.id,
      questionnaireName: questionnaireData.name,
      questionnaireVersion: questionnaireData.version,
      hasQuestionnaireState: !!questionnaire,
      hasQuestionnaireRef: !!questionnaireRef.current,
      loadingAfterSet: false,
      totalQuestions,
      groupsCount: questionnaireData.groups?.length || 0,
      questionsCount: questionnaireData.questions?.length || 0,
      stateUpdated: true,
      refUpdated: true,
    });
    
    // ИСПРАВЛЕНО: Логируем успешное завершение загрузки
    clientLogger.log('✅ loadQuestionnaire completed successfully - RETURNING questionnaire', {
      timestamp: new Date().toISOString(),
      questionnaireId: questionnaireData.id,
      questionnaireName: questionnaireData.name,
      totalQuestions,
      hasQuestionnaireState: !!questionnaireToSet,
      hasRef: !!questionnaireRef.current,
      refId: questionnaireRef.current?.id,
      stateId: questionnaireToSet?.id,
      loading: false,
      willReturn: true,
    });
    
    // ИСПРАВЛЕНО: Гарантируем, что ref установлен перед возвратом
    // Это предотвращает повторные вызовы loadQuestionnaire
    if (!questionnaireRef.current) {
      clientLogger.warn('⚠️ questionnaireRef.current is null after successful load, setting it now', {
        questionnaireId: questionnaireData.id,
      });
      questionnaireRef.current = questionnaireToSet;
    }
    
    return questionnaireToSet;
  } catch (err: any) {
    // ИСПРАВЛЕНО: Улучшено логирование ошибок для диагностики
    const errorDetails = {
      timestamp: new Date().toISOString(),
      message: err?.message,
      stack: err?.stack?.substring(0, 500),
      name: err?.name,
      status: err?.status,
      response: err?.response,
      loadingBeforeError: loading,
      hasQuestionnaireRef: !!questionnaireRef.current,
      hasQuestionnaireState: !!questionnaire,
    };
    
    addDebugLog('❌ Error loading questionnaire', errorDetails);
    clientLogger.error('❌ loadQuestionnaire() ERROR CAUGHT', errorDetails);
    console.error('Ошибка загрузки анкеты:', err);
    
    // ИСПРАВЛЕНО: Специальная обработка для пустой анкеты (500 от бэкенда)
    const errorStatus = err?.status || err?.response?.status || (err?.response?.ok === false ? err?.response?.status : null);
    const errorMsg = err?.response?.data?.message || err?.response?.data?.error || err?.message || '';
    const errorData = err?.response?.data || err?.data || {};
    
    if (errorStatus === 500 || errorMsg.includes('empty') || errorMsg.includes('no questions') || errorMsg.includes('пуст') || errorMsg.includes('Active questionnaire is empty')) {
      clientLogger.error('❌ Backend returned empty questionnaire error', {
        status: errorStatus,
        message: errorMsg,
        questionnaireId: errorData?.questionnaireId,
        fullError: err,
      });
      setError('Анкета временно недоступна. Пожалуйста, попробуйте позже или обратитесь в поддержку.');
      // КРИТИЧНО: Устанавливаем loading=false при ошибке, чтобы не зависать на лоадере
      setLoading(false);
      questionnaireRef.current = null; // ИСПРАВЛЕНО: Сбрасываем ref при ошибке пустой анкеты
      loadQuestionnaireAttemptedRef.current = false; // ИСПРАВЛЕНО: Сбрасываем attemptedRef, чтобы можно было повторить
      return null;
    }
    
    // Если ошибка авторизации, не показываем её как критическую
    if (err?.message?.includes('Unauthorized') || err?.message?.includes('401')) {
      // Анкета публичная, эта ошибка не должна возникать
      clientLogger.warn('Неожиданная ошибка авторизации при загрузке анкеты');
    }
    // Если таймаут - это критическая ошибка, но не блокируем загрузку
    if (err?.message?.includes('Таймаут')) {
      console.error('❌ Таймаут загрузки анкеты - возможно, проблема с сетью или сервером');
      clientLogger.error('❌ Таймаут загрузки анкеты');
    }
    
    // ИСПРАВЛЕНО: Не устанавливаем ошибку сразу, если это перепрохождение анкеты
    const errorMessage = String(err?.message || 'Ошибка загрузки анкеты');
    
    // ИСПРАВЛЕНО: При перепрохождении не показываем ошибку сразу
    if (isRetakingQuiz || showRetakeScreen || questionnaire) {
      clientLogger.warn('⚠️ Error loading questionnaire during retake or questionnaire already loaded, will not show error to user', { 
        error: errorMessage,
        isRetakingQuiz,
        showRetakeScreen,
        hasQuestionnaire: !!questionnaire,
      });
      // Не устанавливаем ошибку при перепрохождении или если анкета уже есть - пользователь может продолжить
      // КРИТИЧНО: Если анкета уже есть, сбрасываем loading, чтобы она отобразилась
      if (questionnaire) {
        setLoading(false);
      }
      return null;
    }
    
    // Только для критических ошибок устанавливаем error state
    // Для временных ошибок (таймаут, сеть) можно попробовать еще раз
    if (err?.message?.includes('Таймаут') || err?.message?.includes('network') || err?.message?.includes('Network')) {
      // Для таймаутов и сетевых ошибок не показываем ошибку сразу
      // Пользователь может попробовать обновить страницу
      clientLogger.warn('⚠️ Temporary error loading questionnaire, user can retry', { error: errorMessage });
      setError('Не удалось загрузить анкету. Проверьте подключение к интернету и обновите страницу.');
      // КРИТИЧНО: Устанавливаем loading=false при ошибке, чтобы показать сообщение об ошибке
      setLoading(false);
      // КРИТИЧНО: Сбрасываем attemptedRef при временных ошибках, чтобы можно было повторить
      loadQuestionnaireAttemptedRef.current = false;
      questionnaireRef.current = null; // ИСПРАВЛЕНО: Сбрасываем ref при ошибке
    } else if (err?.status === 500) {
      // Для 500 ошибок (пустая анкета) показываем понятное сообщение
      const serverMessage = errorData.message || errorData.error || 'Анкета временно недоступна';
      setError(serverMessage);
      // КРИТИЧНО: Устанавливаем loading=false при ошибке, чтобы показать сообщение об ошибке
      setLoading(false);
      loadQuestionnaireAttemptedRef.current = false;
      questionnaireRef.current = null; // ИСПРАВЛЕНО: Сбрасываем ref при ошибке
    } else {
      setError(errorMessage);
      // КРИТИЧНО: Устанавливаем loading=false при ошибке, чтобы показать сообщение об ошибке
      setLoading(false);
      // Для других ошибок тоже сбрасываем, чтобы можно было повторить
      loadQuestionnaireAttemptedRef.current = false;
      questionnaireRef.current = null; // ИСПРАВЛЕНО: Сбрасываем ref при ошибке
    }
    
    return null;
  } finally {
    // ИСПРАВЛЕНО: Сбрасываем флаг загрузки анкеты
    loadQuestionnaireInProgressRef.current = false;
    // КРИТИЧНО: loading=false уже установлен в catch блоке при ошибках или в успешном случае
    // init() также установит loading=false в своем finally блоке для гарантии
    clientLogger.log('🔵 loadQuestionnaire() FINALLY - function completed', {
      timestamp: new Date().toISOString(),
      loadQuestionnaireInProgress: false,
      hasQuestionnaireRef: !!questionnaireRef.current,
      questionnaireId: questionnaireRef.current?.id || null,
      loading,
      error: error || null,
    });
  }
}

