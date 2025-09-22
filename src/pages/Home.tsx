import { Link } from "react-router-dom";
import { useMemo, useState, useEffect } from "react";

// Design Tokens
const tokens = {
  colors: {
    BackgroundStart: "#FDF5F5",
    BackgroundEnd: "#F8F0EC",
    CardBase: "#FFFFFF",
    TextPrimary: "#1C1C1C",
    TextSecondary: "#6F6F6F",
    AccentGradient1: "#F9DAD8",
    AccentGradient2: "#F3CACA",
    ProgressGradient1: "#C09FFF",
    ProgressGradient2: "#F8B6C3",
    IconBlue: "#E3F2FD",
    IconPurple: "#F3E5F5",
    IconBeige: "#FFF8E1",
    IconYellow: "#FFFDE7",
    CheckboxInactive: "#EEE"
  },
  shadows: {
    Neomorphic: "8px 8px 16px rgba(0,0,0,0.1), -8px -8px 16px rgba(255,255,255,0.8)",
    InnerSoft: "inset 2px 2px 4px rgba(0,0,0,0.1), inset -2px -2px 4px rgba(255,255,255,0.8)",
    ButtonShadow: "0 4px 10px rgba(0,0,0,0.1)"
  },
  radii: {
    Capsule: 24,
    Card: 16,
    Button: 24,
    Icon: 12
  }
};

// Компонент кольцевого прогресса
function CircularProgress({ percentage, size = 40 }: { percentage: number; size?: number }) {
  const [animatedPercentage, setAnimatedPercentage] = useState(0);
  
  useEffect(() => {
    const timer = setTimeout(() => {
      setAnimatedPercentage(percentage);
    }, 100);
    return () => clearTimeout(timer);
  }, [percentage]);

  const radius = (size - 8) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDasharray = circumference;
  const strokeDashoffset = circumference - (animatedPercentage / 100) * circumference;

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
          strokeWidth="4"
          fill="none"
        />
        {/* Прогресс круг */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="url(#progressGradient)"
          strokeWidth="4"
          fill="none"
          strokeLinecap="round"
          strokeDasharray={strokeDasharray}
          strokeDashoffset={strokeDashoffset}
          style={{
            transition: 'stroke-dashoffset 0.3s ease-in-out',
          }}
        />
        <defs>
          <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={tokens.colors.ProgressGradient1} />
            <stop offset="100%" stopColor={tokens.colors.ProgressGradient2} />
          </linearGradient>
        </defs>
      </svg>
      {/* Процент в центре */}
      <div 
        className="absolute inset-0 flex items-center justify-center"
        style={{ 
          fontSize: '14px', 
          fontWeight: 700, 
          color: tokens.colors.TextPrimary,
          lineHeight: '14px'
        }}
      >
        {Math.round(animatedPercentage)}%
      </div>
    </div>
  );
}

// Компонент абстрактной иконки
function AbstractIcon({ type, size = 40 }: { type: string; size?: number }) {
  const iconConfigs = {
    cleanser: {
      bgColor: tokens.colors.IconBlue,
      symbol: "○",
      symbolColor: "#2196F3"
    },
    toner: {
      bgColor: tokens.colors.IconPurple,
      symbol: "●",
      symbolColor: "#9C27B0"
    },
    moisturizer: {
      bgColor: tokens.colors.IconBeige,
      symbol: "●",
      symbolColor: "#FF9800"
    },
    spf: {
      bgColor: tokens.colors.IconYellow,
      symbol: "☀",
      symbolColor: "#FFC107"
    }
  };

  const config = iconConfigs[type as keyof typeof iconConfigs] || iconConfigs.cleanser;

  return (
    <div 
      className="flex items-center justify-center rounded-full"
      style={{
        width: size,
        height: size,
        backgroundColor: config.bgColor,
        boxShadow: tokens.shadows.Neomorphic
      }}
    >
      <span 
        style={{
          fontSize: size * 0.4,
          color: config.symbolColor,
          fontWeight: 'bold'
        }}
      >
        {config.symbol}
      </span>
    </div>
  );
}

