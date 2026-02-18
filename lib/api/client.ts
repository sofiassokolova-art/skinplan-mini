// lib/api/client.ts
// Базовый HTTP клиент для работы с бэкендом

import { fetchWithTimeout, handleNetworkError } from '../network-utils';
import { shouldBlockApiRequest } from '../route-utils';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '/api';
const DEFAULT_TIMEOUT = 30000; // 30 секунд по умолчанию

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

/**
 * Получает initData из Telegram WebApp
 * Ждет готовности initData, если он еще не доступен
 */
async function getInitData(): Promise<string | null> {
  // ИСПРАВЛЕНО: В development режиме используем тестовый initData, если реальный недоступен
  if (process.env.NODE_ENV === 'development') {
    // Тестовый Telegram ID: 987654321 (можно заменить на любой другой)
    const TEST_TELEGRAM_ID = '987654321';
    const TEST_INIT_DATA = `user=%7B%22id%22%3A${TEST_TELEGRAM_ID}%2C%22first_name%22%3A%22Test%22%2C%22last_name%22%3A%22User%22%2C%22username%22%3A%22testuser%22%2C%22language_code%22%3A%22ru%22%7D&auth_date=${Math.floor(Date.now() / 1000)}&hash=test_hash_for_development_only`;
    
    if (typeof window === 'undefined') {
      return TEST_INIT_DATA;
    }
    
    // Инициализируем window.Telegram.WebApp, если его нет
    if (!window.Telegram) {
      (window as any).Telegram = {
        WebApp: {
          initData: TEST_INIT_DATA,
          ready: () => {},
          expand: () => {},
        },
      };
      return TEST_INIT_DATA;
    }
    
    if (!window.Telegram.WebApp) {
      (window as any).Telegram.WebApp = {
        initData: TEST_INIT_DATA,
        ready: () => {},
        expand: () => {},
      };
      return TEST_INIT_DATA;
    }
    
    // Если реальный initData есть, используем его
    const existingInitData = window.Telegram.WebApp.initData;
    if (existingInitData) {
      return existingInitData;
    }
    
    // ИСПРАВЛЕНО: Безопасная установка тестового initData (может быть read-only)
    try {
      // Пробуем установить через Object.defineProperty, если обычная установка не работает
      const descriptor = Object.getOwnPropertyDescriptor(window.Telegram.WebApp, 'initData');
      if (descriptor && !descriptor.writable && !descriptor.set) {
        // Свойство read-only, используем defineProperty для переопределения
        Object.defineProperty(window.Telegram.WebApp, 'initData', {
          value: TEST_INIT_DATA,
          writable: true,
          configurable: true,
        });
      } else {
        // Обычная установка
        (window.Telegram.WebApp as any).initData = TEST_INIT_DATA;
      }
      return TEST_INIT_DATA;
    } catch (err) {
      // Если не удалось установить, возвращаем тестовый initData напрямую
      // (не устанавливаем в объект, но используем для запросов)
      return TEST_INIT_DATA;
    }
  }
  
  if (typeof window === 'undefined' || !window.Telegram?.WebApp) {
    return null;
  }

  let initData: string | null = window.Telegram.WebApp.initData || null;
  
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

  return initData;
}

/**
 * Создает заголовки для запроса
 */
function createHeaders(initData: string | null, customHeaders?: Record<string, string>): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(customHeaders || {}),
  };

  // Добавляем initData в заголовки для идентификации пользователя
  if (initData) {
    headers['X-Telegram-Init-Data'] = initData;
    headers['x-telegram-init-data'] = initData;
    if (process.env.NODE_ENV === 'development') {
      console.log('✅ initData добавлен в заголовки, длина:', initData.length);
    }
  } else {
    if (process.env.NODE_ENV === 'development') {
      console.warn('⚠️ initData not available in Telegram WebApp');
    }
  }

  return headers;
}

/**
 * Обрабатывает HTTP ошибки
 */
