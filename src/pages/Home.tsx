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
    <div className="min-h-screen">
      {/* Hero Section */}
      <div className="pt-8">
        {/* Заголовок */}
        <div className="text-center" style={{ marginTop: '32px' }}>
          <h1 className="font-serif" style={{ fontSize: '24px', lineHeight: '1.2', color: '#1C1C1C', fontWeight: '400' }}>
            Привет, {userName || 'Пользователь'}!
          </h1>
          {/* Подзаголовок */}
          <p className="font-sans" style={{ fontSize: '16px', marginTop: '8px', color: '#6F6F6F', fontWeight: '400' }}>
            Твой уход на сегодня
          </p>
        </div>
      </div>

      {/* Центральная часть - Сегодняшний уход */}
      {hasCompletedQuiz && plan ? (
        <div className="container-premium">
          {/* Эндоморфный переключатель + Прогресс */}
          <div className="mt-6">
            <div 
              className="flex items-center justify-between px-4 py-2"
              style={{ 
                backgroundColor: '#F9F0ED',
                borderRadius: '24px',
                height: '44px',
                boxShadow: 'inset 2px 2px 6px rgba(0,0,0,0.05), inset -2px -2px 6px rgba(255,255,255,0.8)'
              }}
            >
              {/* Переключатель Утро/Вечер */}
              <div className="flex gap-1">
                <button
                  onClick={() => setActiveTime('morning')}
                  className={`
                    font-sans font-medium transition-all duration-300 px-4 py-1
                    ${activeTime === 'morning' 
                      ? 'text-text-primary' 
                      : 'text-text-inactive hover:text-text-primary'
                    }
                  `}
                  style={{ 
                    fontSize: '16px',
                    borderRadius: '20px',
                    background: activeTime === 'morning' 
                      ? 'linear-gradient(135deg, #FBD6CF, #F7E6E2)' 
                      : 'transparent'
                  }}
                >
                  Утро
                </button>
                <button
                  onClick={() => setActiveTime('evening')}
                  className={`
                    font-sans font-medium transition-all duration-300 px-4 py-1
                    ${activeTime === 'evening' 
                      ? 'text-text-primary' 
                      : 'text-text-inactive hover:text-text-primary'
                    }
                  `}
                  style={{ 
                    fontSize: '16px',
                    borderRadius: '20px',
                    background: activeTime === 'evening' 
                      ? 'linear-gradient(135deg, #FBD6CF, #F7E6E2)' 
                      : 'transparent'
                  }}
                >
                  Вечер
                </button>
              </div>
              
              {/* Прогресс-бар справа */}
              <CircularProgress 
                progress={progress} 
                size={36} 
                strokeWidth={3}
              />
            </div>
          </div>

          {/* Карточки ухода */}
          <div className="mt-4 space-y-4">
            {skincareTasks.map((task, index) => (
              <div
                key={task.id}
                onClick={() => toggleStepCompleted(task.id)}
                className="cursor-pointer transition-all duration-200 hover:shadow-lg flex items-center justify-between px-4"
                style={{ 
                  height: '64px',
                  borderRadius: '16px',
                  backgroundColor: '#FCF7F5',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.06), inset -2px -2px 6px rgba(255,255,255,0.9)'
                }}
              >
                {/* Левая часть: иконка и текст */}
                <div className="flex items-center gap-4">
                  {/* Минималистичная иконка */}
                  <div 
                    className="w-6 h-6 rounded-lg flex items-center justify-center"
                    style={{ 
                      backgroundColor: index === 0 ? '#A8D8EA' : index === 1 ? '#F4D4BA' : index === 2 ? '#F2C94C' : '#9B8AA3',
                      opacity: 0.8
                    }}
                  >
                    <div className="w-3 h-3 bg-white rounded-sm opacity-90"></div>
                  </div>
                  
                  {/* Текст */}
                  <div>
                    <h4 className="font-sans font-semibold" style={{ fontSize: '16px', color: '#1C1C1C' }}>
                      {task.title}
                    </h4>
                    <p className="font-sans" style={{ fontSize: '14px', color: '#8E8E8E' }}>
                      {task.subtitle}
                    </p>
                  </div>
                </div>

                {/* Эндоморфный чекбокс справа */}
                <div 
                  className={`
                    w-6 h-6 rounded-full flex items-center justify-center transition-all duration-300
                  `}
                  style={{
                    background: completedSteps[task.id] 
                      ? 'linear-gradient(135deg, #EAC3F8, #C7A2F9)' 
                      : '#F0F0F0',
                    boxShadow: completedSteps[task.id] 
                      ? 'inset 1px 1px 3px rgba(0,0,0,0.2)' 
                      : 'inset 1px 1px 3px rgba(0,0,0,0.1)'
                  }}
                >
                  {completedSteps[task.id] && (
                    <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* CTA Кнопка */}
          <div style={{ marginTop: '24px' }}>
            <Link to="/plan">
              <button 
                className="w-full font-sans font-medium transition-all duration-200 hover:shadow-lg"
                style={{ 
                  height: '52px', 
                  fontSize: '16px',
                  color: '#1C1C1C',
                  borderRadius: '26px',
                  background: 'linear-gradient(135deg, #FBD6CF, #F7E6E2)',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.08)'
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

      {/* Нижние карточки */}
      <div className="container-premium pb-8" style={{ marginTop: '24px' }}>
        <div className="grid grid-cols-2" style={{ gap: '16px' }}>
          {/* Корзина */}
          <Link to="/cart">
            <div 
              className="cursor-pointer transition-all duration-200 hover:shadow-md flex flex-col items-center justify-center"
              style={{ 
                height: '72px',
                borderRadius: '16px',
                backgroundColor: '#FAF4F2',
                boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
              }}
            >
              <div className="w-6 h-6 mb-1">
                <svg viewBox="0 0 24 24" fill="none" className="w-full h-full">
                  <path
                    d="M3 3H5L5.4 5M7 13H17L21 5H5.4M7 13L5.4 5M7 13L4.7 15.3C4.3 15.7 4.6 16.5 5.1 16.5H17M17 13V16.5M9 19.5C9.8 19.5 10.5 20.2 10.5 21S9.8 22.5 9 22.5 7.5 21.8 7.5 21 8.2 19.5 9 19.5ZM20 19.5C20.8 19.5 21.5 20.2 21.5 21S20.8 22.5 20 22.5 18.5 21.8 18.5 21 19.2 19.5 20 19.5Z"
                    stroke="#E9A2B2"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    fill="none"
                  />
                </svg>
              </div>
              <span className="font-sans" style={{ fontSize: '14px', color: '#1C1C1C' }}>
                Корзина
              </span>
            </div>
          </Link>
          
          {/* Анкета */}
          <Link to="/quiz">
            <div 
              className="cursor-pointer transition-all duration-200 hover:shadow-md flex flex-col items-center justify-center"
              style={{ 
                height: '72px',
                borderRadius: '16px',
                backgroundColor: '#FAF4F2',
                boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
              }}
            >
              <div className="w-6 h-6 mb-1">
                <svg viewBox="0 0 24 24" fill="none" className="w-full h-full">
                  <path
                    d="M20 21V19C20 17.9 19.1 17 18 17H6C4.9 17 4 17.9 4 19V21M16 7C16 9.2 14.2 11 12 11S8 9.2 8 7 9.8 3 12 3 16 4.8 16 7Z"
                    stroke="#C295F9"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    fill="none"
                  />
                </svg>
              </div>
              <span className="font-sans" style={{ fontSize: '14px', color: '#1C1C1C' }}>
                Анкета
              </span>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}