// lib/api.ts
// API клиент для работы с бэкендом

import { handleNetworkError, fetchWithTimeout } from './network-utils';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '/api';
const DEFAULT_TIMEOUT = 30000; // 30 секунд по умолчанию

async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
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

  if (!response.ok) {
    // Для 404 ошибок логируем подробности
    if (response.status === 404) {
      const errorText = await response.text().catch(() => '');
      console.log('📋 404 Not Found:', {
        endpoint,
        errorText: errorText.substring(0, 200), // Первые 200 символов
        hasInitData: !!initData,
      });
      
      // Создаем объект ошибки с информацией о статусе
      const error: any = new Error(errorText || 'Not found');
      error.status = 404;
      error.isNotFound = true;
      throw error;
    }
    
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
    if (response.status === 404) {
      const errorData = await response.json().catch(() => ({ error: 'Not found' }));
      const errorMessage = errorData.error || 'Not found';
      // Логируем 404 только в development (они могут быть нормальными)
      if (process.env.NODE_ENV === 'development') {
        console.log('⚠️ 404 response from API:', { endpoint, errorMessage });
      }
      // Создаем специальную ошибку с кодом 404 для обработки на клиенте
      const notFoundError = new Error(errorMessage) as any;
      notFoundError.status = 404;
      notFoundError.isNotFound = true;
      throw notFoundError;
    }
    
    // Для остальных ошибок
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    const errorMessage = error.error || `HTTP ${response.status}`;
    
    // Для 400 ошибок (Bad Request)
    if (response.status === 400) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || 'Некорректный запрос. Проверьте данные и попробуйте снова.');
    }
    
    // Для 429 (rate limit) добавляем информацию о времени ожидания
    if (response.status === 429) {
      const retryAfter = response.headers.get('Retry-After');
      const message = retryAfter 
        ? `Слишком много запросов. Попробуйте через ${retryAfter} секунд.`
        : 'Слишком много запросов. Попробуйте позже.';
      throw new Error(message);
    }
    
    throw new Error(errorMessage);
  }

  return response.json();
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
  async getCurrentProfile() {
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
};
