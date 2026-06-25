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
          background: 'rgba(10, 10, 10, 0.9)',
          backdropFilter: 'blur(18px) saturate(160%)',
          WebkitBackdropFilter: 'blur(18px) saturate(160%)',
          color: '#FFFFFF',
          borderRadius: '22px',
          padding: '14px 16px',
          boxShadow: '0 18px 42px rgba(10, 10, 10, 0.22), inset 0 1px 0 rgba(255, 255, 255, 0.12)',
          border: '1px solid rgba(213, 254, 97, 0.24)',
          fontSize: '14px',
          fontWeight: 700,
          lineHeight: 1.25,
          letterSpacing: '-0.1px',
          fontFamily: "var(--font-inter), -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        },
        success: {
          iconTheme: {
            primary: '#D5FE61',
            secondary: '#0A0A0A',
          },
        },
        error: {
          duration: 3600,
          style: {
            background: 'rgba(10, 10, 10, 0.92)',
            color: '#FFFFFF',
            border: '1px solid rgba(255, 119, 119, 0.38)',
            boxShadow: '0 18px 42px rgba(10, 10, 10, 0.24), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
          },
          iconTheme: {
            primary: '#FF7777',
            secondary: '#0A0A0A',
          },
        },
      }}
    />
  );
}