async function handleHttpError(response: Response, endpoint: string, initData: string | null): Promise<never> {
  // Для 401 ошибок
  if (response.status === 401) {
    const errorData = await response.json().catch(() => ({ error: 'Unauthorized' }));
    console.error('❌ 401 Unauthorized:', {
      endpoint,
      hasInitData: !!initData,
      error: errorData.error,
    });

    if (!initData) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('⚠️ 401 без initData в dev, возвращаем null вместо ошибки для endpoint:', endpoint);
        throw new Error('Dev mode: null response');
      }
      throw new Error('Откройте приложение через Telegram Mini App. initData не доступен.');
    } else {
      throw new Error(errorData.error || 'Ошибка авторизации. Попробуйте обновить страницу.');
    }
  }

  // Для 403 ошибок (Forbidden)
  if (response.status === 403) {
    const errorText = await response.text().catch(() => '');
    let errorData: any = {};
    try {
      errorData = JSON.parse(errorText);
    } catch {
      // Если это HTML страница ошибки (например, Vercel), а не JSON
      if (errorText.includes('<!DOCTYPE html>') || errorText.includes('<html')) {
        errorData = {
          error: 'Доступ запрещен',
          message: 'Возможно, истек срок действия сессии или требуется повторная авторизация'
        };
      } else {
        errorData = { error: errorText || 'Forbidden' };
      }
    }
    console.error('❌ 403 Forbidden:', {
      endpoint,
      hasInitData: !!initData,
      error: errorData.error,
      isHtmlError: errorText.includes('<!DOCTYPE html>'),
    });
    const forbiddenError = new Error(errorData.message || errorData.error || 'Доступ запрещен') as any;
    forbiddenError.status = 403;
    forbiddenError.response = {
      status: 403,
      data: errorData,
    };
    throw forbiddenError;
  }

  // Для 301/302 редиректов
  if (response.status === 301 || response.status === 302) {
    const location = response.headers.get('Location');
    if (process.env.NODE_ENV === 'development') {
      console.warn('⚠️ Redirect response:', { 
        status: response.status, 
        endpoint, 
        location,
      });
    }
    const errorData = await response.json().catch(() => ({ error: `Redirected to ${location || 'unknown location'}` }));
    throw new Error(errorData.error || `Запрос был перенаправлен`);
  }
  
  // Для 405 ошибок (Method Not Allowed)
  if (response.status === 405) {
    const errorText = await response.text().catch(() => '');
    let errorData: any = {};
    try {
      errorData = JSON.parse(errorText);
    } catch {
      errorData = { error: errorText || 'Method not allowed' };
    }
    console.error('❌ 405 Method Not Allowed:', { endpoint, errorMessage: errorData.error });
    const methodError = new Error(`HTTP 405: ${errorData.error}`) as any;
    methodError.status = 405;
    methodError.isMethodError = true;
    throw methodError;
  }
  
  // Для 500 ошибок (Internal Server Error)
  if (response.status === 500) {
    const errorText = await response.text().catch(() => '');
    let errorData: any = {};
    try {
      errorData = JSON.parse(errorText);
    } catch {
      errorData = { error: errorText || 'Internal server error' };
    }
    console.error('❌ 500 Internal Server Error:', { 
      endpoint, 
      error: errorData.error || errorData.message,
    });
    const serverError = new Error(errorData.message || errorData.error || 'Ошибка сервера') as any;
    serverError.status = 500;
    serverError.response = {
      status: 500,
      data: errorData,
    };
    throw serverError;
  }
  
  // Для 404 ошибок (Not Found)
  if (response.status === 404) {
    const errorText = await response.text().catch(() => '');
    let errorData: any = {};
    try {
      errorData = JSON.parse(errorText);
    } catch {
      errorData = { error: errorText || 'Not found' };
    }
    if (process.env.NODE_ENV === 'development') {
      console.log('⚠️ 404 response from API:', { endpoint, errorMessage: errorData.error });
    }
    const notFoundError = new Error(errorData.error || 'Not found') as any;
    notFoundError.status = 404;
    notFoundError.isNotFound = true;
    throw notFoundError;
  }
  
  // Для 400 ошибок (Bad Request)
  if (response.status === 400) {
    const errorText = await response.text().catch(() => 'Unknown error');
    let errorData: any = {};
    try {
      errorData = JSON.parse(errorText);
    } catch {
      errorData = { error: errorText || 'Bad request' };
    }
    const errorMsg = errorData.error || errorData.message || 'Некорректный запрос. Проверьте данные и попробуйте снова.';
    throw new Error(errorMsg);
  }
  
  // Для 429 (rate limit)
  if (response.status === 429) {
    const retryAfterHeader = response.headers.get('Retry-After');
    const parsedRetryAfter = retryAfterHeader ? Number(retryAfterHeader) : null;
    const retryAfterSeconds = parsedRetryAfter && Number.isFinite(parsedRetryAfter) ? parsedRetryAfter : null;
    const message = retryAfterSeconds 
      ? `Слишком много запросов. Попробуйте через ${retryAfterSeconds} секунд.`
      : 'Слишком много запросов. Попробуйте позже.';
    const rateLimitError = new Error(message) as any;
    rateLimitError.status = 429;
    if (retryAfterSeconds) {
      rateLimitError.retryAfter = retryAfterSeconds;
    }
    throw rateLimitError;
  }
  
  // Для остальных ошибок
  const errorText = await response.text().catch(() => 'Unknown error');
  let errorData: any = {};
  try {
    errorData = JSON.parse(errorText);
  } catch {
    errorData = { error: errorText || `HTTP ${response.status}` };
  }
  const errorMsg = errorData.error || errorData.message || `HTTP ${response.status}`;
  const apiError = new Error(errorMsg) as any;
  apiError.status = response.status;
  apiError.details = errorData.details || errorData;
  throw apiError;
}

