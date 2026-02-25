// lib/api/client.ts
// Базовый HTTP клиент для работы с бэкендом

import { fetchWithTimeout, handleNetworkError } from '../network-utils';
import { shouldBlockApiRequest } from '../route-utils';
import { DEV_TELEGRAM } from '../config/timeouts';

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
  if (process.env.NODE_ENV === 'development') {
    if (typeof window === 'undefined') return DEV_TELEGRAM.buildInitData();

    const existing = window.Telegram?.WebApp?.initData;
    if (existing) return existing;

    // Мокаем WebApp для локальной разработки
    const testData = DEV_TELEGRAM.buildInitData();
    if (!window.Telegram) {
      (window as any).Telegram = { WebApp: { initData: testData, ready() {}, expand() {} } };
    } else if (!window.Telegram.WebApp) {
      (window as any).Telegram.WebApp = { initData: testData, ready() {}, expand() {} };
    } else {
      try { (window.Telegram.WebApp as any).initData = testData; } catch (_) {}
    }
    return testData;
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

  if (initData) {
    headers['X-Telegram-Init-Data'] = initData;
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

const MAX_RETRIES = 2;
const RETRY_DELAYS = [1000, 3000]; // 1с, 3с

function isRetryable(status: number): boolean {
  return status === 502 || status === 503 || status === 504 || status === 0;
}

/**
 * Базовый HTTP запрос с retry для сетевых ошибок
 */
export async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  if (shouldBlockApiRequest(endpoint)) {
    const isCartEndpoint = endpoint === '/cart' || endpoint.includes('/cart');
    if (isCartEndpoint) return Promise.resolve(DEFAULT_CART_RESPONSE as T);
    return Promise.resolve(DEFAULT_PREFERENCES_RESPONSE as T);
  }

  if (typeof window === 'undefined') {
    const isCartEndpoint = endpoint === '/cart' || endpoint.includes('/cart');
    const isPreferencesEndpoint = endpoint === '/user/preferences' || endpoint.includes('/user/preferences');
    if (isCartEndpoint) return Promise.resolve(DEFAULT_CART_RESPONSE as T);
    if (isPreferencesEndpoint) return Promise.resolve(DEFAULT_PREFERENCES_RESPONSE as T);
  }

  const isQuestionnaireProgressEndpoint = endpoint.includes('/questionnaire/progress');
  const initData = await getInitData();

  if (isQuestionnaireProgressEndpoint && !initData) {
    return { progress: null, isCompleted: false } as T;
  }

  const headers = createHeaders(initData, options.headers as Record<string, string>);
  const timeout = endpoint.includes('/plan/generate') ? 60000 : DEFAULT_TIMEOUT;
  const isWrite = options.method && options.method !== 'GET';

  let lastError: Error | null = null;
  const attempts = isWrite ? 1 : MAX_RETRIES + 1; // не ретраим мутации

  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      const response = await fetchWithTimeout(`${API_BASE}${endpoint}`, {
        ...options,
        headers,
      }, timeout);

      if (!response.ok) {
        if (response.status === 401 && (endpoint.includes('/cart') || endpoint.includes('/wishlist'))) {
          return { items: [] } as T;
        }
        if (isRetryable(response.status) && attempt < attempts - 1) {
          await new Promise(r => setTimeout(r, RETRY_DELAYS[attempt] || 3000));
          continue;
        }
        await handleHttpError(response, endpoint, initData);
      }

      return await response.json() as T;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      const isNetwork = lastError.message.includes('timeout') ||
                        lastError.message.includes('fetch') ||
                        lastError.message.includes('network') ||
                        lastError.message.includes('Failed to fetch');
      if (isNetwork && attempt < attempts - 1) {
        await new Promise(r => setTimeout(r, RETRY_DELAYS[attempt] || 3000));
        continue;
      }
      if (isNetwork) {
        throw new Error(handleNetworkError(error));
      }
      throw lastError;
    }
  }

  throw lastError || new Error('Request failed');
}
