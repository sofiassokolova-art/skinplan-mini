// components/quiz/InfoScreenView.tsx
// Компонент для рендеринга информационных экранов анкеты
// Вынесено из quiz/page.tsx для улучшения читаемости

import React from 'react';
import { WelcomeScreen, HowItWorksScreen, PersonalAnalysisScreen } from './screens';
import { FixedContinueButton, TinderButtons } from './buttons';
import { TestimonialsCarousel, ProductsGrid } from './content';
import { getNextInfoScreenAfterScreen } from '@/app/(miniapp)/quiz/info-screens';
import type { InfoScreen } from '@/app/(miniapp)/quiz/info-screens';
import type { Questionnaire } from '@/lib/quiz/types';

export interface InfoScreenViewProps {
  screen: InfoScreen;
  questionnaire: Questionnaire | null;
  currentInfoScreenIndex: number;
  isSubmitting: boolean;
  isSubmittingRef: React.MutableRefObject<boolean>;
  error: string | null;
  isDev: boolean;
  isHandlingNext: boolean;
  onContinue: () => void;
  onBack?: () => void;
  onSubmit?: () => Promise<void>;
  setIsSubmitting: React.Dispatch<React.SetStateAction<boolean>>;
  setError: React.Dispatch<React.SetStateAction<string | null>>;
  setLoading: React.Dispatch<React.SetStateAction<boolean>>;
}

export function InfoScreenView({
  screen,
  questionnaire,
  currentInfoScreenIndex,
  isSubmitting,
  isSubmittingRef,
  error,
  isDev,
  isHandlingNext,
  onContinue,
  onBack,
  onSubmit,
  setIsSubmitting,
  setError,
  setLoading,
}: InfoScreenViewProps) {
  const isTinderScreen = screen.type === 'tinder';
  const isTestimonialsScreen = screen.type === 'testimonials';
  const isComparisonScreen = screen.type === 'comparison';
  const isProductsScreen = screen.type === 'products';
  const isWelcomeScreen = screen.id === 'welcome';
  const isHowItWorksScreen = screen.id === 'how_it_works';
  const isPersonalAnalysisScreen = screen.id === 'personal_analysis';

  // Используем специализированные компоненты для начальных экранов
  if (isWelcomeScreen) {
    return (
      <WelcomeScreen
        screen={screen}
        onContinue={onContinue}
        isHandlingNext={isHandlingNext}
      />
    );
  }

  if (isHowItWorksScreen) {
    return (
      <HowItWorksScreen
        screen={screen}
        currentInfoScreenIndex={currentInfoScreenIndex}
        onBack={onBack}
        onContinue={onContinue}
      />
    );
  }

  if (isPersonalAnalysisScreen) {
    return (
      <PersonalAnalysisScreen
        screen={screen}
        currentInfoScreenIndex={currentInfoScreenIndex}
        onBack={onBack}
        onContinue={onContinue}
      />
    );
  }

  // Остальные экраны рендерятся здесь
  return (
    <div style={{ 
      padding: '20px',
      paddingBottom: '100px', // Отступ снизу для фиксированной кнопки
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #F5FFFC 0%, #E8FBF7 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
    }}>
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
                display: 'block', // ФИКС: Предотвращает "пиксельную полоску" из-за baseline
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
                display: 'block', // ФИКС: Предотвращает "пиксельную полоску" из-за baseline
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

        {/* Отображение ошибок */}
        {error && (
          <div style={{
            backgroundColor: '#FEE2E2',
            border: '1px solid #FCA5A5',
            borderRadius: '12px',
            padding: '16px',
            marginBottom: '20px',
            textAlign: 'center',
          }}>
            <div style={{
              color: '#DC2626',
              fontWeight: '600',
              marginBottom: '4px',
              fontSize: '14px',
            }}>
              ❌ Ошибка
            </div>
            <div style={{ 
              color: '#991B1B', 
              fontSize: '14px',
              lineHeight: '1.4',
            }}>
              {error || 'Произошла ошибка'}
            </div>
          </div>
        )}

        {/* Testimonials Carousel */}
        {isTestimonialsScreen && screen.content && Array.isArray(screen.content) && (
          <TestimonialsCarousel testimonials={screen.content as any} />
        )}

        {/* Products Grid */}
        {isProductsScreen && screen.content && Array.isArray(screen.content) && (
          <ProductsGrid products={screen.content as any} />
        )}

        {/* Comparison */}
        {isComparisonScreen && (
          <div style={{ marginBottom: '28px' }}>
            {/* Текст уже в subtitle */}
          </div>
        )}

        {/* Кнопки действий */}
        {(() => {
          const isLastInfoScreen = screen.id === 'want_improve';
          const nextInfoScreen = getNextInfoScreenAfterScreen(screen.id);
          
          // Для последнего tinder-экрана кнопки обрабатываются отдельно
          if (isLastInfoScreen && !nextInfoScreen && !isTinderScreen && onSubmit) {
            return (
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (isSubmitting) return;
                  onSubmit().catch((err) => {
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

          // Tinder Buttons
          if (isTinderScreen && onSubmit) {
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
                submitAnswers={onSubmit}
                handleNext={onContinue}
              />
            );
          }

          return null;
        })()}
      </div>
      
      {/* Фиксированная кнопка "Продолжить" внизу экрана */}
      {screen.ctaText && !isTinderScreen && (
        <FixedContinueButton
          ctaText={screen.ctaText}
          onClick={onContinue}
          disabled={isHandlingNext}
          loadingText="Загрузка..."
        />
      )}
    </div>
  );
}

