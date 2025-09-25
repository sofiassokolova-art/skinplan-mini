import { useState, useEffect } from "react";

// Компонент прогресс-круга
function ProgressCircle({ percentage }: { percentage: number }) {
  const [animatedPercentage, setAnimatedPercentage] = useState(0);
  
  useEffect(() => {
    const timer = setTimeout(() => {
      setAnimatedPercentage(percentage);
    }, 100);
    return () => clearTimeout(timer);
  }, [percentage]);

  const size = 200;
  const strokeWidth = 14;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - animatedPercentage / 100);

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-90">
        {/* Фоновый круг */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="rgba(255,255,255,0.3)"
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
          className="progress-ring"
          style={{
            transition: 'stroke-dashoffset 1.2s ease-in-out',
            filter: 'drop-shadow(0 0 8px rgba(165, 139, 255, 0.4))'
          }}
        />
        <defs>
          <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#A58BFF" />
            <stop offset="100%" stopColor="#6C4BFF" />
          </linearGradient>
        </defs>
      </svg>
      {/* Текст в центре */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="text-2xl font-bold" style={{ color: '#1E1E1E', fontFamily: 'Inter, sans-serif' }}>
          {animatedPercentage}%
        </div>
        <div className="text-sm text-center" style={{ color: '#6B6B6B', fontFamily: 'Inter, sans-serif' }}>
          Осталось 2 шага<br/>3 минуты
        </div>
      </div>
    </div>
  );
}

// Компонент свитчера Утро/Вечер
function TimeSwitcher({ activeSegment, setActiveSegment }: { 
  activeSegment: 'morning' | 'evening', 
  setActiveSegment: (segment: 'morning' | 'evening') => void 
}) {
  return (
    <div className="relative bg-white/40 rounded-full p-1" style={{ width: 140, height: 40 }}>
      <div 
        className="absolute top-1 left-1 bg-white rounded-full transition-transform duration-200 ease-out"
        style={{ 
          width: 66, 
          height: 32,
          transform: activeSegment === 'evening' ? 'translateX(70px)' : 'translateX(0)'
        }}
      />
      <div className="relative flex">
        <button
          onClick={() => setActiveSegment('morning')}
          className="flex-1 text-sm font-medium transition-colors duration-200"
          style={{ 
            color: activeSegment === 'morning' ? '#1E1E1E' : '#6B6B6B',
            fontFamily: 'Inter, sans-serif'
          }}
        >
          Утро
        </button>
        <button
          onClick={() => setActiveSegment('evening')}
          className="flex-1 text-sm font-medium transition-colors duration-200"
          style={{ 
            color: activeSegment === 'evening' ? '#1E1E1E' : '#6B6B6B',
            fontFamily: 'Inter, sans-serif'
          }}
        >
          Вечер
        </button>
      </div>
    </div>
  );
}

// Компонент чекбокса
function CareCheckbox({ checked, onChange }: { checked: boolean, onChange: () => void }) {
  return (
    <button
      onClick={onChange}
      className="w-5 h-5 rounded-full border-2 transition-all duration-200 flex items-center justify-center"
      style={{
        backgroundColor: checked ? '#6C4BFF' : '#FFFFFF',
        borderColor: '#6C4BFF'
      }}
    >
      {checked && (
        <svg 
          className="w-3 h-3 text-white transition-transform duration-200"
          style={{ transform: 'scale(0.8)' }}
          fill="currentColor" 
          viewBox="0 0 20 20"
        >
          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
        </svg>
      )}
    </button>
  );
}

