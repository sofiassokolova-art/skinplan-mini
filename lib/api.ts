// lib/api.ts
// API клиент для работы с бэкендом

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '/api';

async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  // Получаем initData из Telegram WebApp
  const initData = typeof window !== 'undefined' && window.Telegram?.WebApp?.initData
    ? window.Telegram.WebApp.initData
    : null;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };

  // Добавляем initData в заголовки для идентификации пользователя (только если доступен)
  // Используем оба варианта для совместимости
  if (initData) {
    headers['X-Telegram-Init-Data'] = initData;
    headers['x-telegram-init-data'] = initData;
    console.log('✅ initData добавлен в заголовки, длина:', initData.length);
  } else {
    console.warn('⚠️ initData not available in Telegram WebApp');
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    const errorMessage = error.error || `HTTP ${response.status}`;
    
    // Для 401 ошибок добавляем более информативное сообщение
    if (response.status === 401) {
      const errorData = await response.json().catch(() => ({ error: 'Unauthorized' }));
      console.error('❌ 401 Unauthorized:', {
        endpoint,
        hasInitData: !!initData,
        error: errorData.error,
        headers: Object.keys(headers),
      });
      
      if (!initData) {
        throw new Error('Откройте приложение через Telegram Mini App. initData не доступен.');
      } else {
        throw new Error(errorData.error || 'Ошибка авторизации. Попробуйте обновить страницу.');
      }
    }
    
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

  // Рекомендации
  async getRecommendations() {
    return request('/recommendations');
  },

  // План ухода (28 дней)
  async getPlan() {
    return request('/plan/generate');
  },

  // Прогресс анкеты
  async getQuizProgress() {
    return request('/questionnaire/progress');
  },

  async saveQuizProgress(questionnaireId: number, questionId: number, answerValue?: string, answerValues?: string[]) {
    return request('/questionnaire/progress', {
      method: 'POST',
      body: JSON.stringify({
        questionnaireId,
        questionId,
        answerValue,
        answerValues,
      }),
    });
  },

  // Отзывы о плане
  async submitPlanFeedback(rating: number, feedback?: string) {
    return request('/feedback', {
      method: 'POST',
      body: JSON.stringify({ rating, feedback }),
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
};
