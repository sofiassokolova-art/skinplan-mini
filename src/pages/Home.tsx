import { Link } from "react-router-dom";
import { useMemo, useState, useEffect } from "react";

// Design Tokens
const tokens = {
  colors: {
    BackgroundStart: "#FDF7F6",
    BackgroundEnd: "#FFFFFF",
    CardBase: "#FFF7F7",
    TextPrimary: "#2A2A2A",
    TextSecondary: "#8C8C8C",
    TextLight: "#6B6B6B",
    ActiveTab: "#FFD6D6",
    InactiveTab: "#F9F4F2",
    ProgressGradient1: "#F9A8D4",
    ProgressGradient2: "#FECACA",
    CtaGradient1: "#FFD6D6",
    CtaGradient2: "#FFB6B6",
    CheckboxGradient1: "#EECFFF",
    CheckboxGradient2: "#C29DFF",
    IconPink: "#FF7D7D",
    IconLavender: "#C29DFF"
  },
  shadows: {
    Card: "0 2px 8px rgba(0,0,0,0.06)",
    Switch: "0 1px 3px rgba(0,0,0,0.04)",
    Neomorphic: "8px 8px 16px rgba(0,0,0,0.1), -8px -8px 16px rgba(255,255,255,0.8)",
    InnerSoft: "inset 1px 1px 2px rgba(0,0,0,0.08), inset -1px -1px 2px rgba(255,255,255,0.9)",
    ButtonShadow: "0 2px 6px rgba(0,0,0,0.08)",
    ProgressGlow: "0 0 6px rgba(249, 168, 212, 0.2)"
  },
  radii: {
    Switch: 12,
    Card: 16,
    Button: 16,
    Icon: 12
  }
};

