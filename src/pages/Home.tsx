import { Link } from "react-router-dom";
import { useState, useEffect } from "react";

// Design Tokens
const tokens = {
  colors: {
    BackgroundStart: "#FEFCFB",
    BackgroundEnd: "#FFFFFF",
    CardBase: "#FFF8F8",
    TextPrimary: "#1A1A1A",
    TextSecondary: "#6B7280",
    TextLight: "#9CA3AF",
    ActiveTab: "#FFE4E1",
    InactiveTab: "#F8F5F4",
    ProgressGradient1: "#A855F7",
    ProgressGradient2: "#EC4899",
    CtaGradient1: "#FFE4E1",
    CtaGradient2: "#FECACA",
    CheckboxGradient1: "#DDD6FE",
    CheckboxGradient2: "#A855F7",
    IconPink: "#F472B6",
    IconLavender: "#A855F7",
    PremiumGold: "#F59E0B",
    PremiumAccent: "#7C3AED"
  },
  shadows: {
    NeomorphicOut: "3px 3px 6px rgba(0,0,0,0.08), -3px -3px 6px rgba(255,255,255,0.9)",
    NeomorphicIn: "inset 2px 2px 4px rgba(0,0,0,0.1), inset -2px -2px 4px rgba(255,255,255,0.8)",
    Card: "3px 3px 6px rgba(0,0,0,0.08), -3px -3px 6px rgba(255,255,255,0.9)",
    Switch: "3px 3px 6px rgba(0,0,0,0.08), -3px -3px 6px rgba(255,255,255,0.9)",
    Button: "3px 3px 6px rgba(0,0,0,0.08), -3px -3px 6px rgba(255,255,255,0.9)",
    ProgressInset: "inset 1px 1px 2px rgba(0,0,0,0.1)",
    CheckboxGlow: "0 0 8px rgba(238, 207, 255, 0.3), 0 2px 4px rgba(0,0,0,0.1)"
  },
  radii: {
    Switch: 12,
    Card: 16,
    Button: 16,
    Icon: 12
  }
};

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
        {/* Прогресс круг с градиентом от светло-лавандового к насыщенному */}
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
            <stop offset="0%" stopColor="#A855F7" />
            <stop offset="100%" stopColor="#EC4899" />
          </linearGradient>
        </defs>
      </svg>
      {/* Процент в центре */}
      <div 
        className="absolute inset-0 flex items-center justify-center"
        style={{ 
          fontSize: '12px', 
          fontWeight: 500, 
          color: '#6B6B6B',
          lineHeight: '12px'
        }}
      >
        {Math.round(animatedPercentage)}%
      </div>
    </div>
  );
}


