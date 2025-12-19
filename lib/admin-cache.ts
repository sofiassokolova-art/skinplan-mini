// lib/admin-cache.ts
// Простое in-memory кеширование для админки

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

class AdminCache {
  private cache = new Map<string, CacheEntry<any>>();

  /**
   * Получить данные из кеша
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) {
      return null;
    }

    // Проверяем срок действия
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  /**
   * Сохранить данные в кеш
   * @param key - ключ кеша
   * @param data - данные для кеширования
   * @param ttlSeconds - время жизни в секундах (по умолчанию 60)
   */
  set<T>(key: string, data: T, ttlSeconds: number = 60): void {
    this.cache.set(key, {
      data,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
  }

  /**
   * Удалить данные из кеша
   */
  delete(key: string): void {
    this.cache.delete(key);
  }

  /**
   * Очистить весь кеш
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Очистить просроченные записи
   */
  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
      }
    }
  }
}

// Singleton instance
export const adminCache = new AdminCache();

// Периодическая очистка просроченных записей (каждые 5 минут)
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    adminCache.cleanup();
  }, 5 * 60 * 1000);
}
