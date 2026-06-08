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

const PALETTES: Record<AppLoaderVariant, {
  background: string;
  text: string;
  subText: string;
  accent: string;
  track: string;
  glow: string;
}> = {
  dark: {
    background: 'var(--ink)',
    text: 'var(--canvas-white)',
    subText: 'rgba(255, 255, 255, 0.62)',
    accent: 'var(--accent)',
    track: 'rgba(255, 255, 255, 0.16)',
    glow: 'rgba(213, 254, 97, 0.24)',
  },
  mint: {
    background: '#F5FFFC',
    text: 'var(--ink)',
    subText: 'var(--ink-soft)',
    accent: 'var(--accent)',
    track: 'rgba(10, 10, 10, 0.14)',
    glow: 'rgba(213, 254, 97, 0.24)',
  },
  light: {
    background: 'var(--canvas-white)',
    text: 'var(--ink)',
    subText: 'var(--ink-soft)',
    accent: 'var(--accent)',
    track: 'rgba(10, 10, 10, 0.14)',
    glow: 'rgba(213, 254, 97, 0.24)',
  },
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
  const shouldShowIndicator = showAnimation;

  return (
    <div
      className="app-bottom-nav-clearance"
      style={{
        position: fullScreen ? 'fixed' : undefined,
        inset: fullScreen ? 0 : undefined,
        minHeight,
        width: '100%',
        background: palette.background,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px 24px var(--bottom-nav-clearance)',
        boxSizing: 'border-box',
        zIndex: fullScreen ? zIndex : undefined,
        fontFamily: "var(--font-inter), -apple-system, BlinkMacSystemFont, sans-serif",
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
        {/* Индетерминантный лоадер — чёрный крутящийся кружок.
            Если задан progress — оставляем determinate-полосу с процентами. */}
        {shouldShowIndicator && safeProgress === null && (
          <div
            className="skinplan-loader-spinner"
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              border: `3px solid ${palette.track}`,
              borderTopColor: palette.text,
              marginBottom: '22px',
            }}
          />
        )}

        {shouldShowIndicator && safeProgress !== null && (
          <div
            style={{
              position: 'relative',
              width: '100%',
              maxWidth: '320px',
              height: '8px',
              background: palette.track,
              borderRadius: '999px',
              overflow: 'hidden',
              marginBottom: '22px',
              boxShadow: `0 0 18px ${palette.glow}`,
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
              fontFamily: "var(--font-unbounded), -apple-system, BlinkMacSystemFont, sans-serif",
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
        :global(.skinplan-loader-spinner) {
          animation: skinplan-loader-spin 0.8s linear infinite;
          will-change: transform;
        }

        @keyframes skinplan-loader-spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
