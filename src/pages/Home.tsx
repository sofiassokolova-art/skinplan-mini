import { Link } from "react-router-dom";
import { useMemo, useState } from "react";
import { Button, Card, Chip, CircularProgress, TaskCard } from "../ui";


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
      <div className="container-premium pt-8 pb-6">
        {/* Логотип */}
        <div className="text-center mb-6">
          <h1 className="font-serif text-4xl text-text-primary mb-2">
            SkinIQ
          </h1>
        </div>
        
        {/* Приветствие */}
        {userName && (
          <div className="text-center mb-4">
            <h2 className="font-serif text-2xl text-text-primary mb-2 drop-shadow-sm">
              Привет, {userName}!
            </h2>
            <p className="text-text-secondary font-sans text-sm">
              Твой уход на сегодня
            </p>
          </div>
        )}
      </div>

      {/* Центральная часть - Сегодняшний уход */}
      {hasCompletedQuiz && plan ? (
        <div className="container-premium space-y-element">
          {/* Переключатель Утро/Вечер - отдельный блок */}
          <Card className="text-center py-4">
            <div className="flex gap-2 justify-center">
              <Chip
                active={activeTime === 'morning'}
                onClick={() => setActiveTime('morning')}
                size="md"
              >
                Утро
              </Chip>
              <Chip
                active={activeTime === 'evening'}
                onClick={() => setActiveTime('evening')}
                size="md"
              >
                Вечер
              </Chip>
            </div>
          </Card>

          {/* Прогресс-бар - отдельный блок */}
          <div className="text-center">
            <CircularProgress 
              progress={progress} 
              size={80} 
              strokeWidth={6}
            />
          </div>

          {/* Список задач */}
          <Card>
            <div className="space-y-3">
              {skincareTasks.map((task) => (
                <TaskCard
                  key={task.id}
                  title={task.title}
                  subtitle={task.subtitle}
                  completed={completedSteps[task.id] || false}
                  onClick={() => toggleStepCompleted(task.id)}
                />
              ))}
            </div>
          </Card>

          {/* CTA Кнопка */}
          <div className="text-center">
            <Link to="/plan">
              <Button size="lg" fullWidth className="text-lg py-4">
                Открыть подробный план
              </Button>
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
                <Button size="lg" fullWidth>
                  Начать анкету
                </Button>
              </Link>
            </div>
          </Card>
        </div>
      )}

      {/* Нижняя навигация */}
      <div className="container-premium mt-section pb-8">
        <div className="grid grid-cols-2 gap-4">
          {/* Корзина */}
          <Link to="/cart">
            <Card clickable className="text-center py-6 bg-gradient-to-br from-pearl-card to-button-from">
              <div className="w-8 h-8 mx-auto mb-3">
                <svg viewBox="0 0 24 24" fill="none" className="w-full h-full">
                  <path
                    d="M3 3H5L5.4 5M7 13H17L21 5H5.4M7 13L5.4 5M7 13L4.7 15.3C4.3 15.7 4.6 16.5 5.1 16.5H17M17 13V16.5M9 19.5C9.8 19.5 10.5 20.2 10.5 21S9.8 22.5 9 22.5 7.5 21.8 7.5 21 8.2 19.5 9 19.5ZM20 19.5C20.8 19.5 21.5 20.2 21.5 21S20.8 22.5 20 22.5 18.5 21.8 18.5 21 19.2 19.5 20 19.5Z"
                    stroke="#F4D4BA"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    fill="#F4D4BA20"
                  />
                </svg>
              </div>
              <h4 className="font-sans font-medium text-text-primary">
                Корзина
              </h4>
              <p className="text-sm text-text-secondary mt-1">
                Товары из плана
              </p>
            </Card>
          </Link>
          
          {/* Анкета */}
          <Link to="/quiz">
            <Card clickable className="text-center py-6 bg-gradient-to-br from-pearl-card to-accent/10">
              <div className="w-8 h-8 mx-auto mb-3">
                <svg viewBox="0 0 24 24" fill="none" className="w-full h-full">
                  <path
                    d="M20 21V19C20 17.9 19.1 17 18 17H6C4.9 17 4 17.9 4 19V21M16 7C16 9.2 14.2 11 12 11S8 9.2 8 7 9.8 3 12 3 16 4.8 16 7Z"
                    stroke="#9B8AA3"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    fill="#9B8AA320"
                  />
                </svg>
              </div>
              <h4 className="font-sans font-medium text-text-primary">
                Анкета
              </h4>
              <p className="text-sm text-text-secondary mt-1">
                {hasCompletedQuiz ? 'Обновить данные' : 'Заполнить профиль'}
              </p>
            </Card>
          </Link>
        </div>
      </div>
    </div>
  );
}