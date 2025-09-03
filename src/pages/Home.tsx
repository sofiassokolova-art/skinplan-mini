import { Link } from "react-router-dom";
import { useMemo, useState } from "react";

export default function Home() {
  const [activeTime, setActiveTime] = useState<'morning' | 'evening'>('morning');
  
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
        <div className="bg-white rounded-3xl border border-gray-200 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-bold text-gray-900">ТВОЙ УХОД СЕГОДНЯ</h2>
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

              return (
                <div key={`routine-${activeTime}-${idx}`} className="flex items-center justify-between py-3 border-b border-gray-100 last:border-b-0">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                      <span className="w-2 h-2 bg-gray-400 rounded-full"></span>
                    </div>
                    <div>
                      <div className="font-medium text-gray-900 text-sm">{step.name.split('(')[0].trim()}</div>
                      <div className="text-xs text-gray-500 uppercase tracking-wide">
                        {getStepStatus(step.step, activeTime)}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="w-6 h-6 bg-gray-100 rounded-full flex items-center justify-center">
                      <span className="text-xs text-gray-600">✓</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          
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