// lib/client-logger.ts
// Условное логирование для клиентского кода (только в development)

const isDevelopment = process.env.NODE_ENV === 'development';

export const clientLogger = {
  log: (...args: any[]) => {
    if (isDevelopment) {
      console.log(...args);
    }
  },
  
  warn: (...args: any[]) => {
    if (isDevelopment) {
      console.warn(...args);
    }
  },
  
  debug: (...args: any[]) => {
    if (isDevelopment) {
      console.debug(...args);
    }
  },
  
  error: (...args: any[]) => {
    // Ошибки всегда логируем, даже в production
    console.error(...args);
  },
  
  info: (...args: any[]) => {
    if (isDevelopment) {
      console.info(...args);
    }
  },
};
