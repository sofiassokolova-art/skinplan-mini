// lib/client-logger.ts
// Условное логирование для клиентского кода с автоматической отправкой на сервер

const isDevelopment = process.env.NODE_ENV === 'development';

// Функция для отправки лога на сервер
const sendLogToServer = async (
  level: 'log' | 'warn' | 'debug' | 'error' | 'info',
  message: string,
  context?: any
) => {
  // ИСПРАВЛЕНО: Всегда отправляем error и warn, в development отправляем все
  // Но не отправляем в SSR
  if (typeof window === 'undefined') {
    return; // SSR - не отправляем
  }

  // В production отправляем только error и warn
  if (!isDevelopment && level !== 'error' && level !== 'warn') {
    return;
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

    // ИСПРАВЛЕНО: Логируем в консоль для отладки (только в development)
    if (isDevelopment) {
      console.debug('📤 Sending log to server:', { level, message: message.substring(0, 50) });
    }

    // Отправляем с таймаутом, чтобы не блокировать
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // Увеличено до 5 секунд

    const response = await fetch('/api/logs', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(initData ? { 'X-Telegram-Init-Data': initData } : {}),
      },
      body: JSON.stringify(logPayload),
      signal: controller.signal,
    });

    if (isDevelopment) {
      if (response.ok) {
        const result = await response.json();
        console.debug('✅ Log sent successfully:', result);
      } else {
        console.warn('⚠️ Failed to send log:', response.status, response.statusText);
      }
    }
  } catch (err: any) {
    // ИСПРАВЛЕНО: Логируем ошибки отправки (но не создаем бесконечный цикл)
    if (isDevelopment) {
      if (err?.name !== 'AbortError') {
        console.warn('⚠️ Error sending log to server:', err?.message || err);
      }
    }
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
    console.log(...args); // Всегда выводим в консоль
    // В production не отправляем обычные логи на сервер (только error/warn)
    if (isDevelopment) {
      sendLogToServer('log', message, args.length > 1 ? args.slice(1) : null);
    }
  },
  
  warn: (...args: any[]) => {
    const message = formatMessage(...args);
    console.warn(...args); // Предупреждения всегда выводим
    // ИСПРАВЛЕНО: Предупреждения всегда отправляем на сервер (и в production, и в development)
    // Добавляем try-catch для безопасности
    try {
      sendLogToServer('warn', message, args.length > 1 ? args.slice(1) : null);
    } catch (err) {
      // Игнорируем ошибки отправки, чтобы не создать бесконечный цикл
    }
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
    // ИСПРАВЛЕНО: Ошибки всегда отправляем на сервер (и в production, и в development)
    // Добавляем try-catch для безопасности
    try {
      sendLogToServer('error', message, args.length > 1 ? args.slice(1) : null);
    } catch (err) {
      // Игнорируем ошибки отправки, чтобы не создать бесконечный цикл
    }
  },
  
  info: (...args: any[]) => {
    const message = formatMessage(...args);
    if (isDevelopment) {
      console.info(...args);
      sendLogToServer('info', message, args.length > 1 ? args.slice(1) : null);
    }
  },
};
