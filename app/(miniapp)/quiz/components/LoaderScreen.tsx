// app/(miniapp)/quiz/components/LoaderScreen.tsx
// Экран загрузки анкеты

'use client';

import { QuizInitialLoader } from './QuizInitialLoader';

interface LoaderScreenProps {
  message?: string;
}

export function LoaderScreen({ message: _message }: LoaderScreenProps) {
  // ИСПРАВЛЕНО: Используем QuizInitialLoader вместо текста
  return <QuizInitialLoader />;
}

