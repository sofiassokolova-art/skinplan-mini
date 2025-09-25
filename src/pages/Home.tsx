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
        {/* Прогресс круг с градиентом и glow */}
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
            filter: 'drop-shadow(0 0 12px rgba(165, 139, 255, 0.6))'
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
        <div className="text-2xl font-semibold" style={{ color: '#1E1E1E', fontFamily: 'Inter, sans-serif' }}>
          {animatedPercentage}%
        </div>
        <div className="text-sm text-center mt-1" style={{ color: '#6B6B6B', fontFamily: 'Inter, sans-serif' }}>
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

  const allStepsCompleted = completedSteps.size === steps.length;

  return (
    <div className="min-h-screen relative overflow-hidden bg-white">
      {/* Фон с градиентом и медицинской сеткой */}
      <div className="absolute inset-0 bg-gradient-to-br from-purple-400 via-pink-400 to-blue-400">
        {/* Мягкие пятна */}
        <div className="absolute top-10 left-10 w-32 h-32 bg-white/20 rounded-full blur-xl animate-float-1"></div>
        <div className="absolute top-32 right-16 w-24 h-24 bg-red-300/30 rounded-full blur-lg animate-float-2"></div>
        <div className="absolute bottom-32 left-20 w-40 h-40 bg-blue-300/25 rounded-full blur-2xl animate-float-3"></div>
        <div className="absolute bottom-20 right-32 w-28 h-28 bg-pink-300/30 rounded-full blur-xl animate-float-4"></div>
        
        {/* Медицинская сетка - структура кожи */}
        <div className="absolute inset-0 opacity-20">
          <svg className="w-full h-full">
            <defs>
              <pattern id="skin-pattern" x="0" y="0" width="80" height="80" patternUnits="userSpaceOnUse">
                <path d="M0,40 Q20,20 40,40 T80,40" stroke="white" strokeWidth="0.5" fill="none" opacity="0.4"/>
                <path d="M0,60 Q30,45 60,60 T120,60" stroke="white" strokeWidth="0.3" fill="none" opacity="0.3"/>
                <path d="M0,20 Q25,35 50,20 T100,20" stroke="white" strokeWidth="0.4" fill="none" opacity="0.35"/>
                <path d="M0,80 Q35,65 70,80 T140,80" stroke="white" strokeWidth="0.3" fill="none" opacity="0.25"/>
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#skin-pattern)" className="animate-skin-grid"/>
          </svg>
        </div>
      </div>

      {/* Кастомные стили */}
      <style dangerouslySetInnerHTML={{__html: `
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700&display=swap');
        
        @keyframes float-1 {
          0%, 100% { transform: translate(0, 0) rotate(0deg); }
          25% { transform: translate(8px, -12px) rotate(3deg); }
          50% { transform: translate(-4px, -8px) rotate(-2deg); }
          75% { transform: translate(-8px, 4px) rotate(1deg); }
        }
        
        @keyframes float-2 {
          0%, 100% { transform: translate(0, 0) rotate(0deg); }
          33% { transform: translate(-12px, 8px) rotate(-3deg); }
          66% { transform: translate(6px, -6px) rotate(2deg); }
        }
        
        @keyframes float-3 {
          0%, 100% { transform: translate(0, 0) rotate(0deg); }
          20% { transform: translate(10px, -16px) rotate(4deg); }
          40% { transform: translate(-6px, -4px) rotate(-1deg); }
          60% { transform: translate(-12px, 10px) rotate(3deg); }
          80% { transform: translate(4px, 6px) rotate(-2deg); }
        }
        
        @keyframes float-4 {
          0%, 100% { transform: translate(0, 0) rotate(0deg); }
          30% { transform: translate(-8px, -10px) rotate(-4deg); }
          60% { transform: translate(12px, 6px) rotate(3deg); }
        }
        
        @keyframes skin-grid {
          0% { transform: translateX(0) translateY(0); }
          100% { transform: translateX(2px) translateY(3px); }
        }
        
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        
        @keyframes fade-slide-up {
          0% { opacity: 0; transform: translateY(20px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        
        @keyframes glow-pulse {
          0%, 100% { filter: drop-shadow(0 0 12px rgba(165, 139, 255, 0.6)); }
          50% { filter: drop-shadow(0 0 20px rgba(165, 139, 255, 0.8)); }
        }
        
        @keyframes completion-celebration {
          0% { transform: scale(1); }
          50% { transform: scale(1.1); filter: drop-shadow(0 0 30px rgba(165, 139, 255, 1)); }
          100% { transform: scale(1); }
        }
        
        .animate-float-1 { animation: float-1 20s ease-in-out infinite; }
        .animate-float-2 { animation: float-2 18s ease-in-out infinite; }
        .animate-float-3 { animation: float-3 22s ease-in-out infinite; }
        .animate-float-4 { animation: float-4 16s ease-in-out infinite; }
        .animate-skin-grid { animation: skin-grid 25s linear infinite; }
        .animate-shimmer { animation: shimmer 8s linear infinite; }
        .animate-fade-slide-up { animation: fade-slide-up 0.3s ease-out; }
        .animate-glow-pulse { animation: glow-pulse 3s ease-in-out infinite; }
        .animate-completion-celebration { animation: completion-celebration 0.6s ease-out; }
        
        .care-step-card {
          background: #FFFFFF;
          border-radius: 16px;
          height: 56px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.06);
          transition: all 0.3s ease;
          margin-bottom: 12px;
        }
        
        .care-step-card:hover {
          transform: translateY(-1px);
          box-shadow: 0 6px 16px rgba(0,0,0,0.08);
        }
        
        .advice-card {
          background: #FFFFFF;
          border-radius: 16px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.06);
          transition: all 0.3s ease;
        }
        
        .advice-card:hover {
          transform: translateY(-1px);
          box-shadow: 0 6px 16px rgba(0,0,0,0.08);
        }
        
        .recommendation-card {
          background: #FFFFFF;
          border-radius: 16px;
          height: 80px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.06);
          transition: all 0.3s ease;
        }
        
        .recommendation-card:hover {
          transform: translateY(-1px);
          box-shadow: 0 6px 16px rgba(0,0,0,0.08);
        }
        
        .cta-button {
          background: rgba(255, 255, 255, 0.2);
          backdrop-filter: blur(16px);
          border: 1px solid rgba(255, 255, 255, 0.3);
          border-radius: 32px;
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
        <div className="text-center mb-8 animate-fade-slide-up">
          <h1 className="mb-2" style={{ 
            fontSize: '30px', 
            fontWeight: 700, 
            color: '#1E1E1E', 
            fontFamily: 'Playfair Display, serif' 
          }}>
            Привет, Елена! ✨
          </h1>
          <p className="text-base mt-2" style={{ 
            color: '#6B6B6B', 
            fontFamily: 'Inter, sans-serif' 
          }}>
            Твой уход на сегодня готов
          </p>
        </div>

        {/* Центральный блок - Прогресс и свитчер */}
        <div className="flex flex-col items-center mb-8">
          <div className={allStepsCompleted ? 'animate-completion-celebration' : 'animate-glow-pulse'}>
            <ProgressCircle percentage={65} />
          </div>
          <div className="mt-6">
            <TimeSwitcher activeSegment={activeSegment} setActiveSegment={setActiveSegment} />
          </div>
        </div>

        {/* Сегодняшний уход */}
        <div className="mb-6">
          <h2 className="text-lg font-semibold mb-4" style={{ 
            color: '#1E1E1E', 
            fontFamily: 'Inter, sans-serif' 
          }}>
            Сегодняшний уход
          </h2>
          
          <div className="space-y-3">
            {steps.map((step) => (
              <div key={step.id} className="care-step-card flex items-center justify-between px-4">
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
          
          <button className="w-full mt-4 py-3 px-4 border rounded-2xl font-medium transition-all duration-200 hover:bg-purple-400/10" style={{
            background: 'rgba(255,255,255,0.2)',
            borderColor: '#6C4BFF',
            borderWidth: '1px',
            color: '#6C4BFF',
            fontFamily: 'Inter, sans-serif'
          }}>
            Перейти к плану
          </button>
        </div>

        {/* Совет дня */}
        <div className="advice-card p-4 mb-4">
          <p className="text-sm" style={{ 
            color: '#1E1E1E', 
            fontFamily: 'Inter, sans-serif' 
          }}>
            Кожа слегка обезвожена. Рекомендуем усилить увлажнение ✨
          </p>
        </div>

        {/* Рекомендации */}
        <div className="grid grid-cols-2 gap-3 mb-8">
          <div className="recommendation-card p-4 flex items-center">
            <div className="text-center w-full">
              <div className="text-2xl mb-1">🧴</div>
              <div className="text-xs" style={{ color: '#6B6B6B', fontFamily: 'Inter, sans-serif' }}>
                Рекомендация дня
              </div>
            </div>
          </div>
          <div className="recommendation-card p-4 flex items-center">
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

        {/* Поздравление при завершении всех шагов */}
        {allStepsCompleted && (
          <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-slide-up">
            <div className="bg-white rounded-2xl p-6 mx-6 text-center shadow-2xl">
              <div className="text-4xl mb-4">✨</div>
              <h3 className="text-xl font-semibold mb-2" style={{ color: '#1E1E1E', fontFamily: 'Inter, sans-serif' }}>
                Уход завершён!
              </h3>
              <p className="text-sm" style={{ color: '#6B6B6B', fontFamily: 'Inter, sans-serif' }}>
                Отличная работа 💕
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}