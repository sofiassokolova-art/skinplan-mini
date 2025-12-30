// components/quiz/screens/LoadingScreen.tsx
// Компонент экрана загрузки для анкеты
// Вынесен из page.tsx для улучшения читаемости

import React from 'react';

export interface LoadingScreenProps {
  message?: string;
}

export function LoadingScreen({ message = 'Загрузка вопросов...' }: LoadingScreenProps) {
  return (
    <div style={{ 
      padding: '20px',
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      background: 'linear-gradient(135deg, #F5FFFC 0%, #E8FBF7 100%)'
    }}>
      <div style={{ color: '#0A5F59', fontSize: '18px' }}>
        {message}
      </div>
    </div>
  );
}

