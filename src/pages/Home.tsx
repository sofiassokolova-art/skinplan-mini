import { useState, useEffect } from "react";

// Компонент фона
function Background() {
  return (
    <div className="absolute inset-0 overflow-hidden">
      <div className="absolute inset-0" style={{background:'linear-gradient(135deg,#F4D1FF 0%, #FFD6E6 45%, #CFE8FF 100%)'}}/>
      {/* blobs */}
      <div className="absolute w-96 h-96 left-6 top-6 rounded-full bg-[#E7C0FF] opacity-40 blur-3xl animate-[blobDrift_20s_ease-in-out_infinite]" />
      <div className="absolute w-72 h-72 right-6 top-24 rounded-full bg-[#CDEBFF] opacity-30 blur-3xl animate-[blobDrift_20s_ease-in-out_infinite]" style={{animationDelay:'2s'}}/>
      <div className="absolute w-80 h-80 left-20 bottom-10 rounded-full bg-white opacity-10 blur-2xl" />
      {/* medical grid - svg overlay */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-10" preserveAspectRatio="none">
        <defs><pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M40 0 L0 0 0 40" stroke="white" strokeOpacity="0.06" strokeWidth="1"/></pattern></defs>
        <rect width="100%" height="100%" fill="url(#grid)"/>
      </svg>
    </div>
  );
}

// Компонент прогресс-круга
function ProgressRing({size=200, stroke=14, value=65}) {
  const [animatedValue, setAnimatedValue] = useState(0);
  
  useEffect(() => {
    const timer = setTimeout(() => {
      setAnimatedValue(value);
    }, 100);
    return () => clearTimeout(timer);
  }, [value]);

  const r = (size - stroke)/2;
  const c = 2*Math.PI*r;
  const dash = c*(animatedValue/100);
  const offset = c - dash;
  
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="transform -rotate-90">
      <defs>
        <linearGradient id="g1" x1="0%" x2="100%">
          <stop offset="0%" stopColor="#A58BFF"/>
          <stop offset="100%" stopColor="#6C4BFF"/>
        </linearGradient>
      </defs>
      <circle cx={size/2} cy={size/2} r={r} stroke="rgba(255,255,255,0.3)" strokeWidth={stroke} fill="transparent"/>
      <circle cx={size/2} cy={size/2} r={r} stroke="url(#g1)" strokeWidth={stroke} strokeLinecap="round"
        strokeDasharray={`${c} ${c}`} strokeDashoffset={offset}
        className="glow"
        style={{transition: 'stroke-dashoffset 1.2s ease-in-out'}} />
    </svg>
  );
}

// Компонент свитчера Утро/Вечер с 3D иконками
function TimeSwitcher({ activeSegment, setActiveSegment }: { 
  activeSegment: 'morning' | 'evening', 
  setActiveSegment: (segment: 'morning' | 'evening') => void 
}) {
  return (
    <div className="relative bg-white/40 rounded-full p-1" style={{ width: 140, height: 40, borderRadius: '20px' }}>
      <div 
        className="absolute top-1 left-1 bg-white rounded-full transition-transform duration-200 ease-out shadow-sm"
        style={{ 
          width: 66, 
          height: 32,
          transform: activeSegment === 'evening' ? 'translateX(70px)' : 'translateX(0)'
        }}
      />
      <div className="relative flex">
        <button
          onClick={() => setActiveSegment('morning')}
          className="flex-1 text-sm font-medium transition-colors duration-200 flex items-center justify-center gap-1"
          style={{ 
            color: activeSegment === 'morning' ? '#1E1E1E' : 'rgba(255,255,255,0.4)',
            fontFamily: 'Inter, sans-serif'
          }}
        >
          {/* 3D Sun icon */}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="5" fill="#C8A951" stroke="#D64550" strokeWidth="1"/>
            <path d="M12 1V3M12 21V23M4.22 4.22L5.64 5.64M18.36 18.36L19.78 19.78M1 12H3M21 12H23M4.22 19.78L5.64 18.36M18.36 5.64L19.78 4.22" stroke="#C8A951" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          Утро
        </button>
        <button
          onClick={() => setActiveSegment('evening')}
          className="flex-1 text-sm font-medium transition-colors duration-200 flex items-center justify-center gap-1"
          style={{ 
            color: activeSegment === 'evening' ? '#1E1E1E' : 'rgba(255,255,255,0.4)',
            fontFamily: 'Inter, sans-serif'
          }}
        >
          {/* 3D Moon icon */}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" fill="#6C4BFF" stroke="#A58BFF" strokeWidth="1"/>
            <circle cx="18" cy="6" r="1" fill="#C8A951" opacity="0.8"/>
          </svg>
          Вечер
        </button>
      </div>
    </div>
  );
}

