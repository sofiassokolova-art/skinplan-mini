// components/quiz/screens/LoadingScreen.tsx
// Компонент экрана загрузки для анкеты
// Вынесен из page.tsx для улучшения читаемости

import React from 'react';
import { QuizInitialLoader } from '@/app/(miniapp)/quiz/components/QuizInitialLoader';

export interface LoadingScreenProps {
  message?: string;
}

export function LoadingScreen({ message: _message }: LoadingScreenProps) {
  return <QuizInitialLoader />;
}

