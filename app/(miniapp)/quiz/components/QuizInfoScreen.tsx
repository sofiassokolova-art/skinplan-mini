// app/(miniapp)/quiz/components/QuizInfoScreen.tsx
// Компонент для рендеринга инфо-экрана анкеты
// Вынесен из page.tsx для упрощения основного компонента

'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { BackButtonFixed } from '@/components/BackButtonFixed';
import { ButtonSkeleton, SkeletonLoader } from '@/components/ui/SkeletonLoader';
import type { Questionnaire } from '@/lib/quiz/types';
import type { InfoScreen } from '../info-screens';
import { getNextInfoScreenAfterScreen } from '../info-screens';
import { extractQuestionsFromQuestionnaire } from '@/lib/quiz/extractQuestions';
import { WelcomeScreen, PersonalAnalysisScreen, HowItWorksScreen, NoMistakesScreen, RecognizeYourselfScreen, ImproveSkinScreen, AiComparisonScreen } from '@/components/quiz/screens';
import { FixedContinueButton, TinderButtons } from '@/components/quiz/buttons';
import { TestimonialsCarousel, ProductsGrid } from '@/components/quiz/content';
import { clientLogger } from '@/lib/client-logger';
import { getInitialInfoScreens } from '../info-screens';
import { QuizErrorDisplay } from './QuizErrorDisplay';
import { preloadQuizImages } from '../image-assets';

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
          <SkeletonLoader variant="rectangular" width="72%" height="72%" borderRadius="12px" />
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
    
    preloadQuizImages([nextScreen1?.image, nextScreen2?.image].filter(Boolean) as string[]);
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
        backgroundColor: 'var(--canvas)',
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

  // ФИКС #1: редизайненный экран no_mistakes "Вы уже сделали главное".
  // Фон из back-картинок + лаймовые угловые акценты + стеклянная карточка с чек-листом
  // (в стиле PersonalAnalysisScreen / HowItWorks), вместо старого монолитного рендера.
  if (screen.id === 'no_mistakes') {
    return (
      <NoMistakesScreen
        screen={screen}
        currentInfoScreenIndex={currentInfoScreenIndex}
        onContinue={handleNext}
        onBack={handleBack}
        isHandlingNext={isHandlingNext}
      />
    );
  }

  // ФИКС #3: редизайн tinder-экранов recognize_yourself_1/2.
  // Полноэкранная картинка + затемнённый стеклянный нижний контейнер с вопросом
  // и кнопками Нет/Да (оба варианта ведут handleNext, commitment-device).
  if (screen.id === 'recognize_yourself_1' || screen.id === 'recognize_yourself_2') {
    return (
      <RecognizeYourselfScreen
        screen={screen}
        currentInfoScreenIndex={currentInfoScreenIndex}
        onChoose={handleNext}
        onBack={handleBack}
        isHandlingNext={isHandlingNext}
      />
    );
  }

  // ФИКС #2: редизайн экрана ai_comparison ("Больше никакой путаницы").
  // Показывается после oral_medications, перед makeup_frequency (вопрос про
  // декоративную косметику) — это и есть нужная позиция по логике приложения.
  if (screen.id === 'ai_comparison') {
    return (
      <AiComparisonScreen
        screen={screen}
        currentInfoScreenIndex={currentInfoScreenIndex}
        onContinue={handleNext}
        onBack={handleBack}
        isHandlingNext={isHandlingNext}
      />
    );
  }

  // ФИКС #5: финальный объединённый экран want_improve (раньше шёл после
  // отдельного skin_transformation, теперь сразу после recognize_yourself_2).
  // Совмещает transformation-визуал и CTA "Получить план ухода" — запускает
  // submitAnswers (генерация плана) через handleGetPlan.
  if (screen.id === 'want_improve') {
    return (
      <ImproveSkinScreen
        screen={screen}
        currentInfoScreenIndex={currentInfoScreenIndex}
        onBack={handleBack}
        isSubmitting={isSubmitting}
        questionnaire={questionnaire}
        isDev={isDev}
        isSubmittingRef={isSubmittingRef}
        setIsSubmitting={setIsSubmitting}
        setError={setError}
        setLoading={setLoading}
        submitAnswers={submitAnswers}
        error={error}
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
    const skinPreviewBackgroundImage = '/back1.jpg';

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
    // Первую букву строки делаем заглавной (значение «Главный фокус» начинается с большой буквы).
    const concernsList = Array.isArray(concernsRaw)
      ? (() => {
          const joined = concernsRaw.slice(0, 2).map(c => c.toLowerCase()).join(' · ');
          return joined ? joined.charAt(0).toUpperCase() + joined.slice(1) : null;
        })()
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
          background: `linear-gradient(rgba(244,242,238,0.45), rgba(244,242,238,0.65)), url(${skinPreviewBackgroundImage}) center / cover no-repeat fixed, var(--canvas)`,
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
              color: '#666666',
              margin: 0,
            }}>
              На основе ваших ответов мы уже понимаем, как должен выглядеть ваш уход.
            </p>

            {/* Карточка с резюме ответов — glassmorphism в стиле приложения */}
            <div style={{
              background: 'rgba(255, 255, 255, 0.55)',
              backdropFilter: 'blur(20px) saturate(180%)',
              WebkitBackdropFilter: 'blur(20px) saturate(180%)',
              border: '1px solid rgba(255, 255, 255, 0.70)',
              boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.06), inset 0 1px 0 0 rgba(255, 255, 255, 0.5)',
              borderRadius: '20px',
              padding: '20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
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
          background: 'var(--canvas)',
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
        <div className="qz-mobile-fullscreen" style={{ position: 'relative', overflow: 'hidden', background: 'var(--canvas)' }}>
          {screen.image && (
            <Image
              className="qz-fullscreen-bg"
              src={screen.image}
              alt=""
              fill
              priority
              quality={95}
              sizes="100vw"
              style={{ objectPosition: 'center' }}
            />
          )}
          <div style={{
            position: 'relative',
            zIndex: 1,
            maxWidth: '480px',
            height: '100%',
            margin: '0 auto',
            padding: 'clamp(72px, 18vh, 112px) clamp(16px, 5vw, 24px) var(--quiz-fixed-cta-clearance, calc(96px + env(safe-area-inset-bottom, 0px)))',
            boxSizing: 'border-box',
            overflowY: 'auto',
            WebkitOverflowScrolling: 'touch',
          }}>
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
        <div className="qz-mobile-fullscreen" style={{ position: 'relative', overflow: 'hidden', background: 'var(--canvas)' }}>
          {screen.image && (
            <Image
              className="qz-fullscreen-bg"
              src={screen.image}
              alt=""
              fill
              priority
              quality={95}
              sizes="100vw"
              style={{ objectPosition: 'center top' }}
            />
          )}
          <div style={{
            position: 'relative', zIndex: 1, maxWidth: '480px', margin: '0 auto', width: '100%',
            padding: 'clamp(80px, 25vw, 120px) clamp(16px, 5vw, 24px) 0',
            display: 'flex', flexDirection: 'column', height: '100%', boxSizing: 'border-box',
            overflowY: 'auto', WebkitOverflowScrolling: 'touch',
          }}>
            <h1 style={{
              fontFamily: "var(--font-unbounded), 'Unbounded', -apple-system, BlinkMacSystemFont, sans-serif",
              fontWeight: 700, fontSize: 'clamp(20px, 6vw, 28px)', lineHeight: '1.25',
              color: '#000000', margin: '0', maxWidth: 'min(200px, 55%)', whiteSpace: 'pre-line',
            }}>
              {screen.title}
            </h1>
            <div style={{
              marginTop: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              paddingBottom: 'calc(clamp(24px, 5vh, 60px) + 72px)',
            }}>
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
        background: 'var(--canvas)',
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
            background: 'var(--canvas)',
          }}>
            <Image
              src={screen.image}
              alt={screen.title}
              width={1200}
              height={isTinderScreen ? 400 : 320}
              quality={95}
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
                {isSubmitting ? <ButtonSkeleton light /> : 'Получить план →'}
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
