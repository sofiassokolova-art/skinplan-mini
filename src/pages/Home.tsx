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
      { id: 'morning-cleanser', icon: '🧴', title: 'Очищение', subtitle: 'На влажную кожу' },
      { id: 'morning-serum', icon: '💧', title: 'Сыворотка', subtitle: 'После очищения' },
      { id: 'morning-moisturizer', icon: '🧴', title: 'Увлажнение', subtitle: 'Перед SPF' },
      { id: 'morning-spf', icon: '☀️', title: 'Защита SPF', subtitle: 'За 15 мин до выхода' }
    ];
    
    const eveningTasks = [
      { id: 'evening-cleanser', icon: '🧴', title: 'Двойное очищение', subtitle: 'Масло + гель' },
      { id: 'evening-treatment', icon: '✨', title: 'Активы', subtitle: 'На сухую кожу' },
      { id: 'evening-moisturizer', icon: '🧴', title: 'Питание', subtitle: 'Завершающий этап' }
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
      {/* 🔝 Hero Section */}
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
            <h2 className="font-serif text-2xl text-text-primary mb-2">
              Привет, {userName}!
            </h2>
            <p className="text-text-secondary font-sans">
              Твой персональный гид по уходу за кожей
            </p>
          </div>
        )}
      </div>

      {/* 📋 Центральная часть - Сегодняшний уход */}
      {hasCompletedQuiz && plan ? (
        <div className="container-premium space-y-element">
          <Card>
            {/* Заголовок и переключатель */}
            <div className="flex items-center justify-between mb-element">
              <div className="flex items-center gap-4">
                <div>
                  <h3 className="font-serif text-xl text-text-primary">
                    Сегодняшний уход
                  </h3>
                </div>
                {/* Прогресс-индикатор */}
                <CircularProgress 
                  progress={progress} 
                  size={60} 
                  strokeWidth={4}
                />
              </div>
              
              {/* Переключатель Утро/Вечер */}
              <div className="flex gap-2">
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
            </div>

            {/* Список задач */}
            <div className="space-y-3">
              {skincareTasks.map((task) => (
                <TaskCard
                  key={task.id}
                  icon={task.icon}
                  title={task.title}
                  subtitle={task.subtitle}
                  completed={completedSteps[task.id] || false}
                  onClick={() => toggleStepCompleted(task.id)}
                />
              ))}
            </div>
          </Card>

          {/* 🔘 CTA Кнопка */}
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
              <div className="text-6xl mb-4">✨</div>
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

      {/* 🛍 Нижняя навигация */}
      <div className="container-premium mt-section pb-8">
        <div className="grid grid-cols-2 gap-4">
          {/* Корзина */}
          <Link to="/cart">
            <Card clickable className="text-center py-6 bg-gradient-to-br from-pearl-card to-button-from">
              <div className="text-3xl mb-2">🛍️</div>
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
              <div className="text-3xl mb-2">📋</div>
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