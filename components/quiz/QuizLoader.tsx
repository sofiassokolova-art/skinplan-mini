// components/quiz/QuizLoader.tsx
// Компонент лоадера для анкеты
// Вынесено из quiz/page.tsx для улучшения читаемости

import React from 'react';
import { QuizInitialLoader } from '@/app/(miniapp)/quiz/components/QuizInitialLoader';

export interface QuizLoaderProps {
  message?: string;
}

export function QuizLoader({ message: _message }: QuizLoaderProps) {
  // ИСПРАВЛЕНО: Используем QuizInitialLoader вместо текста
  return <QuizInitialLoader />;
}

