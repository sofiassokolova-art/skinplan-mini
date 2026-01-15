// components/quiz/screens/PersonalAnalysisScreen.tsx
// Компонент для экрана "SkinIQ — ваш персональный анализ кожи"
// Вынесен из renderInfoScreen для улучшения читаемости

import React from 'react';
import { BackButton } from '../buttons/BackButton';
import { FixedContinueButton } from '../buttons/FixedContinueButton';
import type { InfoScreen } from '@/app/(miniapp)/quiz/info-screens';

export interface PersonalAnalysisScreenProps {
  screen: InfoScreen;
  currentInfoScreenIndex: number;
  onBack: () => void;
  onContinue: () => void;
}

function PersonalAnalysisScreenComponent({ 
  screen, 
  currentInfoScreenIndex, 
  onBack, 
  onContinue 
}: PersonalAnalysisScreenProps) {
  const features = [
    {
      icon: (
        <img 
          src="/icons/detailed_3.PNG" 
          alt="Точная оценка" 
          style={{ width: '48px', height: '48px', objectFit: 'contain' }}
        />
      ),
      text: 'Точная оценка состояния кожи',
      boldPart: null,
    },
    {
      icon: (
        <img 
          src="/icons/hydration_3.PNG" 
          alt="Индивидуальный уход" 
          style={{ width: '48px', height: '48px', objectFit: 'contain' }}
        />
      ),
      text: 'Индивидуально подобранные средства ухода',
      boldPart: null,
    },
    {
      icon: (
        <img 
          src="/icons/face_3.PNG" 
          alt="Умная рутина" 
          style={{ width: '48px', height: '48px', objectFit: 'contain' }}
        />
      ),
      text: 'Умная рутина, которая работает ',
      boldPart: 'в 3 раза эффективнее',
    },
  ];

  return (
    <div style={{ 
      padding: 0,
      margin: 0,
      minHeight: '100vh',
      background: '#FFFFFF',
      display: 'flex',
      flexDirection: 'column',
      position: 'relative',
      width: '100%',
    }}>
      {/* Кнопка "Назад" */}
      {currentInfoScreenIndex > 0 && (
        <BackButton onClick={onBack} />
      )}

      {/* Контент с анимацией */}
      <div 
        className="animate-fade-in"
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'flex-start',
          paddingTop: '120px',
          paddingBottom: '100px',
          paddingLeft: '20px',
          paddingRight: '20px',
          width: '100%',
          boxSizing: 'border-box',
        }}
      >
        {/* Заголовок */}
        <h1 
          className="quiz-title"
          style={{
            fontFamily: "var(--font-unbounded), 'Unbounded', -apple-system, BlinkMacSystemFont, sans-serif",
            fontStyle: 'normal',
            fontSize: '32px',
            lineHeight: '120%',
            letterSpacing: '0px',
            textAlign: 'center',
            color: '#000000',
            margin: '0 0 12px 0',
            maxWidth: '311px',
          }}>
          <span style={{ fontWeight: 700 }}>SkinIQ</span>
          <span style={{ fontWeight: 400 }}> — ваш персональный анализ кожи</span>
        </h1>

        {/* Подзаголовок - статистика */}
        <div style={{
          fontFamily: "var(--font-inter), 'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
          fontWeight: 400,
          fontSize: '14px',
          lineHeight: '140%',
          letterSpacing: '0px',
          textAlign: 'center',
          color: '#9D9D9D',
          marginBottom: '40px',
          maxWidth: '320px',
        }}>
          92% пользователей SkinIQ отмечают улучшение состояния кожи за 1 месяц
        </div>

        {/* Список функций с иконками */}
        <div style={{
          width: '100%',
          maxWidth: '320px',
          display: 'flex',
          flexDirection: 'column',
          gap: '24px',
          marginBottom: '40px',
        }}>
          {features.map((feature, index) => (
            <div
              key={index}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                textAlign: 'center',
                gap: '12px',
              }}
            >
              {/* Иконка */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                {feature.icon}
              </div>
              {/* Текст */}
              <div style={{
                fontFamily: "var(--font-inter), 'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
                fontWeight: 400,
                fontSize: '16px',
                lineHeight: '120%',
                letterSpacing: '0px',
                textAlign: 'center',
                color: '#000000',
                maxWidth: '289px',
              }}>
                {feature.text}
                {feature.boldPart && (
                  <span style={{ fontWeight: 700 }}>{feature.boldPart}</span>
                )}
              </div>
            </div>
          ))}
        </div>

      </div>
      
      {/* Фиксированная кнопка "Продолжить" внизу экрана */}
      <FixedContinueButton
        ctaText={screen.ctaText}
        onClick={onContinue}
      />
    </div>
  );
}

// ФИКС: Оптимизация рендеринга - мемоизируем компонент для предотвращения лишних перерендеров
export const PersonalAnalysisScreen = React.memo(PersonalAnalysisScreenComponent);

