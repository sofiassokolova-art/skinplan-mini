import { useMemo, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

const STORAGE_KEY = "skiniq.answers";
const PREMIUM_KEY = "skiniq.premium";

function getAnswers() {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : {};
  } catch {
    return {};
  }
}

function isPremium(): boolean {
  try {
    return localStorage.getItem(PREMIUM_KEY) === "true";
  } catch {
    return false;
  }
}

function setPremium(value: boolean) {
  try {
    localStorage.setItem(PREMIUM_KEY, value ? "true" : "false");
  } catch {}
}

const Button = ({ children, onClick, variant = "primary", ...props }: any) => {
  const baseClass = "inline-flex items-center justify-center rounded-xl transition focus:outline-none px-4 py-2";
  const variantClass = variant === "primary" ? "border border-black hover:bg-black hover:text-white" :
                      variant === "secondary" ? "border border-neutral-300 hover:border-black" :
                      "border border-transparent hover:bg-neutral-100";
  
  return (
    <button onClick={onClick} className={`${baseClass} ${variantClass}`} {...props}>
      {children}
    </button>
  );
};

const Card = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <div className={`rounded-2xl border border-neutral-200 bg-white shadow-sm ${className}`}>
    {children}
  </div>
);

export default function Plan() {
  const navigate = useNavigate();
  const answers = useMemo(() => getAnswers(), []);
  const hasCompletedQuiz = useMemo(() => {
    return answers ? 
      Object.keys(answers).length > 0 && 
      typeof answers.name === "string" && 
      answers.name.trim().length > 0 : false;
  }, [answers]);

  useEffect(() => {
    if (!hasCompletedQuiz) {
      navigate("/quiz");
    }
  }, [hasCompletedQuiz, navigate]);

  const [hasPremium, setHasPremium] = useState(isPremium());

  const unlockPremium = async () => {
    setPremium(true);
    setHasPremium(true);
  };

  if (!hasCompletedQuiz) {
    return (
      <div className="max-w-3xl mx-auto bg-white/70 border border-white/60 rounded-3xl p-6 backdrop-blur-xl">
        <h2 className="text-lg font-bold mb-2">План недоступен</h2>
        <p className="text-zinc-700">Сначала пройди анкету — затем я соберу план автоматически.</p>
        <a href="/quiz" className="inline-block mt-4 px-5 py-3 rounded-full bg-black text-white">К анкете</a>
      </div>
    );
  }

  const PremiumOverlay = ({ children }: { children: React.ReactNode }) => (
    <div className="relative">
      <div className="pointer-events-none select-none blur-md brightness-95">
        {children}
      </div>
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-white/70 backdrop-blur-sm">
        <div className="text-center">
          <div className="text-lg font-semibold mb-1">Персональные рекомендации</div>
          <div className="opacity-70 mb-3">Разблокируй план ухода и расписание на 28 дней</div>
        </div>
        <Button onClick={unlockPremium}>
          Разблокировать рекомендации за 199₽
        </Button>
        <div className="text-xs opacity-60">
          Оплата единовременная · доступ сразу
        </div>
      </div>
    </div>
  );

  const Header = () => (
    <div className="flex items-center justify-between mb-5">
      <div className="text-2xl md:text-3xl font-bold">Мой план ухода</div>
      <div className="flex gap-2">
        <Button variant="secondary" onClick={() => navigate("/cart")}>
          Корзина
        </Button>
        <Button variant="ghost" onClick={() => {}}>
          Отправить в чат
        </Button>
        <Button onClick={() => window.print()}>
          Скачать PDF
        </Button>
      </div>
    </div>
  );

  const planContent = (
    <div className="space-y-4">
      <Card className="p-4 md:p-5">
        <h3 className="text-xl font-semibold mb-3">Skin-характеристики</h3>
        <div className="text-sm text-neutral-600">
          Тип: {answers.skinType || "—"} | Чувствительность: {answers.sensitivity ? "да" : "нет"} | Цель: {answers.primaryGoal || "—"}
        </div>
      </Card>
      
      <Card className="p-4 md:p-5">
        <h3 className="text-xl font-semibold mb-3">Рекомендации</h3>
        <p className="text-sm text-neutral-600">
          На основе ваших ответов мы подобрали персональный план ухода на 28 дней.
        </p>
      </Card>
    </div>
  );

  return (
    <div className="max-w-3xl mx-auto px-4 py-5 md:py-8">
      <Header />
      {hasPremium ? planContent : <PremiumOverlay>{planContent}</PremiumOverlay>}
    </div>
  );
}