export default function Home() {
  const [activeTime, setActiveTime] = useState<'morning' | 'evening'>('morning');
  const [completedSteps, setCompletedSteps] = useState<Record<string, boolean>>(() => {
    // Фиксированное состояние как в референсе: все шаги кроме SPF завершены
    return {
      'morning-cleanser-0': true,
      'morning-toner-1': true,
      'morning-serum-2': true,
      'morning-moisturizer-3': true,
      'morning-spf-4': false,
      'evening-cleanser-0': true,
      'evening-toner-1': true,
      'evening-serum-2': true,
      'evening-moisturizer-3': true,
      'evening-spf-4': false
    };
  });

  // Функция для переключения статуса выполнения шага
  const toggleStepCompleted = (stepId: string) => {
    const newCompletedSteps = {
      ...completedSteps,
      [stepId]: !completedSteps[stepId]
    };
    setCompletedSteps(newCompletedSteps);
    
    // Сохраняем в localStorage
    try {
      localStorage.setItem('skiniq.routine_progress', JSON.stringify(newCompletedSteps));
    } catch (error) {
      console.error('Ошибка сохранения прогресса:', error);
    }
  };
  
  // Имя пользователя не используется в референсе



  // Данные для карточек ухода
  const careSteps = [
    { 
      id: 'cleanser', 
      name: 'Очищение', 
      description: 'Очищающее средство', 
      icon: 'cleanser' as const
    },
    { 
      id: 'toner', 
      name: 'Тонизирование', 
      description: 'Тоник', 
      icon: 'toner' as const
    },
    { 
      id: 'serum', 
      name: 'Сыворотка', 
      description: 'С витамином C', 
      icon: 'serum' as const
    },
    { 
      id: 'moisturizer', 
      name: 'Увлажнение', 
      description: 'Увлажняющий крем', 
      icon: 'moisturizer' as const
    },
    { 
      id: 'spf', 
      name: 'SPF', 
      description: 'Солнцезащитный крем', 
      icon: 'spf' as const
    }
  ];

  return (
    <div 
      className="min-h-screen relative overflow-hidden"
      style={{
        background: `radial-gradient(ellipse at top, rgba(168, 85, 247, 0.05) 0%, transparent 50%), linear-gradient(135deg, #FEFCFB 0%, #FFF8F8 50%, #FFFFFF 100%)`,
        backgroundSize: '100% 100%',
        boxShadow: 'inset 8px 8px 16px rgba(0,0,0,0.05), inset -8px -8px 16px #ffffff'
      }}
    >
      
      {/* Кастомные стили */}
      <style dangerouslySetInnerHTML={{__html: `
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700&family=Inter:wght@400;500;600;700&display=swap');
        
        @keyframes gradientMove {
          0% { 
            background-position: 20% 20%; 
          }
          50% { 
            background-position: 80% 80%; 
          }
          100% { 
            background-position: 20% 20%; 
          }
        }
        
        @keyframes shine {
          0% { 
            background-position: 0% center; 
          }
          100% { 
            background-position: 200% center; 
          }
        }
        
        @keyframes pearlShimmer {
          0% {
            left: -100%;
          }
          50% {
            left: 100%;
          }
          100% {
            left: 100%;
          }
        }
        
        .shimmer-button::before {
          content: "";
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          border-radius: inherit;
          background: linear-gradient(
            90deg,
            transparent 0%,
            transparent 30%,
            rgba(255,255,255,0.4) 50%,
            transparent 70%,
            transparent 100%
          );
          transform: translateX(-100%);
          animation: shimmer 3s ease-in-out infinite;
        }
        
        .pearl-shimmer::before {
          content: '';
          position: absolute;
          top: 0;
          left: -100%;
          width: 100%;
          height: 100%;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.8), transparent);
          animation: pearlShimmer 4s ease-in-out infinite;
        }
        
        @keyframes shimmer {
          100% { transform: translateX(100%); }
        }
        
        .pearl-button::before {
          content: '';
          position: absolute;
          top: 0;
          left: -100%;
          width: 100%;
          height: 100%;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.6), transparent);
          animation: pearlShimmer 3s ease-in-out infinite;
        }
        
        .scale-up {
          animation: scaleUp 0.2s ease-in-out;
        }
        
        @keyframes scaleUp {
          0% {
            transform: scale(0.8);
            opacity: 0;
          }
          100% {
            transform: scale(1);
            opacity: 1;
          }
        }
        
        .pressed {
          transform: scale(0.98);
          transition: transform 0.1s ease;
        }
        
        .neomorphic-card {
          position: relative;
        }
        
        .neomorphic-card::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          border-radius: inherit;
          background: linear-gradient(135deg, rgba(255,255,255,0.2) 0%, transparent 30%, transparent 70%, rgba(0,0,0,0.05) 100%);
          pointer-events: none;
        }
        
        .neomorphic-card::after {
          content: '';
          position: absolute;
          top: 1px;
          left: 1px;
          right: 1px;
          bottom: 1px;
          border-radius: inherit;
          background: linear-gradient(135deg, rgba(255,255,255,0.4) 0%, transparent 20%, transparent 80%, rgba(0,0,0,0.08) 100%);
          pointer-events: none;
        }
        
        .segment-container {
          background: #FDF7F6;
          border-radius: 28px;
          padding: 4px;
          box-shadow: 4px 4px 8px rgba(0,0,0,0.1), -4px -4px 8px rgba(255,255,255,0.8);
        }
        
        .segment-button {
          flex: 1;
          border-radius: 24px;
          border: none;
          font-family: 'Inter', sans-serif;
          font-size: 16px;
          font-weight: 500;
          cursor: pointer;
          transition: all 200ms ease;
          position: relative;
        }
        
        .segment-button.active {
          background: linear-gradient(145deg, #FFE2E2, #FFD6D6);
          color: #2A2A2A;
          box-shadow: 4px 4px 8px rgba(0,0,0,0.1), -4px -4px 8px rgba(255,255,255,0.8);
        }
        
        .segment-button.inactive {
          background: transparent;
          color: #6B6B6B;
          box-shadow: inset 4px 4px 8px rgba(0,0,0,0.1), inset -4px -4px 8px rgba(255,255,255,0.8);
        }
        
        .cta-button {
          border-radius: 28px;
          height: 64px;
          background: linear-gradient(145deg, #FFECE9, #FFD6D6);
          font-weight: 600;
          font-size: 20px;
          position: relative;
          overflow: hidden;
          border: none;
          color: #2A2A2A;
          font-family: 'Inter', sans-serif;
          cursor: pointer;
          transition: all 0.3s ease;
          box-shadow: 4px 4px 8px rgba(0,0,0,0.1), -4px -4px 8px rgba(255,255,255,0.8);
        }
        
        .cta-shimmer {
          position: absolute;
          inset: 0;
          border-radius: inherit;
          overflow: hidden;
          pointer-events: none;
        }
        
        .cta-shimmer::before {
          content: '';
          position: absolute;
          top: 0;
          left: -100%;
          width: 100%;
          height: 100%;
          background: linear-gradient(110deg, transparent 20%, rgba(255,255,255,0.6) 45%, transparent 70%);
          animation: ctaShimmer 3s ease-in-out infinite;
        }
        
        @keyframes ctaShimmer {
          0% { transform: translateX(0); }
          100% { transform: translateX(200%); }
        }
        
        .premium-glow {
          box-shadow: 0 0 20px rgba(168, 85, 247, 0.3), 4px 4px 8px rgba(0,0,0,0.1), -4px -4px 8px rgba(255,255,255,0.8);
        }
        
        .premium-hover {
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
        
        .premium-hover:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 25px rgba(168, 85, 247, 0.2), 4px 4px 8px rgba(0,0,0,0.1), -4px -4px 8px rgba(255,255,255,0.8);
        }
        
        .premium-text {
          background: linear-gradient(135deg, #A855F7, #EC4899);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        
        .floating-animation {
          animation: float 3s ease-in-out infinite;
        }
        
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-5px); }
        }
        
        .pulse-glow {
          animation: pulseGlow 2s ease-in-out infinite;
        }
        
        @keyframes pulseGlow {
          0%, 100% { box-shadow: 0 0 20px rgba(168, 85, 247, 0.3), 4px 4px 8px rgba(0,0,0,0.1), -4px -4px 8px rgba(255,255,255,0.8); }
          50% { box-shadow: 0 0 30px rgba(168, 85, 247, 0.5), 4px 4px 8px rgba(0,0,0,0.1), -4px -4px 8px rgba(255,255,255,0.8); }
        }
      `}} />
      
      {/* Основной контент */}
      <div className="relative z-10 px-6 py-8">
        {/* Бренд заголовок */}
        <div className="text-center" style={{ marginTop: 32, marginBottom: 16 }}>
          <h1 
            className="premium-text"
            style={{
              fontFamily: 'Inter, sans-serif',
              fontSize: '18px',
              fontWeight: 600,
              margin: 0,
              marginBottom: 8
            }}
          >
            SkinIQ dev
          </h1>
          <p 
            style={{
              fontFamily: 'Inter, sans-serif',
              fontSize: '14px',
              fontWeight: 400,
              color: '#8C8C8C',
              margin: 0,
              marginBottom: 16,
              lineHeight: '120%'
            }}
          >
            мини-приложение
          </p>
          <h2 
            style={{
              fontFamily: 'Playfair Display, serif',
              fontSize: '24px',
              fontWeight: 700,
              color: '#2A2A2A',
              margin: 0,
              marginBottom: 8,
              lineHeight: '120%'
            }}
          >
            Привет, Соня!
          </h2>
          <p 
            style={{
              fontFamily: 'Inter, sans-serif',
              fontSize: '16px',
              fontWeight: 400,
              color: '#8C8C8C',
              margin: 0,
              lineHeight: '120%'
            }}
          >
            Твой уход на сегодня
          </p>
        </div>

        {/* Верхняя строка: переключатель + прогресс */}
        <div 
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginTop: 24,
            marginBottom: 24
          }}
        >
          {/* Переключатель Утро/Вечер */}
          <div 
            className="segment-container"
            style={{
              flex: 1,
              maxWidth: '70%',
              height: 44,
              display: 'flex',
              alignItems: 'center'
            }}
          >
            <button
              onClick={() => setActiveTime('morning')}
              className={`segment-button ${activeTime === 'morning' ? 'active' : 'inactive'}`}
              style={{ height: 36 }}
            >
              Утро
            </button>
            <button
              onClick={() => setActiveTime('evening')}
              className={`segment-button ${activeTime === 'evening' ? 'active' : 'inactive'}`}
              style={{ height: 36 }}
            >
              Вечер
            </button>
          </div>

          {/* Прогресс-круг */}
          <div 
            className="floating-animation premium-glow"
            style={{
              width: 76,
              height: 76,
              borderRadius: '50%',
              background: '#FFF8F8',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginLeft: 16,
              position: 'relative'
            }}
          >
            <CircularProgress 
              percentage={80} 
              size={76}
            />
            </div>
          </div>

        {/* Карточки ухода */}
        <div style={{ marginBottom: 24 }}>
          {careSteps.map((step, index) => {
            const stepId = `${activeTime}-${step.id}-${index}`;
                const isCompleted = completedSteps[stepId] || false;

                return (
              <div 
                key={step.id}
                className="neomorphic-card premium-hover"
                style={{
                  background: '#FFF8F8',
                  borderRadius: 16,
                  boxShadow: '4px 4px 8px rgba(0,0,0,0.1), -4px -4px 8px rgba(255,255,255,0.8)',
                  height: 64,
                  padding: '16px',
                  marginBottom: index < careSteps.length - 1 ? 6 : 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  border: '1px solid rgba(255,255,255,0.3)',
                  position: 'relative'
                }}
              >
                {/* Левая часть: чекбокс + текст */}
                <div className="flex items-center gap-4">
                  {/* Чекбокс слева (глянцевый шарик) */}
                    <button
                      onClick={() => {
                      toggleStepCompleted(stepId);
                      // Добавляем scale-up анимацию
                      const element = document.getElementById(`check-${stepId}`);
                      if (element) {
                        element.classList.add('scale-up');
                        setTimeout(() => element.classList.remove('scale-up'), 200);
                      }
                    }}
                    id={`check-${stepId}`}
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: 12,
                      background: isCompleted 
                        ? '#A855F7'
                        : '#E5E7EB',
                      border: 'none',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease-in-out',
                      boxShadow: 'none',
                      position: 'relative',
                      overflow: 'hidden'
                    }}
                  >
                    {isCompleted && (
                      <>
                        {/* Глянцевый перелив */}
                        <div 
                          style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            right: 0,
                            height: '50%',
                            background: 'linear-gradient(180deg, rgba(255,255,255,0.4), transparent)',
                            borderRadius: '12px 12px 0 0'
                          }}
                        />
                        <svg 
                          width="10" 
                          height="10" 
                          viewBox="0 0 20 20" 
                          fill="none"
                          className="scale-up"
                          style={{ position: 'relative', zIndex: 1 }}
                        >
                          <path 
                            d="M5 13l4 4L19 7" 
                            stroke="#FFFFFF" 
                            strokeWidth="2" 
                            strokeLinecap="round" 
                            strokeLinejoin="round"
                          />
                        </svg>
                      </>
                    )}
                  </button>
                  
                  {/* Текст */}
                  <div>
                    <h3 
                      style={{
                        fontFamily: 'Inter, sans-serif',
                        fontSize: '16px',
                        fontWeight: 700,
                        color: '#2A2A2A',
                        margin: 0,
                        marginBottom: 2
                      }}
                    >
                      {step.name}
                    </h3>
                    <p 
                      style={{
                        fontFamily: 'Inter, sans-serif',
                        fontSize: '14px',
                        fontWeight: 400,
                        color: '#8C8C8C',
                        margin: 0
                      }}
                    >
                      {step.description}
                    </p>
                  </div>
                </div>

              </div>
            );
          })}
        </div>

        {/* CTA Кнопка */}
        <div 
          style={{ marginBottom: 20 }}
        >
          <Link to="/plan">
            <button className="cta-button pulse-glow premium-hover" style={{ width: '100%' }}>
              <div className="cta-shimmer"></div>
              Открыть подробный план
            </button>
          </Link>
        </div>

        {/* Нижние кнопки */}
        <div 
          className="flex gap-4"
          style={{ marginTop: 20, marginBottom: 24 }}
        >
          <Link to="/cart" className="flex-1">
            <div 
              className="neomorphic-card premium-hover"
              style={{
                width: '100%',
                height: 72,
                background: '#FFFFFF',
                borderRadius: 16,
                boxShadow: '4px 4px 8px rgba(0,0,0,0.1), -4px -4px 8px rgba(255,255,255,0.8)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'all 0.3s ease'
              }}
            >
              <svg 
                width="24" 
                height="24" 
                viewBox="0 0 24 24" 
                fill="none"
                style={{ marginBottom: 6 }}
              >
                <path
                  d="M3 3H5L5.4 5M7 13H17L21 5H5.4M7 13L5.4 5M7 13L4.7 15.3C4.3 15.7 4.6 16.5 5.1 16.5H17M17 13V16.5M9 19.5C9.8 19.5 10.5 20.2 10.5 21S9.8 22.5 9 22.5 7.5 21.8 7.5 21 8.2 19.5 9 19.5ZM20 19.5C20.8 19.5 21.5 20.2 21.5 21S20.8 22.5 20 22.5 18.5 21.8 18.5 21 19.2 19.5 20 19.5Z"
                  stroke="#D4A574"
                  strokeWidth="1.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                />
              </svg>
              <span 
                style={{
                  fontFamily: 'Inter, sans-serif',
                  fontSize: '12px',
                  fontWeight: 400,
                  color: '#6B6B6B'
                }}
              >
                Корзина
              </span>
          </div>
          </Link>
          
          <Link to="/quiz" className="flex-1">
            <div 
              className="neomorphic-card premium-hover premium-glow"
              style={{
                width: '100%',
                height: 72,
                background: 'linear-gradient(135deg, #DDD6FE, #A855F7)',
                borderRadius: 16,
                boxShadow: '4px 4px 8px rgba(0,0,0,0.1), -4px -4px 8px rgba(255,255,255,0.8)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'all 0.3s ease'
              }}
            >
              <svg 
                width="24" 
                height="24" 
                viewBox="0 0 24 24" 
                fill="none"
                style={{ marginBottom: 6 }}
              >
                <path
                  d="M20 21V19C20 17.9 19.1 17 18 17H6C4.9 17 4 17.9 4 19V21M16 7C16 9.2 14.2 11 12 11S8 9.2 8 7 9.8 3 12 3 16 4.8 16 7Z"
                  stroke="#FFFFFF"
                  strokeWidth="1.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                />
              </svg>
              <span 
                style={{
                  fontFamily: 'Inter, sans-serif',
                  fontSize: '12px',
                  fontWeight: 400,
                  color: '#FFFFFF'
                }}
              >
                Анкета
              </span>
      </div>
          </Link>
        </div>
      </div>
    </div>
  );
}