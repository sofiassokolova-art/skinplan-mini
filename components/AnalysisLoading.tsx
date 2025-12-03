// components/AnalysisLoading.tsx
// Экран загрузки с прогресс-баром для анализа кожи

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface AnalysisLoadingProps {
  onComplete: () => void;
  duration?: number; // Длительность в миллисекундах (по умолчанию 5-7 сек)
}

export function AnalysisLoading({ onComplete, duration = 6000 }: AnalysisLoadingProps) {
  const router = useRouter();
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const startTime = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const newProgress = Math.min((elapsed / duration) * 100, 100);
      setProgress(newProgress);

      if (newProgress >= 100) {
        clearInterval(interval);
        // Небольшая задержка перед завершением для плавности
        setTimeout(() => {
          onComplete();
        }, 300);
      }
    }, 50); // Обновляем каждые 50мс для плавности

    return () => clearInterval(interval);
  }, [duration, onComplete]);

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #F5FFFC 0%, #E8FBF7 100%)',
      padding: '20px',
    }}>
      {/* Логотип */}
      <div style={{
        marginBottom: '48px',
        textAlign: 'center',
      }}>
        <button
          onClick={() => router.push('/')}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: 0,
            display: 'inline-block',
          }}
        >
          <img
            src="/skiniq-logo.png"
            alt="SkinIQ"
            style={{
              height: '120px',
              marginBottom: '24px',
              transition: 'transform 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'scale(1.05)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'scale(1)';
            }}
          />
        </button>
      </div>

      {/* Анимированный лоадер */}
      <div style={{
        width: '80px',
        height: '80px',
        border: '4px solid rgba(10, 95, 89, 0.1)',
        borderTop: '4px solid #0A5F59',
        borderRadius: '50%',
        animation: 'spin 1s linear infinite',
        marginBottom: '32px',
      }}></div>

      {/* Заголовок */}
      <h1 style={{
        fontFamily: "'Satoshi', 'Manrope', -apple-system, BlinkMacSystemFont, sans-serif",
        fontWeight: 700,
        fontSize: '28px',
        lineHeight: '36px',
        color: '#0A5F59',
        marginBottom: '12px',
        textAlign: 'center',
      }}>
        Подбираем персональный уход
      </h1>

      {/* Подзаголовок */}
      <p style={{
        fontFamily: "'Manrope', -apple-system, BlinkMacSystemFont, sans-serif",
        fontWeight: 400,
        fontSize: '16px',
        lineHeight: '24px',
        color: '#475467',
        marginBottom: '32px',
        textAlign: 'center',
        maxWidth: '320px',
      }}>
        Анализируем ваши ответы и состояние кожи…
      </p>

      {/* Прогресс-бар */}
      <div style={{
        width: '100%',
        maxWidth: '320px',
        height: '8px',
        backgroundColor: 'rgba(10, 95, 89, 0.1)',
        borderRadius: '4px',
        overflow: 'hidden',
        marginBottom: '8px',
      }}>
        <div style={{
          width: `${progress}%`,
          height: '100%',
          backgroundColor: '#0A5F59',
          borderRadius: '4px',
          transition: 'width 0.1s ease-out',
          boxShadow: '0 2px 8px rgba(10, 95, 89, 0.3)',
        }} />
      </div>

      {/* Процент прогресса */}
      <p style={{
        fontFamily: "'Manrope', -apple-system, BlinkMacSystemFont, sans-serif",
        fontWeight: 500,
        fontSize: '14px',
        color: '#0A5F59',
        textAlign: 'center',
      }}>
        {Math.round(progress)}%
      </p>

      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