// Компонент карточки шага
function StepCard({title, subtitle, checked, onToggle}: {
  title: string;
  subtitle: string;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="bg-white rounded-[16px] shadow-[0_4px_12px_rgba(0,0,0,0.06)] px-4 h-14 flex items-center justify-between">
      <div>
        <div className="text-[16px] font-medium text-[#1E1E1E]" style={{ fontFamily: 'Inter, sans-serif' }}>{title}</div>
        {subtitle && <div className="text-[14px] text-[#6B6B6B] mt-1" style={{ fontFamily: 'Inter, sans-serif' }}>{subtitle}</div>}
      </div>
      <button onClick={onToggle} aria-pressed={checked} className="w-9 h-9 rounded-full flex items-center justify-center transition-transform active:scale-95">
        {checked ? (
          <div className="w-8 h-8 rounded-full bg-[#6C4BFF] flex items-center justify-center">
            <svg width="12" height="10" viewBox="0 0 12 10" fill="none"><path d="M1 5L4.2 8L11 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </div>
        ) : (
          <div className="w-8 h-8 rounded-full bg-white border-2 border-[#6C4BFF]" />
        )}
      </button>
    </div>
  )
}

// Компонент CTA с shimmer и 3D иконками
function CTA({onClick}: {onClick: () => void}) {
  return (
    <button onClick={onClick} className="relative w-full h-16 rounded-[32px] overflow-hidden flex items-center justify-between px-6 bg-[rgba(255,255,255,0.2)] backdrop-blur-lg border border-[rgba(255,255,255,0.3)] transition-all duration-300 hover:shadow-[0_8px_24px_rgba(108,75,255,0.25)] hover:scale-[1.02] active:scale-95">
      {/* left refresh icon */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-white shadow-lg flex items-center justify-center">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M1 4V10H7" stroke="#6C4BFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M23 20V14H17" stroke="#6C4BFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M20.49 9C19.9828 7.56612 19.1209 6.2854 17.9845 5.27542C16.848 4.26545 15.4745 3.55976 13.9917 3.22426C12.5089 2.88876 10.9652 2.93434 9.50481 3.35677C8.04439 3.77921 6.71475 4.56473 5.64 5.64L1 10" stroke="#6C4BFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M3.51 15C4.01725 16.4339 4.87913 17.7146 6.01547 18.7246C7.15182 19.7345 8.52522 20.4402 10.008 20.7757C11.4908 21.1112 13.0345 21.0657 14.4949 20.6432C15.9553 20.2208 17.285 19.4353 18.36 18.36L23 14" stroke="#6C4BFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <div className="text-white font-semibold text-lg" style={{ fontFamily: 'Inter, sans-serif' }}>Начать сканирование</div>
      </div>
      {/* right 3D camera icon */}
      <div className="w-12 h-12 rounded-full bg-white shadow-lg flex items-center justify-center relative">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          {/* Camera body */}
          <rect x="4" y="7" width="16" height="10" rx="2" fill="#FFFFFF" stroke="#6C4BFF" strokeWidth="1.5"/>
          {/* Camera lens */}
          <circle cx="12" cy="12" r="3" fill="#6C4BFF"/>
          <circle cx="12" cy="12" r="2" fill="#A58BFF"/>
          {/* Camera flash */}
          <circle cx="16" cy="9" r="1" fill="#C8A951"/>
          {/* Camera viewfinder */}
          <rect x="10" y="5" width="4" height="2" rx="1" fill="#6C4BFF"/>
        </svg>
        {/* Shimmer effect on camera lens */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-6 h-6 rounded-full bg-gradient-to-r from-transparent via-white/30 to-transparent opacity-0 animate-pulse" style={{animation:'shimmer 3s ease-in-out infinite'}}></div>
        </div>
      </div>

      {/* shimmer layer */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -left-[120%] top-0 bottom-0 w-32 bg-gradient-to-r from-transparent via-white/40 to-transparent opacity-30" style={{animation:'shimmer 8s linear infinite'}} />
      </div>
    </button>
  )
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
    { id: 'cleanser', name: 'Очищение кожи', subtitle: 'Очищающее средство' },
    { id: 'antioxidants', name: 'Антиоксиданты', subtitle: 'Витамин C сыворотка' },
    { id: 'moisturizer', name: 'Увлажнение', subtitle: 'Гиалуроновая кислота' },
    { id: 'eye_cream', name: 'Крем для глаз', subtitle: 'Пептидный комплекс' }
  ];

  const allStepsCompleted = completedSteps.size === steps.length;

  return (
    <div className="min-h-screen relative overflow-hidden">
      <Background />

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
        
        @keyframes float-5 {
          0%, 100% { transform: translate(0, 0) rotate(0deg); }
          40% { transform: translate(-6px, -8px) rotate(2deg); }
          80% { transform: translate(10px, 4px) rotate(-2deg); }
        }
        
        @keyframes float-6 {
          0%, 100% { transform: translate(0, 0) rotate(0deg); }
          25% { transform: translate(8px, -12px) rotate(3deg); }
          75% { transform: translate(-10px, 8px) rotate(-3deg); }
        }
        
        @keyframes medical-grid {
          0% { transform: translateX(0) translateY(0); }
          100% { transform: translateX(1px) translateY(2px); }
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
        .animate-float-5 { animation: float-5 14s ease-in-out infinite; }
        .animate-float-6 { animation: float-6 26s ease-in-out infinite; }
        .animate-medical-grid { animation: medical-grid 30s linear infinite; }
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
          transition: all 0.3s ease;
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
        
        .cta-button:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 32px rgba(165, 139, 255, 0.3);
          filter: drop-shadow(0 0 20px rgba(165, 139, 255, 0.4));
        }
        
        .cta-button:active {
          transform: scale(0.95);
        }
        
        .icon-circle {
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: #FFFFFF;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
        }
        
        .icon-circle-large {
          width: 24px;
          height: 24px;
          border-radius: 50%;
          background: #FFFFFF;
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
            lineHeight: '120%',
            color: '#1E1E1E', 
            fontFamily: 'Playfair Display, serif' 
          }}>
            Привет, Елена!
          </h1>
          <p className="text-base mt-2" style={{ 
            fontSize: '16px',
            color: '#6B6B6B', 
            fontFamily: 'Inter, sans-serif' 
          }}>
            Твой уход на сегодня готов
          </p>
        </div>

        {/* Центральный блок - Прогресс и свитчер */}
        <div className="flex flex-col items-center mb-8">
          <div className={allStepsCompleted ? 'animate-completion-celebration' : 'animate-glow-pulse'}>
            <div className="relative">
              <ProgressRing value={65} />
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <div className="text-2xl font-semibold" style={{ color: '#1E1E1E', fontFamily: 'Inter, sans-serif', fontSize: '24px' }}>
                  65%
                </div>
                <div className="text-sm text-center mt-1" style={{ color: '#6B6B6B', fontFamily: 'Inter, sans-serif', fontSize: '14px' }}>
                  Осталось 2 шага<br/>3 минуты
                </div>
              </div>
            </div>
          </div>
          <div className="mt-6">
            <TimeSwitcher activeSegment={activeSegment} setActiveSegment={setActiveSegment} />
          </div>
        </div>

        {/* Сегодняшний уход */}
        <div className="mb-6">
          <h2 className="text-lg font-semibold mb-6" style={{ 
            fontSize: '20px',
            fontWeight: 600,
            color: '#1E1E1E', 
            fontFamily: 'Inter, sans-serif' 
          }}>
            Сегодняшний уход
          </h2>
          
          <div className="space-y-3">
            {steps.map((step) => (
              <StepCard
                key={step.id}
                title={step.name}
                subtitle={step.subtitle}
                checked={completedSteps.has(step.id)}
                onToggle={() => toggleStepCompleted(step.id)}
              />
            ))}
          </div>
          
          <button className="w-full mt-4 py-3 px-4 border rounded-2xl font-medium transition-all duration-200 hover:bg-purple-400/10" style={{
            background: 'rgba(255,255,255,0.2)',
            borderColor: '#6C4BFF',
            borderWidth: '1px',
            color: '#6C4BFF',
            fontSize: '16px',
            fontWeight: 500,
            fontFamily: 'Inter, sans-serif'
          }}>
            Перейти к плану
          </button>
        </div>

        {/* Совет дня */}
        <div className="bg-white rounded-2xl p-4 mb-6 shadow-[0_4px_16px_rgba(0,0,0,0.06)]">
          <h3 className="mb-2" style={{ 
            fontSize: '16px',
            fontWeight: 700,
            color: '#1E1E1E', 
            fontFamily: 'Playfair Display, serif' 
          }}>
            Экспертное мнение
          </h3>
          <p className="leading-relaxed" style={{ 
            fontSize: '14px',
            fontWeight: 400,
            color: '#6B6B6B', 
            fontFamily: 'Inter, sans-serif' 
          }}>
            Кожа слегка обезвожена. Рекомендуем усилить увлажнение гиалуроновой кислотой и пептидами для восстановления гидробаланса.
          </p>
        </div>

        {/* Нижний ряд карточек */}
        <div className="grid grid-cols-2 gap-4 mb-8">
          {/* Перепройти анкету - кнопка с 3D иконкой формы-анкеты */}
          <button className="bg-white rounded-[16px] h-20 shadow-[0_4px_12px_rgba(0,0,0,0.06)] flex items-center transition-all duration-300 hover:border-2 hover:border-[#6C4BFF] hover:shadow-[0_8px_24px_rgba(108,75,255,0.15)] group">
            <div className="text-center w-full px-4">
              <div className="w-6 h-6 mx-auto mb-2 bg-gradient-to-br from-[#6C4BFF] to-[#A58BFF] rounded-full flex items-center justify-center transition-transform duration-300 group-hover:scale-110">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  {/* 3D форма-анкета */}
                  <rect x="3" y="4" width="18" height="16" rx="2" fill="white" stroke="#6C4BFF" strokeWidth="1.5"/>
                  <path d="M9 8H15M9 12H15M9 16H12" stroke="#6C4BFF" strokeWidth="1.5" strokeLinecap="round"/>
                  <circle cx="7" cy="8" r="1" fill="#6C4BFF"/>
                  <circle cx="7" cy="12" r="1" fill="#6C4BFF"/>
                  <circle cx="7" cy="16" r="1" fill="#6C4BFF"/>
                  {/* Карандаш */}
                  <path d="M17 3L21 7L15 13L11 9L17 3Z" fill="#A58BFF"/>
                  <path d="M11 9L15 13" stroke="#6C4BFF" strokeWidth="1"/>
                </svg>
              </div>
              <div className="text-sm font-medium" style={{ color: '#1E1E1E', fontFamily: 'Inter, sans-serif', fontSize: '14px' }}>
                Перепройти анкету
              </div>
            </div>
          </button>
          
          {/* История прогресса - текст с 3D календарной иконкой */}
          <div className="bg-white rounded-[16px] h-20 shadow-[0_4px_12px_rgba(0,0,0,0.06)] flex items-center px-4">
            <div className="flex items-center w-full">
              <div className="w-6 h-6 mr-3 bg-gradient-to-br from-[#6C4BFF] to-[#A58BFF] rounded-full flex items-center justify-center">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <path d="M19 3H18V1H16V3H8V1H6V3H5C3.89 3 3.01 3.9 3.01 5L3 19C3 20.1 3.89 21 5 21H19C20.1 21 21 20.1 21 19V5C21 3.9 20.1 3 19 3ZM19 19H5V8H19V19Z" fill="white"/>
                </svg>
              </div>
              <div className="flex flex-col">
                <div className="text-sm font-medium" style={{ color: '#1E1E1E', fontFamily: 'Inter, sans-serif', fontSize: '14px' }}>
                  5 дней
                </div>
                <div className="text-xs" style={{ color: '#6B6B6B', fontFamily: 'Inter, sans-serif', fontSize: '12px' }}>
                  История прогресса
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* CTA кнопка */}
        <CTA onClick={() => console.log('Start scanning')} />

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