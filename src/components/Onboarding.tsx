import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  icon: string;
  image?: string;
  action?: {
    label: string;
    path: string;
  };
}

const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: 'welcome',
    title: 'Добро пожаловать в SkinIQ! 👋',
    description: 'Персональный ИИ-помощник по уходу за кожей. Пройдите анкету → загрузите фото → получите план ухода.',
    icon: '✨',
    image: 'skin-model'
  },
  {
    id: 'process',
    title: 'ИИ анализ за 3 шага 🔬',
    description: '📋 Анкета (2 мин) → 📸 Фото анализ (ИИ найдет зоны) → 📅 Персональный план (28 дней)',
    icon: '🎯',
    image: 'process-flow'
  },
  {
    id: 'premium',
    title: 'Премиум за 199₽ 💎',
    description: '🆓 Базовый план бесплатно\n💰 Премиум: детальное расписание + PDF отчеты + полный анализ',
    icon: '🔓',
    image: 'premium-features',
    action: {
      label: 'Начать анкету',
      path: '/quiz'
    }
  }
];

interface OnboardingProps {
  onComplete: () => void;
  onSkip: () => void;
}

// Glassmorphism стили
const glass = "bg-white/20 backdrop-blur-xl border border-white/40 shadow-[0_8px_24px_rgba(0,0,0,0.08)]";
const radiusPanel = "rounded-3xl";
const radiusCard = "rounded-2xl";

