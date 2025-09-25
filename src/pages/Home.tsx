import { useState, useEffect } from "react";

// Компонент фона
function Background() {
  return (
    <div className="absolute inset-0 overflow-hidden">
      {/* Премиальный градиент Vogue meets Apple Health */}
      <div className="absolute inset-0" style={{
        background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 25%, #0f3460 50%, #533483 75%, #e94560 100%)'
      }}/>
      
      {/* Анимированные световые эффекты */}
      <div className="absolute inset-0">
        {/* Главный световой поток */}
        <div className="absolute w-[600px] h-[600px] -top-32 -left-32 rounded-full opacity-20 animate-pulse" style={{
          background: 'radial-gradient(circle, rgba(233,69,96,0.4) 0%, rgba(83,52,131,0.2) 50%, transparent 70%)',
          animation: 'pulse 4s ease-in-out infinite'
        }}/>
        
        {/* Вторичный свет */}
        <div className="absolute w-[400px] h-[400px] -bottom-24 -right-24 rounded-full opacity-15" style={{
          background: 'radial-gradient(circle, rgba(15,52,96,0.3) 0%, rgba(22,33,62,0.2) 50%, transparent 70%)',
          animation: 'pulse 6s ease-in-out infinite reverse'
        }}/>
        
        {/* Акцентный свет */}
        <div className="absolute w-[300px] h-[300px] top-1/4 right-1/4 rounded-full opacity-25" style={{
          background: 'radial-gradient(circle, rgba(83,52,131,0.5) 0%, rgba(233,69,96,0.2) 50%, transparent 70%)',
          animation: 'pulse 8s ease-in-out infinite'
        }}/>
      </div>
      
      {/* Премиальная сетка - без точек, только линии */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-3" preserveAspectRatio="none">
        <defs>
          <pattern id="premium-grid" width="60" height="60" patternUnits="userSpaceOnUse">
            <path d="M60 0 L0 0 0 60" stroke="rgba(233,69,96,0.1)" strokeWidth="0.3"/>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#premium-grid)"/>
      </svg>
      
      {/* Элегантные световые акценты вместо точек */}
      <div className="absolute inset-0">
        {[...Array(8)].map((_, i) => (
          <div
            key={i}
            className="absolute rounded-full opacity-20"
            style={{
              width: `${2 + Math.random() * 3}px`,
              height: `${2 + Math.random() * 3}px`,
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              background: `radial-gradient(circle, rgba(233,69,96,0.6) 0%, transparent 70%)`,
              animation: `twinkle ${4 + Math.random() * 3}s ease-in-out infinite`,
              animationDelay: `${Math.random() * 3}s`
            }}
          />
        ))}
      </div>
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
    <div className="relative">
      {/* Премиальный стеклянный фон */}
      <div 
        className="absolute inset-0 rounded-full"
        style={{
          background: 'rgba(255,255,255,0.08)',
          backdropFilter: 'blur(40px)',
          border: '2px solid rgba(255,255,255,0.1)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.1)'
        }}
      />
      
      {/* Внутренний светящийся круг */}
      <div 
        className="absolute inset-2 rounded-full"
        style={{
          background: 'radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%)',
          filter: 'blur(20px)'
        }}
      />
      
      {/* SVG прогресс-круг */}
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="transform -rotate-90 relative z-10">
        <defs>
          {/* Премиальный градиент */}
          <linearGradient id="premium-glow" x1="0%" x2="100%">
            <stop offset="0%" stopColor="#e94560"/>
            <stop offset="50%" stopColor="#533483"/>
            <stop offset="100%" stopColor="#0f3460"/>
          </linearGradient>
          
          {/* Усиленный фильтр для glow */}
          <filter id="premium-glow-filter" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="8" result="coloredBlur"/>
            <feGaussianBlur stdDeviation="4" result="coloredBlur2"/>
            <feMerge> 
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="coloredBlur2"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
          
          {/* Радиальный градиент для фона */}
          <radialGradient id="bg-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.15)"/>
            <stop offset="100%" stopColor="rgba(255,255,255,0.05)"/>
          </radialGradient>
        </defs>
        
        {/* Фоновый круг с премиальным эффектом */}
        <circle 
          cx={size/2} 
          cy={size/2} 
          r={r} 
          stroke="url(#bg-glow)" 
          strokeWidth={stroke} 
          fill="transparent"
          opacity="0.6"
        />
        
        {/* Активный прогресс-круг с премиальным glow */}
        <circle 
          cx={size/2} 
          cy={size/2} 
          r={r} 
          stroke="url(#premium-glow)" 
          strokeWidth={stroke} 
          strokeLinecap="round"
          strokeDasharray={`${c} ${c}`} 
          strokeDashoffset={offset}
          filter="url(#premium-glow-filter)"
          style={{transition: 'stroke-dashoffset 1.5s cubic-bezier(0.4, 0, 0.2, 1)'}} 
        />
      </svg>
    </div>
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
    <div 
      className="rounded-[20px] px-6 py-5 flex items-center justify-between transition-all duration-500 hover:scale-[1.02] group"
      style={{
        background: 'rgba(255,255,255,0.08)',
        backdropFilter: 'blur(30px)',
        border: '1px solid rgba(255,255,255,0.15)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.1)'
      }}
    >
      {/* Левая часть: заголовок + подзаголовок */}
      <div className="flex-1 pr-6">
        <div 
          className="text-[18px] font-semibold leading-tight mb-1" 
          style={{ 
            fontFamily: 'Inter, sans-serif',
            color: 'rgba(255,255,255,0.95)',
            letterSpacing: '-0.02em'
          }}
        >
          {title}
        </div>
        {subtitle && (
          <div 
            className="text-[14px] mt-1 leading-relaxed" 
            style={{ 
              fontFamily: 'Inter, sans-serif',
              color: 'rgba(255,255,255,0.6)',
              fontWeight: 400
            }}
          >
            {subtitle}
          </div>
        )}
      </div>
      
      {/* Правая часть: премиальный чекбокс */}
      <button 
        onClick={onToggle} 
        aria-pressed={checked} 
        className="w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300 active:scale-95"
        style={{
          background: checked ? 'linear-gradient(135deg, #e94560 0%, #533483 100%)' : 'rgba(255,255,255,0.1)',
          border: checked ? 'none' : '2px solid rgba(255,255,255,0.2)',
          boxShadow: checked ? '0 4px 20px rgba(233,69,96,0.4)' : '0 2px 10px rgba(0,0,0,0.1)'
        }}
      >
        {checked ? (
          <svg width="16" height="12" viewBox="0 0 16 12" fill="none">
            <path d="M1 6L5.5 10L15 1" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        ) : (
          <div className="w-4 h-4 rounded-full border-2 border-white opacity-40" />
        )}
      </button>
    </div>
  )
}

// Компонент CTA с shimmer и 3D иконками
function CTA({onClick}: {onClick: () => void}) {
  return (
    <button 
      onClick={onClick} 
      className="relative w-full h-20 rounded-[40px] overflow-hidden flex items-center justify-between px-8 transition-all duration-500 hover:scale-[1.02] active:scale-95 group"
      style={{
        background: 'linear-gradient(135deg, rgba(233,69,96,0.2) 0%, rgba(83,52,131,0.2) 100%)',
        backdropFilter: 'blur(40px)',
        border: '2px solid rgba(255,255,255,0.2)',
        boxShadow: '0 12px 40px rgba(233,69,96,0.3), inset 0 1px 0 rgba(255,255,255,0.1)'
      }}
    >
      {/* left premium icon */}
      <div className="flex items-center gap-4">
        <div 
          className="w-12 h-12 rounded-full flex items-center justify-center"
          style={{
            background: 'linear-gradient(135deg, #e94560 0%, #533483 100%)',
            boxShadow: '0 4px 20px rgba(233,69,96,0.4)'
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M1 4V10H7" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M23 20V14H17" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M20.49 9C19.9828 7.56612 19.1209 6.2854 17.9845 5.27542C16.848 4.26545 15.4745 3.55976 13.9917 3.22426C12.5089 2.88876 10.9652 2.93434 9.50481 3.35677C8.04439 3.77921 6.71475 4.56473 5.64 5.64L1 10" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M3.51 15C4.01725 16.4339 4.87913 17.7146 6.01547 18.7246C7.15182 19.7345 8.52522 20.4402 10.008 20.7757C11.4908 21.1112 13.0345 21.0657 14.4949 20.6432C15.9553 20.2208 17.285 19.4353 18.36 18.36L23 14" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <div 
          className="text-white font-bold text-xl" 
          style={{ 
            fontFamily: 'Inter, sans-serif',
            letterSpacing: '-0.02em',
            textShadow: '0 2px 10px rgba(0,0,0,0.3)'
          }}
        >
          Начать сканирование
        </div>
      </div>
      
      {/* right premium camera icon */}
      <div 
        className="w-14 h-14 rounded-full flex items-center justify-center relative"
        style={{
          background: 'linear-gradient(135deg, #e94560 0%, #533483 100%)',
          boxShadow: '0 4px 20px rgba(233,69,96,0.4)'
        }}
      >
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
          {/* Premium camera body */}
          <rect x="3" y="6" width="18" height="12" rx="3" fill="white" stroke="#e94560" strokeWidth="1.5"/>
          {/* Premium camera lens */}
          <circle cx="12" cy="12" r="4" fill="#e94560"/>
          <circle cx="12" cy="12" r="2.5" fill="#533483"/>
          {/* Premium camera flash */}
          <circle cx="17" cy="8" r="1.5" fill="#ffd700"/>
          {/* Premium camera viewfinder */}
          <rect x="9" y="4" width="6" height="2" rx="1" fill="#e94560"/>
        </svg>
        
        {/* Enhanced shimmer effect */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div 
            className="w-8 h-8 rounded-full bg-gradient-to-r from-transparent via-white/40 to-transparent opacity-0" 
            style={{animation:'shimmer 3s ease-in-out infinite'}}
          />
        </div>
      </div>

      {/* Enhanced shimmer layer */}
      <div className="absolute inset-0 pointer-events-none">
        <div 
          className="absolute -left-[120%] top-0 bottom-0 w-40 bg-gradient-to-r from-transparent via-white/30 to-transparent opacity-20" 
          style={{animation:'shimmer 6s linear infinite'}} 
        />
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
          {/* Премиальный заголовок с градиентом */}
          <h1 className="mb-4" style={{ 
            fontSize: '36px', 
            fontWeight: 700, 
            lineHeight: '110%',
            background: 'linear-gradient(135deg, #ffffff 0%, #e94560 50%, #533483 100%)',
            backgroundClip: 'text',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            fontFamily: 'Playfair Display, serif',
            textShadow: '0 4px 20px rgba(233,69,96,0.3)'
          }}>
            Привет, Елена!
          </h1>
          
          {/* Премиальный подзаголовок */}
          <p className="text-base mt-2" style={{ 
            fontSize: '18px',
            color: 'rgba(255,255,255,0.8)', 
            fontFamily: 'Inter, sans-serif',
            fontWeight: 300,
            letterSpacing: '0.5px'
          }}>
            Твой персональный уход готов
          </p>
          
          {/* Декоративная линия */}
          <div className="mx-auto mt-4 w-16 h-px" style={{
            background: 'linear-gradient(90deg, transparent 0%, #e94560 50%, transparent 100%)'
          }}/>
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
        <div className="premium-card p-6 mb-6">
          <h3 className="mb-3 text-premium-white" style={{ 
            fontSize: '18px',
            fontWeight: 700,
            fontFamily: 'Playfair Display, serif' 
          }}>
            Совет дня
          </h3>
          <p className="leading-relaxed text-premium-muted" style={{ 
            fontSize: '14px',
            fontWeight: 400,
            fontFamily: 'Inter, sans-serif' 
          }}>
            Кожа слегка обезвожена. Рекомендуем усилить увлажнение гиалуроновой кислотой и пептидами для восстановления гидробаланса.
          </p>
        </div>

        {/* Нижний ряд карточек */}
        <div className="grid grid-cols-2 gap-2 mb-8">
          {/* Перепройти анкету - кнопка с 3D иконкой формы-анкеты */}
          <button className="premium-card h-20 flex items-center group hover:scale-[1.02]">
            <div className="text-center w-full px-4">
              <div className="w-6 h-6 mx-auto mb-2 bg-gradient-to-br from-[#e94560] to-[#533483] rounded-full flex items-center justify-center transition-transform duration-300 group-hover:scale-110">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  {/* 3D форма-анкета */}
                  <rect x="3" y="4" width="18" height="16" rx="2" fill="white" stroke="#e94560" strokeWidth="1.5"/>
                  <path d="M9 8H15M9 12H15M9 16H12" stroke="#e94560" strokeWidth="1.5" strokeLinecap="round"/>
                  <circle cx="7" cy="8" r="1" fill="#e94560"/>
                  <circle cx="7" cy="12" r="1" fill="#e94560"/>
                  <circle cx="7" cy="16" r="1" fill="#e94560"/>
                  {/* Карандаш */}
                  <path d="M17 3L21 7L15 13L11 9L17 3Z" fill="#533483"/>
                  <path d="M11 9L15 13" stroke="#e94560" strokeWidth="1"/>
                </svg>
              </div>
              <div className="text-sm font-medium text-premium-white" style={{ fontFamily: 'Inter, sans-serif', fontSize: '14px' }}>
                Перепройти анкету
              </div>
            </div>
          </button>
          
          {/* История прогресса - текст с 3D календарной иконкой */}
          <div className="premium-card h-20 flex items-center px-4">
            <div className="flex items-center w-full">
              <div className="w-6 h-6 mr-3 bg-gradient-to-br from-[#e94560] to-[#533483] rounded-full flex items-center justify-center">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <path d="M19 3H18V1H16V3H8V1H6V3H5C3.89 3 3.01 3.9 3.01 5L3 19C3 20.1 3.89 21 5 21H19C20.1 21 21 20.1 21 19V5C21 3.9 20.1 3 19 3ZM19 19H5V8H19V19Z" fill="white"/>
                </svg>
              </div>
              <div className="flex flex-col">
                <div className="text-sm font-medium text-premium-white" style={{ fontFamily: 'Inter, sans-serif', fontSize: '14px' }}>
                  5 дней
                </div>
                <div className="text-xs text-premium-muted" style={{ fontFamily: 'Inter, sans-serif', fontSize: '13px' }}>
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