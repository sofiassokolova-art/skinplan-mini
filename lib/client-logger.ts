// lib/client-logger.ts
// Условное логирование для клиентского кода с автоматической отправкой на сервер

const isDevelopment = process.env.NODE_ENV === 'development';

// ИСПРАВЛЕНО: Увеличен троттлинг для снижения нагрузки на /api/logs
// Внутренний троттлинг для отправки логов на сервер, чтобы избежать спама одинаковыми сообщениями
const LOG_THROTTLE_MS = 30_000; // 30 секунд для одинаковых сообщений (увеличено для снижения нагрузки)
const DIAGNOSTIC_LOG_THROTTLE_MS = 5_000; // 5 секунд для диагностических логов (меньше троттлинг для диагностики)
const lastSentLogMap = new Map<string, number>();
// Глобальный счетчик для ограничения количества логов в секунду
let logsInLastSecond = 0;
let lastSecondReset = Date.now();
const MAX_LOGS_PER_SECOND = 3; // ИСПРАВЛЕНО: Максимум 3 лога в секунду (уменьшено с 10 для снижения нагрузки)
const MAX_DIAGNOSTIC_LOGS_PER_SECOND = 10; // ИСПРАВЛЕНО: Максимум 10 диагностических логов в секунду

// Проверяем, является ли лог диагностическим
const isDiagnosticLog = (message: string): boolean => {
  return (
    message.includes('🔍') || // ДИАГНОСТИКА
    message.includes('📋') || // ИНФО-СКРИН
    message.includes('✅') || // УСПЕХ
    message.includes('📺') || // РЕНДЕРИНГ
    message.includes('🧹') || // ОЧИСТКА
    message.includes('⏸️') || // ПАУЗА/БЛОКИРОВКА
    message.includes('🛑') || // СТОП
    message.includes('🔄') || // ПЕРЕХОД
    message.includes('ИНФО-СКРИН') ||
    message.includes('ДИАГНОСТИКА') ||
    message.includes('ВОПРОС')
  );
};

const shouldSendToServer = (
  level: 'log' | 'warn' | 'debug' | 'error' | 'info',
  message: string
): boolean => {
  const now = Date.now();
  const isDiagnostic = isDiagnosticLog(message);
  const maxLogsPerSecond = isDiagnostic ? MAX_DIAGNOSTIC_LOGS_PER_SECOND : MAX_LOGS_PER_SECOND;
  const throttleMs = isDiagnostic ? DIAGNOSTIC_LOG_THROTTLE_MS : LOG_THROTTLE_MS;
  
  // Сбрасываем счетчик каждую секунду
  if (now - lastSecondReset >= 1000) {
    logsInLastSecond = 0;
    lastSecondReset = now;
  }
  
  // Ограничиваем количество логов в секунду
  if (logsInLastSecond >= maxLogsPerSecond) {
    return false;
  }
  
  // Ключ по уровню и усечённому сообщению (для диагностических логов используем более короткий ключ)
  const keyLength = isDiagnostic ? 100 : 200;
  const key = `${level}:${message.substring(0, keyLength)}`;
  const last = lastSentLogMap.get(key) ?? 0;

  if (now - last < throttleMs) {
    // Недавно уже отправляли такой же лог — пропускаем отправку на сервер
    return false;
  }

  lastSentLogMap.set(key, now);
  logsInLastSecond++;
  return true;
};

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

    // ИСПРАВЛЕНО: Не логируем в консоль каждый отправляемый лог (слишком много шума)
    // Логируем только в development для отладки
    if (isDevelopment) {
      console.debug('📤 Sending log to server:', { 
        level, 
        message: message.substring(0, 50),
        hasInitData: !!initData,
      });
    }

    // ИСПРАВЛЕНО: Используем requestIdleCallback или setTimeout для неблокирующей отправки
    // Отправляем асинхронно, не блокируя основной поток
    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      // Используем requestIdleCallback если доступен (не блокирует рендеринг)
      (window as any).requestIdleCallback(() => {
        sendLogFetch(logPayload, initData, level, message);
      }, { timeout: 3000 });
    } else {
      // Fallback: отправляем с небольшой задержкой, чтобы не блокировать
      setTimeout(() => {
        sendLogFetch(logPayload, initData, level, message);
      }, 100);
    }
  } catch (err: any) {
    // Игнорируем ошибки отправки
  }
};

