import { Link } from "react-router-dom";
import { useMemo, useState, useEffect } from "react";

// Design Tokens
const tokens = {
  colors: {
    PearlBG0: "#F6F0EB",
    CardBase: "#FBF7F2", 
    CapsuleBase: "#F3ECE7",
    Accent1: "#EFC7BE",
    Accent2: "#CAB9F6",
    Accent3: "#F7D7D0",
    TextPrimary: "#2D2B2A",
    TextSecondary: "#7B7773",
    TextDisabled: "#B7B2AD",
    Divider: "rgba(0,0,0,0.06)"
  },
  shadows: {
    OuterSoft1: "0 14px 28px rgba(0,0,0,0.10), 0 2px 6px rgba(0,0,0,0.06)",
    InnerSoft1: "inset 0 2px 2px rgba(0,0,0,0.08), inset 0 -2px 4px rgba(255,255,255,0.90)",
    PearlSheen: "0 0 0 1px rgba(255,255,255,0.35) inset, 0 -10px 25px rgba(255,255,255,0.35) inset"
  },
  radii: {
    ScreenContainer: 36,
    Card: 24,
    Capsule: 22,
    Tile: 20,
    Button: 28
  }
};

// Компонент кольцевого прогресса для первой карточки
function RingProgress({ percentage, size = 44 }: { percentage: number; size?: number }) {
  const [animatedPercentage, setAnimatedPercentage] = useState(0);
  
  useEffect(() => {
    const timer = setTimeout(() => {
      setAnimatedPercentage(percentage);
    }, 100);
    return () => clearTimeout(timer);
  }, [percentage]);

  const radius = (size - 10) / 2;
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
          stroke={tokens.colors.Divider}
          strokeWidth="5"
          fill="none"
        />
        {/* Прогресс круг */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="url(#ringProgressGradient)"
          strokeWidth="5"
          fill="none"
          strokeLinecap="round"
          strokeDasharray={strokeDasharray}
          strokeDashoffset={strokeDashoffset}
          style={{
            transition: 'stroke-dashoffset 0.3s ease-in-out',
          }}
        />
        <defs>
          <linearGradient id="ringProgressGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={tokens.colors.Accent1} />
            <stop offset="100%" stopColor={tokens.colors.Accent2} />
          </linearGradient>
        </defs>
      </svg>
      {/* Процент в центре */}
      <div 
        className="absolute inset-0 flex items-center justify-center"
        style={{ 
          fontSize: '12px', 
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

// Компонент прогресс-пилюли для капсулы
function ProgressPill({ progress }: { progress: number }) {
  return (
    <div 
      className="flex items-center justify-center"
      style={{
        width: 48,
        height: 28,
        borderRadius: 14,
        background: `linear-gradient(135deg, #EFD7F4, ${tokens.colors.Accent2})`,
        boxShadow: tokens.shadows.OuterSoft1,
        position: 'relative'
      }}
    >
      <span 
        style={{
          fontSize: '14px',
          fontWeight: 700,
          lineHeight: '18px',
          color: tokens.colors.TextPrimary
        }}
      >
        {progress}%
      </span>
      {/* Тонкое перламутровое кольцо */}
      <div 
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: 14,
          border: `1px solid rgba(255,255,255,0.3)`,
          pointerEvents: 'none'
        }}
      />
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

  // Данные для карточек ухода с монохромными иконками
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

  // Компонент монохромной иконки
  const MonochromeIcon = ({ type, size = 24 }: { type: string; size?: number }) => {
    const iconPaths = {
      cleanser: "M12 2L13.09 8.26L20 9L13.09 9.74L12 16L10.91 9.74L4 9L10.91 8.26L12 2Z",
      toner: "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z",
      moisturizer: "M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z",
      spf: "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.94-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"
    };

    return (
      <div 
        className="relative flex items-center justify-center"
        style={{ width: size, height: size }}
      >
        {/* Перламутровый хайлайт */}
        <div 
          className="absolute inset-0 rounded-full"
          style={{
            background: `${tokens.colors.Accent3}35`,
            filter: 'blur(2px)'
          }}
        />
        {/* Иконка */}
        <svg 
          width={size} 
          height={size} 
          viewBox="0 0 24 24" 
          fill="none"
          style={{ position: 'relative', zIndex: 1 }}
        >
          <path
            d={iconPaths[type as keyof typeof iconPaths] || iconPaths.cleanser}
            stroke={tokens.colors.TextSecondary}
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </svg>
      </div>
    );
  };

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Перламутровый фон */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        {/* Радиальный градиент */}
        <div 
          className="absolute inset-0"
          style={{
            background: `radial-gradient(ellipse 85% 85% at 50% 15%, #FFF7F2, ${tokens.colors.PearlBG0})`
          }}
        />
        {/* Линейный градиент */}
        <div 
          className="absolute inset-0"
          style={{
            background: `linear-gradient(180deg, ${tokens.colors.PearlBG0} 0%, #F2E7E1 60%, ${tokens.colors.PearlBG0} 100%)`,
            opacity: 0.65
          }}
        />
        {/* Дышащий shimmer */}
        <div 
          className="absolute inset-0 opacity-6"
          style={{
            background: `url("data:image/svg+xml,%3Csvg viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
            animation: 'shimmer 12s ease-in-out infinite'
          }}
        />
      </div>
      
      {/* Кастомные стили */}
      <style dangerouslySetInnerHTML={{__html: `
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700&family=Inter:wght@400;500;600;700&display=swap');
        
        @keyframes shimmer {
          0%, 100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-10px);
          }
        }
        
        .pearl-sheen {
          position: relative;
          overflow: hidden;
        }
        
        .pearl-sheen::before {
          content: '';
          position: absolute;
          top: 0;
          left: -100%;
          width: 100%;
          height: 100%;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.18), transparent);
          animation: pearlShimmer 6s ease-in-out infinite;
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
        
        .tab-button {
          transition: all 180ms cubic-bezier(0.4, 0, 0.2, 1);
        }
        
        .tab-button.active {
          background: linear-gradient(135deg, #F8E8E2, ${tokens.colors.Accent1} 50%, #F6EDEA);
          box-shadow: ${tokens.shadows.PearlSheen};
        }
        
        .check-control {
          transition: all 120ms cubic-bezier(0.4, 0, 0.2, 1);
        }
        
        .check-control.checked {
          background: linear-gradient(135deg, #F3C3BE, ${tokens.colors.Accent2});
          box-shadow: 0 0 6px ${tokens.colors.Accent2}35;
        }
      `}} />
      
      {/* Основной контейнер */}
      <div 
        className="relative z-10 mx-5 mt-6 mb-7"
        style={{
          background: tokens.colors.CardBase,
          borderRadius: tokens.radii.ScreenContainer,
          boxShadow: `${tokens.shadows.OuterSoft1}, ${tokens.shadows.PearlSheen}`,
          paddingTop: 24,
          paddingLeft: 20,
          paddingRight: 20,
          paddingBottom: 28
        }}
      >
        {/* Логотип */}
        <div 
          style={{
            fontSize: '12px',
            fontWeight: 600,
            color: tokens.colors.TextSecondary,
            opacity: 0.6,
            marginTop: 12
          }}
        >
          SkinIQ
        </div>

        {/* Заголовок */}
        <h1 
          style={{
            fontFamily: 'Playfair Display, serif',
            fontSize: '34px',
            fontWeight: 400,
            lineHeight: '40px',
            color: tokens.colors.TextPrimary,
            letterSpacing: '-0.4px',
            marginTop: 24,
            marginBottom: 8
          }}
        >
          Привет, {userName || 'Пользователь'}!
        </h1>
        
        <p 
          style={{
            fontFamily: 'Inter, sans-serif',
            fontSize: '18px',
            fontWeight: 500,
            lineHeight: '24px',
            color: tokens.colors.TextSecondary,
            marginBottom: 16
          }}
        >
          Твой уход на сегодня
        </p>

        {/* Капсула Утро/Вечер + Прогресс */}
        <div 
          className="flex items-center justify-between"
          style={{
            background: tokens.colors.CapsuleBase,
            borderRadius: tokens.radii.Capsule,
            height: 44,
            padding: 6,
            boxShadow: tokens.shadows.InnerSoft1,
            marginBottom: 16
          }}
        >
          {/* Табы */}
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTime('morning')}
              className={`tab-button px-3 py-1 rounded-2xl ${
                activeTime === 'morning' ? 'active' : ''
              }`}
              style={{
                fontFamily: 'Inter, sans-serif',
                fontSize: '16px',
                fontWeight: activeTime === 'morning' ? 700 : 600,
                lineHeight: '20px',
                color: activeTime === 'morning' ? '#2F2B2A' : tokens.colors.TextSecondary,
                borderRadius: 16
              }}
            >
              Утро
            </button>
            <button
              onClick={() => setActiveTime('evening')}
              className={`tab-button px-3 py-1 rounded-2xl ${
                activeTime === 'evening' ? 'active' : ''
              }`}
              style={{
                fontFamily: 'Inter, sans-serif',
                fontSize: '16px',
                fontWeight: activeTime === 'evening' ? 700 : 600,
                lineHeight: '20px',
                color: activeTime === 'evening' ? '#2F2B2A' : tokens.colors.TextSecondary,
                borderRadius: 16
              }}
            >
              Вечер
            </button>
          </div>
          
          {/* Прогресс-пилюля */}
          <ProgressPill progress={Math.round(progressPercentage)} />
        </div>

        {/* Карточки ухода */}
        <div style={{ marginBottom: 16 }}>
          {careSteps.map((step, index) => {
            const stepId = `${activeTime}-${step.id}-${index}`;
            const isCompleted = completedSteps[stepId] || false;
            const isFirstCard = index === 0;
            
            return (
              <div 
                key={step.id} 
                className="pearl-sheen"
                style={{
                  background: tokens.colors.CardBase,
                  borderRadius: tokens.radii.Card,
                  boxShadow: `${tokens.shadows.OuterSoft1}, ${tokens.shadows.PearlSheen}`,
                  minHeight: 92,
                  padding: '14px 16px',
                  marginBottom: index < careSteps.length - 1 ? 12 : 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}
              >
                {/* Левая часть: иконка + текст */}
                <div className="flex items-center gap-4">
                  <MonochromeIcon type={step.icon} size={24} />
                  <div>
                    <h3 
                      style={{
                        fontFamily: 'Inter, sans-serif',
                        fontSize: '20px',
                        fontWeight: 700,
                        lineHeight: '24px',
                        color: tokens.colors.TextPrimary,
                        margin: 0
                      }}
                    >
                      {step.name}
                    </h3>
                    <p 
                      style={{
                        fontFamily: 'Inter, sans-serif',
                        fontSize: '16px',
                        fontWeight: 400,
                        lineHeight: '22px',
                        color: tokens.colors.TextSecondary,
                        margin: 0
                      }}
                    >
                      {step.description}
                    </p>
                  </div>
                </div>

                {/* Правая часть: прогресс или чек-контрол */}
                {isFirstCard ? (
                  <div style={{ marginLeft: 12 }}>
                    <RingProgress percentage={Math.round(progressPercentage)} />
                  </div>
                ) : (
                  <button
                    onClick={() => toggleStepCompleted(stepId)}
                    className={`check-control ${
                      isCompleted ? 'checked' : ''
                    }`}
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 14,
                      background: isCompleted 
                        ? `linear-gradient(135deg, #F3C3BE, ${tokens.colors.Accent2})`
                        : tokens.colors.CapsuleBase,
                      boxShadow: isCompleted 
                        ? `0 0 6px ${tokens.colors.Accent2}35`
                        : tokens.shadows.InnerSoft1,
                      border: 'none',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer'
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
                )}
              </div>
            );
          })}
        </div>

        {/* CTA Кнопка */}
        <div 
          className="pearl-sheen"
          style={{ marginBottom: 16 }}
        >
          <Link to="/plan">
            <button 
              style={{
                width: '100%',
                height: 56,
                borderRadius: tokens.radii.Button,
                background: `linear-gradient(125deg, ${tokens.colors.Accent3}, ${tokens.colors.Accent1} 45%, #F0E6E1)`,
                boxShadow: `${tokens.shadows.OuterSoft1}, ${tokens.shadows.PearlSheen}`,
                border: 'none',
                fontFamily: 'Inter, sans-serif',
                fontSize: '18px',
                fontWeight: 700,
                lineHeight: '22px',
                color: '#2D2B2A',
                letterSpacing: '-0.2px',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
              onMouseDown={(e) => {
                e.currentTarget.style.transform = 'scale(0.98)';
                e.currentTarget.style.boxShadow = tokens.shadows.InnerSoft1;
              }}
              onMouseUp={(e) => {
                e.currentTarget.style.transform = 'scale(1)';
                e.currentTarget.style.boxShadow = `${tokens.shadows.OuterSoft1}, ${tokens.shadows.PearlSheen}`;
              }}
            >
              Открыть подробный план
            </button>
          </Link>
        </div>

        {/* Нижние плитки */}
        <div 
          className="flex gap-3"
          style={{ marginBottom: 16 }}
        >
          <Link to="/cart" className="flex-1">
            <div 
              className="pearl-sheen flex flex-col items-center justify-center"
              style={{
                background: tokens.colors.CardBase,
                borderRadius: tokens.radii.Tile,
                boxShadow: `${tokens.shadows.OuterSoft1}, ${tokens.shadows.PearlSheen}`,
                minHeight: 92,
                padding: 16,
                cursor: 'pointer'
              }}
            >
              <svg 
                width="28" 
                height="28" 
                viewBox="0 0 24 24" 
                fill="none"
                style={{ marginBottom: 8 }}
              >
                <path
                  d="M3 3H5L5.4 5M7 13H17L21 5H5.4M7 13L5.4 5M7 13L4.7 15.3C4.3 15.7 4.6 16.5 5.1 16.5H17M17 13V16.5M9 19.5C9.8 19.5 10.5 20.2 10.5 21S9.8 22.5 9 22.5 7.5 21.8 7.5 21 8.2 19.5 9 19.5ZM20 19.5C20.8 19.5 21.5 20.2 21.5 21S20.8 22.5 20 22.5 18.5 21.8 18.5 21 19.2 19.5 20 19.5Z"
                  stroke={tokens.colors.TextSecondary}
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                />
              </svg>
              <span 
                style={{
                  fontFamily: 'Inter, sans-serif',
                  fontSize: '16px',
                  fontWeight: 600,
                  lineHeight: '20px',
                  color: tokens.colors.TextPrimary
                }}
              >
                Корзина
              </span>
            </div>
          </Link>
          
          <Link to="/quiz" className="flex-1">
            <div 
              className="pearl-sheen flex flex-col items-center justify-center"
              style={{
                background: tokens.colors.CardBase,
                borderRadius: tokens.radii.Tile,
                boxShadow: `${tokens.shadows.OuterSoft1}, ${tokens.shadows.PearlSheen}`,
                minHeight: 92,
                padding: 16,
                cursor: 'pointer'
              }}
            >
              <svg 
                width="28" 
                height="28" 
                viewBox="0 0 24 24" 
                fill="none"
                style={{ marginBottom: 8 }}
              >
                <path
                  d="M20 21V19C20 17.9 19.1 17 18 17H6C4.9 17 4 17.9 4 19V21M16 7C16 9.2 14.2 11 12 11S8 9.2 8 7 9.8 3 12 3 16 4.8 16 7Z"
                  stroke={tokens.colors.TextSecondary}
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                />
              </svg>
              <span 
                style={{
                  fontFamily: 'Inter, sans-serif',
                  fontSize: '16px',
                  fontWeight: 600,
                  lineHeight: '20px',
                  color: tokens.colors.TextPrimary
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