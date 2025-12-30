// lib/client-logger.ts
// Условное логирование для клиентского кода с автоматической отправкой на сервер

const isDevelopment = process.env.NODE_ENV === 'development';

// Внутренний троттлинг для отправки логов на сервер, чтобы избежать спама одинаковыми сообщениями
const LOG_THROTTLE_MS = 10_000; // 10 секунд для одинаковых сообщений (уменьшено для лучшей диагностики)
const lastSentLogMap = new Map<string, number>();
// Глобальный счетчик для ограничения количества логов в секунду
let logsInLastSecond = 0;
let lastSecondReset = Date.now();
const MAX_LOGS_PER_SECOND = 10; // Максимум 10 логов в секунду (увеличено для диагностики)

const shouldSendToServer = (
  level: 'log' | 'warn' | 'debug' | 'error' | 'info',
  message: string
): boolean => {
  const now = Date.now();
  
  // Сбрасываем счетчик каждую секунду
  if (now - lastSecondReset >= 1000) {
    logsInLastSecond = 0;
    lastSecondReset = now;
  }
  
  // Ограничиваем количество логов в секунду
  if (logsInLastSecond >= MAX_LOGS_PER_SECOND) {
    return false;
  }
  
  // Ключ по уровню и усечённому сообщению
  const key = `${level}:${message.substring(0, 200)}`;
  const last = lastSentLogMap.get(key) ?? 0;

  if (now - last < LOG_THROTTLE_MS) {
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
    const isImportantLog = 
      // Эмодзи для важных событий
      message.includes('✅') || message.includes('❌') || 
      message.includes('⚠️') || message.includes('🔄') ||
      message.includes('🔍') || message.includes('📥') ||
      message.includes('🔵') || message.includes('🟢') ||
      // Ключевые слова для загрузки анкеты
      message.includes('questionnaire') || message.includes('анкет') ||
      message.includes('loadQuestionnaire') || message.includes('init()') ||
      message.includes('setQuestionnaire') || message.includes('questionnaireRef') ||
      message.includes('RENDER') || message.includes('loading') ||
      // Другие важные события
      message.includes('Plan') || message.includes('fallback') ||
      message.includes('redirect') || message.includes('error') ||
      message.includes('CRITICAL') || message.includes('CALLED') ||
      message.includes('RETURNED') || message.includes('EXECUTED') ||
      message.includes('filterQuestions') || message.includes('filter') ||
      message.includes('ВСЕ ВОПРОСЫ') || message.includes('ОТФИЛЬТРОВАНЫ') ||
      // ИСПРАВЛЕНО: Добавляем ключевые слова для debouncing и кэширования
      message.includes('debounced') || message.includes('кэш') ||
      message.includes('Метаданные позиции') || message.includes('progressLoaded') ||
      message.includes('loadSavedProgressFromServer');
    
    // ФИКС: Уменьшаем количество логов, отправляемых на сервер
    // Отправляем только критичные логи и ошибки, не отправляем частые логи рендеринга
    const isFrequentLog = 
      message.includes('📺') || // Логи рендеринга инфо-экранов
      message.includes('🔍 Quiz page render') || // Логи рендеринга страницы
      message.includes('📊 allQuestions state') || // Логи состояния вопросов
      message.includes('💾 allQuestionsPrevRef') || // Логи синхронизации refs
      message.includes('🔍 isShowingInitialInfoScreen') || // Логи вычисления инфо-экранов
      message.includes('⏸️ currentQuestion') || // Логи текущего вопроса
      message.includes('🔍 Состояние рендера'); // Логи состояния рендера
    
    // ИСПРАВЛЕНО: Отправляем только важные логи, исключая частые логи рендеринга
    // В development все равно отправляем все логи для отладки
    if (isDevelopment || (isImportantLog && !isFrequentLog)) {
      try {
        // ИСПРАВЛЕНО: В production отправляем важные log как 'info', чтобы они прошли проверку в sendLogToServer
        const levelToSend = (!isDevelopment && isImportantLog) ? 'info' : 'log';
        // ИСПРАВЛЕНО: Отправляем даже если троттлинг блокирует, для важных логов
        // ИСПРАВЛЕНО: Для важных логов обходим троттлинг полностью
        if (isImportantLog || shouldSendToServer(levelToSend, message)) {
          sendLogToServer(levelToSend, message, args.length > 1 ? args.slice(1) : null);
        }
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
      if (shouldSendToServer('warn', message)) {
        sendLogToServer('warn', message, args.length > 1 ? args.slice(1) : null);
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
    // ИСПРАВЛЕНО: info логи всегда отправляем на сервер (и в production, и в development)
    try {
      if (shouldSendToServer('info', message)) {
        sendLogToServer('info', message, args.length > 1 ? args.slice(1) : null);
      }
    } catch (err) {
      // Игнорируем ошибки отправки
    }
  },
};
