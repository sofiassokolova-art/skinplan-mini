import { Link, useNavigate } from "react-router-dom";
import { useMemo } from "react";
import ModernCard from "../ui/ModernCard";
import ModernButton from "../ui/ModernButton";

export default function Home() {
  const navigate = useNavigate();
  
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
    <div className="space-y-6">
      {userName && (
        <div className="text-center">
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-black bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent mb-2 tracking-tight">
            {greeting}!
          </h1>
        </div>
      )}

      {hasCompletedQuiz && plan && (
        <ModernCard variant="gradient" className="p-6">
          <div className="flex items-start justify-between gap-4 mb-6">
            <div>
              <h2 className="text-xl font-bold text-gray-800 mb-1">Ближайшая рутина</h2>
              <p className="text-sm text-gray-600">Короткий дайджест твоих шагов на сегодня</p>
            </div>
            <ModernButton onClick={() => navigate("/plan")} size="sm">
              Открыть план
            </ModernButton>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <ModernCard variant="glass" className="p-4">
              <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
                <span className="text-lg">🌅</span> Утро
              </h3>
              {plan.morning?.length ? (
                <ul className="space-y-2">
                  {plan.morning.slice(0, 3).map((step: any, idx: number) => (
                    <li key={`m-${idx}`} className="flex items-center gap-2 text-sm text-gray-700">
                      <span className="w-1.5 h-1.5 bg-blue-500 rounded-full"></span>
                      {step.name}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-gray-500">Шаги не найдены</p>
              )}
            </ModernCard>
            
            <ModernCard variant="glass" className="p-4">
              <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
                <span className="text-lg">🌙</span> Вечер
              </h3>
              {plan.evening?.length ? (
                <ul className="space-y-2">
                  {plan.evening.slice(0, 3).map((step: any, idx: number) => (
                    <li key={`e-${idx}`} className="flex items-center gap-2 text-sm text-gray-700">
                      <span className="w-1.5 h-1.5 bg-purple-500 rounded-full"></span>
                      {step.name}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-gray-500">Шаги не найдены</p>
              )}
            </ModernCard>
          </div>
          
          <div className="mt-6 text-center">
            <ModernButton variant="ghost" onClick={() => navigate("/plan")}>
              Перейти к подробному плану →
            </ModernButton>
          </div>
        </ModernCard>
      )}

      {!hasCompletedQuiz && (
        <ModernCard variant="gradient" className="p-6 text-center">
          <div className="mb-6">
            <h2 className="text-xl sm:text-2xl font-black text-gray-800 mb-3 tracking-tight">
              Запланируйте свою рутину
            </h2>
            <p className="text-gray-600 leading-relaxed">
              Пройдите короткую анкету, и мы соберём персональный уход
            </p>
          </div>
          <Link to="/quiz">
            <ModernButton fullWidth size="lg">
              Заполнить анкету
            </ModernButton>
          </Link>
        </ModernCard>
      )}

      <ModernCard className="p-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-500 rounded-2xl flex items-center justify-center text-white text-xl">
            🛒
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-bold text-gray-800">Корзина</h2>
            <p className="text-sm text-gray-600">Товары из плана, которые вы добавили</p>
          </div>
          <Link to="/cart">
            <ModernButton variant="secondary" size="sm">
              Открыть
            </ModernButton>
          </Link>
        </div>
      </ModernCard>
      
      {hasCompletedQuiz && (
        <div className="text-center pt-6">
          <Link to="/quiz" className="text-sm text-gray-500 hover:text-gray-700 transition-colors">
            Перепройти анкету →
          </Link>
        </div>
      )}
    </div>
  );
}