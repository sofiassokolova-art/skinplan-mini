import { Link } from "react-router-dom";
import { useState, useEffect } from "react";

// Компонент кольцевого прогресса
function CircularProgress({ percentage, size = 76 }: { percentage: number; size?: number }) {
  const [animatedPercentage, setAnimatedPercentage] = useState(0);
  
  useEffect(() => {
    const timer = setTimeout(() => {
      setAnimatedPercentage(percentage);
    }, 100);
    return () => clearTimeout(timer);
  }, [percentage]);

  const strokeWidth = 6;
  const radius = 32;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - animatedPercentage / 100);

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg
        width={size}
        height={size}
        className="transform -rotate-90"
      >
        {/* Фоновый круг */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#E5E5E5"
          strokeWidth={strokeWidth}
          fill="none"
        />
        {/* Прогресс круг с градиентом */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="url(#progressGradient)"
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          style={{
            transition: 'stroke-dashoffset 0.5s ease-in-out'
          }}
        />
        <defs>
          <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#EC4899" />
            <stop offset="100%" stopColor="#8B5CF6" />
          </linearGradient>
        </defs>
      </svg>
      {/* Текст в центре */}
      <div 
        className="absolute inset-0 flex items-center justify-center"
        style={{
          fontFamily: 'Inter, sans-serif',
          fontSize: '16px',
          fontWeight: 600,
          color: '#1E1E1E'
        }}
      >
        {animatedPercentage}%
      </div>
    </div>
  );
}

export default function Home() {
  const [activeSegment, setActiveSegment] = useState<'morning' | 'evening'>('morning');
  const [completedSteps, setCompletedSteps] = useState<Set<string>>(new Set());

  const toggleStepCompleted = (stepId: string) => {
    setCompletedSteps(prev => {
      const newSet = new Set(prev);
      if (newSet.has(stepId)) {
        newSet.delete(stepId);
      } else {
        newSet.add(stepId);
      }
      return newSet;
    });
  };

  const steps = [
    { id: 'cleanser', name: 'Очищение кожи', icon: '🧴' },
    { id: 'antioxidants', name: 'Антиоксиданты', icon: '✨' },
    { id: 'moisturizer', name: 'Увлажнение', icon: '💧' },
    { id: 'eye_cream', name: 'Крем для глаз', icon: '👁️' }
  ];

  const completedCount = completedSteps.size;

  return (
    <div 
      className="min-h-screen relative overflow-hidden"
      style={{
        background: 'linear-gradient(135deg, #FDECF4 0%, #F6F9FF 100%)'
      }}
    >
      
      {/* Кастомные стили */}
      <style dangerouslySetInnerHTML={{__html: `
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
        
        .glass-card {
          background: rgba(255, 255, 255, 0.7);
          backdrop-filter: blur(12px);
          border-radius: 28px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.1);
          transition: all 0.3s ease;
        }
        
        .glass-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 24px rgba(0,0,0,0.15);
        }
        
        .step-icon {
          width: 40px;
          height: 40px;
          border-radius: 20px;
          background: rgba(255, 255, 255, 0.8);
          backdrop-filter: blur(8px);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 18px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }
        
        .gradient-text {
          background: linear-gradient(135deg, #EC4899, #8B5CF6);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        
        .cta-button {
          background: linear-gradient(135deg, #EC4899, #8B5CF6);
          border-radius: 28px;
          height: 64px;
          font-weight: 600;
          font-size: 18px;
          color: #FFFFFF;
          border: none;
          cursor: pointer;
          transition: all 0.3s ease;
          box-shadow: 0 8px 24px rgba(236, 72, 153, 0.4);
        }
        
        .cta-button:hover {
          transform: translateY(-2px);
          background: linear-gradient(135deg, #F472B6, #A855F7);
          box-shadow: 0 12px 32px rgba(236, 72, 153, 0.5);
        }
        
        .profile-badge {
          background: rgba(255, 255, 255, 0.8);
          backdrop-filter: blur(12px);
          border-radius: 20px;
          padding: 8px 16px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        }
      `}} />
      
      {/* Основной контент */}
      <div className="relative z-10 px-6 py-8">
        
        {/* Верхняя панель */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-pink-400 to-purple-500 flex items-center justify-center text-white font-semibold">
              Е
            </div>
            <div className="profile-badge">
              <div className="text-sm font-semibold text-gray-800">78%</div>
              <div className="text-xs text-gray-600">Здоровье кожи</div>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="w-8 h-8 rounded-full bg-white/80 backdrop-blur-sm flex items-center justify-center">
              🔔
            </div>
            <div className="w-8 h-8 rounded-full bg-white/80 backdrop-blur-sm flex items-center justify-center">
              ⚏
            </div>
          </div>
        </div>

        {/* Приветствие */}
        <div className="mb-8">
          <h1 className="text-2xl font-medium text-gray-700 mb-2">Привет, Елена</h1>
          <h2 className="text-3xl font-bold gradient-text mb-4">
            Твой план ухода готов.
          </h2>
          <div className="w-12 h-12 rounded-full bg-white/80 backdrop-blur-sm flex items-center justify-center mx-auto">
            <span className="text-2xl">+</span>
          </div>
        </div>

        {/* Основная карточка */}
        <div className="glass-card p-6 mb-8 relative">
          <div className="flex items-center justify-between mb-6">
            <div>
              <div className="text-sm text-gray-500 mb-1">24 дек</div>
              <h3 className="text-xl font-bold text-gray-800">Сегодняшний уход</h3>
            </div>
            <button className="px-4 py-2 bg-white/60 backdrop-blur-sm rounded-full text-sm font-medium text-gray-700">
              Читать план {'>'}
            </button>
          </div>

          {/* Продукт */}
          <div className="relative mb-6">
            <div className="w-16 h-24 bg-gradient-to-b from-green-200 to-green-300 rounded-lg mx-auto relative z-10 flex items-center justify-center">
              <span className="text-green-600 font-bold text-sm">act</span>
            </div>
          </div>

          {/* Нижняя часть карточки */}
          <div className="grid grid-cols-2 gap-6">
            {/* Левая часть - Шаги */}
            <div>
              <div className="text-sm font-semibold text-gray-800 mb-3">{completedCount}/4 Шага</div>
              <div className="grid grid-cols-2 gap-2">
                {steps.map((step) => (
                  <div key={step.id} className="step-icon">
                    {step.icon}
                  </div>
                ))}
              </div>
            </div>

            {/* Правая часть - Прогресс */}
            <div>
              <div className="text-sm font-semibold text-gray-800 mb-3">Здоровье кожи</div>
              <CircularProgress percentage={78} size={76} />
            </div>
          </div>
        </div>

        {/* CTA кнопка */}
        <button className="cta-button w-full flex items-center justify-center gap-3">
          <span>📷</span>
          <span>Начать сканирование</span>
          <span>→</span>
        </button>
      </div>
    </div>
  );
}