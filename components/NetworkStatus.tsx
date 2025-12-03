// components/NetworkStatus.tsx
// Компонент для отображения статуса сети

'use client';

import { useEffect, useState } from 'react';

export function NetworkStatus() {
  const [isOnline, setIsOnline] = useState(
    typeof window !== 'undefined' ? navigator.onLine : true
  );
  const [showOffline, setShowOffline] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setShowOffline(false);
    };
    
    const handleOffline = () => {
      setIsOnline(false);
      setShowOffline(true);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Показываем сообщение, если при загрузке уже нет сети
    if (!navigator.onLine) {
      setShowOffline(true);
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (!showOffline) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        backgroundColor: '#EF4444',
        color: 'white',
        padding: '12px 16px',
        textAlign: 'center',
        zIndex: 9999,
        fontSize: '14px',
        fontWeight: '500',
      }}
    >
      {isOnline ? (
        <>
          ✓ Соединение восстановлено
          <button
            onClick={() => setShowOffline(false)}
            style={{
              marginLeft: '12px',
              background: 'transparent',
              border: '1px solid white',
              color: 'white',
              padding: '4px 8px',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            Закрыть
          </button>
        </>
      ) : (
        '⚠️ Нет подключения к интернету'
      )}
    </div>
  );
}

