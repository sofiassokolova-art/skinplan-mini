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
          alt="Детальный разбор" 
          style={{ width: '48px', height: '48px', objectFit: 'contain' }}
        />
      ),
      text: 'Детальный разбор – морщины, линии, текстура',
    },
    {
      icon: (
        <img 
          src="/icons/hydration_3.PNG" 
          alt="Уровень увлажнённости" 
          style={{ width: '48px', height: '48px', objectFit: 'contain' }}
        />
      ),
      text: 'Уровень увлажнённости – персональная оценка баланса влаги',
    },
    {
      icon: (
        <img 
          src="/icons/face_3.PNG" 
          alt="Поры" 
          style={{ width: '48px', height: '48px', objectFit: 'contain' }}
        />
      ),
      text: 'Поры – точное выявление и измерение',
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

      {/* Контент */}
      <div style={{
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
      }}>
        {/* Заголовок */}
        <h1 
          className="quiz-title"
          style={{
            fontFamily: "var(--font-unbounded), 'Unbounded', -apple-system, BlinkMacSystemFont, sans-serif",
            fontStyle: 'normal',
            fontSize: '24px',
            lineHeight: '120%',
            letterSpacing: '0px',
            textAlign: 'center',
            color: '#000000',
            margin: '0 0 40px 0',
            maxWidth: '311px',
          }}>
          <span style={{ fontWeight: 700 }}>SkinIQ</span>
          <span style={{ fontWeight: 400 }}> — ваш персональный анализ кожи</span>
        </h1>

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
              </div>
            </div>
          ))}
        </div>

        {/* Факты */}
        <div style={{
          width: '100%',
          maxWidth: '320px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          marginTop: '20px',
        }}>
          <div style={{
            fontFamily: "var(--font-inter), 'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
            fontWeight: 400,
            fontSize: '14px',
            lineHeight: '140%',
            letterSpacing: '0px',
            textAlign: 'center',
            color: '#000000',
          }}>
            92% пользователей отмечают улучшение состояния кожи за 1 месяц
          </div>
          <div style={{
            fontFamily: "var(--font-inter), 'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
            fontWeight: 400,
            fontSize: '14px',
            lineHeight: '140%',
            letterSpacing: '0px',
            textAlign: 'center',
            color: '#000000',
          }}>
            SkinIQ в 3 раза эффективнее обычных рутин
          </div>
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

