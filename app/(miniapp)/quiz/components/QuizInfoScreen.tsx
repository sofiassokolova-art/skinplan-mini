// app/(miniapp)/quiz/components/QuizInfoScreen.tsx
// Компонент для рендеринга инфо-экрана анкеты
// Вынесен из page.tsx для упрощения основного компонента

'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { BackButtonFixed } from '@/components/BackButtonFixed';
import type { Questionnaire } from '@/lib/quiz/types';
import type { InfoScreen } from '../info-screens';
import { getNextInfoScreenAfterScreen } from '../info-screens';
import { WelcomeScreen, PersonalAnalysisScreen, GoalsIntroScreen, HowItWorksScreen } from '@/components/quiz/screens';
import { FixedContinueButton, TinderButtons } from '@/components/quiz/buttons';
import { TestimonialsCarousel, ProductsGrid } from '@/components/quiz/content';
import { clientLogger } from '@/lib/client-logger';
import { getInitialInfoScreens } from '../info-screens';
import { QuizErrorDisplay } from './QuizErrorDisplay';

// ФИКС: Оптимизированный компонент для загрузки изображений с next/image
// Использует WebP/AVIF оптимизацию, lazy-loading, и правильные размеры
function ImageWithLoading({
  src,
  alt,
  maxWidth,
  priority = false,
}: {
  src: string;
  alt: string;
  maxWidth: string;
  priority?: boolean;
}) {
  const [imageError, setImageError] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);

  // Стандартные размеры для изображений в quiz (320px * 2 для retina = 640px)
  const width = 640;
  const height = 640;

  // ФИКС: Показываем плейсхолдер пока изображение загружается или если произошла ошибка
  if (imageError || !src) {
    return (
      <div style={{
        width: '100%',
        maxWidth,
        marginBottom: '32px',
        position: 'relative',
        aspectRatio: '1 / 1',
        backgroundColor: '#f5f5f5',
        borderRadius: '12px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        {imageError ? (
          <div style={{
            fontSize: '14px',
            color: '#999',
            textAlign: 'center',
            padding: '20px'
          }}>
            Изображение недоступно
          </div>
        ) : (
          <>
            <div style={{
              width: '40px',
              height: '40px',
              border: '3px solid rgba(0, 0, 0, 0.1)',
              borderTop: '3px solid #000000',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
            }}></div>
            <style jsx>{`
              @keyframes spin {
                0% {
                  transform: rotate(0deg);
                }
                100% {
                  transform: rotate(360deg);
                }
              }
            `}</style>
          </>
        )}
      </div>
    );
  }

  return (
    <div style={{
      width: '100%',
      maxWidth,
      marginBottom: '32px',
      position: 'relative',
      aspectRatio: '1 / 1',
      background: 'transparent',
      backgroundColor: 'transparent',
      opacity: imageLoaded ? 1 : 0.7,
      transition: 'opacity 0.3s ease',
    }}>
      <Image
        src={src}
        alt={alt}
        width={width}
        height={height}
        priority={priority} // Только для первых 1-2 экранов
        style={{
          width: '100%',
          height: 'auto',
          objectFit: 'contain',
          display: 'block',
          filter: 'none', // ФИКС: Убираем любые цветовые фильтры с изображения
        }}
        sizes={`(max-width: 768px) ${maxWidth}, ${maxWidth}`}
        onLoad={() => setImageLoaded(true)}
        onError={() => setImageError(true)}
      />
    </div>
  );
}

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
  handleBack: () => void; // ИСПРАВЛЕНО: Добавлен handleBack для правильной обработки кнопки "Назад"
  pendingInfoScreenRef?: React.MutableRefObject<InfoScreen | null>;
  isInitialInfoScreen?: boolean; // ФИКС: Флаг для начальных инфо экранов
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
  setCurrentInfoScreenIndex: _setCurrentInfoScreenIndex,
  setIsSubmitting,
  setError,
  setLoading,
  handleNext,
  submitAnswers,
  pendingInfoScreenRef,
  handleBack,
  isInitialInfoScreen = false,
}: QuizInfoScreenProps) {
  const screenId = screen?.id;

  const isTinderScreen = screen.type === 'tinder';
  const isTestimonialsScreen = screen.type === 'testimonials';
  const isComparisonScreen = screen.type === 'comparison';
  const isProductsScreen = screen.type === 'products';
  const isTransformationScreen = screen.type === 'transformation';
  const isWelcomeScreen = screen.id === 'welcome';
  const isHowItWorksScreen = screen.id === 'how_it_works';
  const isPersonalAnalysisScreen = screen.id === 'personal_analysis';
  const isGoalsIntroScreen = screen.id === 'goals_intro';
  const isGeneralInfoIntroScreen = screen.id === 'general_info_intro';
  const isHealthDataScreen = screen.id === 'health_data';
  const isSkinFeaturesIntroScreen = screen.id === 'skin_features_intro';
  const isHabitsMatterScreen = screen.id === 'habits_matter';

  // ФИКС: Prefetch следующих 1-2 изображений для ускорения загрузки
  // Используем new Image().src для предзагрузки в кэш браузера
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!screenId) return;
    
    // Находим следующие 1-2 экрана после текущего
    const nextScreen1 = getNextInfoScreenAfterScreen(screenId);
    const nextScreen2 = nextScreen1 ? getNextInfoScreenAfterScreen(nextScreen1.id) : null;
    
    // Prefetch изображения следующих экранов
    const prefetchImage = (imageSrc: string | undefined) => {
      if (!imageSrc) return;
      const img = document.createElement('img');
      img.src = imageSrc;
    };
    
    if (nextScreen1?.image) {
      prefetchImage(nextScreen1.image);
    }
    if (nextScreen2?.image) {
      prefetchImage(nextScreen2.image);
    }
  }, [screenId]);

  // ФИКС: Проверяем что screen существует
  if (!screen) {
    console.error('❌ [QuizInfoScreen] screen is null or undefined');
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#FFFFFF',
        padding: '20px',
      }}>
        <div style={{
          fontSize: '18px',
          color: '#666',
          textAlign: 'center'
        }}>
          Ошибка загрузки экрана
        </div>
      </div>
    );
  }

  // ФИКС: Кнопка "Назад" - создаём один раз для всех экранов
  // Для начальных инфо-экранов показываем кнопку всегда, кроме welcome
  const shouldShowBackButton = screen.id !== 'welcome' && (isInitialInfoScreen || currentInfoScreenIndex > 0);
  const backButton =
    shouldShowBackButton && handleBack ? (
      <BackButtonFixed
        show
        onClick={() => {
          const html = document.documentElement;
          const body = document.body;
          const scrollTop = window.pageYOffset || html.scrollTop || body.scrollTop || 0;
          const scrollLeft = window.pageXOffset || html.scrollLeft || body.scrollLeft || 0;
          handleBack();
          setTimeout(() => window.scrollTo(scrollLeft, scrollTop), 0);
        }}
      />
    ) : null;

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
        onBack={handleBack}
      />
    );
  }

  // Специальный рендеринг для экрана "Как это работает?" с шагами
  if (isHowItWorksScreen) {
    return (
      <HowItWorksScreen
        screen={screen}
        currentInfoScreenIndex={currentInfoScreenIndex}
        onBack={handleBack}
        onContinue={handleNext}
      />
    );
  }

  // Экран "SkinIQ — ваш персональный анализ кожи" - абсолютное позиционирование как у goals_intro
  if (isPersonalAnalysisScreen) {
    return (
      <PersonalAnalysisScreen
        screen={screen}
        currentInfoScreenIndex={currentInfoScreenIndex}
        onContinue={handleNext}
        onBack={handleBack}
      />
    );
  }

  // Экран отзывов (testimonials) - белый фон, фиксированная шапка, скроллится только слайдер
  if (isTestimonialsScreen) {
    // Кнопка "Назад" через портал для гарантированной фиксации

    return (
      <>
        {backButton}
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

        {/* Фиксированная шапка с заголовком и анимацией */}
        <div 
          className="animate-fade-in"
          style={{
            paddingTop: '120px',
            paddingLeft: '20px',
            paddingRight: '20px',
            paddingBottom: '24px',
            background: '#FFFFFF',
          }}
        >
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

        {/* Прокручиваемая область только для слайдера отзывов с анимацией */}
        <div 
          className="animate-fade-in"
          style={{
            flex: 1,
            overflow: 'hidden',
            overflowY: 'visible', // Разрешаем видимость тени сверху/снизу
            paddingLeft: '20px',
            paddingRight: '20px',
            paddingTop: '20px',
            paddingBottom: '180px',
            animationDelay: '0.1s',
          }}
        >
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
            Продолжить
          </button>
        </div>
      </div>
      </>
    );
  }

  // Экран "Какую цель вы ставите перед собой?" (goals_intro)
  if (isGoalsIntroScreen) {
    return (
      <GoalsIntroScreen
        screen={screen}
        currentInfoScreenIndex={currentInfoScreenIndex}
        onBack={handleBack}
        onContinue={() => {
          if (!handleNextInProgressRef.current && !isHandlingNext) {
            handleNext();
          }
        }}
      />
    );
  }

  // Экран "Общая информация" (general_info_intro) - абсолютное позиционирование
  if (isGeneralInfoIntroScreen) {
    // Кнопка "Назад" через портал для гарантированной фиксации

    return (
      <>
        {backButton}
        <div style={{
          padding: 0,
          margin: 0,
          minHeight: '100vh',
          background: '#FFFFFF',
          position: 'relative',
          width: '100%',
        }}>

        {/* Контент с абсолютным позиционированием */}
        <div
          className="animate-fade-in"
          style={{
            position: 'relative',
            width: '100%',
            height: '100vh',
            boxSizing: 'border-box',
          }}
        >
          {/* Картинка с абсолютным позиционированием - без контейнера для skin_features_intro */}
          {screen.image && (
            <div style={{
              position: 'absolute',
              width: '200px',
              height: '241px',
              top: '120px',
              left: '60px',
              zIndex: 10,
            }}>
              <img
                src={screen.image}
                alt={screen.title}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'contain',
                  display: 'block',
                }}
              />
            </div>
          )}

          {/* Заголовок с абсолютным позиционированием */}
          <h1 style={{
            position: 'absolute',
            width: '342px',
            height: '93px',
            top: '320px',
            left: '20px',
            fontFamily: "var(--font-unbounded), 'Unbounded', -apple-system, BlinkMacSystemFont, sans-serif",
            fontWeight: 700,
            fontSize: '32px',
            lineHeight: '120%',
            letterSpacing: '0px',
            textAlign: 'left',
            color: '#000000',
            margin: '0',
            whiteSpace: 'pre-line',
            zIndex: 10,
          }}>
            {screen.title}
          </h1>

          {/* Подзаголовок с абсолютным позиционированием */}
          {screen.subtitle && (
            <div style={{
              position: 'absolute',
              width: '342px',
              height: '93px',
              top: '430px',
              left: '20px',
              fontFamily: "var(--font-inter), 'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
              fontWeight: 400,
              fontSize: '18px',
              lineHeight: '140%',
              letterSpacing: '0px',
              textAlign: 'left',
              color: '#000000',
              whiteSpace: 'pre-line',
              zIndex: 10,
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
            Продолжить
          </button>
        </div>
      </div>
      </>
    );
  }

  // Экран "Узнаем особенности вашей кожи" (skin_features_intro) - абсолютное позиционирование как у general_info_intro
  if (isSkinFeaturesIntroScreen) {
    // Кнопка "Назад" через портал для гарантированной фиксации

    return (
      <>
        {backButton}
        <div style={{
          padding: 0,
          margin: 0,
          minHeight: '100vh',
          background: '#FFFFFF',
          position: 'relative',
          width: '100%',
        }}>

        {/* Контент с абсолютным позиционированием */}
        <div
          className="animate-fade-in"
          style={{
            position: 'relative',
            width: '100%',
            height: '100vh',
            boxSizing: 'border-box',
          }}
        >
          {/* Картинка с абсолютным позиционированием */}
          {screen.image && (
            <div style={{
              position: 'absolute',
              width: '200px',
              height: '241px',
              top: '120px',
              left: '60px',
              zIndex: 10,
            }}>
              <img
                src={screen.image}
                alt={screen.title}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'contain',
                  display: 'block',
                }}
              />
            </div>
          )}

          {/* Заголовок с абсолютным позиционированием */}
          <h1 style={{
            position: 'absolute',
            width: '342px',
            height: '93px',
            top: '320px',
            left: '20px',
            fontFamily: "var(--font-unbounded), 'Unbounded', -apple-system, BlinkMacSystemFont, sans-serif",
            fontWeight: 700,
            fontSize: '32px',
            lineHeight: '120%',
            letterSpacing: '0px',
            textAlign: 'left',
            color: '#000000',
            margin: '0',
            whiteSpace: 'pre-line',
            zIndex: 10,
          }}>
            {screen.title}
          </h1>

          {/* Подзаголовок с абсолютным позиционированием */}
          {screen.subtitle && (
            <div style={{
              position: 'absolute',
              width: '342px',
              height: '93px',
              top: '430px',
              left: '20px',
              fontFamily: "var(--font-inter), 'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
              fontWeight: 400,
              fontSize: '18px',
              lineHeight: '140%',
              letterSpacing: '0px',
              textAlign: 'left',
              color: '#000000',
              whiteSpace: 'pre-line',
              zIndex: 10,
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
            Продолжить
          </button>
        </div>
      </div>
      </>
    );
  }

  // Экран "Нам важно учесть ваши данные о здоровье" (health_data) - такая же верстка как у general_info_intro
  if (isHealthDataScreen) {
    // Кнопка "Назад" через портал для гарантированной фиксации

    return (
      <>
        {backButton}
        <div style={{
          padding: 0,
          margin: 0,
          minHeight: '100vh',
          background: '#FFFFFF',
          position: 'relative',
          width: '100%',
        }}>

        {/* Контент с абсолютным позиционированием */}
        <div
          className="animate-fade-in"
          style={{
            position: 'relative',
            width: '100%',
            height: '100vh',
            boxSizing: 'border-box',
          }}
        >
          {/* Картинка с абсолютным позиционированием - без контейнера для skin_features_intro */}
          {screen.image && (
            <div style={{
              position: 'absolute',
              width: '200px',
              height: '241px',
              top: '120px',
              left: '60px',
              zIndex: 10,
            }}>
              <img
                src={screen.image}
                alt={screen.title}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'contain',
                  display: 'block',
                }}
              />
            </div>
          )}

          {/* Заголовок с абсолютным позиционированием */}
          <h1 style={{
            position: 'absolute',
            width: '342px',
            height: '93px',
            top: '320px',
            left: '20px',
            fontFamily: "var(--font-unbounded), 'Unbounded', -apple-system, BlinkMacSystemFont, sans-serif",
            fontWeight: 700,
            fontSize: '32px',
            lineHeight: '120%',
            letterSpacing: '0px',
            textAlign: 'left',
            color: '#000000',
            margin: '0',
            whiteSpace: 'pre-line',
            zIndex: 10,
          }}>
            {screen.title}
          </h1>

          {/* Подзаголовок с абсолютным позиционированием */}
          {screen.subtitle && (
            <div style={{
              position: 'absolute',
              width: '342px',
              height: '93px',
              top: '430px',
              left: '20px',
              fontFamily: "var(--font-inter), 'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
              fontWeight: 400,
              fontSize: '18px',
              lineHeight: '140%',
              letterSpacing: '0px',
              textAlign: 'left',
              color: '#000000',
              whiteSpace: 'pre-line',
              zIndex: 10,
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
            Продолжить
          </button>
        </div>
      </div>
      </>
    );
  }

  // Экран "Каждая привычка отражается на коже" (habits_matter) - такая же верстка как у health_data
  if (isHabitsMatterScreen) {
    // Кнопка "Назад" через портал для гарантированной фиксации

    return (
      <>
        {backButton}
        <div style={{
          padding: 0,
          margin: 0,
          minHeight: '100vh',
          background: '#FFFFFF',
          position: 'relative',
          width: '100%',
        }}>

        {/* Контент с абсолютным позиционированием */}
        <div
          className="animate-fade-in"
          style={{
            position: 'relative',
            width: '100%',
            height: '100vh',
            boxSizing: 'border-box',
          }}
        >
          {/* Картинка с абсолютным позиционированием - без контейнера для skin_features_intro */}
          {screen.image && (
            <div style={{
              position: 'absolute',
              width: '200px',
              height: '241px',
              top: '120px',
              left: '60px',
              zIndex: 10,
            }}>
              <img
                src={screen.image}
                alt={screen.title}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'contain',
                  display: 'block',
                }}
              />
            </div>
          )}

          {/* Заголовок с абсолютным позиционированием */}
          <h1 style={{
            position: 'absolute',
            width: '342px',
            height: '140px', // Увеличена высота для длинного заголовка
            top: '320px',
            left: '20px',
            fontFamily: "var(--font-unbounded), 'Unbounded', -apple-system, BlinkMacSystemFont, sans-serif",
            fontWeight: 700,
            fontSize: '32px',
            lineHeight: '120%',
            letterSpacing: '0px',
            textAlign: 'left',
            color: '#000000',
            margin: '0',
            whiteSpace: 'pre-line',
            zIndex: 10,
          }}>
            {screen.title}
          </h1>

          {/* Подзаголовок с абсолютным позиционированием */}
          {screen.subtitle && (
            <div style={{
              position: 'absolute',
              width: '342px',
              height: '93px',
              top: '470px', // Сдвинут ниже из-за увеличенной высоты заголовка
              left: '20px',
              fontFamily: "var(--font-inter), 'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
              fontWeight: 400,
              fontSize: '18px',
              lineHeight: '140%',
              letterSpacing: '0px',
              textAlign: 'left',
              color: '#000000',
              whiteSpace: 'pre-line',
              zIndex: 10,
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
              fontFamily: "var(--font-inter), 'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
              fontWeight: 600,
              fontSize: '16px',
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(213, 254, 97, 0.3)',
            }}
          >
            Продолжить
          </button>
        </div>
      </div>
      </>
    );
  }


  // Дефолтный рендеринг для остальных инфо-экранов
  return (
    <>
      {backButton}
      <div style={{
        padding: '20px',
        paddingBottom: '100px',
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #F5FFFC 0%, #E8FBF7 100%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'flex-start',
        position: 'relative',
      }}>

        {/* КАРТИНКА — отдельно, без backdropFilter */}
        {screen.image && !isWelcomeScreen && (
          <div style={{
            width: '88%',
            maxWidth: '420px',
            height: isTinderScreen ? '400px' : '320px',
            borderRadius: '32px',
            overflow: 'hidden',
            marginTop: '80px',
            marginBottom: '24px',
            position: 'relative',
            background: '#fff', // важно: нейтральная подложка
          }}>
            <Image
              src={screen.image}
              alt={screen.title}
              width={1200}
              height={isTinderScreen ? 400 : 320}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                display: 'block',
                filter: 'none', // ФИКС: Убираем любые цветовые фильтры с изображения
              }}
              sizes="(max-width: 768px) 100vw, 420px"
            />
          </div>
        )}

        {/* КАРТОЧКА — стекло, но без изображения */}
        <div style={{
          width: '88%',
          maxWidth: isTestimonialsScreen ? '90%' : '420px',
          backgroundColor: 'rgba(255, 255, 255, 0.58)',
          backdropFilter: 'blur(26px)',
          WebkitBackdropFilter: 'blur(26px)',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          borderRadius: '44px',
          padding: '36px 28px 32px 28px',
          paddingBottom: screen.ctaText ? '32px' : '32px',
          boxShadow: '0 16px 48px rgba(0, 0, 0, 0.12), 0 8px 24px rgba(0, 0, 0, 0.08)',
          position: 'relative',
          zIndex: 1,
        }}>

        
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
          <div style={{ 
            marginBottom: '28px',
            padding: '20px',
            backgroundColor: 'rgba(255, 255, 255, 0.5)',
            borderRadius: '16px',
            border: '1px solid rgba(0, 0, 0, 0.05)',
          }}>
            {/* Текст уже в subtitle, здесь можем добавить визуальные элементы если нужно */}
            {/* ИСПРАВЛЕНО: Добавлен контейнер для визуального отображения comparison экрана */}
          </div>
        )}

        {/* Transformation экран */}
        {isTransformationScreen && screen.content && (
          <div style={{ 
            marginBottom: '28px',
            padding: '20px',
            backgroundColor: 'rgba(255, 255, 255, 0.5)',
            borderRadius: '16px',
            border: '1px solid rgba(0, 0, 0, 0.05)',
            textAlign: 'center',
          }}>
            {/* ИСПРАВЛЕНО: Добавлен рендеринг для transformation экрана */}
            {screen.content.from && screen.content.to && (
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginTop: '16px',
              }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '14px', color: '#6B7280', marginBottom: '8px' }}>
                    {screen.content.from}
                  </div>
                  <div style={{ fontSize: '18px', fontWeight: 600, color: '#0A5F59' }}>
                    {screen.content.indicator || 'Прогресс'}
                  </div>
                </div>
                <div style={{ 
                  width: '40px', 
                  height: '2px', 
                  background: 'linear-gradient(90deg, #D5FE61 0%, #0A5F59 100%)',
                  margin: '0 16px',
                }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '14px', color: '#6B7280', marginBottom: '8px' }}>
                    {screen.content.to}
                  </div>
                  <div style={{ fontSize: '18px', fontWeight: 600, color: '#0A5F59' }}>
                    {screen.content.indicator || 'Цель'}
                  </div>
                </div>
              </div>
            )}
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
        loadingText="Продолжить"
      />
      </div>
    </>
  );
}
