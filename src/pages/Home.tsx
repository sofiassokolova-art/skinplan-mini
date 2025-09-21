import { Link } from "react-router-dom";
import { useMemo, useState } from "react";
import { Card, CircularProgress } from "../ui";


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

  // Данные для задач ухода
  const skincareTasks = useMemo(() => {
    const morningTasks = [
      { id: 'morning-cleanser', iconType: 'cleanser' as const, title: 'Очистка', subtitle: 'На влажную кожу' },
      { id: 'morning-serum', iconType: 'serum' as const, title: 'Сыворотка', subtitle: 'После очищения' },
      { id: 'morning-moisturizer', iconType: 'cream' as const, title: 'Крем', subtitle: 'Перед SPF' },
      { id: 'morning-spf', iconType: 'spf' as const, title: 'SPF', subtitle: 'За 15 мин до выхода' }
    ];
    
    const eveningTasks = [
      { id: 'evening-cleanser', iconType: 'cleanser' as const, title: 'Очистка', subtitle: 'Масло + гель' },
      { id: 'evening-treatment', iconType: 'serum' as const, title: 'Сыворотка', subtitle: 'На сухую кожу' },
      { id: 'evening-moisturizer', iconType: 'cream' as const, title: 'Крем', subtitle: 'Завершающий этап' }
    ];
    
    return activeTime === 'morning' ? morningTasks : eveningTasks;
  }, [activeTime]);

  // Подсчет прогресса
  const progress = useMemo(() => {
    const totalTasks = skincareTasks.length;
    const completedTasks = skincareTasks.filter(task => completedSteps[task.id]).length;
    return totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;
  }, [skincareTasks, completedSteps]);

  return (
    <div className="min-h-screen animate-fadeInUp">
      {/* Логотип в левом верхнем углу */}
      <div className="absolute top-4 left-4 z-20">
        <Link to="/" className="flex items-center">
          <img 
            src="/skiniq-logo.png" 
            alt="SkinIQ" 
            className="h-8 w-auto opacity-80 hover:opacity-100 transition-opacity duration-300"
          />
        </Link>
      </div>

      {/* Hero Section */}
      <div className="pt-8">
        {/* Заголовок */}
        <div className="text-center animate-slideInUp" style={{ marginTop: '32px', animationDelay: '100ms' }}>
          <h1 className="font-serif" style={{ fontSize: '24px', lineHeight: '1.2', color: '#000000', fontWeight: '400' }}>
            Привет, {userName || 'Пользователь'}!
          </h1>
          {/* Подзаголовок */}
          <p className="font-sans" style={{ fontSize: '16px', marginTop: '8px', color: '#6D6D6D', fontWeight: '400' }}>
            Твой уход на сегодня
          </p>
        </div>
      </div>

      {/* Центральная часть - Сегодняшний уход */}
      {hasCompletedQuiz && plan ? (
        <div className="container-premium">
          {/* Единая эндоморфная капсула: переключатель + прогресс */}
          <div className="mt-6 animate-slideInUp" style={{ animationDelay: '200ms' }}>
            <div 
              className="flex items-center justify-between px-4 py-2 transition-all duration-300"
              style={{ 
                background: 'linear-gradient(135deg, #FDFDFD, #F7F1EF)',
                borderRadius: '22px',
                height: '44px',
                boxShadow: 'inset 2px 2px 6px rgba(0,0,0,0.05), inset -2px -2px 6px rgba(255,255,255,0.8)'
              }}
            >
              {/* Переключатель Утро/Вечер */}
              <div className="flex gap-2">
                <button
                  onClick={() => setActiveTime('morning')}
                  className={`
                    font-sans transition-all duration-300 px-3 py-1
                    ${activeTime === 'morning' 
                      ? 'font-bold text-black' 
                      : 'font-normal text-black opacity-60 hover:opacity-80'
                    }
                  `}
                  style={{ 
                    fontSize: '16px',
                    borderRadius: '16px',
                    background: activeTime === 'morning' 
                      ? '#F2C8C2' 
                      : 'transparent'
                  }}
                >
                  Утро
                </button>
                <button
                  onClick={() => setActiveTime('evening')}
                  className={`
                    font-sans transition-all duration-300 px-3 py-1
                    ${activeTime === 'evening' 
                      ? 'font-bold text-black' 
                      : 'font-normal text-black opacity-60 hover:opacity-80'
                    }
                  `}
                  style={{ 
                    fontSize: '16px',
                    borderRadius: '16px',
                    background: activeTime === 'evening' 
                      ? '#F2C8C2' 
                      : 'transparent'
                  }}
                >
                  Вечер
                </button>
              </div>
              
              {/* Прогресс-бар справа внутри капсулы */}
              <CircularProgress 
                progress={progress} 
                size={28} 
                strokeWidth={2}
              />
            </div>
          </div>

          {/* Карточки ухода - перламутровые капсулы */}
          <div className="mt-4 space-y-4">
            {skincareTasks.map((task, index) => (
              <div
                key={task.id}
                onClick={() => {
                  toggleStepCompleted(task.id);
                  // Добавляем анимацию нажатия
                  const element = document.getElementById(`task-${task.id}`);
                  if (element) {
                    element.style.animation = 'elasticPress 0.3s ease-out';
                    setTimeout(() => {
                      element.style.animation = '';
                    }, 300);
                  }
                }}
                id={`task-${task.id}`}
                className={`
                  cursor-pointer transition-all duration-200 hover:shadow-lg flex items-center justify-between px-4
                  animate-staggered-${index + 1}
                `}
                style={{ 
                  height: '64px',
                  borderRadius: '16px',
                  background: '#FFFFFF',
                  backgroundImage: 'linear-gradient(135deg, rgba(255,255,255,0.9), rgba(247,241,239,0.3))',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.06), inset -1px -1px 3px rgba(255,255,255,0.8), inset 1px 1px 3px rgba(0,0,0,0.03)'
                }}
              >
                {/* Левая часть: иконка и текст */}
                <div className="flex items-center gap-4">
                  {/* Монохромная пастельная иконка */}
                  <div 
                    className="w-6 h-6 rounded-lg flex items-center justify-center"
                    style={{ 
                      backgroundColor: index === 0 ? '#E8F4F8' : index === 1 ? '#F9F1E8' : index === 2 ? '#FFF8E1' : '#F3F0F4',
                      border: `1px solid ${index === 0 ? '#A8D8EA' : index === 1 ? '#F4D4BA' : index === 2 ? '#F2C94C' : '#9B8AA3'}`,
                      opacity: 0.7
                    }}
                  >
                    <div 
                      className="w-3 h-3 rounded-sm"
                      style={{ 
                        backgroundColor: index === 0 ? '#A8D8EA' : index === 1 ? '#F4D4BA' : index === 2 ? '#F2C94C' : '#9B8AA3',
                        opacity: 0.6
                      }}
                    ></div>
                  </div>
                  
                  {/* Текст */}
                  <div>
                    <h4 className="font-sans font-bold" style={{ fontSize: '16px', color: '#000000' }}>
                      {task.title}
                    </h4>
                    <p className="font-sans" style={{ fontSize: '14px', color: '#6D6D6D' }}>
                      {task.subtitle}
                    </p>
                  </div>
                </div>

                {/* Эндоморфный чекбокс-капсула справа */}
                <div 
                  className={`
                    w-6 h-6 rounded-full flex items-center justify-center transition-all duration-300
                  `}
                  style={{
                    background: completedSteps[task.id] 
                      ? 'linear-gradient(135deg, #D7A6E8, #F2C8C2)' 
                      : '#F8F8F8',
                    boxShadow: completedSteps[task.id] 
                      ? 'inset 1px 1px 3px rgba(0,0,0,0.15), 0 0 8px rgba(215, 166, 232, 0.3)' 
                      : 'inset 1px 1px 3px rgba(0,0,0,0.08), inset -1px -1px 3px rgba(255,255,255,0.8)'
                  }}
                >
                  {completedSteps[task.id] && (
                    <svg 
                      className="w-3 h-3 text-white" 
                      fill="none" 
                      stroke="currentColor" 
                      viewBox="0 0 20 20"
                      style={{ animation: 'strokeDraw 0.3s ease-out' }}
                    >
                      <path 
                        strokeLinecap="round" 
                        strokeLinejoin="round" 
                        strokeWidth={2} 
                        d="M5 13l4 4L19 7"
                        style={{
                          strokeDasharray: '20',
                          strokeDashoffset: '0'
                        }}
                      />
                    </svg>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* CTA Кнопка - длинная эндоморфная капсула */}
          <div className="animate-slideInUp" style={{ marginTop: '24px', animationDelay: '600ms' }}>
            <Link to="/plan">
              <button 
                className="w-full font-sans font-bold transition-all duration-200 hover:shadow-lg animate-gentle-pulse relative overflow-hidden"
                style={{ 
                  height: '52px', 
                  fontSize: '16px',
                  color: '#000000',
                  borderRadius: '26px',
                  background: 'linear-gradient(135deg, #F2C8C2, #E9D8E9)',
                  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.5), 0 4px 12px rgba(0,0,0,0.08)'
                }}
                onMouseEnter={(e) => {
                  // Ripple эффект
                  const button = e.currentTarget;
                  const ripple = document.createElement('div');
                  ripple.style.cssText = `
                    position: absolute;
                    border-radius: 50%;
                    background: radial-gradient(circle, rgba(255,255,255,0.4) 0%, transparent 70%);
                    transform: scale(0);
                    animation: ripple 0.6s linear;
                    pointer-events: none;
                    left: 50%;
                    top: 50%;
                    width: 100px;
                    height: 100px;
                    margin-left: -50px;
                    margin-top: -50px;
                  `;
                  button.appendChild(ripple);
                  setTimeout(() => ripple.remove(), 600);
                }}
              >
                Открыть подробный план
              </button>
            </Link>
          </div>
        </div>
      ) : (
        /* Экран для новых пользователей */
        <div className="container-premium">
          <Card className="text-center">
            <div className="py-8">
              <div className="w-16 h-16 mx-auto mb-4 bg-progress-gradient rounded-full flex items-center justify-center shadow-neumorphism">
                <svg viewBox="0 0 24 24" fill="none" className="w-8 h-8">
                  <path
                    d="M12 2L13.09 8.26L20 9L13.09 9.74L12 16L10.91 9.74L4 9L10.91 8.26L12 2Z"
                    fill="white"
                    stroke="white"
                    strokeWidth="1"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              <h2 className="font-serif text-2xl text-text-primary mb-text">
                Создай свой план ухода
              </h2>
              <p className="text-text-secondary mb-element leading-relaxed max-w-sm mx-auto">
                Пройди короткую анкету и получи персональные рекомендации
              </p>
              <Link to="/quiz">
                <button 
                  className="w-full bg-gradient-to-r from-button-from to-button-to text-black font-sans font-medium rounded-2xl shadow-sm hover:shadow-md transition-all duration-200"
                  style={{ 
                    height: '56px', 
                    fontSize: '16px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                  }}
                >
                  Начать анкету
                </button>
              </Link>
            </div>
          </Card>
        </div>
      )}

      {/* Нижние кнопки - квадратные эндоморфные капсулы */}
      <div className="container-premium pb-8 animate-slideInUp" style={{ marginTop: '24px', animationDelay: '700ms' }}>
        <div className="grid grid-cols-2" style={{ gap: '16px' }}>
          {/* Корзина */}
          <Link to="/cart">
            <div 
              className="cursor-pointer transition-all duration-200 hover:shadow-md flex flex-col items-center justify-center hover:scale-105 active:scale-95"
              style={{ 
                width: '64px',
                height: '64px',
                borderRadius: '16px',
                background: '#FFFFFF',
                backgroundImage: 'linear-gradient(135deg, rgba(255,255,255,0.9), rgba(247,241,239,0.3))',
                boxShadow: 'inset -1px -1px 3px rgba(255,255,255,0.8), inset 1px 1px 3px rgba(0,0,0,0.05), 0 2px 8px rgba(0,0,0,0.05)'
              }}
            >
              <div className="w-6 h-6 mb-1 animate-cart-shake">
                <svg viewBox="0 0 24 24" fill="none" className="w-full h-full">
                  <path
                    d="M3 3H5L5.4 5M7 13H17L21 5H5.4M7 13L5.4 5M7 13L4.7 15.3C4.3 15.7 4.6 16.5 5.1 16.5H17M17 13V16.5M9 19.5C9.8 19.5 10.5 20.2 10.5 21S9.8 22.5 9 22.5 7.5 21.8 7.5 21 8.2 19.5 9 19.5ZM20 19.5C20.8 19.5 21.5 20.2 21.5 21S20.8 22.5 20 22.5 18.5 21.8 18.5 21 19.2 19.5 20 19.5Z"
                    stroke="#E9A2B2"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    fill="none"
                    opacity="0.7"
                  />
                </svg>
              </div>
              <span className="font-sans" style={{ fontSize: '14px', color: '#000000' }}>
                Корзина
              </span>
            </div>
          </Link>
          
          {/* Анкета */}
          <Link to="/quiz">
            <div 
              className="cursor-pointer transition-all duration-200 hover:shadow-md flex flex-col items-center justify-center hover:scale-105 active:scale-95"
              style={{ 
                width: '64px',
                height: '64px',
                borderRadius: '16px',
                background: '#FFFFFF',
                backgroundImage: 'linear-gradient(135deg, rgba(255,255,255,0.9), rgba(247,241,239,0.3))',
                boxShadow: 'inset -1px -1px 3px rgba(255,255,255,0.8), inset 1px 1px 3px rgba(0,0,0,0.05), 0 2px 8px rgba(0,0,0,0.05)'
              }}
            >
              <div className="w-6 h-6 mb-1 animate-profile-glow">
                <svg viewBox="0 0 24 24" fill="none" className="w-full h-full">
                  <path
                    d="M20 21V19C20 17.9 19.1 17 18 17H6C4.9 17 4 17.9 4 19V21M16 7C16 9.2 14.2 11 12 11S8 9.2 8 7 9.8 3 12 3 16 4.8 16 7Z"
                    stroke="#C295F9"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    fill="none"
                    opacity="0.7"
                  />
                </svg>
              </div>
              <span className="font-sans" style={{ fontSize: '14px', color: '#000000' }}>
                Анкета
              </span>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}