export default function Home() {
  const [activeSegment, setActiveSegment] = useState<'morning' | 'evening'>('morning');
  const [completedSteps, setCompletedSteps] = useState<Set<string>>(new Set(['cleanser']));

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
    { id: 'cleanser', name: 'Очищение кожи' },
    { id: 'antioxidants', name: 'Антиоксиданты' },
    { id: 'moisturizer', name: 'Увлажнение' },
    { id: 'eye_cream', name: 'Крем для глаз' }
  ];

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Анимированный фон */}
      <div className="absolute inset-0 bg-gradient-to-br from-purple-400 via-pink-400 to-blue-400">
        {/* Пятна */}
        <div className="absolute top-10 left-10 w-32 h-32 bg-white/20 rounded-full blur-xl animate-float-1"></div>
        <div className="absolute top-32 right-16 w-24 h-24 bg-red-300/30 rounded-full blur-lg animate-float-2"></div>
        <div className="absolute bottom-32 left-20 w-40 h-40 bg-blue-300/25 rounded-full blur-2xl animate-float-3"></div>
        <div className="absolute bottom-20 right-32 w-28 h-28 bg-pink-300/30 rounded-full blur-xl animate-float-4"></div>
        
        {/* Белые линии */}
        <div className="absolute inset-0 opacity-30">
          <svg className="w-full h-full">
            <defs>
              <pattern id="lines" x="0" y="0" width="100" height="100" patternUnits="userSpaceOnUse">
                <path d="M0,50 Q50,30 100,50 T200,50" stroke="white" strokeWidth="1" fill="none" opacity="0.3"/>
                <path d="M0,80 Q50,60 100,80 T200,80" stroke="white" strokeWidth="1" fill="none" opacity="0.2"/>
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#lines)" className="animate-lines"/>
          </svg>
        </div>
      </div>

      {/* Кастомные стили */}
      <style dangerouslySetInnerHTML={{__html: `
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700&display=swap');
        
        @keyframes float-1 {
          0%, 100% { transform: translate(0, 0) rotate(0deg); }
          25% { transform: translate(10px, -15px) rotate(5deg); }
          50% { transform: translate(-5px, -10px) rotate(-3deg); }
          75% { transform: translate(-10px, 5px) rotate(2deg); }
        }
        
        @keyframes float-2 {
          0%, 100% { transform: translate(0, 0) rotate(0deg); }
          33% { transform: translate(-15px, 10px) rotate(-4deg); }
          66% { transform: translate(8px, -8px) rotate(3deg); }
        }
        
        @keyframes float-3 {
          0%, 100% { transform: translate(0, 0) rotate(0deg); }
          20% { transform: translate(12px, -20px) rotate(6deg); }
          40% { transform: translate(-8px, -5px) rotate(-2deg); }
          60% { transform: translate(-15px, 12px) rotate(4deg); }
          80% { transform: translate(5px, 8px) rotate(-3deg); }
        }
        
        @keyframes float-4 {
          0%, 100% { transform: translate(0, 0) rotate(0deg); }
          30% { transform: translate(-10px, -12px) rotate(-5deg); }
          60% { transform: translate(15px, 8px) rotate(4deg); }
        }
        
        @keyframes lines {
          0% { transform: translateX(0); }
          100% { transform: translateX(100px); }
        }
        
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        
        @keyframes sparkle {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }
        
        .animate-float-1 { animation: float-1 20s ease-in-out infinite; }
        .animate-float-2 { animation: float-2 18s ease-in-out infinite; }
        .animate-float-3 { animation: float-3 22s ease-in-out infinite; }
        .animate-float-4 { animation: float-4 16s ease-in-out infinite; }
        .animate-lines { animation: lines 15s linear infinite; }
        .animate-shimmer { animation: shimmer 8s linear infinite; }
        .animate-sparkle { animation: sparkle 10s ease-in-out infinite; }
        
        .glass-card {
          background: rgba(255, 255, 255, 0.3);
          backdrop-filter: blur(16px);
          border-radius: 16px;
          border: 1px solid rgba(255, 255, 255, 0.2);
        }
        
        .care-card {
          background: #FFFFFF;
          border-radius: 16px;
          height: 56px;
          transition: all 0.3s ease;
        }
        
        .care-card:hover {
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        }
        
        .cta-button {
          background: rgba(255, 255, 255, 0.2);
          backdrop-filter: blur(16px);
          border: 1px solid rgba(255, 255, 255, 0.3);
          border-radius: 16px;
          height: 64px;
          position: relative;
          overflow: hidden;
        }
        
        .cta-button::before {
          content: '';
          position: absolute;
          top: 0;
          left: -100%;
          width: 100%;
          height: 100%;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent);
          animation: shimmer 8s linear infinite;
        }
        
        .cta-button:active {
          transform: scale(0.95);
        }
        
        .icon-circle {
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.9);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
        }
        
        .icon-circle-large {
          width: 24px;
          height: 24px;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.9);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 14px;
        }
      `}} />
      
      {/* Основной контент */}
      <div className="relative z-10 px-6 py-8">
        
        {/* Логотип */}
        <div className="flex justify-center mb-8">
          <div className="text-2xl font-bold" style={{ color: '#1E1E1E', fontFamily: 'Playfair Display, serif' }}>
            SkinIQ
          </div>
        </div>

        {/* Приветствие */}
        <div className="text-center mb-8 animate-sparkle">
          <h1 className="mb-2" style={{ 
            fontSize: '32px', 
            fontWeight: 700, 
            color: '#1E1E1E', 
            fontFamily: 'Playfair Display, serif' 
          }}>
            Привет, Елена! ✨
          </h1>
          <p className="text-base" style={{ 
            color: '#6B6B6B', 
            fontFamily: 'Inter, sans-serif' 
          }}>
            Твой уход на сегодня готов
          </p>
        </div>

        {/* Центральный блок - Прогресс и свитчер */}
        <div className="flex flex-col items-center mb-8">
          <ProgressCircle percentage={65} />
          <div className="mt-6">
            <TimeSwitcher activeSegment={activeSegment} setActiveSegment={setActiveSegment} />
          </div>
        </div>

        {/* Сегодняшний уход */}
        <div className="glass-card p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4" style={{ 
            color: '#1E1E1E', 
            fontFamily: 'Inter, sans-serif' 
          }}>
            Сегодняшний уход
          </h2>
          
          <div className="space-y-3">
            {steps.map((step) => (
              <div key={step.id} className="care-card flex items-center justify-between px-4">
                <span className="text-base font-medium" style={{ 
                  color: '#1E1E1E', 
                  fontFamily: 'Inter, sans-serif' 
                }}>
                  {step.name}
                </span>
                <CareCheckbox 
                  checked={completedSteps.has(step.id)} 
                  onChange={() => toggleStepCompleted(step.id)} 
                />
              </div>
            ))}
          </div>
          
          <button className="w-full mt-4 py-3 px-4 border border-purple-400 rounded-2xl font-medium transition-all duration-200 hover:bg-purple-400/10" style={{
            background: 'rgba(255,255,255,0.2)',
            borderColor: '#6C4BFF',
            color: '#6C4BFF',
            fontFamily: 'Inter, sans-serif'
          }}>
            Перейти к плану
          </button>
        </div>

        {/* Совет дня */}
        <div className="bg-white rounded-2xl p-4 mb-4">
          <p className="text-sm" style={{ 
            color: '#1E1E1E', 
            fontFamily: 'Inter, sans-serif' 
          }}>
            Кожа слегка обезвожена. Рекомендуем усилить увлажнение ✨
          </p>
        </div>

        {/* Рекомендации */}
        <div className="grid grid-cols-2 gap-3 mb-8">
          <div className="bg-white rounded-2xl p-4 h-20 flex items-center">
            <div className="text-center w-full">
              <div className="text-2xl mb-1">🧴</div>
              <div className="text-xs" style={{ color: '#6B6B6B', fontFamily: 'Inter, sans-serif' }}>
                Рекомендация дня
              </div>
            </div>
          </div>
          <div className="bg-white rounded-2xl p-4 h-20 flex items-center">
            <div className="text-center w-full">
              <div className="text-sm font-medium mb-1" style={{ color: '#1E1E1E', fontFamily: 'Inter, sans-serif' }}>
                5 дней
              </div>
              <div className="text-xs" style={{ color: '#6B6B6B', fontFamily: 'Inter, sans-serif' }}>
                История прогресса 💕
              </div>
            </div>
          </div>
        </div>

        {/* CTA кнопка */}
        <button className="cta-button w-full flex items-center justify-center gap-4">
          <div className="icon-circle">↻</div>
          <span className="text-lg font-semibold text-white" style={{ fontFamily: 'Inter, sans-serif' }}>
            Начать сканирование
          </span>
          <div className="icon-circle-large">📷</div>
        </button>
      </div>
    </div>
  );
}