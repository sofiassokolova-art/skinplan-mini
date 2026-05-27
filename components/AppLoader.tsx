// components/AppLoader.tsx
// Единый пользовательский лоадер miniapp.

'use client';

import dynamic from 'next/dynamic';
import type { CSSProperties, ReactNode } from 'react';

const DotLottieReact = dynamic(
  () => import('@lottiefiles/dotlottie-react').then((mod) => mod.DotLottieReact),
  {
    ssr: false,
    loading: () => <div className="skinplan-loader-dot" />,
  }
);

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
    background: '#000000',
    text: '#FFFFFF',
    subText: '#A3A3A3',
    accent: '#D5FE61',
    track: '#242424',
    glow: 'rgba(213, 254, 97, 0.32)',
  },
  mint: {
    background: 'linear-gradient(135deg, #F5FFFC 0%, #E8FBF7 100%)',
    text: '#0A0A0A',
    subText: '#475467',
    accent: '#0A5F59',
    track: 'rgba(10, 95, 89, 0.14)',
    glow: 'rgba(10, 95, 89, 0.18)',
  },
  light: {
    background: '#FFFFFF',
    text: '#0A0A0A',
    subText: '#6B7280',
    accent: '#0A0A0A',
    track: 'rgba(0, 0, 0, 0.1)',
    glow: 'rgba(213, 254, 97, 0.28)',
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
              width: '128px',
              height: '128px',
              marginBottom: safeProgress === null ? '18px' : '30px',
            }}
          >
            <div
              className="skinplan-loader-glow"
              style={{
                position: 'absolute',
                inset: '24px',
                borderRadius: '50%',
                background: palette.glow,
              }}
            />
            <DotLottieReact
              src="/loader%203.lottie"
              loop
              autoplay
              style={{
                position: 'relative',
                width: '128px',
                height: '128px',
              }}
            />
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
        .skinplan-loader-glow {
          animation: skinplan-loader-pulse 1.6s ease-in-out infinite;
        }

        :global(.skinplan-loader-dot) {
          width: 88px;
          height: 88px;
          border-radius: 50%;
          background: ${palette.accent};
          animation: skinplan-loader-pulse 1.6s ease-in-out infinite;
        }

        @keyframes skinplan-loader-pulse {
          0%, 100% {
            transform: scale(1);
            opacity: 1;
          }
          50% {
            transform: scale(0.84);
            opacity: 0.55;
          }
        }
      `}</style>
    </div>
  );
}