export default function Onboarding({ onComplete, onSkip }: OnboardingProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isVisible, setIsVisible] = useState(true);
  const navigate = useNavigate();

  const step = ONBOARDING_STEPS[currentStep];
  const isLastStep = currentStep === ONBOARDING_STEPS.length - 1;

  const nextStep = () => {
    if (isLastStep) {
      handleComplete();
    } else {
      setCurrentStep(prev => prev + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleComplete = () => {
    setIsVisible(false);
    setTimeout(() => {
      onComplete();
    }, 300);
  };

  const handleSkip = () => {
    setIsVisible(false);
    setTimeout(() => {
      onSkip();
    }, 300);
  };

  const handleAction = () => {
    if (step.action) {
      handleComplete();
      navigate(step.action.path);
    }
  };

  if (!isVisible) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Background with floating spheres */}
      <div 
        className="absolute inset-0 -z-10"
        style={{
          backgroundImage: "url('/bg/spheres-day-light.jpg')",
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat"
        }}
      />

      {/* Main content */}
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className={`${glass} ${radiusPanel} max-w-md w-full mx-auto shadow-2xl transform transition-all duration-300 ${
          isVisible ? 'scale-100 opacity-100' : 'scale-95 opacity-0'
        }`}>
          {/* Header with progress */}
          <div className="p-6 pb-4">
            <div className="flex justify-between items-center mb-4">
              <span className="text-sm text-neutral-600 font-medium">
                {currentStep + 1} из {ONBOARDING_STEPS.length}
              </span>
              <button 
                onClick={handleSkip}
                className="text-sm text-neutral-600 hover:text-neutral-800 transition-colors font-medium"
              >
                Пропустить
              </button>
            </div>
            
            {/* Progress bar */}
            <div className={`${glass} ${radiusCard} h-2 mb-6`}>
              <div 
                className="h-2 rounded-full transition-all duration-500"
                style={{ 
                  width: `${((currentStep + 1) / ONBOARDING_STEPS.length) * 100}%`,
                  background: "linear-gradient(90deg, #FFC6D9, #E9C987)"
                }}
              />
            </div>
          </div>

          {/* Content */}
          <div className="px-6 pb-6">
            {/* Icon and image */}
            <div className="text-center mb-6">
              {step.image === 'skin-model' ? (
                <div className="w-32 h-32 mx-auto mb-4 rounded-full overflow-hidden relative shadow-2xl border-4 border-white/60">
                  <img 
                    src="/photo_2025-09-04 12.37.36.jpeg"
                    alt="Красивая кожа"
                    className="w-full h-full object-cover"
                    style={{
                      filter: 'brightness(1.05) contrast(1.02) saturate(1.1)'
                    }}
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.style.display = 'none';
                      const parent = target.parentElement;
                      if (parent) {
                        parent.style.background = `
                          radial-gradient(ellipse at 40% 20%, rgba(255, 235, 210, 1) 0%, rgba(255, 220, 190, 0.9) 30%, transparent 65%),
                          radial-gradient(ellipse at 65% 30%, rgba(250, 215, 180, 0.95) 0%, rgba(245, 200, 165, 0.85) 35%, transparent 60%),
                          linear-gradient(140deg, #FFEEE6 0%, #FFE4D6 12%, #FFDCC7 25%, #F5C99B 40%, #E8B887 55%, #D4A574 70%, #C19660 85%, #B08A55 100%)
                        `;
                      }
                    }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-br from-violet-100/10 to-amber-100/10 mix-blend-soft-light"></div>
                </div>
              ) : step.image === 'process-flow' ? (
                <div className={`w-32 h-20 mx-auto mb-4 ${radiusCard} overflow-hidden relative shadow-lg border-2 border-white/60 bg-white/40 backdrop-blur-sm`}>
                  <div className="flex items-center justify-center h-full gap-1">
                    <div className="flex items-center gap-1">
                      <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center text-white text-sm font-bold shadow-lg">📋</div>
                      <div className="text-neutral-500">→</div>
                      <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-purple-600 rounded-full flex items-center justify-center text-white text-sm font-bold shadow-lg">📸</div>
                      <div className="text-neutral-500">→</div>
                      <div className="w-8 h-8 bg-gradient-to-br from-green-500 to-green-600 rounded-full flex items-center justify-center text-white text-sm font-bold shadow-lg">📅</div>
                    </div>
                  </div>
                </div>
              ) : step.image === 'premium-features' ? (
                <div className={`w-32 h-20 mx-auto mb-4 ${radiusCard} overflow-hidden relative shadow-lg border-2 border-white/60 bg-white/40 backdrop-blur-sm`}>
                  <div className="flex items-center justify-center h-full gap-2">
                    <div className="text-2xl">🆓</div>
                    <div className="text-neutral-500">+</div>
                    <div className="text-2xl">💰</div>
                    <div className="text-neutral-500">=</div>
                    <div className="text-2xl">💎</div>
                  </div>
                </div>
              ) : (
                <div className="flex justify-center items-center gap-4 mb-4">
                  <div className="text-4xl">{step.icon}</div>
                  {step.image && step.image !== 'skin-model' && (
                    <div className="text-4xl opacity-70">{step.image}</div>
                  )}
                </div>
              )}
              
              <h2 className="text-2xl font-bold mb-3 text-neutral-900">
                {step.title}
              </h2>
              <div className="text-neutral-700 leading-relaxed text-[15px]">
                {step.description.split('\n').map((line, idx) => (
                  <p key={idx} className={idx > 0 ? 'mt-2' : ''}>
                    {line}
                  </p>
                ))}
              </div>
            </div>

            {/* Buttons */}
            <div className="flex gap-3">
              {currentStep > 0 && (
                <button
                  onClick={prevStep}
                  className={`flex-1 h-12 ${radiusCard} ${glass} text-neutral-700 font-bold text-[15px] transition-all duration-200 hover:bg-white/30`}
                >
                  Назад
                </button>
              )}
              
              {step.action ? (
                <button
                  onClick={handleAction}
                  className="flex-1 h-12 bg-neutral-900 text-white font-bold text-[15px] transition-all duration-200 hover:bg-neutral-800 rounded-2xl shadow-lg"
                >
                  {step.action.label}
                </button>
              ) : (
                <button
                  onClick={nextStep}
                  className="flex-1 h-12 bg-neutral-900 text-white font-bold text-[15px] transition-all duration-200 hover:bg-neutral-800 rounded-2xl shadow-lg"
                >
                  {isLastStep ? 'Начать' : 'Далее'}
                </button>
              )}
            </div>

            {/* Page indicators */}
            <div className="flex justify-center gap-2 mt-6">
              {ONBOARDING_STEPS.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setCurrentStep(idx)}
                  className={`h-2 rounded-full transition-all duration-300 ${
                    idx === currentStep 
                      ? 'bg-neutral-900 w-6' 
                      : idx < currentStep 
                        ? 'bg-neutral-600 w-4' 
                        : 'bg-white/60 w-2'
                  }`}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}

// Хук для управления онбордингом
export const useOnboarding = () => {
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    const hasSeenOnboarding = localStorage.getItem('skiniq_onboarding_completed');
    if (!hasSeenOnboarding) {
      setShowOnboarding(true);
    }
  }, []);

  const completeOnboarding = () => {
    localStorage.setItem('skiniq_onboarding_completed', 'true');
    setShowOnboarding(false);
  };

  const skipOnboarding = () => {
    localStorage.setItem('skiniq_onboarding_completed', 'true');
    setShowOnboarding(false);
  };

  const resetOnboarding = () => {
    localStorage.removeItem('skiniq_onboarding_completed');
    setShowOnboarding(true);
  };

  return {
    showOnboarding,
    completeOnboarding,
    skipOnboarding,
    resetOnboarding
  };
};