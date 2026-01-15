// app/(miniapp)/quiz/components/QuizInitialLoader.tsx
// Компонент для отображения скелетной загрузки анкеты (без спиннера)

'use client';

import { QuestionSkeleton } from '@/components/ui/SkeletonLoader';

interface QuizInitialLoaderProps {
  // Параметры оставлены для обратной совместимости, но не используются
  message?: string;
  subMessage?: string;
}

export function QuizInitialLoader({ 
  message: _message,
  subMessage: _subMessage
}: QuizInitialLoaderProps) {
  // Используем только скелетную загрузку, без спиннера и текста
  return (
    <div style={{ 
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#FFFFFF',
      padding: '40px 20px',
    }}>
      <QuestionSkeleton />
    </div>
  );
}
