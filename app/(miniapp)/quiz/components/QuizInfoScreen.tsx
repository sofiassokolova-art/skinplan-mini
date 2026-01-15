// app/(miniapp)/quiz/components/QuizInfoScreen.tsx
// Компонент для рендеринга инфо-экрана анкеты
// Вынесен из page.tsx для упрощения основного компонента

'use client';

import type { Questionnaire } from '@/lib/quiz/types';
import type { InfoScreen } from '../info-screens';
import { getNextInfoScreenAfterScreen } from '../info-screens';
import { WelcomeScreen, HowItWorksScreen, PersonalAnalysisScreen } from '@/components/quiz/screens';
import { FixedContinueButton, TinderButtons } from '@/components/quiz/buttons';
import { TestimonialsCarousel, ProductsGrid } from '@/components/quiz/content';
import { clientLogger } from '@/lib/client-logger';
import { getInitialInfoScreens } from '../info-screens';
import { QuizErrorDisplay } from './QuizErrorDisplay';

interface QuizInfoScreenProps {
  screen: InfoScreen;
  currentInfoScreenIndex: number;
  questionnaire: Questionnaire | null;
  questionnaireRef: React.MutableRefObject<Questionnaire | null>;
  error: string | null;
  isSubmitting: boolean;
  isHandlingNext: boolean;
  isDev: boolean;
  handleNextInProgressRef: React.MutableRefObject<boolean>;
  isSubmittingRef: React.MutableRefObject<boolean>;
  setCurrentInfoScreenIndex: (index: number | ((prev: number) => number)) => void;
  setIsSubmitting: (value: boolean | ((prev: boolean) => boolean)) => void;
  setError: (error: string | null | ((prev: string | null) => string | null)) => void;
  setLoading: (loading: boolean | ((prev: boolean) => boolean)) => void;
  handleNext: () => Promise<void>;
  submitAnswers: () => Promise<void>;
  pendingInfoScreenRef?: React.MutableRefObject<InfoScreen | null>;
}

