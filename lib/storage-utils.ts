// lib/storage-utils.ts
// Безопасные утилиты для работы с sessionStorage и localStorage

/**
 * Безопасно получает значение из sessionStorage
 */
export function safeSessionStorageGet(key: string): string | null {
  try {
    if (typeof window === 'undefined' || !window.sessionStorage) {
      return null;
    }
    return window.sessionStorage.getItem(key);
  } catch (error) {
    console.warn('sessionStorage.getItem failed:', error);
    return null;
  }
}

/**
 * Безопасно сохраняет значение в sessionStorage
 */
export function safeSessionStorageSet(key: string, value: string): boolean {
  try {
    if (typeof window === 'undefined' || !window.sessionStorage) {
      return false;
    }
    window.sessionStorage.setItem(key, value);
    return true;
  } catch (error) {
    console.warn('sessionStorage.setItem failed:', error);
    return false;
  }
}

/**
 * Безопасно удаляет значение из sessionStorage
 */
export function safeSessionStorageRemove(key: string): boolean {
  try {
    if (typeof window === 'undefined' || !window.sessionStorage) {
      return false;
    }
    window.sessionStorage.removeItem(key);
    return true;
  } catch (error) {
    console.warn('sessionStorage.removeItem failed:', error);
    return false;
  }
}

/**
 * Безопасно очищает весь sessionStorage
 */
export function safeSessionStorageClear(): boolean {
  try {
    if (typeof window === 'undefined' || !window.sessionStorage) {
      return false;
    }
    window.sessionStorage.clear();
    return true;
  } catch (error) {
    console.warn('sessionStorage.clear failed:', error);
    return false;
  }
}

/**
 * Безопасно получает значение из localStorage
 */
export function safeLocalStorageGet(key: string): string | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return null;
    }
    return window.localStorage.getItem(key);
  } catch (error) {
    console.warn('localStorage.getItem failed:', error);
    return null;
  }
}

/**
 * Безопасно сохраняет значение в localStorage
 */
export function safeLocalStorageSet(key: string, value: string): boolean {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return false;
    }
    window.localStorage.setItem(key, value);
    return true;
  } catch (error) {
    console.warn('localStorage.setItem failed:', error);
    return false;
  }
}

/**
 * Безопасно удаляет значение из localStorage
 */
export function safeLocalStorageRemove(key: string): boolean {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return false;
    }
    window.localStorage.removeItem(key);
    return true;
  } catch (error) {
    console.warn('localStorage.removeItem failed:', error);
    return false;
  }
}