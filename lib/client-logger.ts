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

  // ИСПРАВЛЕНО: В production отправляем error, warn и info (для важных логов)
  // Но не отправляем debug и обычные log
  if (!isDevelopment && level !== 'error' && level !== 'warn' && level !== 'info') {
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

    // ИСПРАВЛЕНО: Логируем в консоль для отладки (всегда, чтобы видеть, что логи отправляются)
    console.debug('📤 Sending log to server:', { 
      level, 
      message: message.substring(0, 50),
      hasInitData: !!initData,
    });

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

    clearTimeout(timeoutId);

    // ИСПРАВЛЕНО: Всегда логируем результат отправки для диагностики
    if (response.ok) {
      const result = await response.json();
      console.debug('✅ Log sent successfully:', { 
        level, 
        saved: result.saved,
        kvSaved: result.kvSaved,
        dbSaved: result.dbSaved,
      });
    } else {
      const errorText = await response.text().catch(() => 'Unknown error');
      console.warn('⚠️ Failed to send log:', { 
        status: response.status, 
        statusText: response.statusText,
        error: errorText.substring(0, 200),
        level,
        message: message.substring(0, 50),
      });
    }
  } catch (err: any) {
    // ИСПРАВЛЕНО: Логируем ошибки отправки (но не создаем бесконечный цикл)
    if (err?.name !== 'AbortError') {
      console.warn('⚠️ Error sending log to server:', {
        error: err?.message || err,
        errorName: err?.name,
        level,
        message: message.substring(0, 50),
      });
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
    // ИСПРАВЛЕНО: Отправляем логи на сервер (в development все, в production только важные)
    // Проверяем, является ли это важным логом (содержит эмодзи или ключевые слова)
    const isImportantLog = message.includes('✅') || message.includes('❌') || 
                          message.includes('⚠️') || message.includes('🔄') ||
                          message.includes('🔍') || message.includes('📥') ||
                          message.includes('Plan') || message.includes('fallback') ||
                          message.includes('redirect') || message.includes('error');
    
    if (isDevelopment || isImportantLog) {
      try {
        sendLogToServer('log', message, args.length > 1 ? args.slice(1) : null);
      } catch (err) {
        // Игнорируем ошибки отправки
      }
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
    console.info(...args);
    // ИСПРАВЛЕНО: info логи всегда отправляем на сервер (и в production, и в development)
    try {
      sendLogToServer('info', message, args.length > 1 ? args.slice(1) : null);
    } catch (err) {
      // Игнорируем ошибки отправки
    }
  },
};