// Компонент кольцевого прогресса
function CircularProgress({ percentage, size = 36 }: { percentage: number; size?: number }) {
  const [animatedPercentage, setAnimatedPercentage] = useState(0);
  
  useEffect(() => {
    const timer = setTimeout(() => {
      setAnimatedPercentage(percentage);
    }, 100);
    return () => clearTimeout(timer);
  }, [percentage]);

  const strokeWidth = 3;
  const radius = (size - strokeWidth) / 2;
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
          strokeWidth={strokeWidth}
          fill="none"
        />
        {/* Прогресс круг */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="url(#progressGradient)"
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={strokeDasharray}
          strokeDashoffset={strokeDashoffset}
          style={{
            transition: 'stroke-dashoffset 0.5s ease-in-out',
            filter: 'drop-shadow(0 0 3px rgba(249, 168, 212, 0.2))'
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
      {/* Фон */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div 
          className="absolute inset-0"
          style={{
            background: `linear-gradient(180deg, ${tokens.colors.BackgroundStart}, ${tokens.colors.BackgroundEnd})`
          }}
        />
      </div>
      
      {/* Кастомные стили */}
      <style dangerouslySetInnerHTML={{__html: `
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700&family=Inter:wght@400;500;600;700&display=swap');
        
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
        
        .pearl-button {
          position: relative;
          overflow: hidden;
        }
        
        .pearl-button::before {
          content: '';
          position: absolute;
          top: 0;
          left: -100%;
          width: 100%;
          height: 100%;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent);
          animation: pearlShimmer 4s ease-in-out infinite;
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
      `}} />
      
      {/* Основной контент */}
      <div className="relative z-10 px-6 py-8">
        {/* Заголовок */}
        <div className="text-center" style={{ marginTop: 32 }}>
          <h1 
            style={{
              fontFamily: 'Playfair Display, serif',
              fontSize: '24px',
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

        {/* Переключатель Утро/Вечер (отдельная подложка) */}
        <div 
          style={{
            background: tokens.colors.CardBase,
            borderRadius: tokens.radii.Switch,
            height: 44,
            padding: 4,
            boxShadow: tokens.shadows.Switch,
            marginTop: 24,
            marginBottom: 24,
            display: 'flex',
            alignItems: 'center'
          }}
        >
              <button
                onClick={() => setActiveTime('morning')}
            style={{
              fontFamily: 'Inter, sans-serif',
              fontSize: '16px',
              fontWeight: 500,
              color: tokens.colors.TextPrimary,
              background: activeTime === 'morning' 
                ? tokens.colors.ActiveTab
                : tokens.colors.InactiveTab,
              border: 'none',
              borderRadius: 8,
              flex: 1,
              height: 36,
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
              fontSize: '16px',
              fontWeight: 500,
              color: activeTime === 'evening' ? tokens.colors.TextPrimary : tokens.colors.TextSecondary,
              background: activeTime === 'evening' 
                ? tokens.colors.ActiveTab
                : tokens.colors.InactiveTab,
              border: 'none',
              borderRadius: 8,
              flex: 1,
              height: 36,
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              boxShadow: activeTime === 'evening' ? tokens.shadows.InnerSoft : 'none'
            }}
          >
            Вечер
              </button>
          </div>

        {/* Карточки ухода */}
        <div style={{ marginBottom: 24 }}>
          {careSteps.map((step, index) => {
            const stepId = `${activeTime}-${step.id}-${index}`;
                const isCompleted = completedSteps[stepId] || false;
            const isFirstStep = index === 0;

                return (
              <div 
                key={step.id}
                style={{
                  background: tokens.colors.CardBase,
                  borderRadius: tokens.radii.Card,
                  boxShadow: tokens.shadows.Card,
                  height: 64,
                  padding: '16px',
                  marginBottom: index < careSteps.length - 1 ? 12 : 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}
              >
                {/* Левая часть: чекбокс + текст */}
                <div className="flex items-center gap-4">
                  {/* Чекбокс слева */}
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
                        ? `linear-gradient(135deg, ${tokens.colors.CheckboxGradient1}, ${tokens.colors.CheckboxGradient2})`
                        : `linear-gradient(135deg, #F5F5F5, #E8E8E8)`,
                      border: 'none',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease-in-out',
                      boxShadow: isCompleted 
                        ? '0 2px 4px rgba(238, 207, 255, 0.3), inset 0 1px 2px rgba(255,255,255,0.4)'
                        : 'inset 0 1px 2px rgba(0,0,0,0.1), inset 0 -1px 2px rgba(255,255,255,0.8)',
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
                            background: 'linear-gradient(180deg, rgba(255,255,255,0.3), transparent)',
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

                {/* Прогресс-круг только у первого шага */}
                {isFirstStep && (
                  <div style={{ marginRight: 16 }}>
                    <CircularProgress percentage={Math.round(progressPercentage)} />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* CTA Кнопка */}
        <div 
          className="pearl-button"
          style={{ marginBottom: 20 }}
        >
          <Link to="/plan">
            <button 
              style={{
                width: '100%',
                height: 48,
                borderRadius: tokens.radii.Button,
                background: `linear-gradient(135deg, ${tokens.colors.CtaGradient1}, ${tokens.colors.CtaGradient2})`,
                boxShadow: tokens.shadows.ButtonShadow,
                border: 'none',
                fontFamily: 'Inter, sans-serif',
                fontSize: '16px',
                fontWeight: 700,
                color: '#1A1A1A',
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
          className="flex justify-center gap-4"
          style={{ marginTop: 20, marginBottom: 24 }}
        >
          <Link to="/cart">
            <div 
              style={{
                width: 72,
                height: 72,
                background: tokens.colors.CardBase,
                borderRadius: tokens.radii.Icon,
                boxShadow: tokens.shadows.Card,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              <svg 
                width="28" 
                height="28" 
                viewBox="0 0 24 24" 
                fill="none"
                style={{ marginBottom: 4 }}
              >
                <path
                  d="M3 3H5L5.4 5M7 13H17L21 5H5.4M7 13L5.4 5M7 13L4.7 15.3C4.3 15.7 4.6 16.5 5.1 16.5H17M17 13V16.5M9 19.5C9.8 19.5 10.5 20.2 10.5 21S9.8 22.5 9 22.5 7.5 21.8 7.5 21 8.2 19.5 9 19.5ZM20 19.5C20.8 19.5 21.5 20.2 21.5 21S20.8 22.5 20 22.5 18.5 21.8 18.5 21 19.2 19.5 20 19.5Z"
                  stroke={tokens.colors.IconPink}
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
                  color: tokens.colors.TextLight
                }}
              >
                Корзина
              </span>
            </div>
          </Link>
          
          <Link to="/quiz">
            <div 
              style={{
                width: 72,
                height: 72,
                background: tokens.colors.CardBase,
                borderRadius: tokens.radii.Icon,
                boxShadow: tokens.shadows.Card,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              <svg 
                width="28" 
                height="28" 
                viewBox="0 0 24 24" 
                fill="none"
                style={{ marginBottom: 4 }}
              >
                <path
                  d="M20 21V19C20 17.9 19.1 17 18 17H6C4.9 17 4 17.9 4 19V21M16 7C16 9.2 14.2 11 12 11S8 9.2 8 7 9.8 3 12 3 16 4.8 16 7Z"
                  stroke={tokens.colors.IconLavender}
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
                  color: tokens.colors.TextLight
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