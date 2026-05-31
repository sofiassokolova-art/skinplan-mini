// components/AppLoader.tsx
// Единый пользовательский лоадер miniapp.

'use client';

import type { CSSProperties, ReactNode } from 'react';

type AppLoaderVariant = 'dark' | 'mint' | 'light';

interface AppLoaderProps {
  message?: string;
  subMessage?: string;
  progress?: number;
  showProgressPercent?: boolean;
  showAnimation?: boolean;
  variant?: AppLoaderVariant;
  fullScreen?: boolean;
  minHeight?: CSSProperties['minHeight'];
  zIndex?: number;
  children?: ReactNode;
}

// Единая «чёрно-серая» палитра — соответствует самому первому лоадеру,
// который виден до подгрузки анкеты: белый фон, чёрная дуга, серое кольцо.
// Все варианты теперь возвращают один и тот же стиль, чтобы лоадер визуально
// не менялся между экранами. Варианты оставлены ради обратной совместимости.
const SHARED_PALETTE = {
  background: '#FFFFFF',
  text: '#0A0A0A',
  subText: '#6B7280',
  accent: '#0A0A0A',           // чёрная вращающаяся дуга
  track: '#E5E7EB',            // серое кольцо-трек
  glow: 'transparent',
};

const PALETTES: Record<AppLoaderVariant, {
  background: string;
  text: string;
  subText: string;
  accent: string;
  track: string;
  glow: string;
}> = {
  dark: SHARED_PALETTE,
  mint: SHARED_PALETTE,
  light: SHARED_PALETTE,
};

export function AppLoader({
  message,
  subMessage,
  progress,
  showProgressPercent = false,
  showAnimation = true,
  variant = 'light',
  fullScreen = false,
  minHeight = '100vh',
  zIndex = 99998,
  children,
}: AppLoaderProps) {
  const palette = PALETTES[variant];
  const safeProgress = typeof progress === 'number'
    ? Math.max(0, Math.min(100, progress))
    : null;

  return (
    <div
      style={{
        position: fullScreen ? 'fixed' : undefined,
        inset: fullScreen ? 0 : undefined,
        minHeight,
        width: '100%',
        background: palette.background,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        boxSizing: 'border-box',
        zIndex: fullScreen ? zIndex : undefined,
        fontFamily: "var(--font-inter), 'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
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
        {showAnimation && (
          <div
            style={{
              position: 'relative',
              width: '72px',
              height: '72px',
              marginBottom: safeProgress === null ? '20px' : '30px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {/* Чёрная дуга на сером кольце — единый «первый» лоадер */}
            <div className="skinplan-loader-ring" />
          </div>
        )}

        {safeProgress !== null && (
          <div
            style={{
              width: '100%',
              maxWidth: '320px',
              height: '8px',
              background: palette.track,
              borderRadius: '999px',
              overflow: 'hidden',
              marginBottom: '18px',
            }}
          >
            <div
              style={{
                height: '100%',
                width: `${safeProgress}%`,
                background: palette.accent,
                borderRadius: '999px',
                transition: 'width 500ms ease-out',
              }}
            />
          </div>
        )}

        {message && (
          <p
            style={{
              margin: 0,
              color: palette.text,
              fontSize: '18px',
              fontWeight: 700,
              lineHeight: 1.35,
              fontFamily: "var(--font-unbounded), 'Unbounded', -apple-system, BlinkMacSystemFont, sans-serif",
            }}
          >
            {message}
          </p>
        )}

        {subMessage && (
          <p
            style={{
              margin: '10px 0 0',
              color: palette.subText,
              fontSize: '14px',
              lineHeight: 1.45,
            }}
          >
            {subMessage}
          </p>
        )}

        {showProgressPercent && safeProgress !== null && (
          <p
            style={{
              margin: '10px 0 0',
              color: palette.subText,
              fontSize: '13px',
              fontWeight: 600,
            }}
          >
            {Math.round(safeProgress)}%
          </p>
        )}

        {children && (
          <div style={{ width: '100%', marginTop: '24px' }}>
            {children}
          </div>
        )}
      </div>

      <style jsx>{`
        :global(.skinplan-loader-ring) {
          width: 56px;
          height: 56px;
          border-radius: 50%;
          border: 5px solid ${palette.track};
          border-top-color: ${palette.accent};
          animation: skinplan-loader-spin 0.9s linear infinite;
          will-change: transform;
        }

        @keyframes skinplan-loader-spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
