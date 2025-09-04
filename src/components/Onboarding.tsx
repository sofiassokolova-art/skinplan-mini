import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  icon: string;
  image?: string; // SVG или эмодзи для визуализации
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
    image: 'skin-model' // Используем специальное изображение
  },
  {
    id: 'process',
    title: 'ИИ анализ за 3 шага 🔬',
    description: '📋 Анкета (2 мин) → 📸 Фото анализ (ИИ найдет зоны) → 📅 Персональный план (28 дней)',
    icon: '🎯',
    image: '🔍'
  },
  {
    id: 'premium',
    title: 'Премиум за 199₽ 💎',
    description: '🆓 Базовый план бесплатно\n💰 Премиум: детальное расписание + PDF отчеты + полный анализ',
    icon: '🔓',
    image: '💳',
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
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className={`bg-white rounded-3xl max-w-md w-full mx-auto shadow-2xl transform transition-all duration-300 ${
        isVisible ? 'scale-100 opacity-100' : 'scale-95 opacity-0'
      }`}>
        {/* Прогресс */}
        <div className="px-6 pt-6">
          <div className="flex justify-between items-center mb-4">
            <span className="text-sm text-gray-500">
              {currentStep + 1} из {ONBOARDING_STEPS.length}
            </span>
            <button 
              onClick={handleSkip}
              className="text-sm text-gray-500 hover:text-gray-700 transition"
            >
              Пропустить
            </button>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2 mb-6">
            <div 
              className="bg-gradient-to-r from-indigo-500 to-purple-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${((currentStep + 1) / ONBOARDING_STEPS.length) * 100}%` }}
            />
          </div>
        </div>

        {/* Контент */}
        <div className="px-6 pb-6">
          {/* Иконка и изображение */}
          <div className="text-center mb-6">
            {step.image === 'skin-model' ? (
              <div className="w-32 h-32 mx-auto mb-4 rounded-full overflow-hidden relative shadow-2xl border-4 border-white">
                <div 
                  className="w-full h-full rounded-full relative"
                  style={{
                    background: `
                      radial-gradient(circle at 40% 30%, rgba(255, 228, 196, 1) 0%, rgba(255, 218, 185, 0.8) 30%),
                      radial-gradient(circle at 60% 40%, rgba(250, 214, 165, 0.9) 0%, transparent 40%),
                      radial-gradient(circle at 30% 70%, rgba(245, 198, 160, 0.8) 0%, transparent 35%),
                      linear-gradient(145deg, #FFDAB9 0%, #F5C6A0 25%, #E6A875 50%, #D2B48C 75%, #DEB887 100%)
                    `,
                    boxShadow: 'inset 0 4px 12px rgba(0,0,0,0.15), inset 0 -2px 6px rgba(255,255,255,0.2)'
                  }}
                >
                  {/* Текстура кожи */}
                  <div className="absolute top-3 left-4 w-1.5 h-1.5 bg-white/20 rounded-full blur-[0.5px]"></div>
                  <div className="absolute top-6 right-5 w-1 h-1 bg-white/15 rounded-full"></div>
                  <div className="absolute bottom-4 left-1/3 w-2 h-1 bg-rose-300/30 rounded-full blur-[0.5px]"></div>
                  <div className="absolute top-1/2 right-3 w-0.5 h-0.5 bg-white/25 rounded-full"></div>
                  
                  {/* Блики как на настоящей коже */}
                  <div className="absolute top-4 left-6 w-3 h-2 bg-white/10 rounded-full blur-sm transform rotate-12"></div>
                  <div className="absolute bottom-6 right-6 w-2 h-3 bg-white/8 rounded-full blur-sm transform -rotate-12"></div>
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
            <h2 className="text-2xl font-bold mb-3 text-gray-900">
              {step.title}
            </h2>
            <div className="text-gray-600 leading-relaxed">
              {step.description.split('\n').map((line, idx) => (
                <p key={idx} className={idx > 0 ? 'mt-2' : ''}>
                  {line}
                </p>
              ))}
            </div>
          </div>

          {/* Кнопки */}
          <div className="flex gap-3">
            {currentStep > 0 && (
              <button
                onClick={prevStep}
                className="flex-1 px-4 py-3 rounded-full border border-gray-300 text-gray-700 hover:bg-gray-50 transition"
              >
                Назад
              </button>
            )}
            
            {step.action ? (
              <button
                onClick={handleAction}
                className="flex-1 px-4 py-3 rounded-full bg-gradient-to-r from-indigo-500 to-purple-600 text-white hover:opacity-90 transition"
              >
                {step.action.label}
              </button>
            ) : (
              <button
                onClick={nextStep}
                className="flex-1 px-4 py-3 rounded-full bg-gradient-to-r from-indigo-500 to-purple-600 text-white hover:opacity-90 transition"
              >
                {isLastStep ? 'Начать' : 'Далее'}
              </button>
            )}
          </div>

          {/* Индикаторы */}
          <div className="flex justify-center gap-2 mt-6">
            {ONBOARDING_STEPS.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentStep(idx)}
                className={`w-2 h-2 rounded-full transition-all ${
                  idx === currentStep 
                    ? 'bg-indigo-500 w-6' 
                    : idx < currentStep 
                      ? 'bg-indigo-300' 
                      : 'bg-gray-300'
                }`}
              />
            ))}
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