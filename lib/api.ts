// lib/api.ts
// API клиент для работы с бэкендом
// РЕФАКТОРИНГ: Используем модульную структуру для лучшей поддерживаемости

import { shouldBlockApiRequest } from './route-utils';
import { request as baseRequest } from './api/client';
import { getCachedData, setCachedData } from './api/cache';
import { getActiveRequest, setActiveRequest, removeActiveRequest, createRequestKey } from './api/dedup';
import type { 
  UserProfileResponse, 
  ProfileResponse, 
  PlanResponse, 
  WishlistResponse, 
  CartResponse, 
  AnalysisResponse,
  QuizProgressResponse,
  SubmitAnswersResponse,
  RecommendationsResponse
} from './api-types';

// Дефолтные значения для заблокированных endpoints
const DEFAULT_CART_RESPONSE = { items: [] };
const DEFAULT_PREFERENCES_RESPONSE = {
  isRetakingQuiz: false,
  fullRetakingQuiz: false,
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

async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  // РЕФАКТОРИНГ: Используем централизованную проверку из route-utils.ts
  // Блокируем cart и preferences на /quiz для предотвращения лишних запросов
  if (shouldBlockApiRequest(endpoint)) {
    const isCartEndpoint = endpoint === '/cart' || endpoint.includes('/cart');
    console.log('🚫 Blocking API request on /quiz:', endpoint);
    
    if (isCartEndpoint) {
      return Promise.resolve(DEFAULT_CART_RESPONSE as T);
    }
    return Promise.resolve(DEFAULT_PREFERENCES_RESPONSE as T);
  }
  
  // ИСПРАВЛЕНО: На сервере (SSR) также блокируем cart и preferences
  if (typeof window === 'undefined') {
    const isCartEndpoint = endpoint === '/cart' || endpoint.includes('/cart');
    const isPreferencesEndpoint = endpoint === '/user/preferences' || endpoint.includes('/user/preferences');
    
    if (isCartEndpoint) {
      return Promise.resolve(DEFAULT_CART_RESPONSE as T);
    }
    if (isPreferencesEndpoint) {
      return Promise.resolve(DEFAULT_PREFERENCES_RESPONSE as T);
    }
  }
  
  // РЕФАКТОРИНГ: Используем модули для кэширования и дедупликации
  const requestKey = createRequestKey(options.method || 'GET', endpoint);
  
  // Проверяем кэш ПЕРЕД проверкой активных запросов
  if (requestKey) {
    const cached = getCachedData<T>(requestKey, endpoint);
    if (cached !== null) {
      return cached;
    }
    
    // Проверяем активные запросы
    const activeRequest = getActiveRequest<T>(requestKey);
    if (activeRequest) {
      return activeRequest;
    }
  }
  
  // Создаем промис запроса
  const requestPromise = baseRequest<T>(endpoint, options);
  
  // Сохраняем активный запрос для дедупликации
  if (requestKey) {
    setActiveRequest(requestKey, requestPromise);
  }
  
  try {
    const data = await requestPromise;
    
    // Кэшируем результат для GET запросов
    if (requestKey) {
      setCachedData(requestKey, data, endpoint);
      removeActiveRequest(requestKey);
    }
    
    return data;
  } catch (error) {
    // Удаляем промис из activeRequests при ошибке
    if (requestKey) {
      removeActiveRequest(requestKey);
    }
    throw error;
  }
}

