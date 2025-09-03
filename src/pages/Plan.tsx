import { useMemo, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

const STORAGE_KEY = "skiniq.answers";
const PREMIUM_KEY = "skiniq.premium";
const CART_KEY = "skiniq.cart";

interface Answers {
  name?: string;
  skinType?: string;
  sensitivity?: boolean;
  concerns?: string[];
  oiliness?: string;
  primaryGoal?: string;
}

function getAnswers(): Answers {
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

function addToCart(item: any) {
  try {
    const cart = JSON.parse(localStorage.getItem(CART_KEY) || "[]");
    if (!cart.some((existing: any) => 
      existing.name === item.name && 
      existing.timeOfDay === item.timeOfDay && 
      existing.step === item.step
    )) {
      cart.push(item);
      localStorage.setItem(CART_KEY, JSON.stringify(cart));
    }
  } catch {}
}

const Button = ({ children, onClick, variant = "primary", size = "md", disabled, ...props }: any) => {
  const baseClass = "inline-flex items-center justify-center rounded-xl transition focus:outline-none disabled:opacity-50 disabled:pointer-events-none";
  const sizeClass = size === "sm" ? "px-3 py-1.5 text-sm" : "px-4 py-2";
  const variantClass = variant === "primary" ? "border border-black hover:bg-black hover:text-white" :
                      variant === "secondary" ? "border border-neutral-300 hover:border-black" :
                      "border border-transparent hover:bg-neutral-100";
  
  return (
    <button 
      disabled={disabled}
      onClick={onClick} 
      className={`${baseClass} ${sizeClass} ${variantClass}`} 
      {...props}
    >
      {children}
    </button>
  );
};

const Card = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <div className={`rounded-2xl border border-neutral-200 bg-white shadow-sm ${className}`}>
    {children}
  </div>
);

const ProgressBar = ({ value }: { value: number }) => (
  <div className="w-full h-2 rounded bg-neutral-200/60">
    <div 
      className="h-2 rounded bg-gradient-to-r from-indigo-500 to-fuchsia-500 transition-[width]"
      style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
    />
  </div>
);

function buildAnalysis(answers: Answers) {
  const skinType = answers.skinType ?? "нормальная";
  const sensitivity = !!answers.sensitivity;
  const oiliness = answers.oiliness ?? "средняя";
  const concerns = answers.concerns ?? [];
  const primaryGoal = answers.primaryGoal ?? "увлажнить";

  const recommendedActives = new Set<string>();
  const riskFlags: string[] = [];

  if (concerns.includes("акне")) {
    recommendedActives.add("BHA 2% (салициловая) — через день вечером");
  }
  if (concerns.includes("постакне") || primaryGoal === "осветлить постакне") {
    recommendedActives.add("Азелаиновая кислота 10% — вечер/через день");
  }
  if (concerns.includes("расширенные поры") || primaryGoal === "сузить поры") {
    recommendedActives.add("Ниацинамид 4–10% — утро/вечер");
  }
  if (concerns.includes("сухость") || primaryGoal === "увлажнить" || skinType === "сухая") {
    recommendedActives.add("Гиалуроновая кислота / увлажняющий бустер");
    recommendedActives.add("Керамиды / сквалан — базовое восстановление");
  }
  if (concerns.includes("покраснение") || sensitivity) {
    recommendedActives.add("Цика / пантенол — успокаивание");
  }
  if (oiliness === "высокая") {
    recommendedActives.add("Лёгкие флюиды/гели; безкомедогенные формулы");
  }
  if (oiliness === "низкая" || skinType === "сухая") {
    recommendedActives.add("Более плотный крем вечером");
  }

  recommendedActives.add("SPF 50 утром ежедневно");

  if (sensitivity) {
    riskFlags.push("Избегать высоких концентраций кислот в первую неделю");
  }

  return {
    skinType,
    sensitivity,
    oiliness,
    concerns,
    primaryGoal,
    recommendedActives: [...recommendedActives],
    riskFlags
  };
}

function buildPlan(analysis: any) {
  const cleanser = analysis.skinType === "сухая" || analysis.sensitivity 
    ? "Мягкое очищение (крем/гель, pH≈5.5)" 
    : "Гель-очищение";
    
  const hydrator = analysis.primaryGoal === "увлажнить" || analysis.skinType === "сухая"
    ? "Увлажняющая сыворотка (гиалуроновая кислота)"
    : "Тонер/эссенция";

  const morningTreatments = [];
  if (analysis.primaryGoal === "сузить поры" || analysis.concerns.includes("расширенные поры")) {
    morningTreatments.push("Ниацинамид 4–10%");
  }
  if (analysis.concerns.includes("покраснение")) {
    morningTreatments.push("Цика/пантенол");
  }

  const eveningTreatments = [];
  if (analysis.concerns.includes("акне")) {
    eveningTreatments.push("BHA 2% (2–3 р/нед)");
  }
  if (analysis.concerns.includes("постакне") || analysis.primaryGoal === "осветлить постакне") {
    eveningTreatments.push("Азелаиновая 10% (через день)");
  }
  if (analysis.sensitivity) {
    eveningTreatments.push("Минималистичный буфер (алоэ/цина)");
  }

  const lightMoisturizer = "Лёгкий флюид/гель-крем (некомедогенный)";
  const richMoisturizer = "Крем с керамидами/скваланом";

  const generateId = (() => {
    let counter = 0;
    return (prefix = "p") => `${prefix}_${++counter}`;
  })();

  const morning = [
    { id: generateId("cl"), name: cleanser, step: "cleanser", timeOfDay: "morning" },
    { id: generateId("hy"), name: hydrator, step: "hydrator", timeOfDay: "morning" },
    ...morningTreatments.map(name => ({ 
      id: generateId("tr"), 
      name, 
      step: "treatment", 
      timeOfDay: "morning" 
    })),
    { 
      id: generateId("mo"), 
      name: analysis.skinType === "сухая" ? richMoisturizer : lightMoisturizer, 
      step: "moisturizer", 
      timeOfDay: "morning" 
    },
    { id: generateId("sp"), name: "SPF 50", step: "spf", timeOfDay: "morning" }
  ];

  const evening = [
    { id: generateId("cl"), name: cleanser, step: "cleanser", timeOfDay: "evening" },
    { 
      id: generateId("hy"), 
      name: "Успокаивающая эссенция/сыворотка (по необходимости)", 
      step: "hydrator", 
      timeOfDay: "evening" 
    },
    ...eveningTreatments.map(name => ({ 
      id: generateId("tr"), 
      name, 
      step: "treatment", 
      timeOfDay: "evening" 
    })),
    { 
      id: generateId("mo"), 
      name: analysis.sensitivity || analysis.skinType === "сухая" ? richMoisturizer : lightMoisturizer, 
      step: "moisturizer", 
      timeOfDay: "evening" 
    }
  ];

  return { morning, evening };
}

function build28DaySchedule(analysis: any) {
  const schedule = [];
  const hasAcne = analysis.concerns.includes("акне");
  const hasPostAcne = analysis.concerns.includes("постакне");
  const hasRedness = analysis.concerns.includes("покраснение");
  const isSensitive = analysis.sensitivity || analysis.skinType === "сухая";

  for (let day = 1; day <= 28; day++) {
    const morningNotes = ["Очищение → увлажнение → SPF 50"];
    const eveningNotes = ["Очищение → увлажнение → крем"];

    // Week 1 (days 1-7)
    if (day <= 7) {
      if (hasRedness || isSensitive) {
        eveningNotes.push("Успокаивающее (цика/пантенол)");
      }
      if (hasPostAcne) {
        eveningNotes.push("Азелаиновая 10% (1 раз в эту неделю)");
      }
    }

    // Week 2 (days 8-14)
    if (day >= 8 && day <= 14) {
      if (hasAcne && (day === 9 || day === 12)) {
        eveningNotes.push("BHA 2% (точечно/тонкий слой)");
      }
      if (hasPostAcne && day === 10) {
        eveningNotes.push("Азелаиновая 10%");
      }
      if (analysis.primaryGoal === "сузить поры" && (day === 11 || day === 14)) {
        morningNotes.push("Ниацинамид 4–10%");
      }
    }

    // Week 3 (days 15-21)
    if (day >= 15 && day <= 21) {
      if (hasAcne && (day === 15 || day === 18 || day === 21)) {
        eveningNotes.push("BHA 2%");
      }
      if (hasPostAcne && (day === 16 || day === 20)) {
        eveningNotes.push("Азелаиновая 10%");
      }
      if (!isSensitive && analysis.primaryGoal !== "увлажнить" && day === 19) {
        eveningNotes.push("Мягкий ретиноид (если есть опыт)");
      }
    }

    // Week 4 (days 22-28)
    if (day >= 22) {
      if (hasAcne && (day === 23 || day === 26)) {
        eveningNotes.push("BHA 2%");
      }
      if (hasPostAcne && (day === 22 || day === 25 || day === 28)) {
        eveningNotes.push("Азелаиновая 10%");
      }
      if (analysis.primaryGoal === "увлажнить" || isSensitive) {
        eveningNotes.push("Плотнее крем (керамиды)");
      }
    }

    schedule.push({
      day,
      morningNotes,
      eveningNotes
    });
  }

  return schedule;
}

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

  const analysis = useMemo(() => buildAnalysis(answers), [answers]);
  const plan = useMemo(() => buildPlan(analysis), [analysis]);
  const schedule = useMemo(() => build28DaySchedule(analysis), [analysis]);
  const [hasPremium, setHasPremium] = useState(isPremium());

  const unlockPremium = async () => {
    setPremium(true);
    setHasPremium(true);
  };

  const addAllToCart = () => {
    [...plan.morning, ...plan.evening].forEach(addToCart);
    alert("Все продукты добавлены в корзину.");
  };

  const sendToTelegram = () => {
    const text = `SkinIQ — персональный план ухода (28 дней)
Тип кожи: ${analysis.skinType}; Чувствительность: ${analysis.sensitivity ? "да" : "нет"}; Жирность: ${analysis.oiliness}
${analysis.concerns?.length ? `Проблемы: ${analysis.concerns.join(", ")}` : ""}
Цель: ${analysis.primaryGoal}

Утро:
${plan.morning.map((step, i) => `${i + 1}. ${step.name}`).join("\n")}

Вечер:
${plan.evening.map((step, i) => `${i + 1}. ${step.name}`).join("\n")}

Расписание 28 дней (кратко):
${schedule.map(day => `День ${day.day}: утро — ${day.morningNotes.join("; ")} | вечер — ${day.eveningNotes.join("; ")}`).join("\n")}`;

    if ((window as any).Telegram?.WebApp?.sendData) {
      (window as any).Telegram.WebApp.sendData(JSON.stringify({ type: "plan", text }));
      alert("План отправлен в чат боту.");
    } else {
      const success = (window.navigator as any).clipboard?.writeText(text);
      if (success) {
        alert("Я скопировал план в буфер обмена — вставь в чат вручную.");
      } else {
        alert("Не удалось отправить. Открой в Telegram Mini App или скопируй содержимое вручную.");
      }
    }
  };

  const printPlan = () => {
    window.print();
  };

  useEffect(() => {
    try {
      localStorage.setItem("skiniq.plan", JSON.stringify(plan));
    } catch {}
  }, [plan]);

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

  const ProductSection = ({ title, items }: { title: string; items: any[] }) => (
    <Card className="p-4 md:p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xl font-semibold">{title}</h3>
        <Button variant="ghost" onClick={() => items.forEach(addToCart)}>
          Добавить всё
        </Button>
      </div>
      <div className="grid gap-3">
        {items.map(item => (
          <div 
            key={`${item.timeOfDay}-${item.step}-${item.name}`}
            className="flex items-start justify-between gap-3 rounded-xl border border-neutral-200 p-3"
          >
            <div>
              <div className="text-base font-medium">{item.name}</div>
              <div className="text-xs opacity-60">{item.step}</div>
            </div>
            <Button size="sm" onClick={() => addToCart(item)}>
              Добавить в корзину
            </Button>
          </div>
        ))}
      </div>
    </Card>
  );

  const Header = () => (
    <div className="flex items-center justify-between mb-5">
      <div className="text-2xl md:text-3xl font-bold">Мой план ухода</div>
      <div className="flex gap-2">
        <Button variant="secondary" onClick={() => navigate("/cart")}>
          Корзина
        </Button>
        <Button variant="ghost" onClick={sendToTelegram}>
          Отправить в чат
        </Button>
        <Button onClick={printPlan}>
          Скачать PDF
        </Button>
      </div>
    </div>
  );

  const MetricsSection = () => (
    <Card className="p-4 md:p-5">
      <div className="flex items-start justify-between mb-4">
        <h3 className="text-xl font-semibold">Skin-характеристики</h3>
        <div className="text-sm text-neutral-500">Базируется на ваших ответах</div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">
        <div className="rounded-xl border border-neutral-200 p-3">
          <div className="text-xs text-neutral-500 mb-1">Тип кожи</div>
          <div className="text-lg font-semibold">{analysis.skinType}</div>
        </div>
        <div className="rounded-xl border border-neutral-200 p-3">
          <div className="text-xs text-neutral-500 mb-2">Чувствительность</div>
          <div className="flex items-center gap-3">
            <div className="w-full">
              <ProgressBar value={analysis.sensitivity ? 70 : 30} />
            </div>
            <div className="text-sm font-medium w-8 text-right">
              {analysis.sensitivity ? 9 : 3}
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-neutral-200 p-3">
          <div className="text-xs text-neutral-500 mb-2">Жирность</div>
          <div className="flex items-center gap-3">
            <div className="w-full">
              <ProgressBar value={
                analysis.oiliness === "высокая" ? 85 : 
                analysis.oiliness === "средняя" ? 55 : 25
              } />
            </div>
            <div className="text-sm font-medium w-12 text-right">
              {analysis.oiliness}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-xl border border-neutral-200 p-3">
          <div className="text-xs text-neutral-500 mb-1">Основная цель</div>
          <div className="font-medium">{analysis.primaryGoal}</div>
        </div>
        <div className="rounded-xl border border-neutral-200 p-3">
          <div className="text-xs text-neutral-500 mb-1">Ключевые активы</div>
          <div className="text-sm text-neutral-700">
            {analysis.recommendedActives.slice(0, 3).join(", ")}
          </div>
        </div>
      </div>
    </Card>
  );

  const ScheduleSection = () => (
    <Card className="p-4 md:p-5">
      <h3 className="text-xl font-semibold mb-3">Расписание 28 дней</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {schedule.map(day => (
          <div key={day.day} className="rounded-xl border border-neutral-200 p-3">
            <div className="text-sm font-semibold mb-1">День {day.day}</div>
            <div className="text-sm">
              <span className="opacity-60">Утро:</span> {day.morningNotes.join("; ")}
            </div>
            <div className="text-sm">
              <span className="opacity-60">Вечер:</span> {day.eveningNotes.join("; ")}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );

  const planContent = (
    <div className="space-y-4">
      <MetricsSection />
      <ProductSection title="Утро" items={plan.morning} />
      <ProductSection title="Вечер" items={plan.evening} />
      <Card className="p-4 md:p-5">
        <div className="flex items-center justify-between">
          <div className="text-sm opacity-70">
            Быстро добавить все средства в корзину
          </div>
          <Button onClick={addAllToCart}>
            Добавить все
          </Button>
        </div>
      </Card>
      <ScheduleSection />
    </div>
  );

  return (
    <div className="max-w-3xl mx-auto px-4 py-5 md:py-8 print:px-0">
      <Header />
      {hasPremium ? planContent : <PremiumOverlay>{planContent}</PremiumOverlay>}
      
      <style>{`
        @media print {
          .print\\:px-0 { padding-left: 0 !important; padding-right: 0 !important; }
          button, a { display: none !important; }
          .blur-md { filter: none !important; }
          .backdrop-blur-sm, .bg-white\\/70 { display: none !important; }
        }
      `}</style>
    </div>
  );
}