export function QuizInfoScreen({
  screen,
  currentInfoScreenIndex,
  questionnaire,
  questionnaireRef,
  error,
  isSubmitting,
  isHandlingNext,
  isDev,
  handleNextInProgressRef,
  isSubmittingRef,
  setCurrentInfoScreenIndex,
  setIsSubmitting,
  setError,
  setLoading,
  handleNext,
  submitAnswers,
  pendingInfoScreenRef,
}: QuizInfoScreenProps) {
  const isTinderScreen = screen.type === 'tinder';
  const isTestimonialsScreen = screen.type === 'testimonials';
  const isComparisonScreen = screen.type === 'comparison';
  const isProductsScreen = screen.type === 'products';
  const isWelcomeScreen = screen.id === 'welcome';
  const isHowItWorksScreen = screen.id === 'how_it_works';
  const isPersonalAnalysisScreen = screen.id === 'personal_analysis';
  const isGoalsIntroScreen = screen.id === 'goals_intro';
  const isGeneralInfoIntroScreen = screen.id === 'general_info_intro';

  // РЕФАКТОРИНГ: Используем компонент WelcomeScreen
  if (isWelcomeScreen) {
    return (
      <WelcomeScreen
        screen={screen}
        onContinue={() => {
          if (!handleNextInProgressRef.current && !isHandlingNext) {
            handleNext();
          }
        }}
        isHandlingNext={isHandlingNext}
        currentInfoScreenIndex={currentInfoScreenIndex}
        onBack={() => {
          if (currentInfoScreenIndex > 0) {
            setCurrentInfoScreenIndex(currentInfoScreenIndex - 1);
          }
        }}
      />
    );
  }

  // Специальный рендеринг для экрана "Как это работает?"
  if (isHowItWorksScreen) {
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
        {/* Кнопка "Назад" - простая стрелка без фона */}
        <button
          onClick={() => {
            if (currentInfoScreenIndex > 0) {
              setCurrentInfoScreenIndex(currentInfoScreenIndex - 1);
            }
          }}
          style={{
            position: 'absolute',
            top: 'clamp(20px, 4vh, 40px)',
            left: 'clamp(19px, 5vw, 24px)',
            zIndex: 10,
            width: '44px',
            height: '44px',
            background: 'transparent',
            border: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            padding: 0,
          }}
        >
          <svg
            width="12"
            height="20"
            viewBox="0 0 12 20"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M10 2L2 10L10 18"
              stroke="#1A1A1A"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>

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
              const stepText = step.replace(/^\d+\.\s*/, '');
              
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
        {screen.ctaText && (
          <div style={{
            position: 'fixed',
            bottom: 'clamp(40px, 6vh, 60px)',
            left: 0,
            right: 0,
            padding: '0 clamp(20px, 5vw, 40px)',
            background: 'transparent',
            zIndex: 100,
            display: 'flex',
            justifyContent: 'center',
          }}>
            <button
              onClick={handleNext}
              style={{
                width: '100%',
                maxWidth: 'clamp(224px, 60vw, 320px)',
                height: 'clamp(56px, 8vh, 64px)',
                borderRadius: '20px',
                background: '#D5FE61',
                color: '#000000',
                border: 'none',
                fontFamily: "var(--font-inter), -apple-system, BlinkMacSystemFont, sans-serif",
                fontWeight: 600,
                fontSize: 'clamp(14px, 4vw, 16px)',
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
                transition: 'transform 0.2s, box-shadow 0.2s',
              }}
              onMouseDown={(e) => {
                e.currentTarget.style.transform = 'scale(0.98)';
              }}
              onMouseUp={(e) => {
                e.currentTarget.style.transform = 'scale(1)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'scale(1)';
              }}
            >
              {String(screen.ctaText || 'Продолжить')}
            </button>
          </div>
        )}
      </div>
    );
  }

  // РЕФАКТОРИНГ: Используем компонент PersonalAnalysisScreen
  if (isPersonalAnalysisScreen) {
    return (
      <PersonalAnalysisScreen
        screen={screen}
        currentInfoScreenIndex={currentInfoScreenIndex}
        onBack={() => {
          if (currentInfoScreenIndex > 0) {
            setCurrentInfoScreenIndex(currentInfoScreenIndex - 1);
          }
        }}
        onContinue={handleNext}
      />
    );
  }

  // Экран отзывов (testimonials) - белый фон, фиксированная шапка, скроллится только слайдер
  if (isTestimonialsScreen) {
    return (
      <div style={{ 
        padding: 0,
        margin: 0,
        minHeight: '100vh',
        maxHeight: '100vh',
        background: '#FFFFFF',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        width: '100%',
        overflow: 'hidden',
      }}>
        {/* Фиксированная кнопка "Назад" */}
        {currentInfoScreenIndex > 0 && (
          <button
            onClick={() => setCurrentInfoScreenIndex(currentInfoScreenIndex - 1)}
            style={{
              position: 'fixed',
              top: 'clamp(20px, 4vh, 40px)',
              left: 'clamp(19px, 5vw, 24px)',
              zIndex: 100,
              width: '44px',
              height: '44px',
              background: 'transparent',
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              padding: 0,
            }}
          >
            <svg
              width="12"
              height="20"
              viewBox="0 0 12 20"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M10 2L2 10L10 18"
                stroke="#1A1A1A"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        )}

        {/* Фиксированная шапка с заголовком */}
        <div style={{
          paddingTop: '120px',
          paddingLeft: '20px',
          paddingRight: '20px',
          paddingBottom: '24px',
          background: '#FFFFFF',
        }}>
          {/* Заголовок */}
          <h1 style={{
            fontFamily: "var(--font-unbounded), 'Unbounded', -apple-system, BlinkMacSystemFont, sans-serif",
            fontWeight: 700,
            fontSize: '26px',
            lineHeight: '120%',
            letterSpacing: '0px',
            textAlign: 'center',
            color: '#000000',
            margin: '0 0 12px 0',
            maxWidth: '100%',
          }}>
            {screen.title}
          </h1>

          {/* Подзаголовок */}
          {screen.subtitle && (
            <div style={{
              fontFamily: "var(--font-inter), 'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
              fontWeight: 400,
              fontSize: '16px',
              lineHeight: '140%',
              letterSpacing: '0px',
              textAlign: 'center',
              color: '#000000',
              whiteSpace: 'pre-line',
            }}>
              {screen.subtitle}
            </div>
          )}
        </div>

        {/* Прокручиваемая область только для слайдера отзывов */}
        <div style={{
          flex: 1,
          overflow: 'hidden',
          overflowY: 'visible', // Разрешаем видимость тени сверху/снизу
          paddingLeft: '20px',
          paddingRight: '20px',
          paddingTop: '20px',
          paddingBottom: '180px',
        }}>
          {/* Слайдер отзывов */}
          {screen.content && Array.isArray(screen.content) && (
            <TestimonialsCarousel testimonials={screen.content as any} />
          )}
        </div>
        
        {/* Фиксированная кнопка "Продолжить" внизу экрана */}
        <div style={{
          position: 'fixed',
          bottom: '40px',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '100%',
          maxWidth: '320px',
          padding: '0 20px',
          boxSizing: 'border-box',
          zIndex: 100,
        }}>
          <button
            onClick={handleNext}
            style={{
              width: '100%',
              height: '56px',
              borderRadius: '20px',
              background: '#D5FE61',
              color: '#000000',
              border: 'none',
              fontFamily: "var(--font-inter), -apple-system, BlinkMacSystemFont, sans-serif",
              fontWeight: 600,
              fontSize: '16px',
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(213, 254, 97, 0.3)',
            }}
          >
            {screen.ctaText || 'Продолжить'}
          </button>
        </div>
      </div>
    );
  }

  // Экран "Какую цель вы ставите перед собой?" (goals_intro)
  if (isGoalsIntroScreen) {
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
          <button
            onClick={() => setCurrentInfoScreenIndex(currentInfoScreenIndex - 1)}
            style={{
              position: 'absolute',
              top: 'clamp(20px, 4vh, 40px)',
              left: 'clamp(19px, 5vw, 24px)',
              zIndex: 10,
              width: '44px',
              height: '44px',
              background: 'transparent',
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              padding: 0,
            }}
          >
            <svg
              width="12"
              height="20"
              viewBox="0 0 12 20"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M10 2L2 10L10 18"
                stroke="#1A1A1A"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        )}

        {/* Контент */}
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'flex-start',
          paddingTop: '100px',
          paddingBottom: '120px',
          paddingLeft: '20px',
          paddingRight: '20px',
          width: '100%',
          boxSizing: 'border-box',
        }}>
          {/* Картинка */}
          {screen.image && (
            <div style={{
              width: '100%',
              maxWidth: '320px',
              marginBottom: '32px',
            }}>
              <img
                src={screen.image}
                alt={screen.title}
                style={{
                  width: '100%',
                  height: 'auto',
                  objectFit: 'contain',
                  border: 'none',
                  outline: 'none',
                  display: 'block',
                }}
              />
            </div>
          )}

          {/* Заголовок */}
          <h1 style={{
            fontFamily: "var(--font-unbounded), 'Unbounded', -apple-system, BlinkMacSystemFont, sans-serif",
            fontWeight: 700,
            fontSize: '32px',
            lineHeight: '120%',
            letterSpacing: '0px',
            textAlign: 'left',
            color: '#000000',
            margin: '0 0 16px 0',
            width: '100%',
            maxWidth: '320px',
            whiteSpace: 'pre-line',
          }}>
            {screen.title}
          </h1>

          {/* Подзаголовок */}
          {screen.subtitle && (
            <div style={{
              fontFamily: "var(--font-inter), 'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
              fontWeight: 400,
              fontSize: '18px',
              lineHeight: '140%',
              letterSpacing: '0px',
              textAlign: 'left',
              color: '#000000',
              width: '100%',
              maxWidth: '320px',
            }}>
              {screen.subtitle}
            </div>
          )}
        </div>
        
        {/* Фиксированная кнопка "Продолжить" внизу экрана */}
        <div style={{
          position: 'fixed',
          bottom: '40px',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '100%',
          maxWidth: '320px',
          padding: '0 20px',
          boxSizing: 'border-box',
          zIndex: 100,
        }}>
          <button
            onClick={handleNext}
            style={{
              width: '100%',
              height: '56px',
              borderRadius: '20px',
              background: '#D5FE61',
              color: '#000000',
              border: 'none',
              fontFamily: "var(--font-inter), -apple-system, BlinkMacSystemFont, sans-serif",
              fontWeight: 600,
              fontSize: '16px',
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
            }}
          >
            {screen.ctaText || 'Продолжить'}
          </button>
        </div>
      </div>
    );
  }

  // Экран "Общая информация" (general_info_intro) - такая же верстка как у goals_intro
  if (isGeneralInfoIntroScreen) {
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
          <button
            onClick={() => setCurrentInfoScreenIndex(currentInfoScreenIndex - 1)}
            style={{
              position: 'absolute',
              top: 'clamp(20px, 4vh, 40px)',
              left: 'clamp(19px, 5vw, 24px)',
              zIndex: 10,
              width: '44px',
              height: '44px',
              background: 'transparent',
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              padding: 0,
            }}
          >
            <svg
              width="12"
              height="20"
              viewBox="0 0 12 20"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M10 2L2 10L10 18"
                stroke="#1A1A1A"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        )}

        {/* Контент */}
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'flex-start',
          paddingTop: '100px',
          paddingBottom: '120px',
          paddingLeft: '20px',
          paddingRight: '20px',
          width: '100%',
          boxSizing: 'border-box',
        }}>
          {/* Картинка */}
          {screen.image && (
            <div style={{
              width: '100%',
              maxWidth: '320px',
              marginBottom: '32px',
            }}>
              <img
                src={screen.image}
                alt={screen.title}
                style={{
                  width: '100%',
                  height: 'auto',
                  objectFit: 'contain',
                  border: 'none',
                  outline: 'none',
                  display: 'block',
                }}
              />
            </div>
          )}

          {/* Заголовок */}
          <h1 style={{
            fontFamily: "var(--font-unbounded), 'Unbounded', -apple-system, BlinkMacSystemFont, sans-serif",
            fontWeight: 700,
            fontSize: '32px',
            lineHeight: '120%',
            letterSpacing: '0px',
            textAlign: 'left',
            color: '#000000',
            margin: '0 0 16px 0',
            width: '100%',
            maxWidth: '320px',
            whiteSpace: 'pre-line',
          }}>
            {screen.title}
          </h1>

          {/* Подзаголовок */}
          {screen.subtitle && (
            <div style={{
              fontFamily: "var(--font-inter), 'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
              fontWeight: 400,
              fontSize: '18px',
              lineHeight: '140%',
              letterSpacing: '0px',
              textAlign: 'left',
              color: '#000000',
              width: '100%',
              maxWidth: '320px',
            }}>
              {screen.subtitle}
            </div>
          )}
        </div>
        
        {/* Фиксированная кнопка "Продолжить" внизу экрана */}
        <div style={{
          position: 'fixed',
          bottom: '40px',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '100%',
          maxWidth: '320px',
          padding: '0 20px',
          boxSizing: 'border-box',
          zIndex: 100,
        }}>
          <button
            onClick={handleNext}
            style={{
              width: '100%',
              height: '56px',
              borderRadius: '20px',
              background: '#D5FE61',
              color: '#000000',
              border: 'none',
              fontFamily: "var(--font-inter), -apple-system, BlinkMacSystemFont, sans-serif",
              fontWeight: 600,
              fontSize: '16px',
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(213, 254, 97, 0.3)',
            }}
          >
            {screen.ctaText || 'Продолжить'}
          </button>
        </div>
      </div>
    );
  }

  // Дефолтный рендеринг для остальных инфо-экранов
  return (
    <div style={{ 
      padding: '20px',
      paddingBottom: '100px',
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #F5FFFC 0%, #E8FBF7 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
    }}>
      {/* Кнопка "Назад" - простая стрелка */}
      {currentInfoScreenIndex > 0 && (
        <button
          onClick={() => setCurrentInfoScreenIndex(currentInfoScreenIndex - 1)}
          style={{
            position: 'absolute',
            top: 'clamp(20px, 4vh, 40px)',
            left: 'clamp(19px, 5vw, 24px)',
            zIndex: 10,
            width: '44px',
            height: '44px',
            background: 'transparent',
            border: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            padding: 0,
          }}
        >
          <svg
            width="12"
            height="20"
            viewBox="0 0 12 20"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M10 2L2 10L10 18"
              stroke="#1A1A1A"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      )}

      <div style={{
        width: '88%',
        maxWidth: isTestimonialsScreen ? '90%' : '420px',
        backgroundColor: 'rgba(255, 255, 255, 0.58)',
        backdropFilter: 'blur(26px)',
        border: '1px solid rgba(255, 255, 255, 0.2)',
        borderRadius: '44px',
        padding: '36px 28px 32px 28px',
        paddingBottom: screen.ctaText ? '32px' : '32px',
        boxShadow: '0 16px 48px rgba(0, 0, 0, 0.12), 0 8px 24px rgba(0, 0, 0, 0.08)',
        position: 'relative',
        zIndex: 1,
        marginTop: '80px',
      }}>
        {/* Изображение */}
        {screen.image && !isTinderScreen && !isWelcomeScreen && (
          <div style={{
            width: '100%',
            height: '320px',
            borderRadius: '32px 32px 0 0',
            overflow: 'hidden',
            marginBottom: '24px',
          }}>
            <img
              src={screen.image}
              alt={screen.title}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
              }}
            />
          </div>
        )}

        {/* Tinder-экран с изображением */}
        {isTinderScreen && screen.image && (
          <div style={{
            width: '100%',
            height: '400px',
            borderRadius: '32px',
            overflow: 'hidden',
            marginBottom: '24px',
            position: 'relative',
          }}>
            <img
              src={screen.image}
              alt={screen.title}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
              }}
            />
          </div>
        )}
        
        {/* Заголовок */}
        <h1 className="quiz-title" style={{
          fontFamily: "'Unbounded', -apple-system, BlinkMacSystemFont, sans-serif",
          fontWeight: 700,
          fontSize: '36px',
          lineHeight: '42px',
          color: '#0A5F59',
          margin: '0 0 16px 0',
          textAlign: 'center',
        }}>
          {String(screen.title || '')}
        </h1>

        {/* Подзаголовок - многострочный */}
        {screen.subtitle && (
          <div style={{
            fontFamily: "var(--font-inter), -apple-system, BlinkMacSystemFont, sans-serif",
            fontWeight: 400,
            fontSize: '18px',
            lineHeight: '1.6',
            color: '#475467',
            margin: '0 0 28px 0',
            textAlign: 'center',
            whiteSpace: 'pre-line',
          }}>
            {String(screen.subtitle || '')}
          </div>
        )}

        {/* РЕФАКТОРИНГ: Используем компонент QuizErrorDisplay */}
        <QuizErrorDisplay error={error} />

        {/* РЕФАКТОРИНГ: Используем компонент TestimonialsCarousel */}
        {isTestimonialsScreen && screen.content && Array.isArray(screen.content) && (
          <TestimonialsCarousel testimonials={screen.content as any} />
        )}

        {/* РЕФАКТОРИНГ: Используем компонент ProductsGrid */}
        {isProductsScreen && screen.content && Array.isArray(screen.content) && (
          <ProductsGrid products={screen.content as any} />
        )}

        {/* Сравнение (comparison) */}
        {isComparisonScreen && (
          <div style={{ marginBottom: '28px' }}>
            {/* Текст уже в subtitle, здесь можем добавить визуальные элементы если нужно */}
          </div>
        )}

        {/* Кнопки действий */}
        {(() => {
          const isLastInfoScreen = screen.id === 'want_improve';
          const nextInfoScreen = getNextInfoScreenAfterScreen(screen.id);
          
          if (isLastInfoScreen && !nextInfoScreen && !isTinderScreen) {
            return (
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (isSubmitting) return;
                  submitAnswers().catch((err) => {
                    console.error('Error submitting answers:', err);
                    const errorMessage = String(err?.message || 'Ошибка отправки ответов');
                    setError(errorMessage);
                    setIsSubmitting(false);
                  });
                }}
                disabled={isSubmitting}
                style={{
                  width: '100%',
                  height: '64px',
                  background: '#0A5F59',
                  color: 'white',
                  border: 'none',
                  borderRadius: '32px',
                  fontFamily: "var(--font-inter), -apple-system, BlinkMacSystemFont, sans-serif",
                  fontWeight: 600,
                  fontSize: '18px',
                  cursor: isSubmitting ? 'not-allowed' : 'pointer',
                  boxShadow: '0 8px 24px rgba(10, 95, 89, 0.3), 0 4px 12px rgba(10, 95, 89, 0.2)',
                  opacity: isSubmitting ? 0.7 : 1,
                  marginTop: '20px',
                }}
              >
                {isSubmitting ? 'Отправка...' : 'Получить план →'}
              </button>
            );
          }

          // РЕФАКТОРИНГ: Используем компонент TinderButtons
          if (isTinderScreen) {
            const isLastInfoScreen = screen.id === 'want_improve';
            return (
              <TinderButtons
                screenId={screen.id}
                isLastInfoScreen={isLastInfoScreen}
                isTinderScreen={isTinderScreen}
                isSubmitting={isSubmitting}
                questionnaire={questionnaire}
                isDev={isDev}
                error={error}
                isSubmittingRef={isSubmittingRef}
                setIsSubmitting={setIsSubmitting}
                setError={setError}
                setLoading={setLoading}
                submitAnswers={submitAnswers}
                handleNext={handleNext}
              />
            );
          }

          return null;
        })()}
      </div>
      
      {/* РЕФАКТОРИНГ: Используем компонент FixedContinueButton */}
      <FixedContinueButton
        ctaText={screen.ctaText}
        onClick={() => {
          const initialInfoScreens = getInitialInfoScreens();
          const isOnInitialInfoScreen = currentInfoScreenIndex < initialInfoScreens.length;
          
          // ФИКС: Получаем актуальное значение pendingInfoScreen из ref
          const currentPendingInfoScreen = pendingInfoScreenRef?.current;
          
          clientLogger.warn('🖱️ Кнопка "Продолжить": клик получен', {
            handleNextInProgress: handleNextInProgressRef.current,
            hasQuestionnaire: !!questionnaire,
            hasQuestionnaireRef: !!questionnaireRef.current,
            isHandlingNext,
            questionnaireId: questionnaire?.id || questionnaireRef.current?.id,
            currentInfoScreenIndex,
            initialInfoScreensLength: initialInfoScreens.length,
            isOnInitialInfoScreen,
            currentScreenId: screen.id,
            currentScreenType: screen.type,
            pendingInfoScreenFromRef: currentPendingInfoScreen ? currentPendingInfoScreen.id : null,
            hasPendingInfoScreenRef: !!pendingInfoScreenRef,
          });
          
          const canProceed = !handleNextInProgressRef.current && 
                             (isOnInitialInfoScreen || (questionnaire || questionnaireRef.current));
          
          if (canProceed) {
            clientLogger.warn('✅ Кнопка "Продолжить": вызываем handleNext', {
              isOnInitialInfoScreen,
              hasQuestionnaire: !!questionnaire || !!questionnaireRef.current,
            });
            handleNext();
          } else {
            clientLogger.warn('⏸️ Кнопка "Продолжить": пропущен клик', {
              handleNextInProgress: handleNextInProgressRef.current,
              hasQuestionnaire: !!questionnaire,
              hasQuestionnaireRef: !!questionnaireRef.current,
              isHandlingNext,
              isOnInitialInfoScreen,
            });
          }
        }}
        disabled={isHandlingNext}
        loadingText="Загрузка..."
      />
    </div>
  );
}

