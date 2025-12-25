// lib/user-preferences.ts
// Helper функции для работы с пользовательскими настройками
// Заменяют использование localStorage

import { api } from './api';

// Кэш для preferences (чтобы не делать лишние запросы)
let preferencesCache: {
  data: any;
  timestamp: number;
} | null = null;

// ИСПРАВЛЕНО: Промис для синхронизации одновременных запросов
// Если несколько компонентов вызывают getUserPreferences() одновременно,
// они все ждут одного запроса вместо создания множественных запросов
let pendingRequest: Promise<any> | null = null;

const CACHE_TTL = 30000; // 30 секунд кэш (увеличено для уменьшения запросов)

// Получаем preferences с кэшированием
export async function getUserPreferences() {
  // ТЗ: НА /quiz и /plan* НИКОГДА не делаем API вызовы - используем дефолтные значения
  // КРИТИЧНО: Проверяем pathname, href и referrer СИНХРОННО перед любыми async операциями
  if (typeof window !== 'undefined') {
    const pathname = window.location.pathname;
    const href = window.location.href;
    const referrer = document.referrer;
    const isNavigatingToQuiz = referrer && (referrer.includes('/quiz') || referrer.endsWith('/quiz'));
    const isNavigatingToPlan = referrer && (referrer.includes('/plan') || referrer.endsWith('/plan'));
    const isQuizInHref = href.includes('/quiz');
    const isPlanInHref = href.includes('/plan');
    const isOnQuizPage = pathname === '/quiz' || pathname.startsWith('/quiz/');
    const isOnPlanPage = pathname === '/plan' || pathname.startsWith('/plan/');
    const shouldBlock = isOnQuizPage || isOnPlanPage || isNavigatingToQuiz || isNavigatingToPlan || isQuizInHref || isPlanInHref;
    
    if (shouldBlock) {
      console.log('⚠️ getUserPreferences called on /quiz or /plan - returning defaults without API call', {
        pathname,
        href,
        referrer,
        isNavigatingToQuiz,
        isNavigatingToPlan,
        isQuizInHref,
        isPlanInHref,
        isOnQuizPage,
        isOnPlanPage,
        hasPendingRequest: !!pendingRequest,
      });
      // ИСПРАВЛЕНО: Возвращаем resolved Promise с дефолтными значениями
      // Это предотвращает любые async операции на /quiz
      return {
        isRetakingQuiz: false,
        fullRetakeFromHome: false,
        paymentRetakingCompleted: false,
        paymentFullRetakeCompleted: false,
        hasPlanProgress: false,
        routineProducts: null,
        planFeedbackSent: false,
        serviceFeedbackSent: false,
        lastPlanFeedbackDate: null,
        lastServiceFeedbackDate: null,
        extra: null,
      };
    }
  }
  
  // ИСПРАВЛЕНО: Проверяем sessionStorage для hasPlanProgress (самый частый запрос)
  // Это предотвращает множественные запросы при загрузке страницы
  // ВАЖНО: Используем try-catch для всех операций с sessionStorage, так как они могут быть недоступны
  if (typeof window !== 'undefined') {
    try {
      const cached = sessionStorage.getItem('user_preferences_cache');
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          const cacheAge = Date.now() - parsed.timestamp;
          if (cacheAge < CACHE_TTL && parsed.data) {
            return parsed.data;
          }
        } catch (e) {
          // Игнорируем ошибки парсинга
        }
      }
    } catch (e) {
      // Игнорируем ошибки sessionStorage (может быть недоступен в приватном режиме и т.д.)
      // Продолжаем выполнение с проверкой кэша в памяти
    }
  }
  
  // Проверяем кэш в памяти
  if (preferencesCache && Date.now() - preferencesCache.timestamp < CACHE_TTL) {
    // ИСПРАВЛЕНО: Даже если есть кэш, проверяем pathname на /quiz
    // На /quiz не используем кэш, возвращаем дефолтные значения
    if (typeof window !== 'undefined') {
      const pathname = window.location.pathname;
      if (pathname === '/quiz' || pathname.startsWith('/quiz/')) {
        console.log('⚠️ getUserPreferences called on /quiz - returning defaults (ignoring cache)');
        return {
          isRetakingQuiz: false,
          fullRetakeFromHome: false,
          paymentRetakingCompleted: false,
          paymentFullRetakeCompleted: false,
          hasPlanProgress: false,
          routineProducts: null,
          planFeedbackSent: false,
          serviceFeedbackSent: false,
          lastPlanFeedbackDate: null,
          lastServiceFeedbackDate: null,
          extra: null,
        };
      }
    }
    return preferencesCache.data;
  }

  // ИСПРАВЛЕНО: Если уже есть запрос в процессе, проверяем pathname перед возвратом
  // Если мы на /quiz, не ждем pending запрос, возвращаем дефолтные значения
  if (pendingRequest) {
    // КРИТИЧНО: Проверяем pathname еще раз перед возвратом pending запроса
    if (typeof window !== 'undefined') {
      const pathname = window.location.pathname;
      if (pathname === '/quiz' || pathname.startsWith('/quiz/')) {
        console.log('⚠️ getUserPreferences: pending request exists but we are on /quiz - returning defaults');
        return {
          isRetakingQuiz: false,
          fullRetakeFromHome: false,
          paymentRetakingCompleted: false,
          paymentFullRetakeCompleted: false,
          hasPlanProgress: false,
          routineProducts: null,
          planFeedbackSent: false,
          serviceFeedbackSent: false,
          lastPlanFeedbackDate: null,
          lastServiceFeedbackDate: null,
          extra: null,
        };
      }
    }
    return pendingRequest;
  }

  // Создаем новый запрос
  pendingRequest = (async () => {
    try {
      const prefs = await api.getUserPreferences();
      preferencesCache = {
        data: prefs,
        timestamp: Date.now(),
      };
      
      // ИСПРАВЛЕНО: Сохраняем в sessionStorage для использования между компонентами
      if (typeof window !== 'undefined') {
        try {
          sessionStorage.setItem('user_preferences_cache', JSON.stringify({
            data: prefs,
            timestamp: Date.now(),
          }));
        } catch (e) {
          // Игнорируем ошибки sessionStorage (может быть заполнен)
        }
      }
      
      return prefs;
    } catch (error) {
      // Если ошибка - возвращаем значения по умолчанию
      console.warn('Failed to get user preferences, using defaults:', error);
      return {
        isRetakingQuiz: false,
        fullRetakeFromHome: false,
        paymentRetakingCompleted: false,
        paymentFullRetakeCompleted: false,
        hasPlanProgress: false,
        routineProducts: null,
        planFeedbackSent: false,
        serviceFeedbackSent: false,
        lastPlanFeedbackDate: null,
        lastServiceFeedbackDate: null,
        extra: null,
      };
    } finally {
      // Очищаем pendingRequest после завершения
      pendingRequest = null;
    }
  })();

  return pendingRequest;
}

