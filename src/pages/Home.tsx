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
          <h1 className="font-serif font-bold" style={{ fontSize: '24px', lineHeight: '1.2', color: '#000000' }}>
            Привет, {userName || 'Пользователь'}!
          </h1>
          {/* Подзаголовок */}
          <p className="font-sans" style={{ fontSize: '16px', marginTop: '8px', color: '#777777' }}>
            Твой уход на сегодня
          </p>
        </div>
      </div>

      {/* Центральная часть - Сегодняшний уход */}
      {hasCompletedQuiz && plan ? (
        <div className="container-premium">
          {/* Объединенный блок: Переключатель + Прогресс */}
          <div className="mt-6">
            <div 
              className="flex items-center justify-between px-4 py-2 rounded-2xl"
              style={{ 
                backgroundColor: '#F8F5F4',
                height: '40px'
              }}
            >
              {/* Переключатель Утро/Вечер */}
              <div className="flex gap-1">
                <button
                  onClick={() => setActiveTime('morning')}
                  className={`
                    font-sans font-medium text-black transition-all duration-300 px-4 py-1 rounded-full
                    ${activeTime === 'morning' 
                      ? 'shadow-inner' 
                      : 'hover:bg-gray-200/50'
                    }
                  `}
                  style={{ 
                    fontSize: '14px',
                    backgroundColor: activeTime === 'morning' 
                      ? 'transparent' 
                      : '#F5F5F5',
                    backgroundImage: activeTime === 'morning' 
                      ? 'linear-gradient(to right, #FADADD, #F6EAEF)' 
                      : 'none'
                  }}
                >
                  Утро
                </button>
                <button
                  onClick={() => setActiveTime('evening')}
                  className={`
                    font-sans font-medium text-black transition-all duration-300 px-4 py-1 rounded-full
                    ${activeTime === 'evening' 
                      ? 'shadow-inner' 
                      : 'hover:bg-gray-200/50'
                    }
                  `}
                  style={{ 
                    fontSize: '14px',
                    backgroundColor: activeTime === 'evening' 
                      ? 'transparent' 
                      : '#F5F5F5',
                    backgroundImage: activeTime === 'evening' 
                      ? 'linear-gradient(to right, #FADADD, #F6EAEF)' 
                      : 'none'
                  }}
                >
                  Вечер
                </button>
              </div>
              
              {/* Прогресс-бар справа */}
              <CircularProgress 
                progress={progress} 
                size={32} 
                strokeWidth={2}
              />
            </div>
          </div>

          {/* Карточки ухода */}
          <div className="mt-4 space-y-4">
            {skincareTasks.map((task, index) => (
              <div
                key={task.id}
                onClick={() => toggleStepCompleted(task.id)}
                className="bg-white rounded-2xl shadow-sm cursor-pointer transition-all duration-200 hover:shadow-md flex items-center justify-between px-4"
                style={{ 
                  height: '72px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.08)'
                }}
              >
                {/* Левая часть: иконка и текст */}
                <div className="flex items-center gap-4">
                  {/* Иконка */}
                  <div 
                    className="w-6 h-6 rounded-full"
                    style={{ 
                      backgroundColor: index === 0 ? '#A8D8EA' : index === 1 ? '#F4D4BA' : index === 2 ? '#F2C94C' : '#9B8AA3'
                    }}
                  ></div>
                  
                  {/* Текст */}
                  <div>
                    <h4 className="font-sans font-bold" style={{ fontSize: '16px', color: '#000000' }}>
                      {task.title}
                    </h4>
                    <p className="font-sans" style={{ fontSize: '14px', color: '#777777' }}>
                      {task.subtitle}
                    </p>
                  </div>
                </div>

                {/* Эндоморфный чекбокс справа */}
                <div 
                  className={`
                    w-6 h-6 rounded-full flex items-center justify-center transition-all duration-300
                    ${completedSteps[task.id] 
                      ? 'bg-gradient-to-br from-lavender-light to-lavender-medium' 
                      : 'bg-gray-100 hover:bg-gray-200'
                    }
                  `}
                  style={{
                    boxShadow: 'inset 2px 2px 4px rgba(0,0,0,0.1)'
                  }}
                >
                  {completedSteps[task.id] && (
                    <svg className="w-3 h-3 text-lavender-dark" fill="currentColor" viewBox="0 0 20 20">
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
                className="w-full text-black font-sans font-medium rounded-2xl hover:shadow-lg transition-all duration-200"
                style={{ 
                  height: '56px', 
                  fontSize: '16px',
                  background: 'linear-gradient(to right, #FADADD, #F6EAEF)',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
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
      <div className="container-premium pb-8" style={{ marginTop: '16px' }}>
        <div className="grid grid-cols-2" style={{ gap: '8px' }}>
          {/* Корзина */}
          <Link to="/cart">
            <div 
              className="bg-white rounded-2xl hover:shadow-md transition-all duration-200 cursor-pointer flex flex-col items-center justify-center"
              style={{ 
                height: '72px',
                boxShadow: '0 4px 8px rgba(0,0,0,0.05)'
              }}
            >
              <div className="w-6 h-6 mb-1">
                <svg viewBox="0 0 24 24" fill="none" className="w-full h-full">
                  <path
                    d="M3 3H5L5.4 5M7 13H17L21 5H5.4M7 13L5.4 5M7 13L4.7 15.3C4.3 15.7 4.6 16.5 5.1 16.5H17M17 13V16.5M9 19.5C9.8 19.5 10.5 20.2 10.5 21S9.8 22.5 9 22.5 7.5 21.8 7.5 21 8.2 19.5 9 19.5ZM20 19.5C20.8 19.5 21.5 20.2 21.5 21S20.8 22.5 20 22.5 18.5 21.8 18.5 21 19.2 19.5 20 19.5Z"
                    stroke="#F6C2D9"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    fill="none"
                  />
                </svg>
              </div>
              <span className="font-sans font-medium text-black" style={{ fontSize: '14px' }}>
                Корзина
              </span>
            </div>
          </Link>
          
          {/* Анкета */}
          <Link to="/quiz">
            <div 
              className="bg-white rounded-2xl hover:shadow-md transition-all duration-200 cursor-pointer flex flex-col items-center justify-center"
              style={{ 
                height: '72px',
                boxShadow: '0 4px 8px rgba(0,0,0,0.05)'
              }}
            >
              <div className="w-6 h-6 mb-1">
                <svg viewBox="0 0 24 24" fill="none" className="w-full h-full">
                  <path
                    d="M20 21V19C20 17.9 19.1 17 18 17H6C4.9 17 4 17.9 4 19V21M16 7C16 9.2 14.2 11 12 11S8 9.2 8 7 9.8 3 12 3 16 4.8 16 7Z"
                    stroke="#C7B6F9"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    fill="none"
                  />
                </svg>
              </div>
              <span className="font-sans font-medium text-black" style={{ fontSize: '14px' }}>
                Анкета
              </span>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}