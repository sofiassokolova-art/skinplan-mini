import { Link, useNavigate } from "react-router-dom";
import { useMemo } from "react";

const Card = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <div className={`rounded-2xl border border-neutral-200 bg-white shadow-sm ${className}`}>
    {children}
  </div>
);

const Button = ({ children, onClick, variant = "primary", ...props }: any) => {
  const baseClass = "inline-flex items-center justify-center rounded-xl transition focus:outline-none disabled:opacity-50 disabled:pointer-events-none px-4 py-2";
  const variantClass = variant === "primary" ? "border border-black hover:bg-black hover:text-white" :
                      variant === "secondary" ? "border border-neutral-300 hover:border-black" :
                      "border border-transparent hover:bg-neutral-100";
  
  return (
    <button 
      onClick={onClick} 
      className={`${baseClass} ${variantClass}`} 
      {...props}
    >
      {children}
    </button>
  );
};

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
    <div className="space-y-4">
      {userName && (
        <div className="text-center sm:text-left">
          <h1 className="text-xl sm:text-2xl font-bold mb-2">{greeting}!</h1>
        </div>
      )}

      {hasCompletedQuiz && plan && (
        <Card className="mb-4 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-medium">Ближайшая рутина</h2>
              <p className="text-sm text-neutral-600">Короткий дайджест твоих шагов на сегодня</p>
            </div>
            <div>
              <Button onClick={() => navigate("/plan")}>Открыть план</Button>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
            <Card className="p-3">
              <h3 className="font-medium mb-2">Утро</h3>
              {plan.morning?.length ? (
                <ul className="list-disc list-inside space-y-1">
                  {plan.morning.slice(0, 4).map((step: any, idx: number) => (
                    <li key={`m-${idx}`}>{step.name}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-neutral-600">Шаги не найдены</p>
              )}
            </Card>
            <Card className="p-3">
              <h3 className="font-medium mb-2">Вечер</h3>
              {plan.evening?.length ? (
                <ul className="list-disc list-inside space-y-1">
                  {plan.evening.slice(0, 4).map((step: any, idx: number) => (
                    <li key={`e-${idx}`}>{step.name}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-neutral-600">Шаги не найдены</p>
              )}
            </Card>
          </div>
          <div className="mt-4">
            <Button variant="ghost" onClick={() => navigate("/plan")}>
              Перейти к подробному плану
            </Button>
          </div>
        </Card>
      )}

      {!hasCompletedQuiz && (
        <Card className="p-4 text-center sm:p-6">
          <h2 className="text-lg sm:text-xl font-bold mb-2">Запланируйте свою рутину</h2>
          <p className="text-sm text-neutral-600 mb-4">Пройдите короткую анкету, и мы соберём персональный уход.</p>
          <Link to="/quiz">
            <Button className="w-full sm:w-auto">Заполнить анкету</Button>
          </Link>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4">
        <Card className="p-4 flex flex-col">
          <h2 className="text-lg font-medium">Корзина</h2>
          <p className="text-sm text-neutral-600 mt-1">Товары из плана, которые вы добавили.</p>
          <div className="mt-auto pt-3">
            <Link to="/cart">
              <Button variant="ghost">Перейти в корзину</Button>
            </Link>
          </div>
        </Card>
      </div>
      
      {hasCompletedQuiz && (
        <div className="text-center mt-6 pt-4 border-t border-neutral-200">
          <Link to="/quiz" className="text-sm text-neutral-500 underline hover:text-neutral-700">
            Перепройти анкету
          </Link>
        </div>
      )}
    </div>
  );
}