export const api = {
  // Анкета
  async getActiveQuestionnaire() {
    return request('/questionnaire/active');
  },

  async submitAnswers(params: {
    questionnaireId: number;
    answers: Array<{
      questionId: number;
      answerValue?: string;
      answerValues?: string[];
    }>;
    clientSubmissionId?: string;
  }): Promise<SubmitAnswersResponse> {
    const { questionnaireId, answers, clientSubmissionId } = params;
    // ВАЖНО: Логируем перед отправкой запроса
    if (typeof window !== 'undefined') {
      console.log('📤 api.submitAnswers called:', {
        questionnaireId,
        answersCount: answers.length,
        answerQuestionIds: answers.map(a => a.questionId),
        hasInitData: !!window.Telegram?.WebApp?.initData,
      });
    }
    
    try {
      const result = await request<SubmitAnswersResponse>('/questionnaire/answers', {
        method: 'POST',
        body: JSON.stringify({ questionnaireId, answers, clientSubmissionId }),
      });
      
      // ВАЖНО: Логируем после получения ответа
      if (typeof window !== 'undefined') {
        console.log('📥 api.submitAnswers response received:', {
          hasResult: !!result,
          resultType: typeof result,
          resultKeys: result ? Object.keys(result) : [],
          hasProfile: !!result?.profile,
          profileId: result?.profile?.id,
        });
      }
      
      return result;
    } catch (error: any) {
      // ВАЖНО: Логируем ошибку
      if (typeof window !== 'undefined') {
        console.error('❌ api.submitAnswers error:', {
          error,
          message: error?.message,
          status: error?.status,
          stack: error?.stack?.substring(0, 500),
        });
      }
      throw error;
    }
  },

  // Профиль
  // ОПТИМИЗАЦИЯ: Кэшируем результат проверки профиля в sessionStorage
  // и дедуплицируем параллельные запросы для предотвращения множественных запросов
  async getCurrentProfile(): Promise<ProfileResponse | null> {
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
            return JSON.parse(cached) as ProfileResponse;
          }
        }
        
        // Проверяем, есть ли уже выполняющийся запрос
        const pendingPromise = (window as any)[globalPendingKey] as Promise<ProfileResponse | null> | null;
        if (pendingPromise) {
          // Запрос уже выполняется - ждем его результата
          return pendingPromise;
        }
        
        // Создаем новый запрос и сохраняем промис для дедупликации
        const profilePromise = (async (): Promise<ProfileResponse | null> => {
          try {
            const profile = await request<ProfileResponse>('/profile/current');
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
    return request<ProfileResponse | null>('/profile/current');
  },

  async getUserProfile(): Promise<UserProfileResponse> {
    return request<UserProfileResponse>('/profile/user');
  },

  async updateUserProfile(data: { firstName?: string; lastName?: string; phoneNumber?: string }) {
    return request('/profile/user', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  // Рекомендации
  async getRecommendations(): Promise<RecommendationsResponse> {
    return request<RecommendationsResponse>('/recommendations');
  },

  // План ухода (28 дней) - получает план БЕЗ генерации (только из кэша)
  async getPlan(profileId?: string): Promise<PlanResponse> {
    const url = profileId ? `/plan?profileId=${profileId}` : '/plan';
    return request<PlanResponse>(url);
  },

  // Генерация плана ухода (28 дней) - явная генерация
  async generatePlan(profileId?: string): Promise<PlanResponse> {
    const url = profileId ? `/plan/generate?profileId=${profileId}` : '/plan/generate';
    return request<PlanResponse>(url);
  },

  // Подбор рекомендаций (создание RecommendationSession)
  async buildRecommendations(profileId: string) {
    return request(`/recommendations/build?profileId=${profileId}`, {
      method: 'POST',
    });
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
  async getQuizProgress(): Promise<QuizProgressResponse> {
    return request<QuizProgressResponse>('/questionnaire/progress');
  },

  // ИСПРАВЛЕНО: Используем новый идемпотентный эндпоинт для очистки ответов
  async clearQuizProgress(profileVersion?: number, cleanupId?: string) {
    return request('/questionnaire/answers/cleanup', {
      method: 'POST',
      body: JSON.stringify({
        profileVersion,
        cleanupId,
      }),
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
  async getWishlist(): Promise<WishlistResponse> {
    return request<WishlistResponse>('/wishlist');
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

  // Пользовательские настройки и флаги (замена localStorage)
  async getUserPreferences() {
    return request<{
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
    }>('/user/preferences');
  },

  async updateUserPreferences(preferences: {
    isRetakingQuiz?: boolean;
    fullRetakeFromHome?: boolean;
    paymentRetakingCompleted?: boolean;
    paymentFullRetakeCompleted?: boolean;
    hasPlanProgress?: boolean;
    routineProducts?: any;
    planFeedbackSent?: boolean;
    serviceFeedbackSent?: boolean;
    lastPlanFeedbackDate?: string | null;
    lastServiceFeedbackDate?: string | null;
    extra?: any;
  }) {
    return request('/user/preferences', {
      method: 'POST',
      body: JSON.stringify(preferences),
    });
  },

  async removeUserPreference(key: string) {
    return request(`/user/preferences?key=${key}`, {
      method: 'DELETE',
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
  async getCart(): Promise<CartResponse> {
    // ИСПРАВЛЕНО: Проверяем pathname перед вызовом request, чтобы предотвратить запросы на /quiz
    if (typeof window !== 'undefined') {
      const pathname = window.location.pathname;
      if (pathname === '/quiz' || pathname.startsWith('/quiz/')) {
        if (process.env.NODE_ENV === 'development') {
          console.log('🚫 getCart() called on /quiz - returning empty cart without API call');
        }
        return { items: [] } as CartResponse;
      }
    }
    return request<CartResponse>('/cart');
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
  async getAnalysis(): Promise<AnalysisResponse> {
    return request<AnalysisResponse>('/analysis');
  },

  // Получение entitlements пользователя
  async getEntitlements(): Promise<{
    paid: boolean;
    validUntil: string | null;
    entitlements: Array<{
      code: string;
      active: boolean;
      validUntil: string | null;
    }>;
  }> {
    return request('/me/entitlements');
  },

  // Админские функции
  async clearCache() {
    return request('/admin/clear-cache', {
      method: 'POST',
    });
  },
};
