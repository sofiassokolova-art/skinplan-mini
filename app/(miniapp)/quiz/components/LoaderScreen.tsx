// app/(miniapp)/quiz/components/LoaderScreen.tsx
// Экран загрузки анкеты

'use client';

import { Spinner } from './Spinner';

interface LoaderScreenProps {
  message?: string;
}

export function LoaderScreen({ message = 'Загружаем анкету, еще немного' }: LoaderScreenProps) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        padding: '20px',
        background: 'linear-gradient(135deg, #F5FFFC 0%, #E8FBF7 100%)',
        gap: '24px',
      }}
    >
      <Spinner size="large" />
      <div
        style={{
          color: '#0A5F59',
          fontSize: '18px',
          fontWeight: '500',
          textAlign: 'center',
        }}
      >
        {message}
      </div>
    </div>
  );
}

