// components/quiz/screens/HowItWorksScreen.tsx
// Компонент для экрана "Как это работает?"
// Вынесен из renderInfoScreen для улучшения читаемости

import React from 'react';
import { FixedContinueButton } from '../buttons/FixedContinueButton';
import { BackButtonFixed } from '@/components/BackButtonFixed';
import type { InfoScreen } from '@/app/(miniapp)/quiz/info-screens';

export interface HowItWorksScreenProps {
  screen: InfoScreen;
  currentInfoScreenIndex: number;
  onBack: () => void;
  onContinue: () => void;
}

function HowItWorksScreenComponent({ 
  screen, 
  currentInfoScreenIndex, 
  onBack, 
  onContinue 
}: HowItWorksScreenProps) {
  const steps = screen.subtitle?.split('\n').filter(line => line.trim()) || [];
  
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
      <BackButtonFixed show={currentInfoScreenIndex > 0} onClick={onBack} />

      {/* Контент */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'flex-start',
        paddingTop: '120px',
        paddingBottom: '100px', // Отступ снизу для фиксированной кнопки
        paddingLeft: '20px',
        paddingRight: '20px',
        width: '100%',
        boxSizing: 'border-box',
      }}>
        {/* Заголовок */}
        <h1 
          className="quiz-how-it-works-title"
          style={{
            fontFamily: "var(--font-unbounded), 'Unbounded', -apple-system, BlinkMacSystemFont, sans-serif",
            fontWeight: 700,
            fontStyle: 'normal',
            fontSize: '24px',
            lineHeight: '100%',
            letterSpacing: '0px',
            textAlign: 'center',
            color: '#000000',
            margin: '0 0 60px 0',
          }}>
          {screen.title}
        </h1>

        {/* Шаги */}
        <div style={{
          width: '100%',
          maxWidth: '320px',
          display: 'flex',
          flexDirection: 'column',
          gap: '40px',
          marginBottom: '0',
          alignItems: 'center',
        }}>
          {steps.map((step, index) => {
            const stepNumber = index + 1;
            const stepText = step.replace(/^\d+\.\s*/, ''); // Убираем номер из начала строки
            
            return (
              <div
                key={index}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  textAlign: 'center',
                  width: '100%',
                }}
              >
                {/* Круг с номером и текстом "Шаг" */}
                <div style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '50%',
                  background: '#D5FE61',
                  border: 'none',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontFamily: "var(--font-inter), -apple-system, BlinkMacSystemFont, sans-serif",
                  color: '#000000',
                  marginBottom: '8px',
                  padding: '2px 0',
                }}>
                  {/* Номер шага */}
                  <div style={{
                    fontWeight: 800,
                    fontSize: '20px',
                    lineHeight: '19.45px',
                    letterSpacing: '0px',
                  }}>
                    {stepNumber}
                  </div>
                  {/* Текст "Шаг" */}
                  <div style={{
                    fontWeight: 100,
                    fontSize: '10px',
                    lineHeight: '12px',
                    letterSpacing: '0px',
                    marginTop: '-2px',
                  }}>
                    Шаг
                  </div>
                </div>
                
                {/* Текст шага */}
                <div style={{
                  fontFamily: "var(--font-inter), -apple-system, BlinkMacSystemFont, sans-serif",
                  fontWeight: 400,
                  fontSize: '16px',
                  lineHeight: '140%',
                  letterSpacing: '0px',
                  color: '#000000',
                  textAlign: 'center',
                }}>
                  {stepText}
                </div>
              </div>
            );
          })}
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
export const HowItWorksScreen = React.memo(HowItWorksScreenComponent);
