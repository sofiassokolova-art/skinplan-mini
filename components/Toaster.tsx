// components/Toaster.tsx
// Toast уведомления для ошибок и успешных действий

'use client';

import { Toaster as HotToaster } from 'react-hot-toast';

export function Toaster() {
  return (
    <HotToaster
      position="top-center"
      toastOptions={{
        duration: 4000,
        style: {
          background: 'rgba(255, 255, 255, 0.95)',
          backdropFilter: 'blur(10px)',
          color: '#0A5F59',
          borderRadius: '12px',
          padding: '16px',
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.12)',
          border: '1px solid rgba(10, 95, 89, 0.1)',
          fontSize: '14px',
          fontFamily: "'Manrope', -apple-system, BlinkMacSystemFont, sans-serif",
          maxWidth: '400px',
        },
        success: {
          iconTheme: {
            primary: '#0A5F59',
            secondary: '#fff',
          },
        },
        error: {
          style: {
            background: 'rgba(254, 226, 226, 0.95)',
            color: '#991B1B',
            border: '1px solid #FCA5A5',
          },
          iconTheme: {
            primary: '#DC2626',
            secondary: '#fff',
          },
        },
      }}
    />
  );
}