// Обновляем preferences
export async function updateUserPreferences(updates: Partial<{
  isRetakingQuiz: boolean;
  fullRetakeFromHome: boolean;
  paymentRetakingCompleted: boolean;
  paymentFullRetakeCompleted: boolean;
  hasPlanProgress: boolean;
  routineProducts: any;
  planFeedbackSent: boolean;
  serviceFeedbackSent: boolean;
  lastPlanFeedbackDate: string | null;
  lastServiceFeedbackDate: string | null;
  extra: any;
}>) {
  try {
    await api.updateUserPreferences(updates);
    // Инвалидируем кэш
    preferencesCache = null;
    // ИСПРАВЛЕНО: Инвалидируем sessionStorage кэш
    if (typeof window !== 'undefined') {
      try {
        sessionStorage.removeItem('user_preferences_cache');
      } catch (e) {
        // Игнорируем ошибки
      }
    }
  } catch (error) {
    console.error('Failed to update user preferences:', error);
    throw error;
  }
}

// Удаляем конкретный флаг
export async function removeUserPreference(key: string) {
  try {
    await api.removeUserPreference(key);
    // Инвалидируем кэш
    preferencesCache = null;
  } catch (error) {
    console.error('Failed to remove user preference:', error);
    throw error;
  }
}

// Helper функции для конкретных флагов (для удобства)

export async function getIsRetakingQuiz(): Promise<boolean> {
  // ИСПРАВЛЕНО: НА /quiz НИКОГДА не делаем API вызовы
  if (typeof window !== 'undefined') {
    const pathname = window.location.pathname;
    if (pathname === '/quiz' || pathname.startsWith('/quiz/')) {
      return false;
    }
  }
  const prefs = await getUserPreferences();
  return prefs.isRetakingQuiz;
}

export async function setIsRetakingQuiz(value: boolean) {
  await updateUserPreferences({ isRetakingQuiz: value });
}

export async function getFullRetakeFromHome(): Promise<boolean> {
  // ИСПРАВЛЕНО: НА /quiz НИКОГДА не делаем API вызовы
  if (typeof window !== 'undefined') {
    const pathname = window.location.pathname;
    if (pathname === '/quiz' || pathname.startsWith('/quiz/')) {
      return false;
    }
  }
  const prefs = await getUserPreferences();
  return prefs.fullRetakeFromHome;
}

export async function setFullRetakeFromHome(value: boolean) {
  await updateUserPreferences({ fullRetakeFromHome: value });
}

export async function getHasPlanProgress(): Promise<boolean> {
  // ТЗ: НА /quiz и /plan* НИКОГДА не делаем API вызовы - возвращаем false для нового пользователя
  // Это предотвращает лишние запросы для нового пользователя на странице анкеты и плана
  if (typeof window !== 'undefined') {
    const pathname = window.location.pathname;
    if (pathname === '/quiz' || pathname.startsWith('/quiz/') ||
        pathname === '/plan' || pathname.startsWith('/plan/')) {
      console.log('⚠️ getHasPlanProgress called on /quiz or /plan - returning false without API call');
      return false; // Новый пользователь на анкете или плане
    }
  }
  
  const prefs = await getUserPreferences();
  return prefs.hasPlanProgress;
}

