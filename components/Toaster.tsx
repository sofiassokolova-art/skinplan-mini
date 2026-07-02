// components/Toaster.tsx
// Toast уведомления для ошибок и успешных действий

'use client';

import { Toaster as HotToaster } from 'react-hot-toast';

export function Toaster() {
  return (
    <HotToaster
      position="top-center"
      gutter={8}
      containerStyle={{
        top: 'calc(env(safe-area-inset-top, 0px) + 12px)',
        left: 12,
        right: 12,
      }}
      toastOptions={{
        duration: 2600,
        className: 'skiniq-toast',
        style: {
          width: 'calc(100vw - 32px)',
          maxWidth: '388px',
          minHeight: '52px',
          background: 'rgba(255, 255, 255, 0.68)',
          backdropFilter: 'blur(24px) saturate(180%)',
          WebkitBackdropFilter: 'blur(24px) saturate(180%)',
          color: '#0A0A0A',
          borderRadius: '24px',
          padding: '14px 16px',
          boxShadow:
            '0 18px 42px rgba(56, 48, 36, 0.14), inset 0 1px 0 rgba(255, 255, 255, 0.78)',
          border: '1px solid rgba(255, 255, 255, 0.76)',
          fontSize: '14px',
          fontWeight: 650,
          lineHeight: 1.25,
          letterSpacing: 0,
          fontFamily: "var(--font-inter), -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        },
        success: {
          iconTheme: {
            primary: '#0A0A0A',
            secondary: '#D5FE61',
          },
        },
        error: {
          duration: 3600,
          style: {
            background: 'rgba(255, 255, 255, 0.72)',
            color: '#0A0A0A',
            border: '1px solid rgba(255, 119, 119, 0.42)',
            boxShadow:
              '0 18px 42px rgba(90, 38, 38, 0.16), inset 0 1px 0 rgba(255, 255, 255, 0.78)',
          },
          iconTheme: {
            primary: '#FF7777',
            secondary: '#FFFFFF',
          },
        },
      }}
    />
  );
}