export default function Home() {
  const [activeTime, setActiveTime] = useState<'morning' | 'evening'>('morning');
  const [completedSteps, setCompletedSteps] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem('skiniq.routine_progress');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
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

  const userName = useMemo(() => {
    try {
      const data = localStorage.getItem("skiniq.answers");
      const parsed = data ? JSON.parse(data) : {};
      return parsed?.name || undefined;
    } catch {
      return undefined;
    }
  }, []);

  const plan = useMemo(() => {
    try {
      const data = localStorage.getItem("skiniq.plan");
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  }, []);

  // Вычисляем прогресс для текущего времени дня
  const currentSteps = activeTime === 'morning' ? (plan?.morning || []) : (plan?.evening || []);
  const completedCount = currentSteps.filter((step: any, idx: number) => {
    const stepId = `${activeTime}-${step.step}-${idx}`;
    return completedSteps[stepId];
  }).length;
  const progressPercentage = currentSteps.length > 0 ? (completedCount / currentSteps.length) * 100 : 0;

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
      name: 'Сыворотка', 
      description: 'Сыворотка', 
      icon: 'toner' as const
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
    },
  ];

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Анимированный фон */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div 
          className="absolute inset-0"
          style={{
            background: `linear-gradient(135deg, ${tokens.colors.BackgroundStart}, ${tokens.colors.BackgroundEnd})`,
            animation: 'gradientMove 18s linear infinite'
          }}
        />
      </div>
      
      {/* Кастомные стили */}
      <style dangerouslySetInnerHTML={{__html: `
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700&family=Inter:wght@400;500;600;700&display=swap');
        
        @keyframes gradientMove {
          0% {
            background-position: 0% 50%;
          }
          50% {
            background-position: 100% 50%;
          }
          100% {
            background-position: 0% 50%;
          }
        }
        
        @keyframes shimmer {
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
        
        .shimmer-button {
          position: relative;
          overflow: hidden;
        }
        
        .shimmer-button::before {
          content: '';
          position: absolute;
          top: 0;
          left: -100%;
          width: 100%;
          height: 100%;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent);
          animation: shimmer 5s ease-in-out infinite;
        }
        
        .fade-in-up {
          animation: fadeInUp 0.6s ease-out forwards;
          opacity: 0;
          transform: translateY(20px) scale(0.95);
        }
        
        @keyframes fadeInUp {
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        
        .bounce-check {
          animation: bounceCheck 0.3s ease-in-out;
        }
        
        @keyframes bounceCheck {
          0% {
            transform: scale(0.85);
          }
          50% {
            transform: scale(1.1);
          }
          100% {
            transform: scale(1);
          }
        }
      `}} />
      
      {/* Основной контент */}
      <div className="relative z-10 px-4 py-8">
        {/* Заголовок */}
        <div className="text-center fade-in-up" style={{ marginTop: 32 }}>
          <h1 
            style={{
              fontFamily: 'Playfair Display, serif',
              fontSize: '28px',
              fontWeight: 700,
              color: tokens.colors.TextPrimary,
              margin: 0,
              marginBottom: 8
            }}
          >
            Привет, {userName || 'Пользователь'}!
          </h1>
          <p 
            style={{
              fontFamily: 'Inter, sans-serif',
              fontSize: '16px',
              fontWeight: 400,
              color: tokens.colors.TextSecondary,
              margin: 0
            }}
          >
            Твой уход на сегодня
          </p>
        </div>

        {/* Блок Утро/Вечер + Прогресс */}
        <div 
          className="fade-in-up"
          style={{
            background: tokens.colors.CardBase,
            borderRadius: tokens.radii.Capsule,
            height: 48,
            padding: 6,
            boxShadow: tokens.shadows.Neomorphic,
            marginTop: 24,
            marginBottom: 24,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          {/* Табы */}
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTime('morning')}
              style={{
                fontFamily: 'Inter, sans-serif',
                fontSize: '14px',
                fontWeight: 600,
                color: tokens.colors.TextPrimary,
                background: activeTime === 'morning' 
                  ? `linear-gradient(135deg, ${tokens.colors.AccentGradient1}, ${tokens.colors.AccentGradient2})`
                  : tokens.colors.CardBase,
                border: 'none',
                borderRadius: 18,
                padding: '8px 16px',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                boxShadow: activeTime === 'morning' ? tokens.shadows.InnerSoft : 'none'
              }}
            >
              Утро
            </button>
            <button
              onClick={() => setActiveTime('evening')}
              style={{
                fontFamily: 'Inter, sans-serif',
                fontSize: '14px',
                fontWeight: 600,
                color: tokens.colors.TextPrimary,
                background: activeTime === 'evening' 
                  ? `linear-gradient(135deg, ${tokens.colors.AccentGradient1}, ${tokens.colors.AccentGradient2})`
                  : tokens.colors.CardBase,
                border: 'none',
                borderRadius: 18,
                padding: '8px 16px',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                boxShadow: activeTime === 'evening' ? tokens.shadows.InnerSoft : 'none'
              }}
            >
              Вечер
            </button>
          </div>
          
          {/* Прогресс */}
          <CircularProgress percentage={Math.round(progressPercentage)} />
        </div>

        {/* Карточки ухода */}
        <div style={{ marginBottom: 24 }}>
          {careSteps.map((step, index) => {
            const stepId = `${activeTime}-${step.id}-${index}`;
            const isCompleted = completedSteps[stepId] || false;
            
            return (
              <div 
                key={step.id} 
                className="fade-in-up"
                style={{
                  background: tokens.colors.CardBase,
                  borderRadius: tokens.radii.Card,
                  boxShadow: tokens.shadows.Neomorphic,
                  padding: '16px',
                  marginBottom: index < careSteps.length - 1 ? 12 : 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  animationDelay: `${index * 0.1}s`
                }}
              >
                {/* Левая часть: иконка + текст */}
                <div className="flex items-center gap-4">
                  <AbstractIcon type={step.icon} size={40} />
                  <div>
                    <h3 
                      style={{
                        fontFamily: 'Inter, sans-serif',
                        fontSize: '16px',
                        fontWeight: 700,
                        color: tokens.colors.TextPrimary,
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
                        color: tokens.colors.TextSecondary,
                        margin: 0
                      }}
                    >
                      {step.description}
                    </p>
                  </div>
                </div>

                {/* Чекбокс */}
                <button
                  onClick={() => {
                    toggleStepCompleted(stepId);
                    // Добавляем bounce анимацию
                    const element = document.getElementById(`check-${stepId}`);
                    if (element) {
                      element.classList.add('bounce-check');
                      setTimeout(() => element.classList.remove('bounce-check'), 300);
                    }
                  }}
                  id={`check-${stepId}`}
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 14,
                    background: isCompleted 
                      ? `linear-gradient(135deg, ${tokens.colors.ProgressGradient1}, ${tokens.colors.ProgressGradient2})`
                      : tokens.colors.CheckboxInactive,
                    border: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    transition: 'all 0.3s ease-in-out',
                    boxShadow: tokens.shadows.InnerSoft
                  }}
                >
                  {isCompleted && (
                    <svg 
                      width="12" 
                      height="12" 
                      viewBox="0 0 20 20" 
                      fill="none"
                    >
                      <path 
                        d="M5 13l4 4L19 7" 
                        stroke="#FFFFFF" 
                        strokeWidth="2" 
                        strokeLinecap="round" 
                        strokeLinejoin="round"
                      />
                    </svg>
                  )}
                </button>
              </div>
            );
          })}
        </div>

        {/* CTA Кнопка */}
        <div 
          className="fade-in-up shimmer-button"
          style={{ marginBottom: 20 }}
        >
          <Link to="/plan">
            <button 
              style={{
                width: '100%',
                height: 48,
                borderRadius: tokens.radii.Button,
                background: `linear-gradient(135deg, ${tokens.colors.AccentGradient1}, ${tokens.colors.AccentGradient2})`,
                boxShadow: tokens.shadows.ButtonShadow,
                border: 'none',
                fontFamily: 'Inter, sans-serif',
                fontSize: '16px',
                fontWeight: 600,
                color: tokens.colors.TextPrimary,
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              Открыть подробный план
            </button>
          </Link>
        </div>

        {/* Нижние иконки */}
        <div 
          className="flex justify-center gap-4 fade-in-up"
          style={{ marginTop: 20 }}
        >
          <Link to="/cart">
            <div 
              style={{
                width: 64,
                height: 64,
                background: tokens.colors.CardBase,
                borderRadius: tokens.radii.Icon,
                boxShadow: tokens.shadows.Neomorphic,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              <svg 
                width="24" 
                height="24" 
                viewBox="0 0 24 24" 
                fill="none"
                style={{ marginBottom: 4 }}
              >
                <path
                  d="M3 3H5L5.4 5M7 13H17L21 5H5.4M7 13L5.4 5M7 13L4.7 15.3C4.3 15.7 4.6 16.5 5.1 16.5H17M17 13V16.5M9 19.5C9.8 19.5 10.5 20.2 10.5 21S9.8 22.5 9 22.5 7.5 21.8 7.5 21 8.2 19.5 9 19.5ZM20 19.5C20.8 19.5 21.5 20.2 21.5 21S20.8 22.5 20 22.5 18.5 21.8 18.5 21 19.2 19.5 20 19.5Z"
                  stroke="#E91E63"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                />
              </svg>
              <span 
                style={{
                  fontFamily: 'Inter, sans-serif',
                  fontSize: '12px',
                  fontWeight: 500,
                  color: tokens.colors.TextSecondary
                }}
              >
                Корзина
              </span>
            </div>
          </Link>
          
          <Link to="/quiz">
            <div 
              style={{
                width: 64,
                height: 64,
                background: tokens.colors.CardBase,
                borderRadius: tokens.radii.Icon,
                boxShadow: tokens.shadows.Neomorphic,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              <svg 
                width="24" 
                height="24" 
                viewBox="0 0 24 24" 
                fill="none"
                style={{ marginBottom: 4 }}
              >
                <path
                  d="M20 21V19C20 17.9 19.1 17 18 17H6C4.9 17 4 17.9 4 19V21M16 7C16 9.2 14.2 11 12 11S8 9.2 8 7 9.8 3 12 3 16 4.8 16 7Z"
                  stroke="#9C27B0"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                />
              </svg>
              <span 
                style={{
                  fontFamily: 'Inter, sans-serif',
                  fontSize: '12px',
                  fontWeight: 500,
                  color: tokens.colors.TextSecondary
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