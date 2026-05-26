// app/(miniapp)/quiz/components/QuizInfoScreen.tsx
// Компонент для рендеринга инфо-экрана анкеты
// Вынесен из page.tsx для упрощения основного компонента

'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { Check } from 'lucide-react';
import { BackButtonFixed } from '@/components/BackButtonFixed';
import type { Questionnaire } from '@/lib/quiz/types';
import type { InfoScreen } from '../info-screens';
import { getNextInfoScreenAfterScreen } from '../info-screens';
import { extractQuestionsFromQuestionnaire } from '@/lib/quiz/extractQuestions';
import { WelcomeScreen, PersonalAnalysisScreen, HowItWorksScreen } from '@/components/quiz/screens';
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
  // Ответы пользователя — нужны для персонализированных экранов (skin_preview).
  // Опционально: начальные инфо-экраны (welcome, personal_analysis) рендерятся до ответов.
  answers?: Record<number, string | string[]>;
}

// Шаговые интро-экраны (stepNumber !== undefined) теперь невидимы для пользователя:
// компонент сразу вызывает handleNext, а лейбл «Шаг N: название» показывается
// над прогресс-баром на следующих вопросах (см. QuizQuestion.tsx → QUESTION_STEP_MAP).
function StepScreenAutoAdvance({
  handleNext,
  isHandlingNext,
}: {
  handleNext: () => Promise<void>;
  isHandlingNext: boolean;
}) {
  const calledRef = useRef(false);
  useEffect(() => {
    if (calledRef.current || isHandlingNext) return;
    calledRef.current = true;
    handleNext();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
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
  answers,
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
  // general_info_intro и skin_features_intro УДАЛЕНЫ как филлер-экраны (см. info-screens.ts).
  const isHealthDataScreen = screen.id === 'health_data';
  const isSkinPreviewScreen = screen.id === 'skin_preview';
  // habits_matter экран удалён — спец-обработка больше не нужна.

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

  // Экран "SkinIQ — ваш персональный анализ кожи"
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
      <div
        style={
          isWelcomeScreen
            ? {
                padding: 0,
                margin: 0,
                height: '100vh',
                background: `
                  radial-gradient(60% 30% at 100% 0%, rgba(213,254,97,0.55) 0%, transparent 65%),
                  radial-gradient(70% 30% at 0% 35%, rgba(255,231,200,0.6) 0%, transparent 65%),
                  radial-gradient(80% 25% at 100% 70%, rgba(213,254,97,0.35) 0%, transparent 65%),
                  radial-gradient(80% 30% at 0% 100%, rgba(220,210,196,0.6) 0%, transparent 60%),
                  #F4F2EE`,
                display: 'flex',
                flexDirection: 'column',
                position: 'relative',
                width: '100%',
                overflow: 'hidden',
              }
            : {
                padding: 0,
                margin: 0,
                minHeight: '100vh',
                maxHeight: '100vh',
                background: `
                  radial-gradient(60% 30% at 100% 0%, rgba(213,254,97,0.55) 0%, transparent 65%),
                  radial-gradient(70% 30% at 0% 35%, rgba(255,231,200,0.6) 0%, transparent 65%),
                  radial-gradient(80% 25% at 100% 70%, rgba(213,254,97,0.35) 0%, transparent 65%),
                  radial-gradient(80% 30% at 0% 100%, rgba(220,210,196,0.6) 0%, transparent 60%),
                  #F4F2EE`,
                display: 'flex',
                flexDirection: 'column',
                position: 'relative',
                width: '100%',
                overflow: 'hidden',
              }
        }
      >

        {/* Фиксированная шапка с заголовком и анимацией */}
        <div 
          className="animate-fade-in"
          style={
            isWelcomeScreen
              ? {
                  paddingTop: '180px',
                  paddingLeft: '20px',
                  paddingRight: '20px',
                  paddingBottom: '24px',
                  background: 'transparent',
                }
              : {
                  paddingTop: '120px',
                  paddingLeft: '20px',
                  paddingRight: '20px',
                  paddingBottom: '24px',
                  background: 'transparent',
                }
          }
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
            overflowY: 'visible',
            paddingLeft: '16px',
            paddingRight: '16px',
            paddingTop: '8px',
            paddingBottom: '160px',
            animationDelay: '0.1s',
          }}
        >
          {/* Слайдер отзывов */}
          {screen.content && Array.isArray(screen.content) && (
            <TestimonialsCarousel testimonials={screen.content as any} />
          )}
        </div>
        
        <FixedContinueButton
          ctaText={screen.ctaText}
          onClick={handleNext}
          disabled={isHandlingNext}
          loadingText="Продолжить"
        />
      </div>
      </>
    );
  }

  // Экран mid-quiz preview персонализации (skin_preview) — показывается после блока вопросов
  // про кожу (skin_type, skin_concerns, skin_sensitivity, seasonal_changes, fitzpatrick_type). Цель: дать
  // пользователю промежуточный «вывод» по его ответам — он видит, что машина уже что-то поняла,
  // и охотнее доходит до конца анкеты.
  if (isSkinPreviewScreen) {
    // Резолвим ответы пользователя в человекочитаемые label'ы.
    const allQuestions = extractQuestionsFromQuestionnaire(questionnaire);
    const findAnswerLabel = (questionCode: string): string | string[] | null => {
      const q = allQuestions.find((qq: any) => qq?.code === questionCode);
      if (!q || !answers) return null;
      const raw = answers[q.id];
      if (raw === undefined || raw === null) return null;
      const options = (q as any).options || (q as any).answerOptions || [];
      const resolveOne = (v: string): string => {
        const opt = options.find((o: any) =>
          String(o.id) === String(v) ||
          o.value === v ||
          o.label === v
        );
        return opt?.label || v;
      };
      if (Array.isArray(raw)) return raw.map(resolveOne);
      return resolveOne(raw);
    };

    const skinTypeLabel = findAnswerLabel('skin_type');
    const concernsRaw = findAnswerLabel('skin_concerns');
    const sensitivityLabel = findAnswerLabel('skin_sensitivity');

    // Для skin_type оставляем только короткий заголовок (до \n), без длинного описания.
    const skinTypeShort = typeof skinTypeLabel === 'string'
      ? skinTypeLabel.split('\n')[0].replace(/^Тип \d+\s*[—-]\s*/, '').trim()
      : null;

    // Для skin_concerns берём первые 2 жалобы — больше визуально перегружает карточку.
    const concernsList = Array.isArray(concernsRaw)
      ? concernsRaw.slice(0, 2).map(c => c.toLowerCase()).join(' · ')
      : null;

    const sensitivityShort = typeof sensitivityLabel === 'string'
      ? (sensitivityLabel.match(/^(Практически|Лёгкое|Заметное|Сильное)/i)?.[0] || null)
      : null;

    return (
      <>
        {backButton}
        <div style={{
          padding: 0,
          margin: 0,
          minHeight: '100vh',
          background: `
            radial-gradient(60% 30% at 100% 0%, rgba(213,254,97,0.55) 0%, transparent 65%),
            radial-gradient(70% 30% at 0% 35%, rgba(255,231,200,0.6) 0%, transparent 65%),
            radial-gradient(80% 25% at 100% 70%, rgba(213,254,97,0.35) 0%, transparent 65%),
            radial-gradient(80% 30% at 0% 100%, rgba(220,210,196,0.6) 0%, transparent 60%),
            #F4F2EE
          `,
          position: 'relative',
          width: '100%',
        }}>
          <div
            className="animate-fade-in"
            style={{
              position: 'relative',
              width: '100%',
              minHeight: '100vh',
              boxSizing: 'border-box',
              padding: '120px 20px 140px',
              maxWidth: '420px',
              margin: '0 auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '24px',
            }}
          >
            <h1 style={{
              fontFamily: "var(--font-unbounded), 'Unbounded', -apple-system, BlinkMacSystemFont, sans-serif",
              fontWeight: 700,
              fontSize: '28px',
              lineHeight: '120%',
              color: '#000000',
              margin: 0,
            }}>
              Ваш предварительный профиль
            </h1>

            <p style={{
              fontFamily: "var(--font-inter), 'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
              fontSize: '15px',
              lineHeight: '140%',
              color: '#4B5563',
              margin: 0,
            }}>
              На основе ваших ответов мы уже понимаем, как должен выглядеть ваш уход.
            </p>

            {/* Карточка с резюме ответов */}
            <div style={{
              background: 'rgba(255,255,255,0.55)',
              backdropFilter: 'blur(28px) saturate(160%)',
              WebkitBackdropFilter: 'blur(28px) saturate(160%)',
              border: '1px solid rgba(255,255,255,0.7)',
              borderRadius: '28px',
              padding: '22px',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
              boxShadow: '0 8px 32px rgba(0,0,0,0.06)',
              fontFamily: "var(--font-inter), 'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
            }}>
              {skinTypeShort && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span style={{ fontSize: '13px', color: '#888' }}>Тип кожи</span>
                  <span style={{ fontSize: '17px', fontWeight: 600, color: '#000' }}>{skinTypeShort}</span>
                </div>
              )}
              {concernsList && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span style={{ fontSize: '13px', color: '#888' }}>Главный фокус</span>
                  <span style={{ fontSize: '17px', fontWeight: 600, color: '#000' }}>{concernsList}</span>
                </div>
              )}
              {sensitivityShort && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span style={{ fontSize: '13px', color: '#888' }}>Чувствительность</span>
                  <span style={{ fontSize: '17px', fontWeight: 600, color: '#000' }}>{sensitivityShort}</span>
                </div>
              )}
            </div>

            <p style={{
              fontFamily: "var(--font-inter), 'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
              fontSize: '15px',
              lineHeight: '140%',
              color: '#000000',
              margin: 0,
            }}>
              Ещё несколько вопросов — и мы соберём план под ваши предпочтения и бюджет.
            </p>
          </div>

          <FixedContinueButton
            ctaText={screen.ctaText || 'Продолжить'}
            onClick={handleNext}
            disabled={isHandlingNext}
            loadingText="Продолжить"
          />
        </div>
      </>
    );
  }

  // Mini-progress-step экран — теперь прозрачно пропускается.
  // Лейбл «Шаг N: название» показывается над прогресс-баром вопросов (QuizQuestion → QUESTION_STEP_MAP).
  if (screen.stepNumber !== undefined && screen.totalSteps !== undefined) {
    return <StepScreenAutoAdvance handleNext={handleNext} isHandlingNext={isHandlingNext} />;
  }

  // Финальный экран после бюджета — закрепляет «всё готово» и допродаёт ценность плана.
  // Светлый фирменный фон (как в ai_comparison/personal_analysis):
  //  1) светлая стеклянная карточка «Что мы учли» со статусом «Готово» и чек-листом данных
  //  2) лёгкая карточка «В вашем плане» с коротким value-summary
  if (screen.id === 'no_mistakes') {
    const collected = [
      'Тип и состояние кожи',
      'Цели и приоритеты',
      'Чувствительность и здоровье',
      'Бюджет и формат',
    ];
    const CheckIcon = ({ color = 'currentColor' }: { color?: string }) => (
      <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke={color} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <polyline points="2,5 4.2,7.2 8,3.4" />
      </svg>
    );

    return (
      <>
        {backButton}
        <div style={{
          minHeight: '100vh',
          position: 'relative',
          background: `
            radial-gradient(60% 30% at 100% 0%, rgba(213,254,97,0.55) 0%, transparent 65%),
            radial-gradient(70% 30% at 0% 35%, rgba(255,231,200,0.6) 0%, transparent 65%),
            radial-gradient(80% 25% at 100% 70%, rgba(213,254,97,0.35) 0%, transparent 65%),
            radial-gradient(80% 30% at 0% 100%, rgba(220,210,196,0.6) 0%, transparent 60%),
            #F4F2EE
          `,
          color: '#1C1C1C',
          width: '100%',
          overflowX: 'hidden',
        }}>
          <div
            className="animate-fade-in"
            style={{
              position: 'relative',
              zIndex: 1,
              width: '100%',
              maxWidth: '430px',
              minHeight: '100vh',
              margin: '0 auto',
              padding: 'clamp(76px, 11vh, 88px) 20px 140px',
              boxSizing: 'border-box',
              display: 'flex',
              flexDirection: 'column',
              gap: 'clamp(12px, 2vh, 16px)',
            }}
          >
            {/* Kicker: статус готовности */}
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              width: 'fit-content',
              padding: '7px 12px 7px 9px',
              background: '#0A0A0A',
              color: '#D5FE61',
              borderRadius: '999px',
              fontFamily: "var(--font-inter), 'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
              fontSize: '11px',
              fontWeight: 700,
              letterSpacing: '0.6px',
              textTransform: 'uppercase',
            }}>
              <span style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                background: '#D5FE61',
                boxShadow: '0 0 0 4px rgba(213,254,97,0.25)',
              }} />
              Профиль готов
            </span>

            {/* Заголовок: фокус на «завершён» */}
            <h1 className="quiz-title" style={{
              fontFamily: "var(--font-unbounded), 'Unbounded', -apple-system, BlinkMacSystemFont, sans-serif",
              fontWeight: 700,
              fontSize: 'clamp(26px, 7.2vw, 32px)',
              lineHeight: 1.06,
              letterSpacing: 0,
              color: '#0A0A0A',
              margin: 0,
              maxWidth: '360px',
            }}>
              Анализ вашей кожи{' '}
              <span style={{
                background: 'linear-gradient(180deg, transparent 62%, #D5FE61 62%)',
                padding: '0 4px',
              }}>
                завершён
              </span>
            </h1>

            {/* Лид */}
            <p style={{
              fontFamily: "var(--font-inter), 'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
              fontSize: '15px',
              lineHeight: 1.45,
              color: '#3A3A3A',
              margin: 0,
              maxWidth: '360px',
            }}>
              Все данные собраны. На их основе формируем персональный протокол ухода.
            </p>

            {/* Светлая карточка: что мы учли */}
            <div style={{
              background: 'rgba(255,255,255,0.6)',
              backdropFilter: 'blur(24px) saturate(160%)',
              WebkitBackdropFilter: 'blur(24px) saturate(160%)',
              border: '1px solid rgba(255,255,255,0.7)',
              borderRadius: '24px',
              padding: 'clamp(16px, 2.4vh, 18px)',
              boxShadow: '0 10px 30px rgba(0,0,0,0.06)',
              display: 'flex',
              flexDirection: 'column',
              gap: 'clamp(12px, 2vh, 14px)',
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '10px',
              }}>
                <span style={{
                  fontFamily: "var(--font-unbounded), 'Unbounded', -apple-system, BlinkMacSystemFont, sans-serif",
                  fontSize: '13px',
                  fontWeight: 600,
                  color: '#1C1C1C',
                  letterSpacing: '0.1px',
                }}>Что мы учли</span>

                <span style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '5px 9px 5px 7px',
                  background: '#D5FE61',
                  color: '#0A0A0A',
                  borderRadius: '999px',
                  fontSize: '11px',
                  fontWeight: 700,
                  letterSpacing: '0.4px',
                  textTransform: 'uppercase',
                }}>
                  <CheckIcon color="#0A0A0A" />
                  Готово
                </span>
              </div>

              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '10px 14px',
                fontFamily: "var(--font-inter), 'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
              }}>
                {collected.map((item) => (
                  <div key={item} style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    fontSize: '13px',
                    color: '#1C1C1C',
                    fontWeight: 500,
                  }}>
                    <span style={{
                      width: '18px',
                      height: '18px',
                      borderRadius: '50%',
                      background: '#0A0A0A',
                      color: '#D5FE61',
                      display: 'grid',
                      placeItems: 'center',
                      flexShrink: 0,
                    }}>
                      <CheckIcon />
                    </span>
                    {item}
                  </div>
                ))}
              </div>
            </div>

            {/* Лёгкая карточка: что вы получаете в плане (re-sell value) */}
            <div style={{
              background: 'rgba(255,255,255,0.48)',
              backdropFilter: 'blur(22px) saturate(155%)',
              WebkitBackdropFilter: 'blur(22px) saturate(155%)',
              border: '1px solid rgba(255,255,255,0.64)',
              borderRadius: '24px',
              padding: '16px',
              color: '#1C1C1C',
              boxShadow: '0 8px 24px rgba(0,0,0,0.045)',
              display: 'flex',
              flexDirection: 'column',
              gap: '11px',
            }}>
              <span style={{
                fontSize: '10px',
                fontWeight: 700,
                color: '#0A0A0A',
                letterSpacing: '0.8px',
                textTransform: 'uppercase',
                fontFamily: "var(--font-inter), 'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
              }}>В вашем плане</span>

              <h2 style={{
                fontFamily: "var(--font-unbounded), 'Unbounded', -apple-system, BlinkMacSystemFont, sans-serif",
                fontSize: 'clamp(16px, 4.4vw, 17px)',
                fontWeight: 700,
                lineHeight: 1.18,
                color: '#0A0A0A',
                margin: 0,
              }}>
                Уход под{' '}
                <span style={{
                  background: 'linear-gradient(180deg, transparent 62%, #D5FE61 62%)',
                  padding: '0 3px',
                }}>
                  вашу
                </span>{' '}
                кожу, а не под среднюю
              </h2>

              <p style={{
                fontFamily: "var(--font-inter), 'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
                fontSize: '13px',
                lineHeight: 1.4,
                color: '#3A3A3A',
                margin: 0,
              }}>
                Ритуал, совместимые активы и средства в рамках бюджета.
              </p>
            </div>
          </div>

          <FixedContinueButton
            ctaText={screen.ctaText}
            onClick={handleNext}
            disabled={isHandlingNext}
            loadingText="Продолжить"
          />
        </div>
      </>
    );
  }

  // Экран "Нам важно учесть ваши данные о здоровье" (health_data) - такая же верстка как у general_info_intro
  // (теперь не используется — health_data конвертирован в progress-step выше; блок оставлен как fallback
  // на случай, если в БД остался скрин без stepNumber, либо если кто-то поднимет старую анкету).
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
        
        <FixedContinueButton
          ctaText={screen.ctaText}
          onClick={handleNext}
          disabled={isHandlingNext}
          loadingText="Продолжить"
        />
      </div>
      </>
    );
  }

  // Экран "Уход, который вам подходит" — отдельный pitch перед предпочтениями.
  // Перенесён из mockup-skiniq-redesign.html: без AI-лейбла, с фокусом на понятный подбор.
  if (isComparisonScreen && screen.id === 'ai_comparison') {
    const steps = [
      {
        num: '01',
        title: 'Понимаем вашу кожу',
        desc: 'Что у вас за тип, чего она хочет и чего избегает.',
      },
      {
        num: '02',
        title: 'Убираем лишнее',
        desc: 'Несовместимые активы, аллергены и то, что вам не подойдёт.',
      },
      {
        num: '03',
        title: 'Выстраиваем ритуал',
        desc: 'Утренние и вечерние шаги в правильном порядке.',
      },
    ];

    return (
      <>
        {backButton}
        <div style={{
          minHeight: '100vh',
          position: 'relative',
          overflowX: 'hidden',
          overflowY: 'auto',
          background: '#FDF7F6',
          color: '#1C1C1C',
        }}>
          <Image
            src="/image 1576994977.png"
            alt=""
            fill
            style={{ objectFit: 'cover', objectPosition: 'center' }}
            priority
          />
          <div
            aria-hidden
            style={{
              position: 'absolute',
              inset: 0,
              zIndex: 1,
              background: 'linear-gradient(180deg, rgba(253,247,246,0) 0%, rgba(253,247,246,0.25) 60%, rgba(253,247,246,0.55) 100%)',
              pointerEvents: 'none',
            }}
          />

          <div
            className="animate-fade-in"
            style={{
              position: 'relative',
              zIndex: 2,
              width: '100%',
              maxWidth: '420px',
              minHeight: '100vh',
              margin: '0 auto',
              padding: '72px 22px 150px',
              boxSizing: 'border-box',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <h1 style={{
              fontFamily: "var(--font-unbounded), 'Unbounded', -apple-system, BlinkMacSystemFont, sans-serif",
              fontWeight: 700,
              fontSize: '32px',
              lineHeight: 1.04,
              letterSpacing: '0px',
              color: '#1C1C1C',
              margin: '0 0 28px 0',
            }}>
              Уход,<br />
              который вам{' '}
              <span style={{
                background: 'linear-gradient(180deg, transparent 62%, #D5FE61 62%)',
                padding: '0 4px',
              }}>
                подходит
              </span>
            </h1>

            <div style={{
              background: 'rgba(255,255,255,0.55)',
              backdropFilter: 'blur(20px) saturate(160%)',
              WebkitBackdropFilter: 'blur(20px) saturate(160%)',
              border: '1px solid rgba(255,255,255,0.7)',
              borderRadius: '24px',
              padding: '20px 18px 12px',
              boxShadow: '0 10px 30px rgba(0,0,0,0.05)',
              marginBottom: '18px',
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px',
                marginBottom: '10px',
                padding: '0 2px',
              }}>
                <div style={{
                  fontFamily: "var(--font-unbounded), 'Unbounded', -apple-system, BlinkMacSystemFont, sans-serif",
                  fontSize: '13px',
                  fontWeight: 600,
                  color: '#1C1C1C',
                }}>
                  Принцип подбора
                </div>
                <div style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  background: '#D5FE61',
                  color: '#1C1C1C',
                  padding: '4px 9px',
                  borderRadius: '999px',
                  fontSize: '11px',
                  fontWeight: 600,
                  letterSpacing: '0px',
                  whiteSpace: 'nowrap',
                }}>
                  <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#1C1C1C' }} />
                  SkinIQ
                </div>
              </div>

              {steps.map((step, index) => (
                <div
                  key={step.num}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '30px 1fr',
                    gap: '12px',
                    padding: '15px 2px',
                    borderTop: index === 0 ? 'none' : '1px solid rgba(28,28,28,0.08)',
                  }}
                >
                  <div style={{
                    width: '30px',
                    height: '30px',
                    borderRadius: '50%',
                    background: '#0A0A0A',
                    color: '#D5FE61',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '11px',
                    fontWeight: 700,
                    letterSpacing: '0px',
                  }}>
                    {step.num}
                  </div>
                  <div>
                    <h3 style={{
                      fontFamily: "var(--font-unbounded), 'Unbounded', -apple-system, BlinkMacSystemFont, sans-serif",
                      fontSize: '13px',
                      fontWeight: 600,
                      lineHeight: 1.2,
                      color: '#1C1C1C',
                      margin: '0 0 2px',
                    }}>
                      {step.title}
                    </h3>
                    <p style={{
                      fontSize: '12px',
                      lineHeight: 1.35,
                      color: '#6F6F6F',
                      margin: 0,
                    }}>
                      {step.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <div style={{
              background: '#0A0A0A',
              borderRadius: '24px',
              padding: '20px',
              color: '#FFFFFF',
              position: 'relative',
              overflow: 'hidden',
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', position: 'relative', zIndex: 1 }}>
                <div style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '50%',
                  background: '#D5FE61',
                  color: '#1C1C1C',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  <Check size={16} strokeWidth={3} aria-hidden="true" />
                </div>
                <div>
                  <div style={{
                    fontSize: '10px',
                    fontWeight: 600,
                    color: '#D5FE61',
                    letterSpacing: '0px',
                    textTransform: 'uppercase',
                    marginBottom: '3px',
                  }}>
                    Результат
                  </div>
                  <h2 style={{
                    fontFamily: "var(--font-unbounded), 'Unbounded', -apple-system, BlinkMacSystemFont, sans-serif",
                    fontSize: '15px',
                    lineHeight: 1.15,
                    fontWeight: 600,
                    margin: '0 0 4px',
                  }}>
                    Уход без сомнений
                  </h2>
                  <p style={{
                    fontSize: '11px',
                    lineHeight: 1.4,
                    color: 'rgba(255,255,255,0.65)',
                    margin: 0,
                  }}>
                    Каждое средство на своём месте. Работает в комплекте, а не по отдельности.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <FixedContinueButton
            ctaText={screen.ctaText}
            onClick={handleNext}
            disabled={isHandlingNext}
            loadingText="Продолжить"
            maxWidth={420}
          />
        </div>
      </>
    );
  }

  // Экран сравнения simple_care — полноэкранный редизайн с карточками
  if (isComparisonScreen && screen.id === 'simple_care') {
    const content = screen.content as {
      left: { title: string; items: string[] };
      right: { title: string; items: string[] };
    };

    const glassCard: React.CSSProperties = {
      flex: 1,
      minWidth: 0,
      backgroundColor: 'rgba(255, 255, 255, 0.45)',
      backdropFilter: 'blur(24px)',
      WebkitBackdropFilter: 'blur(24px)',
      border: '1px solid rgba(255, 255, 255, 0.55)',
      borderRadius: '22px',
      paddingTop: '44px',
      paddingBottom: '28px',
      paddingLeft: '14px',
      paddingRight: '14px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      boxShadow: '0 8px 32px rgba(0,0,0,0.07)',
      wordBreak: 'break-word',
    };

    const renderCard = (
      side: { title: string; items: string[] },
      iconBg: string,
      icon: React.ReactNode,
    ) => (
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div style={{
          width: '52px', height: '52px', borderRadius: '50%',
          backgroundColor: iconBg, display: 'flex', alignItems: 'center',
          justifyContent: 'center', zIndex: 1, flexShrink: 0,
          marginBottom: '-26px', boxShadow: '0 2px 8px rgba(0,0,0,0.10)',
        }}>
          {icon}
        </div>
        <div style={glassCard}>
          <p style={{
            fontFamily: "var(--font-unbounded), 'Unbounded', -apple-system, sans-serif",
            fontWeight: 700, fontSize: 'clamp(12px, 3.5vw, 15px)', lineHeight: '1.3',
            textAlign: 'center', color: '#000', margin: '0 0 clamp(14px, 4vw, 20px) 0',
          }}>{side.title}</p>
          {side.items.map((item, i) => (
            <p key={i} style={{
              fontFamily: "var(--font-inter), 'Inter', -apple-system, sans-serif",
              fontSize: 'clamp(12px, 3.3vw, 14px)', lineHeight: '1.45',
              textAlign: 'center', color: '#333',
              margin: i < side.items.length - 1 ? '0 0 clamp(10px, 3.5vw, 16px) 0' : '0',
            }}>{item}</p>
          ))}
        </div>
      </div>
    );

    return (
      <>
        {backButton}
        <div style={{ minHeight: '100vh', position: 'relative', overflow: 'hidden', background: '#f5f0eb' }}>
          {screen.image && (
            <Image src={screen.image} alt="" fill style={{ objectFit: 'cover', objectPosition: 'center' }} priority />
          )}
          <div style={{ position: 'relative', zIndex: 1, maxWidth: '480px', margin: '0 auto', padding: 'clamp(80px, 25vw, 120px) clamp(16px, 5vw, 24px) clamp(100px, 25vw, 130px)' }}>
            <h1 style={{
              fontFamily: "var(--font-unbounded), 'Unbounded', -apple-system, BlinkMacSystemFont, sans-serif",
              fontWeight: 700, fontSize: 'clamp(20px, 6vw, 28px)', lineHeight: '1.25',
              color: '#000000', margin: '0 0 clamp(32px, 10vw, 52px) 0',
            }}>
              SkinIQ делает уход за&nbsp;кожей простым и&nbsp;понятным
            </h1>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'stretch' }}>
              {renderCard(content?.left, '#f0f0f0',
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="#555" strokeWidth="1.8" strokeLinecap="round"><line x1="4" y1="4" x2="14" y2="14"/><line x1="14" y1="4" x2="4" y2="14"/></svg>
              )}
              {renderCard(content?.right, '#D5FE61',
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="#000" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="3,9 7,13 15,5"/></svg>
              )}
            </div>
          </div>
          <FixedContinueButton ctaText={screen.ctaText} onClick={handleNext} disabled={isHandlingNext} loadingText="Продолжить" />
        </div>
      </>
    );
  }

  // Экран "SkinIQ заботится о вашем здоровье" (health_trust)
  if (screen.id === 'health_trust') {
    const cards = [
      {
        icon: (
          <svg width="36" height="36" viewBox="0 0 36 36" fill="none" stroke="#555" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 3 L30 8 L30 18 C30 25 24 30 18 33 C12 30 6 25 6 18 L6 8 Z"/>
            <polyline points="13,18 16,21 23,14"/>
          </svg>
        ),
        title: 'Безопасность',
        desc: 'Все рекомендации по уходу одобрены врачами дерматологами и абсолютно безопасны',
      },
      {
        icon: (
          <svg width="36" height="36" viewBox="0 0 36 36" fill="none" stroke="#555" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <rect x="8" y="16" width="20" height="16" rx="3"/>
            <path d="M12 16 L12 11 C12 7.7 14.7 5 18 5 C21.3 5 24 7.7 24 11 L24 16"/>
            <circle cx="18" cy="24" r="2" fill="#555" stroke="none"/>
          </svg>
        ),
        title: 'Конфиденциальность',
        desc: 'Вся информация остается конфиденциальной и используется только для персональных рекомендаций',
      },
    ];

    return (
      <>
        {backButton}
        <div style={{ minHeight: '100vh', position: 'relative', overflow: 'hidden', background: '#f5f0eb' }}>
          {screen.image && (
            <Image src={screen.image} alt="" fill style={{ objectFit: 'cover', objectPosition: 'center top' }} priority />
          )}
          <div style={{
            position: 'relative', zIndex: 1, maxWidth: '480px', margin: '0 auto', width: '100%',
            padding: 'clamp(80px, 25vw, 120px) clamp(16px, 5vw, 24px) 0',
            display: 'flex', flexDirection: 'column', minHeight: '100vh', boxSizing: 'border-box',
          }}>
            <h1 style={{
              fontFamily: "var(--font-unbounded), 'Unbounded', -apple-system, BlinkMacSystemFont, sans-serif",
              fontWeight: 700, fontSize: 'clamp(20px, 6vw, 28px)', lineHeight: '1.25',
              color: '#000000', margin: '0', maxWidth: 'min(200px, 55%)', whiteSpace: 'pre-line',
            }}>
              {screen.title}
            </h1>
            <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '12px', paddingBottom: '96px' }}>
              {cards.map((card, i) => (
                <div key={i} style={{
                  background: 'rgba(255,255,255,0.55)', backdropFilter: 'blur(24px)',
                  WebkitBackdropFilter: 'blur(24px)', border: '1px solid rgba(255,255,255,0.6)',
                  borderRadius: '20px', padding: '20px 20px 20px 16px',
                  display: 'flex', alignItems: 'flex-start', gap: '16px',
                  boxShadow: '0 8px 32px rgba(0,0,0,0.06)',
                }}>
                  <div style={{ width: '44px', height: '44px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {card.icon}
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontFamily: "var(--font-inter), 'Inter', -apple-system, sans-serif", fontWeight: 600, fontSize: 'clamp(13px, 3.8vw, 16px)', color: '#000', margin: '0 0 6px 0', lineHeight: '1.3' }}>{card.title}</p>
                    <p style={{ fontFamily: "var(--font-inter), 'Inter', -apple-system, sans-serif", fontSize: 'clamp(11px, 3.2vw, 14px)', lineHeight: '1.5', color: '#444', margin: '0' }}>{card.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <FixedContinueButton ctaText={screen.ctaText} onClick={handleNext} disabled={isHandlingNext} loadingText="Продолжить" />
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
        background: '#FFFFFF',
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
