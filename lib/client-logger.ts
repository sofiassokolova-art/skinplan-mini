// lib/client-logger.ts
// Условное логирование для клиентского кода с автоматической отправкой на сервер

const isDevelopment = process.env.NODE_ENV === 'development';

// Функция для отправки лога на сервер
const sendLogToServer = async (
  level: 'log' | 'warn' | 'debug' | 'error' | 'info',
  message: string,
  context?: any
) => {
  // Отправляем только error и warn в production, все логи в development
  if (!isDevelopment && level !== 'error' && level !== 'warn') {
    return;
  }

  // Отправляем асинхронно, не блокируя основной поток
  if (typeof window === 'undefined') {
    return; // SSR - не отправляем
  }

  try {
    const initData = window.Telegram?.WebApp?.initData || null;
    
    const logPayload = {
      level: level === 'log' ? 'info' : level, // Преобразуем 'log' в 'info' для API
      message: message.substring(0, 500), // Ограничиваем длину сообщения
      context: context || null,
      url: window.location.href,
      userAgent: navigator.userAgent,
    };

    // Отправляем с таймаутом, чтобы не блокировать
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000); // 2 секунды таймаут

    fetch('/api/logs', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(initData ? { 'X-Telegram-Init-Data': initData } : {}),
      },
      body: JSON.stringify(logPayload),
      signal: controller.signal,
    })
      .catch(() => {
        // Игнорируем ошибки отправки логов, чтобы не создавать бесконечный цикл
      })
      .finally(() => {
        clearTimeout(timeoutId);
      });
  } catch (err) {
    // Игнорируем ошибки отправки логов
  }
};

// Функция для форматирования аргументов в сообщение
const formatMessage = (...args: any[]): string => {
  if (args.length === 0) return '';
  if (args.length === 1) {
    if (typeof args[0] === 'string') return args[0];
    return JSON.stringify(args[0]);
  }
  return args.map(arg => 
    typeof arg === 'string' ? arg : JSON.stringify(arg)
  ).join(' ');
};

export const clientLogger = {
  log: (...args: any[]) => {
    const message = formatMessage(...args);
    if (isDevelopment) {
      console.log(...args);
    }
    // В production не отправляем обычные логи на сервер (только error/warn)
    if (isDevelopment) {
      sendLogToServer('log', message, args.length > 1 ? args.slice(1) : null);
    }
  },
  
  warn: (...args: any[]) => {
    const message = formatMessage(...args);
    if (isDevelopment) {
      console.warn(...args);
    } else {
      console.warn(...args); // Предупреждения всегда выводим
    }
    // Предупреждения всегда отправляем на сервер
    sendLogToServer('warn', message, args.length > 1 ? args.slice(1) : null);
  },
  
  debug: (...args: any[]) => {
    const message = formatMessage(...args);
    if (isDevelopment) {
      console.debug(...args);
      sendLogToServer('debug', message, args.length > 1 ? args.slice(1) : null);
    }
  },
  
  error: (...args: any[]) => {
    const message = formatMessage(...args);
    // Ошибки всегда логируем, даже в production
    console.error(...args);
    // Ошибки всегда отправляем на сервер
    sendLogToServer('error', message, args.length > 1 ? args.slice(1) : null);
  },
  
  info: (...args: any[]) => {
    const message = formatMessage(...args);
    if (isDevelopment) {
      console.info(...args);
      sendLogToServer('info', message, args.length > 1 ? args.slice(1) : null);
    }
  },
};
