import { useState, useEffect } from 'react';

interface TourStep {
  target: string;
  title: string;
  description: string;
  position: 'top' | 'bottom' | 'left' | 'right';
}

const TOUR_STEPS: TourStep[] = [
  {
    target: '[href="/quiz"]',
    title: 'Начните с анкеты',
    description: 'Расскажите о своей коже, проблемах и предпочтениях',
    position: 'bottom'
  },
  {
    target: '[href="/plan"]',
    title: 'Получите план ухода',
    description: 'Персональный план с продуктами и расписанием на 28 дней',
    position: 'bottom'
  },
  {
    target: '[href="/cart"]',
    title: 'Сохраните в корзину',
    description: 'Добавьте рекомендованные продукты для покупки',
    position: 'bottom'
  }
];

interface FeatureTourProps {
  isActive: boolean;
  onComplete: () => void;
}

export default function FeatureTour({ isActive, onComplete }: FeatureTourProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [highlightElement, setHighlightElement] = useState<Element | null>(null);

  useEffect(() => {
    if (!isActive) return;

    const step = TOUR_STEPS[currentStep];
    const element = document.querySelector(step.target);
    setHighlightElement(element);

    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [isActive, currentStep]);

  const nextStep = () => {
    if (currentStep < TOUR_STEPS.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      onComplete();
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  if (!isActive || !highlightElement) return null;

  const step = TOUR_STEPS[currentStep];
  const rect = highlightElement.getBoundingClientRect();

  return (
    <>
      {/* Оверлей */}
      <div className="fixed inset-0 bg-black/30 z-40" />
      
      {/* Подсветка элемента */}
      <div 
        className="fixed z-50 border-4 border-indigo-400 rounded-lg shadow-lg"
        style={{
          top: rect.top - 8,
          left: rect.left - 8,
          width: rect.width + 16,
          height: rect.height + 16,
          pointerEvents: 'none'
        }}
      />

      {/* Подсказка */}
      <div 
        className="fixed z-50 bg-white rounded-2xl p-4 shadow-xl max-w-xs"
        style={{
          top: step.position === 'bottom' ? rect.bottom + 16 : rect.top - 100,
          left: Math.max(16, Math.min(window.innerWidth - 320, rect.left + rect.width / 2 - 160))
        }}
      >
        <div className="text-sm font-bold mb-2">{step.title}</div>
        <div className="text-xs text-gray-600 mb-4">{step.description}</div>
        
        <div className="flex justify-between items-center">
          <span className="text-xs text-gray-500">
            {currentStep + 1} из {TOUR_STEPS.length}
          </span>
          <div className="flex gap-2">
            {currentStep > 0 && (
              <button 
                onClick={prevStep}
                className="px-3 py-1 text-xs border rounded-full hover:bg-gray-50"
              >
                Назад
              </button>
            )}
            <button 
              onClick={nextStep}
              className="px-3 py-1 text-xs bg-indigo-600 text-white rounded-full hover:bg-indigo-700"
            >
              {currentStep === TOUR_STEPS.length - 1 ? 'Готово' : 'Далее'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}