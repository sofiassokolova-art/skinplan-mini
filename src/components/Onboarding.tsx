import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  icon: string;
  action?: {
    label: string;
    path: string;
  };
}

const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: 'welcome',
    title: 'Добро пожаловать в SkinPlan! 👋',
    description: 'Персональный помощник по уходу за кожей. Мы создадим индивидуальный план ухода специально для вас.',
    icon: '✨'
  },
  {
    id: 'quiz',
    title: 'Расскажите о своей коже 📝',
    description: 'Пройдите подробную анкету о типе кожи, проблемах и предпочтениях. Это займет всего 3-5 минут.',
    icon: '📋',
    action: {
      label: 'Начать анкету',
      path: '/quiz'
    }
  },
  {
    id: 'photo',
    title: 'AI-анализ кожи 📸',
    description: 'Загрузите фото для детального анализа. Наш ИИ определит 12 показателей и выделит проблемные зоны.',
    icon: '🔬'
  },
  {
    id: 'plan',
    title: 'Персональный план ухода 📋',
    description: 'Получите детальный план с продуктами, расписанием на 28 дней и персональными рекомендациями.',
    icon: '🎯'
  },
  {
    id: 'pdf',
    title: 'Сохраните результат 📄',
    description: 'Скачайте план в PDF формате или добавьте все продукты в корзину для покупки.',
    icon: '💾'
  }
];

interface OnboardingProps {
  onComplete: () => void;
  onSkip: () => void;
  onStartTour?: () => void;
}

export default function Onboarding({ onComplete, onSkip, onStartTour }: OnboardingProps) {
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
          {/* Иконка */}
          <div className="text-center mb-6">
            <div className="text-6xl mb-4">{step.icon}</div>
            <h2 className="text-2xl font-bold mb-3 text-gray-900">
              {step.title}
            </h2>
            <p className="text-gray-600 leading-relaxed">
              {step.description}
            </p>
          </div>

          {/* Кнопки */}
          <div className="space-y-3">
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
            
            {/* Альтернативные действия */}
            {isLastStep && onStartTour && (
              <button
                onClick={() => {
                  handleComplete();
                  onStartTour();
                }}
                className="w-full px-4 py-2 rounded-full border border-indigo-300 text-indigo-600 hover:bg-indigo-50 transition text-sm"
              >
                🎯 Интерактивный тур по интерфейсу
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
    const hasSeenOnboarding = localStorage.getItem('skinplan_onboarding_completed');
    if (!hasSeenOnboarding) {
      setShowOnboarding(true);
    }
  }, []);

  const completeOnboarding = () => {
    localStorage.setItem('skinplan_onboarding_completed', 'true');
    setShowOnboarding(false);
  };

  const skipOnboarding = () => {
    localStorage.setItem('skinplan_onboarding_completed', 'true');
    setShowOnboarding(false);
  };

  const resetOnboarding = () => {
    localStorage.removeItem('skinplan_onboarding_completed');
    setShowOnboarding(true);
  };

  return {
    showOnboarding,
    completeOnboarding,
    skipOnboarding,
    resetOnboarding
  };
};