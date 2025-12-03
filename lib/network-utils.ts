// lib/network-utils.ts
// Утилиты для обработки сетевых ошибок

/**
 * Проверяет, есть ли интернет-соединение
 */
export function isOnline(): boolean {
  if (typeof window === 'undefined') return true; // На сервере всегда true
  return navigator.onLine;
}

/**
 * Обрабатывает сетевые ошибки и возвращает понятное сообщение
 */
export function handleNetworkError(error: unknown): string {
  if (!isOnline()) {
    return 'Нет подключения к интернету. Проверьте ваше соединение и попробуйте снова.';
  }

  if (error instanceof TypeError && error.message.includes('fetch')) {
    return 'Ошибка соединения с сервером. Попробуйте позже.';
  }

  if (error instanceof Error) {
    // Таймаут
    if (error.message.includes('timeout') || error.message.includes('Timeout')) {
      return 'Превышено время ожидания. Попробуйте снова.';
    }

    // Отказ в доступе
    if (error.message.includes('401') || error.message.includes('Unauthorized')) {
      return 'Ошибка авторизации. Обновите страницу.';
    }

    // Сервер недоступен
    if (error.message.includes('500') || error.message.includes('Internal Server Error')) {
      return 'Временная ошибка сервера. Попробуйте через несколько минут.';
    }

    return error.message || 'Произошла ошибка. Попробуйте еще раз.';
  }

  return 'Произошла неизвестная ошибка. Попробуйте еще раз.';
}

/**
 * Выполняет fetch с таймаутом
 */
export async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs: number = 30000
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Request timeout after ${timeoutMs}ms`);
    }
    throw error;
  }
}

/**
 * Хук для отслеживания состояния сети (используется в компонентах)
 */
export function useNetworkStatus() {
  if (typeof window === 'undefined') {
    return { isOnline: true };
  }

  const [isOnline, setIsOnline] = React.useState(navigator.onLine);

  React.useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return { isOnline };
}

// Импорт React для хука (если используется на клиенте)
let React: any = null;
if (typeof window !== 'undefined') {
  try {
    React = require('react');
  } catch {
    // React недоступен, хук не будет работать
  }
}

