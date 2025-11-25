// app/(miniapp)/logs/page.tsx
// Страница для сбора и отображения всех логов

'use client';

import { useState, useEffect } from 'react';

// Перехватываем все console.log, console.error, console.warn
if (typeof window !== 'undefined') {
  const logs: Array<{ type: string; message: any; timestamp: number }> = [];
  
  const originalLog = console.log;
  const originalError = console.error;
  const originalWarn = console.warn;

  console.log = (...args: any[]) => {
    logs.push({ type: 'log', message: args, timestamp: Date.now() });
    originalLog(...args);
  };

  console.error = (...args: any[]) => {
    logs.push({ type: 'error', message: args, timestamp: Date.now() });
    originalError(...args);
  };

  console.warn = (...args: any[]) => {
    logs.push({ type: 'warn', message: args, timestamp: Date.now() });
    originalWarn(...args);
  };

  (window as any).__APP_LOGS__ = logs;
}

export default function LogsPage() {
  const [logs, setLogs] = useState<Array<{ type: string; message: any; timestamp: number }>>([]);
  const [autoRefresh, setAutoRefresh] = useState(true);

  useEffect(() => {
    const updateLogs = () => {
      if (typeof window !== 'undefined' && (window as any).__APP_LOGS__) {
        setLogs([...(window as any).__APP_LOGS__]);
      }
    };

    updateLogs();
    
    if (autoRefresh) {
      const interval = setInterval(updateLogs, 500);
      return () => clearInterval(interval);
    }
  }, [autoRefresh]);

  const copyLogs = () => {
    const logsText = logs.map(log => {
      const time = new Date(log.timestamp).toLocaleTimeString();
      const message = typeof log.message === 'string' 
        ? log.message 
        : JSON.stringify(log.message, null, 2);
      return `[${time}] ${log.type.toUpperCase()}: ${message}`;
    }).join('\n');

    navigator.clipboard.writeText(logsText);
    alert('Логи скопированы в буфер обмена!');
  };

  const clearLogs = () => {
    if (typeof window !== 'undefined' && (window as any).__APP_LOGS__) {
      (window as any).__APP_LOGS__.length = 0;
      setLogs([]);
    }
  };

  return (
    <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      <h1 style={{ marginBottom: '20px' }}>Логи приложения</h1>
      
      <div style={{ marginBottom: '20px', display: 'flex', gap: '10px' }}>
        <button
          onClick={copyLogs}
          style={{
            padding: '10px 20px',
            backgroundColor: '#0A5F59',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
          }}
        >
          Скопировать все логи
        </button>
        
        <button
          onClick={clearLogs}
          style={{
            padding: '10px 20px',
            backgroundColor: '#dc3545',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
          }}
        >
          Очистить логи
        </button>
        
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <input
            type="checkbox"
            checked={autoRefresh}
            onChange={(e) => setAutoRefresh(e.target.checked)}
          />
          Автообновление
        </label>
      </div>

      <div style={{
        backgroundColor: '#1e1e1e',
        color: '#d4d4d4',
        padding: '20px',
        borderRadius: '8px',
        fontFamily: 'monospace',
        fontSize: '12px',
        maxHeight: '600px',
        overflow: 'auto',
      }}>
        {logs.length === 0 ? (
          <div style={{ color: '#888' }}>Логи пока отсутствуют. Выполните действия в приложении.</div>
        ) : (
          logs.map((log, index) => {
            const time = new Date(log.timestamp).toLocaleTimeString();
            const color = log.type === 'error' ? '#f48771' : log.type === 'warn' ? '#dcdcaa' : '#4ec9b0';
            
            return (
              <div key={index} style={{ marginBottom: '8px', color }}>
                <span style={{ color: '#888' }}>[{time}]</span>{' '}
                <span style={{ color: '#569cd6' }}>{log.type.toUpperCase()}:</span>{' '}
                <span>
                  {typeof log.message === 'string' ? (
                    log.message
                  ) : Array.isArray(log.message) ? (
                    log.message.map((msg: any, i: number) => (
                      <span key={i}>
                        {typeof msg === 'object' ? JSON.stringify(msg, null, 2) : String(msg)}
                        {i < log.message.length - 1 ? ' ' : ''}
                      </span>
                    ))
                  ) : (
                    JSON.stringify(log.message, null, 2)
                  )}
                </span>
              </div>
            );
          })
        )}
      </div>

      <div style={{ marginTop: '20px', padding: '15px', backgroundColor: '#e7f3ff', borderRadius: '8px' }}>
        <h3>Инструкция:</h3>
        <ol>
          <li>Откройте эту страницу в отдельной вкладке</li>
          <li>Вернитесь к приложению и выполните действия (пройдите анкету до конца)</li>
          <li>Вернитесь на эту страницу и нажмите "Скопировать все логи"</li>
          <li>Вставьте логи в сообщение</li>
        </ol>
      </div>
    </div>
  );
}