// ИСПРАВЛЕНО: Вынесено в отдельную функцию для полностью неблокирующей отправки
// В production полностью отключено для снижения нагрузки и предотвращения 403 ошибок
const sendLogFetch = async (
  logPayload: any, 
  initData: string | null, 
  level: 'log' | 'warn' | 'debug' | 'error' | 'info',
  message: string
) => {
  // ИСПРАВЛЕНО: В production отправляем логи на сервер, но только ошибки и критичные warn
  // Логи сохраняются в PostgreSQL, а не в Redis/KV
  // Отправка логов не блокирует работу приложения (fire-and-forget)
  // ИСПРАВЛЕНО: Также отправляем warn логи (включая диагностические) в production
  if (!isDevelopment && level !== 'error' && level !== 'warn') {
    return; // В production отправляем на сервер только error и warn логи
  }

  try {
    // ИСПРАВЛЕНО: sendBeacon НЕ поддерживает кастомные заголовки (X-Telegram-Init-Data)
    // Поэтому используем fetch с keepalive для неблокирующей отправки
    // Fetch с keepalive работает так же как sendBeacon, но поддерживает заголовки
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000); // Таймаут 2 секунды

    // ИСПРАВЛЕНО: Полностью fire-and-forget - НЕ ждем ответа вообще
    // Не вызываем .then() или .await() - отправляем и забываем
    fetch('/api/logs', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(initData ? { 'X-Telegram-Init-Data': initData } : {}),
      },
      body: JSON.stringify(logPayload),
      keepalive: true, // Не блокирует закрытие страницы
      signal: controller.signal,
    }).catch(() => {
      clearTimeout(timeoutId);
      // Игнорируем все ошибки - логирование не должно блокировать приложение
      // Не логируем в консоль, чтобы не создавать еще больше запросов
    });
    
    // ИСПРАВЛЕНО: Очищаем timeout через небольшую задержку, если fetch не завершился
    // Это предотвращает утечку памяти, но не блокирует основной поток
    setTimeout(() => {
      clearTimeout(timeoutId);
    }, 2000);
  } catch (err: any) {
    // Игнорируем все ошибки - логирование не должно блокировать приложение
    // Не логируем в консоль, чтобы не создавать еще больше запросов
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
    // ИСПРАВЛЕНО: В production отправляем только критичные логи (error, критичные warn)
  // В development отправляем больше, но все равно с троттлингом
    // Проверяем, является ли это критичным логом
    const isCriticalLog = 
      // Только ошибки и критичные предупреждения
      message.includes('❌') || 
      (message.includes('⚠️') && (message.includes('error') || message.includes('Error') || message.includes('CRITICAL'))) ||
      // Критичные события, которые нужны для диагностики
      message.includes('CRITICAL') || 
      message.includes('FATAL') ||
      (message.includes('error') && (message.includes('API') || message.includes('fetch') || message.includes('network')));
    
    // ИСПРАВЛЕНО: Отправляем в production ТОЛЬКО критичные логи
    // В development отправляем больше, но все равно с усиленным троттлингом
    if (isDevelopment) {
      // В development: отправляем важные логи с троттлингом
      const isImportantLog = 
        message.includes('✅') || message.includes('❌') || 
        message.includes('⚠️') || message.includes('🔄') ||
        message.includes('CRITICAL') || message.includes('error');
      
      if (isImportantLog && shouldSendToServer('log', message)) {
        try {
          sendLogToServer('log', message, args.length > 1 ? args.slice(1) : null);
        } catch (err) {
          // Игнорируем ошибки отправки
        }
      }
    } else {
      // В production: отправляем ТОЛЬКО критичные логи
      if (isCriticalLog && shouldSendToServer('info', message)) {
        try {
          sendLogToServer('info', message, args.length > 1 ? args.slice(1) : null);
        } catch (err) {
          // Игнорируем ошибки отправки
        }
      }
    }
  },
  
  warn: (...args: any[]) => {
    const message = formatMessage(...args);
    console.warn(...args); // Предупреждения всегда выводим
    // ИСПРАВЛЕНО: Предупреждения отправляем с троттлингом
    // В production отправляем только критичные предупреждения и диагностические логи
    try {
      const isCriticalWarn = 
        message.includes('CRITICAL') || 
        message.includes('error') || 
        message.includes('Error') ||
        message.includes('failed') ||
        message.includes('Failed');
      
      // ИСПРАВЛЕНО: Также отправляем диагностические логи для инфо-экранов и вопросов
      const isDiagnosticLog = 
        message.includes('🔍') || // ДИАГНОСТИКА
        message.includes('📋') || // ИНФО-СКРИН
        message.includes('✅') || // УСПЕХ
        message.includes('📺') || // РЕНДЕРИНГ
        message.includes('🧹') || // ОЧИСТКА
        message.includes('⏸️') || // ПАУЗА/БЛОКИРОВКА
        message.includes('ИНФО-СКРИН') ||
        message.includes('ДИАГНОСТИКА') ||
        message.includes('ВОПРОС');
      
      if (isDevelopment || isCriticalWarn || isDiagnosticLog) {
        if (shouldSendToServer('warn', message)) {
          sendLogToServer('warn', message, args.length > 1 ? args.slice(1) : null);
        }
      }
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
      if (shouldSendToServer('error', message)) {
        sendLogToServer('error', message, args.length > 1 ? args.slice(1) : null);
      }
    } catch (err) {
      // Игнорируем ошибки отправки, чтобы не создать бесконечный цикл
    }
  },
  
  info: (...args: any[]) => {
    const message = formatMessage(...args);
    console.info(...args);
    // ИСПРАВЛЕНО: info логи отправляем только в development или только критичные в production
    try {
      const isCriticalInfo = 
        message.includes('CRITICAL') || 
        message.includes('error') || 
        message.includes('Error');
      
      if (isDevelopment || isCriticalInfo) {
        if (shouldSendToServer('info', message)) {
          sendLogToServer('info', message, args.length > 1 ? args.slice(1) : null);
        }
      }
    } catch (err) {
      // Игнорируем ошибки отправки
    }
  },
};