/**
 * Базовый HTTP запрос
 */
export async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  // Блокируем cart и preferences на /quiz
  if (shouldBlockApiRequest(endpoint)) {
    const isCartEndpoint = endpoint === '/cart' || endpoint.includes('/cart');
    console.log('🚫 Blocking API request on /quiz:', endpoint);
    
    if (isCartEndpoint) {
      return Promise.resolve(DEFAULT_CART_RESPONSE as T);
    }
    return Promise.resolve(DEFAULT_PREFERENCES_RESPONSE as T);
  }
  
  // На сервере (SSR) также блокируем cart и preferences
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

  // Получаем initData
  const isQuestionnaireProgressEndpoint = endpoint.includes('/questionnaire/progress');
  const initData = await getInitData();

  // Не дергаем /questionnaire/progress, если initData недоступен
  if (isQuestionnaireProgressEndpoint && !initData) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('⚠️ Skipping request to /questionnaire/progress: Telegram initData not available, returning empty progress');
    }
    return {
      progress: null,
      isCompleted: false,
    } as T;
  }

  // Создаем заголовки
  const headers = createHeaders(initData, options.headers as Record<string, string>);

  // Определяем таймаут
  const timeout = endpoint.includes('/plan/generate') ? 60000 : DEFAULT_TIMEOUT;
  
  // Логируем перед отправкой запроса (только для критичных endpoints)
  if (endpoint.includes('/questionnaire/answers') || endpoint.includes('/plan/generate')) {
    if (typeof window !== 'undefined') {
      console.log('📤 Sending request to:', `${API_BASE}${endpoint}`, {
        method: options.method || 'GET',
        hasInitData: !!initData,
        initDataLength: initData?.length || 0,
        timeout,
      });
    }
  }
  
  let response: Response;
  try {
    response = await fetchWithTimeout(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
    }, timeout);
    
    // Логируем ответ (только для критичных endpoints)
    if (endpoint.includes('/questionnaire/answers') || endpoint.includes('/plan/generate')) {
      if (typeof window !== 'undefined') {
        console.log('📥 Received response from:', `${API_BASE}${endpoint}`, {
          status: response.status,
          statusText: response.statusText,
          ok: response.ok,
        });
      }
    }
  } catch (error) {
    // Логируем ошибку сети (только для критичных endpoints)
    if (endpoint.includes('/questionnaire/answers') || endpoint.includes('/plan/generate')) {
      if (typeof window !== 'undefined') {
        const errorMessage = error instanceof Error ? error.message : String(error);
        const errorName = error instanceof Error ? error.name : undefined;
        const errorStack = error instanceof Error ? error.stack?.substring(0, 200) : undefined;
        console.error('❌ Network error for:', `${API_BASE}${endpoint}`, {
          error: errorMessage,
          errorType: typeof error,
          errorName,
          stack: errorStack,
        });
      }
    }
    const errorMessage = handleNetworkError(error);
    throw new Error(errorMessage);
  }

  if (!response.ok) {
    // Обрабатываем специальные случаи для cart/wishlist (401 - это нормально)
    if (response.status === 401) {
      if (endpoint.includes('/cart') || endpoint.includes('/wishlist')) {
        if (process.env.NODE_ENV === 'development') {
          console.log('ℹ️ 401 for cart/wishlist (user may not be authorized), returning empty result');
        }
        return { items: [] } as T;
      }
    }
    
    await handleHttpError(response, endpoint, initData);
  }

  const data = await response.json() as T;
  return data;
}
