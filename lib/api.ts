// lib/api.ts
// API клиент для работы с бэкендом

import { handleNetworkError, fetchWithTimeout } from './network-utils';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '/api';
const DEFAULT_TIMEOUT = 30000; // 30 секунд по умолчанию

// ИСПРАВЛЕНО: Глобальная защита от множественных одновременных запросов
// Кэшируем активные промисы для предотвращения дублирующих запросов
const activeRequests = new Map<string, Promise<any>>();
const requestCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 2000; // 2 секунды кэш для одинаковых запросов

async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  // ИСПРАВЛЕНО: Создаем уникальный ключ для запроса (GET запросы кэшируем)
  const isGetRequest = !options.method || options.method === 'GET';
  const requestKey = isGetRequest ? `${options.method || 'GET'}:${endpoint}` : null;
  
  // Если это GET запрос и он уже выполняется - возвращаем тот же промис
  if (requestKey && activeRequests.has(requestKey)) {
    return activeRequests.get(requestKey) as Promise<T>;
  }
  
  // Если это GET запрос и есть свежий кэш - возвращаем из кэша
  if (requestKey && requestCache.has(requestKey)) {
    const cached = requestCache.get(requestKey)!;
    if (Date.now() - cached.timestamp < CACHE_TTL) {
      return Promise.resolve(cached.data) as Promise<T>;
    }
    requestCache.delete(requestKey);
  }
  
  // Получаем initData из Telegram WebApp
  // Ждем готовности initData, если он еще не доступен
  let initData: string | null = null;
  
  if (typeof window !== 'undefined' && window.Telegram?.WebApp) {
    initData = window.Telegram.WebApp.initData || null;
    
    // Если initData еще не готов, ждем немного
    if (!initData) {
      await new Promise((resolve) => {
        let attempts = 0;
        const maxAttempts = 10; // 10 * 100ms = 1 секунда
        const checkInterval = setInterval(() => {
          attempts++;
          initData = window.Telegram?.WebApp?.initData || null;
          if (initData || attempts >= maxAttempts) {
            clearInterval(checkInterval);
            resolve(undefined);
          }
        }, 100);
      });
    }
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };

  // Добавляем initData в заголовки для идентификации пользователя (только если доступен)
  // Используем оба варианта для совместимости
  // Важно: передаем initData как есть, без дополнительного кодирования
  if (initData) {
    // Передаем initData без изменений (он уже в правильном формате от Telegram)
    headers['X-Telegram-Init-Data'] = initData;
    headers['x-telegram-init-data'] = initData;
    // Логируем только в development
    if (process.env.NODE_ENV === 'development') {
      console.log('✅ initData добавлен в заголовки, длина:', initData.length, 'endpoint:', endpoint);
    }
  } else {
    // Предупреждение только в development или если это критичный endpoint
    if (process.env.NODE_ENV === 'development' || endpoint.includes('/plan/generate') || endpoint.includes('/questionnaire')) {
      console.warn('⚠️ initData not available in Telegram WebApp for endpoint:', endpoint);
    }
  }

  // ИСПРАВЛЕНО: Создаем промис запроса и сохраняем его для предотвращения дублирования
  const requestPromise = (async () => {
    // Используем fetchWithTimeout для обработки таймаутов
    // Для генерации плана используем больший таймаут
    const timeout = endpoint.includes('/plan/generate') ? 60000 : DEFAULT_TIMEOUT;
    
    let response: Response;
    try {
      response = await fetchWithTimeout(`${API_BASE}${endpoint}`, {
        ...options,
        headers,
      }, timeout);
    } catch (error) {
      // Обрабатываем сетевые ошибки
      const errorMessage = handleNetworkError(error);
      throw new Error(errorMessage);
    }
    
    return response;
  })();
  
  // ИСПРАВЛЕНО: Сохраняем промис для GET запросов, чтобы предотвратить дублирование
  if (requestKey) {
    activeRequests.set(requestKey, requestPromise);
  }
  
  try {
    const response = await requestPromise;

    if (!response.ok) {
    // Для 401 ошибок добавляем более информативное сообщение
    // НО: для некоторых endpoints (cart, wishlist) 401 - это нормально (пользователь не авторизован)
    // В этом случае не выбрасываем исключение, а возвращаем пустой результат
    if (response.status === 401) {
      // Для cart и wishlist 401 - это нормально, если пользователь не авторизован
      // Возвращаем пустой результат вместо исключения
      if (endpoint.includes('/cart') || endpoint.includes('/wishlist')) {
        if (process.env.NODE_ENV === 'development') {
          console.log('ℹ️ 401 for cart/wishlist (user may not be authorized), returning empty result');
        }
        return { items: [] } as T;
      }
      
      // Для других endpoints 401 - это ошибка авторизации
      const errorData = await response.json().catch(() => ({ error: 'Unauthorized' }));
      // Всегда логируем 401 ошибки (они важны для отладки)
      console.error('❌ 401 Unauthorized:', {
        endpoint,
        hasInitData: !!initData,
        error: errorData.error,
      });
      
      if (!initData) {
        throw new Error('Откройте приложение через Telegram Mini App. initData не доступен.');
      } else {
        throw new Error(errorData.error || 'Ошибка авторизации. Попробуйте обновить страницу.');
      }
    }
    
    // Для 301/302 редиректов - обычно означает, что запрос был перенаправлен
    // Может происходить при повторной отправке формы или при изменении URL
    if (response.status === 301 || response.status === 302) {
      const location = response.headers.get('Location');
      if (process.env.NODE_ENV === 'development') {
        console.warn('⚠️ Redirect response:', { 
          status: response.status, 
          endpoint, 
          location,
          method: options.method || 'GET'
        });
      }
      
      // Для POST запросов редирект может означать проблему с повторной отправкой
      if (options.method === 'POST') {
        throw new Error('Форма уже была отправлена. Пожалуйста, обновите страницу и попробуйте снова.');
      }
      
      // Для GET запросов можем попробовать следовать редиректу
      const errorData = await response.json().catch(() => ({ error: `Redirected to ${location || 'unknown location'}` }));
      throw new Error(errorData.error || `Запрос был перенаправлен`);
    }
    
    // Для 404 ошибок (Not Found) - обычно означает отсутствие профиля
    // Это нормальная ситуация для новых пользователей или когда профиль не найден
    if (response.status === 404) {
      const errorText = await response.text().catch(() => '');
      let errorData: any = {};
      try {
        errorData = JSON.parse(errorText);
      } catch {
        // Если не JSON, используем текст как есть
        errorData = { error: errorText || 'Not found' };
      }
      const errorMessage = errorData.error || 'Not found';
      
      // Логируем 404 только в development (они могут быть нормальными для новых пользователей)
      if (process.env.NODE_ENV === 'development') {
        console.log('⚠️ 404 response from API:', { endpoint, errorMessage });
      }
      
      // Создаем специальную ошибку с кодом 404 для обработки на клиенте
      const notFoundError = new Error(errorMessage) as any;
      notFoundError.status = 404;
      notFoundError.isNotFound = true;
      throw notFoundError;
    }
    
    // ИСПРАВЛЕНО: Для ошибок 500 и других статусов правильно парсим ответ
    const errorText = await response.text().catch(() => 'Unknown error');
    let errorData: any = {};
    try {
      errorData = JSON.parse(errorText);
    } catch {
      // Если не JSON, используем текст как есть
      errorData = { error: errorText || `HTTP ${response.status}` };
    }
    const errorMessage = errorData.error || errorData.message || `HTTP ${response.status}`;
    
    // Для 400 ошибок (Bad Request)
    if (response.status === 400) {
      throw new Error(errorMessage || 'Некорректный запрос. Проверьте данные и попробуйте снова.');
    }
    
    // Для 429 (rate limit) добавляем информацию о времени ожидания
    if (response.status === 429) {
      const retryAfter = response.headers.get('Retry-After');
      const message = retryAfter 
        ? `Слишком много запросов. Попробуйте через ${retryAfter} секунд.`
        : 'Слишком много запросов. Попробуйте позже.';
      throw new Error(message);
    }
    
    // Для 500 ошибок добавляем детальную информацию
    if (response.status === 500) {
      const apiError = new Error(errorMessage) as any;
      apiError.status = 500;
      apiError.details = errorData.details || errorData;
      throw apiError;
    }
    
    // Для остальных ошибок
    const apiError = new Error(errorMessage) as any;
    apiError.status = response.status;
    apiError.details = errorData.details || errorData;
    throw apiError;
  }

  // ИСПРАВЛЕНО: Получаем данные и кэшируем для GET запросов
  const data = await response.json() as T;
  
  // Кэшируем результат для GET запросов
  if (requestKey) {
    requestCache.set(requestKey, { data, timestamp: Date.now() });
  }
  
  return data;
  } catch (error) {
    // ИСПРАВЛЕНО: Удаляем промис из activeRequests при ошибке
    if (requestKey) {
      activeRequests.delete(requestKey);
    }
    throw error;
  } finally {
    // ИСПРАВЛЕНО: Удаляем промис из activeRequests после завершения
    if (requestKey) {
      activeRequests.delete(requestKey);
    }
  }
}

