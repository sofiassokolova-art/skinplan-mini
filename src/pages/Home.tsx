import { Link } from "react-router-dom";
import { useMemo, useState, useEffect } from "react";

// Функция проверки премиум доступа (из Plan.tsx)
function isPremium(): boolean {
  try {
    return localStorage.getItem("skiniq.premium") === "true";
  } catch {
    return false;
  }
}

function setPremium(value: boolean) {
  try {
    localStorage.setItem("skiniq.premium", value ? "true" : "false");
  } catch {}
}

// Компонент кругового прогресс-бара
function CircularProgress({ percentage, size = 28 }: { percentage: number; size?: number }) {
  const [animatedPercentage, setAnimatedPercentage] = useState(0);
  
  useEffect(() => {
    const timer = setTimeout(() => {
      setAnimatedPercentage(percentage);
    }, 100);
    return () => clearTimeout(timer);
  }, [percentage]);

  const radius = (size - 6) / 2;
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
          strokeWidth="3"
          fill="none"
        />
        {/* Прогресс круг */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="url(#progressGradient)"
          strokeWidth="3"
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
            <stop offset="0%" stopColor="#F7CEDF" />
            <stop offset="100%" stopColor="#E2D4F7" />
          </linearGradient>
        </defs>
      </svg>
      {/* Процент в центре */}
      <div 
        className="absolute inset-0 flex items-center justify-center"
        style={{ fontSize: '12px', fontWeight: 500, color: '#1A1A1A' }}
      >
        {Math.round(animatedPercentage)}%
      </div>
    </div>
  );
}