export async function setHasPlanProgress(value: boolean) {
  await updateUserPreferences({ hasPlanProgress: value });
}

export async function getPaymentRetakingCompleted(): Promise<boolean> {
  // ИСПРАВЛЕНО: НА /quiz НИКОГДА не делаем API вызовы
  if (typeof window !== 'undefined') {
    const pathname = window.location.pathname;
    if (pathname === '/quiz' || pathname.startsWith('/quiz/')) {
      return false;
    }
  }
  const prefs = await getUserPreferences();
  return prefs.paymentRetakingCompleted;
}

export async function setPaymentRetakingCompleted(value: boolean) {
  await updateUserPreferences({ paymentRetakingCompleted: value });
}

export async function getPaymentFullRetakeCompleted(): Promise<boolean> {
  // ИСПРАВЛЕНО: НА /quiz НИКОГДА не делаем API вызовы
  if (typeof window !== 'undefined') {
    const pathname = window.location.pathname;
    if (pathname === '/quiz' || pathname.startsWith('/quiz/')) {
      return false;
    }
  }
  const prefs = await getUserPreferences();
  return prefs.paymentFullRetakeCompleted;
}

export async function setPaymentFullRetakeCompleted(value: boolean) {
  await updateUserPreferences({ paymentFullRetakeCompleted: value });
}

export async function getRoutineProducts(): Promise<any> {
  // ИСПРАВЛЕНО: НА /quiz НИКОГДА не делаем API вызовы
  if (typeof window !== 'undefined') {
    const pathname = window.location.pathname;
    if (pathname === '/quiz' || pathname.startsWith('/quiz/')) {
      return null;
    }
  }
  const prefs = await getUserPreferences();
  return prefs.routineProducts;
}

export async function setRoutineProducts(value: any) {
  await updateUserPreferences({ routineProducts: value });
}

export async function getPlanFeedbackSent(): Promise<boolean> {
  // ИСПРАВЛЕНО: НА /quiz НИКОГДА не делаем API вызовы
  if (typeof window !== 'undefined') {
    const pathname = window.location.pathname;
    if (pathname === '/quiz' || pathname.startsWith('/quiz/')) {
      return false;
    }
  }
  const prefs = await getUserPreferences();
  return prefs.planFeedbackSent;
}

export async function setPlanFeedbackSent(value: boolean) {
  await updateUserPreferences({ planFeedbackSent: value });
}

export async function getServiceFeedbackSent(): Promise<boolean> {
  // ТЗ: НА /quiz и /plan* НИКОГДА не делаем API вызовы
  if (typeof window !== 'undefined') {
    const pathname = window.location.pathname;
    if (pathname === '/quiz' || pathname.startsWith('/quiz/') ||
        pathname === '/plan' || pathname.startsWith('/plan/')) {
      console.log('⚠️ getServiceFeedbackSent called on /quiz or /plan - returning false without API call');
      return false; // На анкете и плане не показываем попап
    }
  }
  const prefs = await getUserPreferences();
  return prefs.serviceFeedbackSent;
}

export async function setServiceFeedbackSent(value: boolean) {
  await updateUserPreferences({ serviceFeedbackSent: value });
}

export async function getLastPlanFeedbackDate(): Promise<string | null> {
  // ИСПРАВЛЕНО: НА /quiz НИКОГДА не делаем API вызовы
  if (typeof window !== 'undefined') {
    const pathname = window.location.pathname;
    if (pathname === '/quiz' || pathname.startsWith('/quiz/')) {
      return null;
    }
  }
  const prefs = await getUserPreferences();
  return prefs.lastPlanFeedbackDate;
}

export async function setLastPlanFeedbackDate(value: string | null) {
  await updateUserPreferences({ lastPlanFeedbackDate: value });
}

export async function getLastServiceFeedbackDate(): Promise<string | null> {
  // ТЗ: НА /quiz и /plan* НИКОГДА не делаем API вызовы
  if (typeof window !== 'undefined') {
    const pathname = window.location.pathname;
    if (pathname === '/quiz' || pathname.startsWith('/quiz/') ||
        pathname === '/plan' || pathname.startsWith('/plan/')) {
      console.log('⚠️ getLastServiceFeedbackDate called on /quiz or /plan - returning null without API call');
      return null; // На анкете и плане не показываем попап
    }
  }
  const prefs = await getUserPreferences();
  return prefs.lastServiceFeedbackDate;
}

export async function setLastServiceFeedbackDate(value: string | null) {
  await updateUserPreferences({ lastServiceFeedbackDate: value });
}

// Инвалидируем кэш (для принудительного обновления)
export function invalidatePreferencesCache() {
  preferencesCache = null;
  // ИСПРАВЛЕНО: Инвалидируем sessionStorage кэш
  if (typeof window !== 'undefined') {
    try {
      sessionStorage.removeItem('user_preferences_cache');
    } catch (e) {
      // Игнорируем ошибки
    }
  }
}

