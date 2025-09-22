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
          stroke="#C29DFF"
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={strokeDasharray}
          strokeDashoffset={strokeDashoffset}
          style={{
            transition: 'stroke-dashoffset 0.5s ease-in-out'
          }}
        />
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
  ];

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Простой белый фон */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div 
          className="absolute inset-0"
          style={{
            background: '#FEFEFE'
          }}
        />
      </div>
      
      {/* Кастомные стили */}
      <style dangerouslySetInnerHTML={{__html: `
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700&family=Inter:wght@400;500;600;700&display=swap');
        
        @keyframes comboMove {
          0% {
            background-position: 50% 50%, 0% 50%;
          }
          50% {
            background-position: 60% 40%, 100% 50%;
          }
          100% {
            background-position: 50% 50%, 0% 50%;
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
          animation: pearlShimmer 5s ease-in-out infinite;
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
        {/* Бренд заголовок */}
        <div className="text-center" style={{ marginTop: 32, marginBottom: 16 }}>
          <h1 
            style={{
              fontFamily: 'Inter, sans-serif',
              fontSize: '18px',
              fontWeight: 600,
              color: tokens.colors.TextPrimary,
              margin: 0,
              marginBottom: 16
            }}
          >
            SKinIQ
          </h1>
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
            Привет, {userName || 'Имя'}!
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

        {/* Переключатель Утро/Вечер */}
        <div 
          style={{
            background: '#FEFEFE',
            borderRadius: tokens.radii.Switch,
            height: 44,
            padding: 4,
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
                ? '#FFD6D6'
                : 'transparent',
              border: 'none',
              borderRadius: 8,
              flex: 1,
              height: 36,
              cursor: 'pointer',
              transition: 'all 0.2s ease'
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
                ? '#FFD6D6'
                : 'transparent',
              border: activeTime === 'evening' ? 'none' : '1px solid #E0E0E0',
              borderRadius: 8,
              flex: 1,
              height: 36,
              cursor: 'pointer',
              transition: 'all 0.2s ease'
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
                  background: '#FEFEFE',
                  borderRadius: tokens.radii.Card,
                  boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
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
                        ? `linear-gradient(135deg, ${tokens.colors.CheckboxGradient1}, ${tokens.colors.CheckboxGradient2})`
                        : `linear-gradient(135deg, #F5F5F5, #E8E8E8)`,
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
                background: '#FFD6D6',
                boxShadow: 'none',
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
                background: '#FEFEFE',
                borderRadius: tokens.radii.Icon,
                border: '1px solid #E0E0E0',
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
                  stroke="#2A2A2A"
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
                  color: '#2A2A2A'
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
                background: '#C29DFF',
                borderRadius: tokens.radii.Icon,
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