export default function Home() {
  const [activeTime, setActiveTime] = useState<'morning' | 'evening'>('morning');
  const [hasPremium, setHasPremium] = useState(isPremium());
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

  const hasCompletedQuiz = useMemo(() => {
    try {
      const data = localStorage.getItem("skiniq.answers");
      if (!data) return false;
      const parsed = JSON.parse(data);
      return (typeof parsed?.name === "string" ? parsed.name.trim() : "").length > 0;
    } catch {
      return false;
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
    { id: 'cleanser', name: 'Очищение', description: 'Очищающее средство', icon: '🧼', color: '#F7CEDF' },
    { id: 'toner', name: 'Тонизирование', description: 'Тоник', icon: '💧', color: '#E2D4F7' },
    { id: 'moisturizer', name: 'Увлажнение', description: 'Увлажняющий крем', icon: '🧴', color: '#F7CEDF' },
    { id: 'spf', name: 'SPF', description: 'Солнцезащитный крем', icon: '☀️', color: '#E2D4F7' },
  ];

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Живой градиентный фон */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-b from-[#FFF8F5] to-[#FCEEEF]"></div>
        <div className="animated-gradient absolute inset-0"></div>
        <div className="pearl-shimmer absolute inset-0"></div>
      </div>
      
      {/* Кастомные стили */}
      <style dangerouslySetInnerHTML={{__html: `
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700&family=Inter:wght@400;500;600&display=swap');
        
        .animated-gradient {
          background: linear-gradient(
            -45deg,
            #FFF8F5,
            #FCEEEF,
            #FFF8F5,
            #FCEEEF,
            #FFF8F5
          );
          background-size: 400% 400%;
          animation: gradientFlow 25s ease-in-out infinite;
        }
        
        @keyframes gradientFlow {
          0% {
            background-position: 0% 50%;
          }
          25% {
            background-position: 100% 50%;
          }
          50% {
            background-position: 100% 100%;
          }
          75% {
            background-position: 0% 100%;
          }
          100% {
            background-position: 0% 50%;
          }
        }
        
        .pearl-shimmer {
          background-image: 
            radial-gradient(circle at 20% 20%, rgba(255,255,255,0.08) 0%, transparent 50%),
            radial-gradient(circle at 80% 80%, rgba(255,255,255,0.06) 0%, transparent 50%),
            radial-gradient(circle at 40% 60%, rgba(255,255,255,0.05) 0%, transparent 50%);
          animation: shimmer 30s ease-in-out infinite;
        }
        
        @keyframes shimmer {
          0%, 100% {
            transform: translateX(0) translateY(0);
          }
          25% {
            transform: translateX(10px) translateY(-5px);
          }
          50% {
            transform: translateX(-5px) translateY(10px);
          }
          75% {
            transform: translateX(-10px) translateY(-5px);
          }
        }
        
        .capsule-container {
          background: rgba(255, 255, 255, 0.85);
          border-radius: 24px;
          box-shadow: 
            inset 0 2px 4px rgba(255,255,255,0.8),
            inset 0 -2px 6px rgba(0,0,0,0.05);
        }
        
        .time-button {
          font-family: 'Inter', sans-serif;
          font-size: 14px;
          font-weight: 500;
          padding: 12px 24px;
          border-radius: 20px;
          transition: all 0.3s ease;
        }
        
        .time-button.active {
          background: linear-gradient(135deg, #FADADD 0%, #E7D6F8 100%);
          color: #1A1A1A;
          box-shadow: 0 2px 8px rgba(250, 218, 221, 0.3);
          animation: gradientGlow 2s ease-in-out infinite alternate;
        }
        
        .time-button.inactive {
          background: transparent;
          color: #7D7D7D;
        }
        
        @keyframes gradientGlow {
          0% {
            box-shadow: 0 2px 8px rgba(250, 218, 221, 0.3);
          }
          100% {
            box-shadow: 0 4px 16px rgba(250, 218, 221, 0.5);
          }
        }
        
        .care-card {
          background: rgba(255, 255, 255, 0.9);
          border-radius: 16px;
          height: 64px;
          box-shadow: 
            0 4px 8px rgba(0,0,0,0.05),
            inset 0 1px 0 rgba(255,255,255,0.8);
          transition: all 0.3s ease;
        }
        
        .care-card:hover {
          transform: translateY(-1px);
          box-shadow: 
            0 6px 12px rgba(0,0,0,0.08),
            inset 0 1px 0 rgba(255,255,255,0.8);
        }
        
        .checkbox {
          width: 24px;
          height: 24px;
          border-radius: 50%;
          border: 2px solid #E5E5E5;
          transition: all 0.3s ease;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        
        .checkbox.checked {
          background: linear-gradient(135deg, #FADADD 0%, #E7D6F8 100%);
          border: none;
          transform: scale(1.1);
        }
        
        .main-button {
          background: linear-gradient(135deg, #FADADD 0%, #E7D6F8 100%);
          border-radius: 24px;
          font-family: 'Playfair Display', serif;
          font-size: 18px;
          font-weight: 600;
          color: #1A1A1A;
          box-shadow: 
            0 6px 12px rgba(0,0,0,0.08),
            inset 0 1px 0 rgba(255,255,255,0.8);
          transition: all 0.3s ease;
          position: relative;
          overflow: hidden;
        }
        
        .main-button::before {
          content: '';
          position: absolute;
          top: 0;
          left: -100%;
          width: 100%;
          height: 100%;
          background: linear-gradient(
            90deg,
            transparent,
            rgba(255, 255, 255, 0.2),
            transparent
          );
          animation: shimmer 8s ease-in-out infinite;
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
        
        .main-button:hover {
          transform: translateY(-2px);
          background: linear-gradient(135deg, #FADADD 0%, #E7D6F8 100%);
          box-shadow: 
            0 8px 16px rgba(0,0,0,0.12),
            inset 0 1px 0 rgba(255,255,255,0.8),
            0 0 20px rgba(250, 218, 221, 0.3);
        }
        
        .main-button:active {
          transform: scale(0.96);
          box-shadow: 
            0 4px 8px rgba(0,0,0,0.1),
            inset 0 2px 4px rgba(0,0,0,0.1),
            inset 0 0 10px rgba(0,0,0,0.05);
        }
        
        .bottom-button {
          background: white;
          border-radius: 16px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.05);
          transition: all 0.3s ease;
        }
        
        .bottom-button:hover {
          transform: translateY(-1px);
          box-shadow: 0 4px 8px rgba(0,0,0,0.08);
        }
      `}} />
      
      <div className="relative z-10 px-4 py-8">
        {/* Заголовок */}
        <div className="text-center mb-8" style={{ marginTop: '32px' }}>
          <h1 
            className="text-2xl font-bold mb-2"
            style={{ 
              fontFamily: 'Playfair Display, serif',
              fontSize: '24px',
              color: '#1A1A1A'
            }}
          >
            SKinIQ
          </h1>
          <p 
            className="text-base"
            style={{ 
              fontFamily: 'Inter, sans-serif',
              fontSize: '16px',
              color: '#7D7D7D'
            }}
          >
            {userName ? `Привет, ${userName}!` : 'Привет!'}
          </p>
          <p 
            className="text-sm mt-2"
            style={{ 
              fontFamily: 'Inter, sans-serif',
              fontSize: '14px',
              color: '#7D7D7D'
            }}
          >
            Твой уход на сегодня
          </p>
        </div>

        {/* Переключатель Утро/Вечер + Прогресс */}
        <div className="flex items-center justify-between mb-6">
          <div className="capsule-container flex p-1">
            <button
              onClick={() => setActiveTime('morning')}
              className={`time-button ${activeTime === 'morning' ? 'active' : 'inactive'}`}
            >
              Утро
            </button>
            <button
              onClick={() => setActiveTime('evening')}
              className={`time-button ${activeTime === 'evening' ? 'active' : 'inactive'}`}
            >
              Вечер
            </button>
          </div>
          <CircularProgress percentage={progressPercentage} />
        </div>

        {/* Карточки ухода */}
        <div className="space-y-4 mb-6">
          {careSteps.map((step, index) => {
            const stepId = `${activeTime}-${step.id}-${index}`;
            const isCompleted = completedSteps[stepId] || false;
            
            return (
              <div key={step.id} className="care-card flex items-center justify-between px-4">
                <div className="flex items-center gap-3">
                  <div 
                    className="w-5 h-5 rounded-full flex items-center justify-center text-sm"
                    style={{ backgroundColor: step.color }}
                  >
                    {step.icon}
                  </div>
                  <div>
                    <div 
                      className="font-medium"
                      style={{ 
                        fontFamily: 'Inter, sans-serif',
                        fontSize: '16px',
                        color: '#1A1A1A'
                      }}
                    >
                      {step.name}
                    </div>
                    <div 
                      className="text-sm"
                      style={{ 
                        fontFamily: 'Inter, sans-serif',
                        fontSize: '14px',
                        color: '#7D7D7D'
                      }}
                    >
                      {step.description}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => toggleStepCompleted(stepId)}
                  className={`checkbox ${isCompleted ? 'checked' : ''}`}
                >
                  {isCompleted && (
                    <span className="text-white text-xs font-bold">✓</span>
                  )}
                </button>
              </div>
            );
          })}
        </div>

        {/* Кнопка "Открыть подробный план" */}
        <div className="mb-6">
          <Link to="/plan">
            <button className="main-button w-full py-4 px-6">
              Открыть подробный план
            </button>
          </Link>
        </div>

        {/* Нижние кнопки */}
        <div className="flex gap-4">
          <Link to="/cart" className="flex-1">
            <div className="bottom-button p-4 text-center">
              <div className="text-2xl mb-2">🛒</div>
              <div 
                className="font-medium"
                style={{ 
                  fontFamily: 'Inter, sans-serif',
                  fontSize: '14px',
                  color: '#1A1A1A'
                }}
              >
                Корзина
              </div>
            </div>
          </Link>
          <Link to="/quiz" className="flex-1">
            <div className="bottom-button p-4 text-center">
              <div className="text-2xl mb-2">📋</div>
              <div 
                className="font-medium"
                style={{ 
                  fontFamily: 'Inter, sans-serif',
                  fontSize: '14px',
                  color: '#1A1A1A'
                }}
              >
                Анкета
              </div>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}