// lib/api/dedup.ts
// Дедупликация запросов для предотвращения race conditions

const activeRequests = new Map<string, Promise<any>>();

/**
 * Проверяет, есть ли уже активный запрос с таким ключом
 */
export function getActiveRequest<T>(requestKey: string): Promise<T> | null {
  if (!activeRequests.has(requestKey)) {
    return null;
  }

  const activeRequest = activeRequests.get(requestKey);
  if (activeRequest) {
    if (process.env.NODE_ENV === 'development') {
      console.log('🔄 Reusing active request for:', requestKey, {
        activeRequestsSize: activeRequests.size,
      });
    }
    return activeRequest as Promise<T>;
  }

  return null;
}

/**
 * Сохраняет активный запрос
 */
export function setActiveRequest<T>(requestKey: string, promise: Promise<T>): void {
  // Double-check pattern для предотвращения race conditions
  if (activeRequests.has(requestKey)) {
    if (process.env.NODE_ENV === 'development') {
      console.log('🔄 Reusing active request (double-check):', requestKey, {
        activeRequestsSize: activeRequests.size,
      });
    }
    return;
  }

  activeRequests.set(requestKey, promise);
  
  if (process.env.NODE_ENV === 'development') {
    console.log('📝 New active request registered:', requestKey, {
      activeRequestsSize: activeRequests.size,
    });
  }
}

/**
 * Удаляет активный запрос
 */
export function removeActiveRequest(requestKey: string): void {
  activeRequests.delete(requestKey);
}

/**
 * Создает ключ для запроса
 */
export function createRequestKey(method: string, endpoint: string): string | null {
  const isGetRequest = !method || method === 'GET';
  return isGetRequest ? `${method || 'GET'}:${endpoint}` : null;
}
