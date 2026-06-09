// app/(miniapp)/quiz/components/QuizInitialLoader.tsx
// Корневой (entry) лоадер miniapp — белый фон + чёрный крутящийся кружок.
// Используется на root-странице, в layout-гейте и на входе в анкету.
// В остальных местах (home/plan/payment/analysis) остаются скелетные лоадеры (AppLoader).
// Дополнительно префетчит ленивые чанки анкеты, чтобы переход
// LOADER → INFO/QUESTION был мгновенным после прилёта данных.

'use client';

import { useEffect, useState } from 'react';
import { preloadQuizImages } from '../image-assets';

interface QuizInitialLoaderProps {
  message?: string;
  subMessage?: string;
  // Если передан onTimeout — вызывается через timeoutMs если лоадер всё ещё показывается
  onTimeout?: () => void;
  timeoutMs?: number;
}

// Префетч ленивых чанков следующих экранов анкеты — запускается уже на лоадере,
// пока React Query тянет /api/questionnaire. Когда данные прилетят, чанки
// будут в кэше браузера → переход без мигания и без второго лоадера.
function prefetchQuizChunks(): void {
  if (typeof window === 'undefined') return;
  // dynamic import без await — браузер скачивает и парсит модули в фоне
  void import('./QuizInfoScreen');
  void import('./QuizQuestion');
  void import('./QuizResumeScreen');
  preloadQuizImages();
}

export function QuizInitialLoader({
  message,
  subMessage,
  onTimeout,
  timeoutMs = 12_000, // 12 сек: даём время на cold start БД (Neon до ~15 сек) и медленную сеть
}: QuizInitialLoaderProps) {
  const [showReload, setShowReload] = useState(false);

  useEffect(() => {
    // Префетч следующих экранов параллельно с загрузкой данных
    prefetchQuizChunks();

    const t = setTimeout(() => {
      setShowReload(true);
      onTimeout?.();
    }, timeoutMs);
    return () => clearTimeout(t);
  }, [onTimeout, timeoutMs]);

  return (
    <div
      className="app-bottom-nav-clearance"
      style={{
        position: 'fixed',
        inset: 0,
        minHeight: '100vh',
        width: '100%',
        background: 'var(--canvas-white)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px 24px var(--bottom-nav-clearance)',
        boxSizing: 'border-box',
        zIndex: 99998,
        fontFamily: 'var(--font-inter), -apple-system, BlinkMacSystemFont, sans-serif',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '420px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
        }}
      >
        {/* Индетерминантный лоадер — чёрный крутящийся кружок */}
        <div
          className="skinplan-loader-spinner"
          style={{
            width: '40px',
            height: '40px',
            borderRadius: '50%',
            border: '3px solid rgba(10, 10, 10, 0.14)',
            borderTopColor: 'var(--ink)',
            marginBottom: message ? '22px' : 0,
          }}
          aria-hidden="true"
        />

        {message && (
          <p
            style={{
              margin: 0,
              color: 'var(--ink)',
              fontSize: '18px',
              fontWeight: 700,
              lineHeight: 1.35,
              fontFamily:
                'var(--font-unbounded), -apple-system, BlinkMacSystemFont, sans-serif',
            }}
          >
            {message}
          </p>
        )}

        {subMessage && (
          <p
            style={{
              margin: '10px 0 0',
              color: 'var(--ink-soft)',
              fontSize: '14px',
              lineHeight: 1.45,
            }}
          >
            {subMessage}
          </p>
        )}

        {showReload && (
          <div style={{ textAlign: 'center', marginTop: '24px' }}>
            <p style={{ color: '#6B7280', fontSize: 14, marginBottom: 12 }}>
              Загрузка занимает больше времени, чем обычно
            </p>
            <button
              onClick={() => window.location.reload()}
              style={{
                padding: '10px 24px',
                background: '#0A0A0A',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: 999,
                fontSize: 14,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Обновить
            </button>
          </div>
        )}
      </div>

      <style jsx>{`
        :global(.skinplan-loader-spinner) {
          animation: skinplan-loader-spin 0.8s linear infinite;
          will-change: transform;
        }

        @keyframes skinplan-loader-spin {
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  );
}
