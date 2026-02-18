// app/(miniapp)/quiz/components/QuizDebugPanel.tsx
// Компонент для отображения debug логов в development режиме

'use client';

interface DebugLog {
  time: string;
  message: string;
  data?: any;
}

interface QuizDebugPanelProps {
  showDebugPanel: boolean;
  debugLogs: DebugLog[];
  onToggle: () => void;
}

export function QuizDebugPanel({
  showDebugPanel,
  debugLogs,
  onToggle,
}: QuizDebugPanelProps) {
  return (
    <div style={{
      position: 'fixed',
      bottom: '20px',
      right: '20px',
      zIndex: 9999,
    }}>
      <button
        onClick={onToggle}
        style={{
          padding: '8px 16px',
          backgroundColor: '#0A5F59',
          color: 'white',
          border: 'none',
          borderRadius: '8px',
          cursor: 'pointer',
          fontSize: '12px',
          fontWeight: '600',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)',
        }}
      >
        {showDebugPanel ? '🔽 Скрыть логи' : '🔺 Показать логи'}
      </button>
      {showDebugPanel && (
        <div style={{
          position: 'absolute',
          bottom: '40px',
          right: '0',
          width: '300px',
          maxHeight: '400px',
          backgroundColor: 'rgba(0, 0, 0, 0.9)',
          color: '#0f0',
          padding: '12px',
          borderRadius: '8px',
          fontSize: '11px',
          fontFamily: 'monospace',
          overflow: 'auto',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
        }}>
          <div style={{ marginBottom: '8px', fontWeight: 'bold', color: '#fff' }}>
            Debug Logs ({debugLogs.length})
          </div>
          {debugLogs.map((log, idx) => (
            <div key={idx} style={{ marginBottom: '8px', borderBottom: '1px solid #333', paddingBottom: '4px' }}>
              <div style={{ color: '#0f0', fontWeight: 'bold' }}>
                [{log.time}] {log.message}
              </div>
              {log.data && (
                <pre style={{ 
                  marginTop: '4px', 
                  color: '#ccc', 
                  fontSize: '10px',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-all',
                }}>
                  {JSON.stringify(log.data, null, 2)}
                </pre>
              )}
            </div>
          ))}
          {debugLogs.length === 0 && (
            <div style={{ color: '#666', fontStyle: 'italic' }}>
              Логи появятся здесь...
            </div>
          )}
        </div>
      )}
    </div>
  );
}
