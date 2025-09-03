import { Link } from "react-router-dom";
import { useMemo } from "react";

export default function Home() {
  
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
    <div className="space-y-4">
      {userName && (
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-1">
            {greeting}!
          </h1>
        </div>
      )}

      {hasCompletedQuiz && plan && (
        <div className="bg-white rounded-3xl border border-gray-200 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-900">{userName?.toUpperCase()}'S ROUTINE</h2>
            <div className="flex gap-2">
              <span className="px-3 py-1 bg-black text-white text-xs font-semibold rounded-full">MORNING</span>
              <span className="px-3 py-1 bg-gray-200 text-gray-700 text-xs font-semibold rounded-full">EVENING</span>
            </div>
          </div>

          <div className="space-y-4">
            {plan.morning?.slice(0, 4).map((step: any, idx: number) => (
              <div key={`routine-${idx}`} className="flex items-center justify-between py-3 border-b border-gray-100 last:border-b-0">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                    <span className="w-2 h-2 bg-gray-400 rounded-full"></span>
                  </div>
                  <div>
                    <div className="font-medium text-gray-900 text-sm">{step.name.split('(')[0].trim()}</div>
                    <div className="text-xs text-gray-500 uppercase tracking-wide">{step.step}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-gray-900">2°</div>
                  <div className="text-xs text-gray-500">DROPS IN THE MORNING</div>
                </div>
              </div>
            ))}
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
  );
}