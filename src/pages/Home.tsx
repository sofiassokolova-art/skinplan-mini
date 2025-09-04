import { Link } from "react-router-dom";
import { useMemo, useState } from "react";

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

  // Функция для сброса прогресса (новый день)
  const resetDailyProgress = () => {
    setCompletedSteps({});
    try {
      localStorage.removeItem('skiniq.routine_progress');
    } catch (error) {
      console.error('Ошибка сброса прогресса:', error);
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

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    const timeGreeting = hour >= 18 ? "Добрый вечер" : "Добрый день";
    return `${timeGreeting}${userName ? `, ${userName}` : ""}`;
  }, [userName]);

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

  return (
    <div className="space-y-4 relative">
      {/* Анимированный жидкий фон */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-100 via-purple-50 to-pink-50"></div>
        <div className="liquid-bg absolute inset-0"></div>
      </div>
      
      <style dangerouslySetInnerHTML={{__html: `
        .liquid-bg {
          background: linear-gradient(-45deg, 
            rgba(219, 234, 254, 0.4), 
            rgba(196, 181, 253, 0.3), 
            rgba(253, 230, 138, 0.2), 
            rgba(191, 219, 254, 0.4),
            rgba(233, 213, 255, 0.3)
          );
          background-size: 400% 400%;
          animation: liquidFlow 15s ease-in-out infinite;
        }
        
        @keyframes liquidFlow {
          0% {
            background-position: 0% 50%;
            transform: scale(1) rotate(0deg);
          }
          25% {
            background-position: 100% 50%;
            transform: scale(1.1) rotate(1deg);
          }
          50% {
            background-position: 100% 100%;
            transform: scale(1.05) rotate(-0.5deg);
          }
          75% {
            background-position: 0% 100%;
            transform: scale(1.1) rotate(0.5deg);
          }
          100% {
            background-position: 0% 50%;
            transform: scale(1) rotate(0deg);
          }
        }
      `}} />
      
      <div className="relative z-10">
      {userName && (
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-1">
            {greeting}!
          </h1>
        </div>
      )}

      {hasCompletedQuiz && plan && (
        <div className="bg-white rounded-3xl border border-gray-200 p-6 shadow-sm relative">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg font-bold text-gray-900">ТВОЙ УХОД СЕГОДНЯ</h2>
              {hasPremium && (
                <div className="text-xs text-gray-500 mt-1">
                  Прогресс: {Object.values(completedSteps).filter(Boolean).length} из {(plan.morning?.length || 0) + (plan.evening?.length || 0)} шагов
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setActiveTime('morning')}
                className={`px-3 py-1 text-xs font-semibold rounded-full transition-colors ${
                  activeTime === 'morning' 
                    ? 'bg-black text-white' 
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                УТРО
              </button>
              <button
                onClick={() => setActiveTime('evening')}
                className={`px-3 py-1 text-xs font-semibold rounded-full transition-colors ${
                  activeTime === 'evening' 
                    ? 'bg-black text-white' 
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                ВЕЧЕР
              </button>
            </div>
          </div>

          {/* Кнопка сброса прогресса */}
          {hasPremium && Object.values(completedSteps).some(Boolean) && (
            <div className="text-center mb-4">
              <button
                onClick={resetDailyProgress}
                className="text-xs text-gray-500 hover:text-gray-700 transition underline"
                title="Сбросить прогресс на новый день"
              >
                Сбросить прогресс
              </button>
            </div>
          )}

          {hasPremium ? (
            <div className="space-y-4">
              {(activeTime === 'morning' ? plan.morning : plan.evening)?.slice(0, 4).map((step: any, idx: number) => {
                const getStepStatus = (stepType: string, timeOfDay: string) => {
                  const statuses = {
                    'cleanser': timeOfDay === 'morning' ? 'НА ВЛАЖНУЮ КОЖУ' : 'ДВОЙНОЕ ОЧИЩЕНИЕ',
                    'hydrator': timeOfDay === 'morning' ? 'ПОСЛЕ ОЧИЩЕНИЯ' : 'НА ВЛАЖНУЮ КОЖУ', 
                    'treatment': timeOfDay === 'morning' ? 'ПЕРЕД УВЛАЖНЕНИЕМ' : 'НА СУХУЮ КОЖУ',
                    'moisturizer': timeOfDay === 'morning' ? 'ПЕРЕД SPF' : 'ЗАВЕРШАЮЩИЙ ЭТАП',
                    'spf': 'ЗА 15 МИН ДО ВЫХОДА'
                  };
                  return statuses[stepType as keyof typeof statuses] || 'ПО ИНСТРУКЦИИ';
                };

                const stepId = `${activeTime}-${step.step}-${idx}`;
                const isCompleted = completedSteps[stepId] || false;

                return (
                  <div key={`routine-${activeTime}-${idx}`} className="flex items-center justify-between py-3 border-b border-gray-100 last:border-b-0">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                        <span className="w-2 h-2 bg-gray-400 rounded-full"></span>
                      </div>
                      <div>
                        <div className={`font-medium text-sm transition-colors ${isCompleted ? 'text-gray-500 line-through' : 'text-gray-900'}`}>
                          {step.name.split('(')[0].trim()}
                        </div>
                        <div className="text-xs text-gray-500 uppercase tracking-wide">
                          {getStepStatus(step.step, activeTime)}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <button
                        onClick={() => toggleStepCompleted(stepId)}
                        className={`w-6 h-6 rounded-full flex items-center justify-center transition-all duration-200 ${
                          isCompleted 
                            ? 'bg-green-500 text-white shadow-lg transform scale-110' 
                            : 'bg-gray-100 hover:bg-gray-200 text-gray-600 hover:scale-105'
                        }`}
                        title={isCompleted ? 'Отменить выполнение' : 'Отметить как выполнено'}
                      >
                        <span className="text-xs font-bold">✓</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="relative">
              {/* Заблюренный контент */}
              <div className="filter blur-sm pointer-events-none">
                <div className="space-y-4">
                  {[1, 2, 3, 4].map((idx) => (
                    <div key={idx} className="flex items-center justify-between py-3 border-b border-gray-100 last:border-b-0">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                          <span className="w-2 h-2 bg-gray-400 rounded-full"></span>
                        </div>
                        <div>
                          <div className="font-medium text-gray-900 text-sm">Средство {idx}</div>
                          <div className="text-xs text-gray-500 uppercase tracking-wide">ИНСТРУКЦИЯ</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="w-6 h-6 bg-gray-100 rounded-full flex items-center justify-center">
                          <span className="text-xs text-gray-600">✓</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              
              {/* Оверлей с призывом к покупке */}
              <div className="absolute inset-0 bg-white/90 backdrop-blur-sm flex items-center justify-center rounded-xl">
                <div className="text-center p-4">
                  <div className="text-3xl mb-2">🔒</div>
                  <div className="font-bold text-gray-900 mb-2">Детальная рутина</div>
                  <div className="text-sm text-gray-600 mb-4">
                    Пошаговые инструкции и точное время применения
                  </div>
                  <div className="flex gap-2 flex-wrap justify-center">
                    <button
                      onClick={() => {
                        setPremium(true);
                        setHasPremium(true);
                      }}
                      className="px-4 py-2 bg-indigo-600 text-white rounded-full text-sm font-semibold hover:bg-indigo-700 transition"
                    >
                      Разблокировать за 199₽
                    </button>
                    <button
                      onClick={() => {
                        setPremium(false);
                        setHasPremium(false);
                      }}
                      className="px-3 py-1 bg-gray-200 text-gray-600 rounded-full text-xs hover:bg-gray-300 transition"
                    >
                      Тест: сбросить
                    </button>
                  </div>
                  <div className="text-xs text-gray-500 mt-2">
                    или 7 дней бесплатно
                  </div>
                </div>
              </div>
            </div>
          )}
          
          <div className="mt-6 text-center">
            <Link to="/plan">
              <button className="text-sm text-gray-600 hover:text-gray-900 transition-colors font-medium">
                ПЕРЕЙТИ К ПОДРОБНОМУ ПЛАНУ
              </button>
            </Link>
          </div>
        </div>
      )}

      {!hasCompletedQuiz && (
        <div className="bg-white rounded-3xl border border-gray-200 p-6 shadow-sm text-center">
          <h2 className="text-xl font-bold text-gray-900 mb-3">
            ЗАПЛАНИРУЙТЕ СВОЮ РУТИНУ
          </h2>
          <p className="text-gray-600 mb-6 leading-relaxed">
            Пройдите короткую анкету, и мы соберём персональный уход
          </p>
          <Link to="/quiz">
            <button className="w-full bg-black text-white py-4 rounded-2xl font-semibold hover:bg-gray-800 transition-colors">
              ЗАПОЛНИТЬ АНКЕТУ
            </button>
          </Link>
        </div>
      )}

      <div className="bg-white rounded-3xl border border-gray-200 p-6 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-gray-100 rounded-2xl flex items-center justify-center">
            <span className="text-xl">🛒</span>
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-bold text-gray-900">КОРЗИНА</h2>
            <p className="text-sm text-gray-600">Товары из плана, которые вы добавили</p>
          </div>
          <Link to="/cart">
            <button className="px-4 py-2 bg-gray-100 text-gray-700 rounded-full text-sm font-semibold hover:bg-gray-200 transition-colors">
              ОТКРЫТЬ
            </button>
          </Link>
        </div>
      </div>
      
      {hasCompletedQuiz && (
        <div className="text-center pt-4">
          <Link to="/quiz" className="text-sm text-gray-500 hover:text-gray-700 transition-colors font-medium">
            ПЕРЕПРОЙТИ АНКЕТУ
          </Link>
        </div>
      )}
      </div>
    </div>
  );
}