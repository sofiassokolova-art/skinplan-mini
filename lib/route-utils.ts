// lib/route-utils.ts
// Утилиты для проверки маршрутов приложения
// РЕФАКТОРИНГ: Централизованная логика проверки страниц

/**
 * Проверяет, находится ли пользователь на странице /quiz
 * Используется для блокировки лишних API-запросов во время прохождения анкеты
 */
export function isQuizContext(): boolean {
  if (typeof window === 'undefined') return false;
  
  const pathname = window.location.pathname;
  const href = window.location.href;
  const referrer = document.referrer;
  
  const isOnQuizPage = pathname === '/quiz' || pathname.startsWith('/quiz/');
  const isNavigatingToQuiz = referrer && (referrer.includes('/quiz') || referrer.endsWith('/quiz'));
  const isQuizInHref = href.includes('/quiz');
  
  return isOnQuizPage || isNavigatingToQuiz || isQuizInHref;
}

/**
 * Проверяет, находится ли пользователь на странице /plan
 */
export function isPlanContext(): boolean {
  if (typeof window === 'undefined') return false;
  
  const pathname = window.location.pathname;
  return pathname === '/plan' || pathname.startsWith('/plan/');
}

/**
 * Проверяет, находится ли пользователь на главной странице /home
 */
export function isHomeContext(): boolean {
  if (typeof window === 'undefined') return false;
  
  const pathname = window.location.pathname;
  return pathname === '/home' || pathname.startsWith('/home/');
}

/**
 * Проверяет, является ли текущая страница корневой
 */
export function isRootContext(): boolean {
  if (typeof window === 'undefined') return false;
  
  const pathname = window.location.pathname;
  return pathname === '/' || pathname === '';
}

/**
 * Возвращает детальную информацию о текущем контексте навигации
 * Полезно для логирования и отладки
 */
export function getNavigationContext(): {
  pathname: string;
  href: string;
  referrer: string;
  isQuiz: boolean;
  isPlan: boolean;
  isHome: boolean;
  isRoot: boolean;
} {
  if (typeof window === 'undefined') {
    return {
      pathname: '',
      href: '',
      referrer: '',
      isQuiz: false,
      isPlan: false,
      isHome: false,
      isRoot: false,
    };
  }
  
  const pathname = window.location.pathname;
  const href = window.location.href;
  const referrer = document.referrer;
  
  return {
    pathname,
    href,
    referrer,
    isQuiz: isQuizContext(),
    isPlan: isPlanContext(),
    isHome: isHomeContext(),
    isRoot: isRootContext(),
  };
}

/**
 * Проверяет, должны ли быть заблокированы определенные API-запросы
 * @param endpoint - API endpoint для проверки
 * @returns true, если запрос должен быть заблокирован
 */
export function shouldBlockApiRequest(endpoint: string): boolean {
  // Блокируем cart и preferences на /quiz
  const isCartEndpoint = endpoint === '/cart' || 
                        (endpoint.includes('/cart') && !endpoint.includes('/questionnaire'));
  const isPreferencesEndpoint = endpoint === '/user/preferences' || 
                                (endpoint.includes('/user/preferences') && !endpoint.includes('/questionnaire'));
  
  if (isCartEndpoint || isPreferencesEndpoint) {
    return isQuizContext();
  }
  
  return false;
}