export const api = {
  // Устаревшая функция - больше не нужна, initData передается автоматически
  async authTelegram(initData: string) {
    return { success: true };
  },

  // Анкета
  async getActiveQuestionnaire() {
    return request('/questionnaire/active');
  },

  async submitAnswers(questionnaireId: number, answers: Array<{
    questionId: number;
    answerValue?: string;
    answerValues?: string[];
  }>) {
    return request('/questionnaire/answers', {
      method: 'POST',
      body: JSON.stringify({ questionnaireId, answers }),
    });
  },

  // Профиль
  // ОПТИМИЗАЦИЯ: Кэшируем результат проверки профиля в sessionStorage
  // и дедуплицируем параллельные запросы для предотвращения множественных запросов
  async getCurrentProfile() {
    // Проверяем кэш в sessionStorage
    if (typeof window !== 'undefined') {
      const cacheKey = 'profile_check_cache';
      const cacheTimestampKey = 'profile_check_cache_timestamp';
      const cacheMaxAge = 5000; // 5 секунд - достаточно для предотвращения дублирующих запросов
      
      // Дедупликация: если запрос уже выполняется, ждем его результата
      const globalPendingKey = '__profile_request_pending';
      if (!(window as any)[globalPendingKey]) {
        (window as any)[globalPendingKey] = null;
      }
      
      try {
        // Проверяем кэш
        const cached = sessionStorage.getItem(cacheKey);
        const cachedTimestamp = sessionStorage.getItem(cacheTimestampKey);
        
        if (cached && cachedTimestamp) {
          const age = Date.now() - parseInt(cachedTimestamp, 10);
          if (age < cacheMaxAge) {
            // Кэш свежий - возвращаем закэшированный результат
            if (cached === 'null') {
              // Профиль не найден - возвращаем null
              return null;
            }
            // Профиль найден - возвращаем из кэша
            return JSON.parse(cached);
          }
        }
        
        // Проверяем, есть ли уже выполняющийся запрос
        const pendingPromise = (window as any)[globalPendingKey];
        if (pendingPromise) {
          // Запрос уже выполняется - ждем его результата
          return pendingPromise;
        }
        
        // Создаем новый запрос и сохраняем промис для дедупликации
        const profilePromise = (async () => {
          try {
            const profile = await request('/profile/current');
            // Если профиль null - это нормально, кэшируем как 'null'
            if (profile === null) {
              sessionStorage.setItem(cacheKey, 'null');
              sessionStorage.setItem(cacheTimestampKey, String(Date.now()));
              return null;
            }
            // Сохраняем в кэш
            sessionStorage.setItem(cacheKey, JSON.stringify(profile));
            sessionStorage.setItem(cacheTimestampKey, String(Date.now()));
            return profile;
          } catch (error: any) {
            // Если 404 - тоже кэшируем, чтобы не делать повторные запросы (для обратной совместимости)
            if (error?.status === 404 || error?.isNotFound) {
              sessionStorage.setItem(cacheKey, 'null');
              sessionStorage.setItem(cacheTimestampKey, String(Date.now()));
            }
            throw error;
          } finally {
            // Очищаем ссылку на промис после завершения
            (window as any)[globalPendingKey] = null;
          }
        })();
        
        // Сохраняем промис для других вызовов
        (window as any)[globalPendingKey] = profilePromise;
        
        return profilePromise;
      } catch (e) {
        // Очищаем промис в случае ошибки
        (window as any)[globalPendingKey] = null;
        throw e;
      }
    }
    
    // SSR или window недоступен - делаем запрос без кэша
    return request('/profile/current');
  },

  async getUserProfile() {
    return request('/profile/user');
  },

  async updateUserProfile(data: { firstName?: string; lastName?: string; phoneNumber?: string }) {
    return request('/profile/user', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  // Рекомендации
  async getRecommendations() {
    return request('/recommendations');
  },

  // План ухода (28 дней) - получает план БЕЗ генерации (только из кэша)
  async getPlan() {
    return request('/plan');
  },

  // Генерация плана ухода (28 дней) - явная генерация
  async generatePlan() {
    return request('/plan/generate');
  },

  // Прогресс плана (28 дней)
  async getPlanProgress() {
    return request('/plan/progress');
  },

  async savePlanProgress(currentDay: number, completedDays: number[]) {
    return request('/plan/progress', {
      method: 'POST',
      body: JSON.stringify({ currentDay, completedDays }),
    });
  },

  // Ежедневный совет
  async getDailyTip(data: { currentDay?: number; skinType?: string; concerns?: string[]; currentProducts?: string[] }) {
    return request<{ tip: string; source: string; day?: number }>('/api/ai/daily-tip', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // Прогресс анкеты
  async getQuizProgress() {
    return request('/questionnaire/progress');
  },

  async clearQuizProgress() {
    return request('/questionnaire/progress', {
      method: 'DELETE',
    });
  },

  async saveQuizProgress(
    questionnaireId: number, 
    questionId: number, 
    answerValue?: string, 
    answerValues?: string[],
    questionIndex?: number,
    infoScreenIndex?: number
  ) {
    return request('/questionnaire/progress', {
      method: 'POST',
      body: JSON.stringify({
        questionnaireId,
        questionId,
        answerValue,
        answerValues,
        questionIndex,
        infoScreenIndex,
      }),
    });
  },

  // Отзывы о плане
  // Старый метод (для совместимости)
  async submitPlanFeedback(rating: number, feedback?: string) {
    return request('/feedback', {
      method: 'POST',
      body: JSON.stringify({ rating, feedback }),
    });
  },

  // Новый метод для анализа (поддержка isRelevant, reasons, comment)
  async submitAnalysisFeedback(feedback: {
    isRelevant: boolean;
    reasons?: string[];
    comment?: string;
    type?: 'plan_recommendations' | 'plan_general' | 'service';
  }) {
    return request('/feedback', {
      method: 'POST',
      body: JSON.stringify(feedback),
    });
  },

  // Универсальный метод для отправки фидбека (используется в плане)
  async submitFeedback(
    isRelevant: boolean,
    reasons?: string[],
    comment?: string | null
  ) {
    return request('/feedback', {
      method: 'POST',
      body: JSON.stringify({ isRelevant, reasons, comment }),
    });
  },

  async getLastPlanFeedback() {
    return request('/feedback');
  },

  // Избранное (Wishlist)
  async getWishlist() {
    return request('/wishlist');
  },

  async addToWishlist(productId: number) {
    return request('/wishlist', {
      method: 'POST',
      body: JSON.stringify({ productId }),
    });
  },

  async removeFromWishlist(productId: number) {
    return request(`/wishlist?productId=${productId}`, {
      method: 'DELETE',
    });
  },

  async submitWishlistFeedback(productId: number, feedback: string) {
    return request('/wishlist/feedback', {
      method: 'POST',
      body: JSON.stringify({ productId, feedback }),
    });
  },

  async getProductAlternatives(productId: number) {
    return request(`/products/alternatives/${productId}`);
  },

  async replaceProductInPlan(oldProductId: number, newProductId: number) {
    return request('/plan/replace-product', {
      method: 'POST',
      body: JSON.stringify({ oldProductId, newProductId }),
    });
  },

  // Корзина
  async getCart() {
    return request('/cart');
  },

  async addToCart(productId: number, quantity: number = 1) {
    return request('/cart', {
      method: 'POST',
      body: JSON.stringify({ productId, quantity }),
    });
  },

  async removeFromCart(productId: number) {
    return request(`/cart?productId=${productId}`, {
      method: 'DELETE',
    });
  },

  // Анкета (используем существующие методы)
  async getQuestionnaire() {
    return request('/questionnaire/active');
  },

  async getUserAnswers() {
    // Получаем ответы через существующий endpoint
    return request('/questionnaire/answers');
  },

  // Анализ кожи
  async getAnalysis() {
    return request('/analysis');
  },

  // Админские функции
  async clearCache() {
    return request('/admin/clear-cache', {
      method: 'POST',
    });
  },
};
