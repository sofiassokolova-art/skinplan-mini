// components/AppLoader.tsx
// Единый пользовательский лоадер miniapp.

'use client';

import type { CSSProperties, ReactNode } from 'react';
import { SkeletonLoader } from '@/components/ui/SkeletonLoader';

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
  const skeletonColor = variant === 'dark' ? 'rgba(255, 255, 255, 0.18)' : 'rgba(10, 10, 10, 0.12)';
  const skeletonColorSoft = variant === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(10, 10, 10, 0.08)';
  const skeletonAccent = variant === 'dark' ? 'rgba(213, 254, 97, 0.36)' : 'rgba(213, 254, 97, 0.72)';

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
        {shouldShowIndicator && (
          <div
            style={{
              width: '100%',
              marginBottom: message ? '24px' : 0,
            }}
            aria-hidden="true"
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'center',
                marginBottom: '18px',
              }}
            >
              <SkeletonLoader
                variant="circular"
                width="52px"
                height="52px"
                style={{ backgroundColor: skeletonAccent, boxShadow: `0 0 18px ${palette.glow}` }}
              />
            </div>

            <SkeletonLoader
              variant="rectangular"
              width="64%"
              height="16px"
              borderRadius="999px"
              style={{ margin: '0 auto 10px', backgroundColor: skeletonColor }}
            />
            <SkeletonLoader
              variant="rectangular"
              width="88%"
              height="10px"
              borderRadius="999px"
              style={{ margin: '0 auto 18px', backgroundColor: skeletonColorSoft }}
            />

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {[0, 1, 2].map((index) => (
                <div
                  key={index}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '40px minmax(0, 1fr)',
                    gap: '12px',
                    alignItems: 'center',
                    padding: '10px 12px',
                    border: `1px solid ${palette.track}`,
                    borderRadius: '8px',
                    background: variant === 'dark' ? 'rgba(255, 255, 255, 0.04)' : 'rgba(255, 255, 255, 0.54)',
                  }}
                >
                  <SkeletonLoader
                    variant="rectangular"
                    width="40px"
                    height="40px"
                    borderRadius="8px"
                    style={{ backgroundColor: skeletonColor }}
                  />
                  <div>
                    <SkeletonLoader
                      variant="rectangular"
                      width={index === 1 ? '78%' : '62%'}
                      height="12px"
                      borderRadius="999px"
                      style={{ marginBottom: '8px', backgroundColor: skeletonColor }}
                    />
                    <SkeletonLoader
                      variant="rectangular"
                      width={index === 2 ? '54%' : '88%'}
                      height="10px"
                      borderRadius="999px"
                      style={{ backgroundColor: skeletonColorSoft }}
                    />
                  </div>
                </div>
              ))}
            </div>
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

    </div>
  );
}
