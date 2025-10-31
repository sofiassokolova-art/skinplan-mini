import { useMemo, useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { fetchDailyAdvice, buildAdviceCacheKey } from "../lib/dailyAdvice";
import type { AnalysisSnapshot } from "../lib/dailyAdvice";

const STORAGE_KEY = "skiniq.answers";
const PREMIUM_KEY = "skiniq.premium";

interface Answers {
  name?: string;
  skinType?: string;
  sensitivity?: boolean;
  concerns?: string[];
  oiliness?: string;
  primaryGoal?: string;
  photo_data_url?: string | null;
  photo_analysis?: any | null;
  photo_scans?: { ts: number; preview: string; analysis: any; problemAreas?: any[] }[];
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
    const cartItems = JSON.parse(localStorage.getItem("skinplan_cart") || "[]");
    const newItem = {
      id: `${item.step}-${Date.now()}`,
      name: item.name,
      qty: 1,
      feedback: ""
    };
    
    // Проверяем, нет ли уже такого товара
    const existingIndex = cartItems.findIndex((cartItem: any) => cartItem.name === item.name);
    if (existingIndex >= 0) {
      cartItems[existingIndex].qty += 1;
    } else {
      cartItems.push(newItem);
    }
    
    localStorage.setItem("skinplan_cart", JSON.stringify(cartItems));
    console.log("Товар добавлен в корзину:", newItem.name);
  } catch (error) {
    console.error("Ошибка добавления в корзину:", error);
  }
}

const Button = ({ children, onClick, variant = "primary", size = "md", disabled, ...props }: any) => {
  const baseClass = "inline-flex items-center justify-center rounded-2xl transition-all duration-200 focus:outline-none disabled:opacity-50 disabled:pointer-events-none font-semibold";
  const sizeClass = size === "sm" ? "px-3 py-1.5 text-sm" : size === "lg" ? "px-6 py-3 text-base" : "px-4 py-2 text-sm";
  const variantClass = variant === "primary" ? "bg-gradient-to-r from-gray-600 to-gray-700 text-white hover:from-gray-700 hover:to-gray-800 shadow-[0_10px_30px_rgba(0,0,0,0.2)] hover:shadow-[0_15px_40px_rgba(0,0,0,0.3)] hover:scale-[1.02] active:scale-[0.98]" :
                      variant === "secondary" ? "bg-white/30 backdrop-blur-xl text-gray-800 border border-gray-200/50 hover:bg-white/40 shadow-[0_4px_16px_rgba(0,0,0,0.1)]" :
                      "bg-white/20 backdrop-blur-xl text-gray-700 border border-gray-200/40 hover:bg-white/30 shadow-[0_4px_16px_rgba(0,0,0,0.08)]";
  
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
  <div className={`rounded-3xl border border-white/40 bg-white/30 backdrop-blur-2xl shadow-[0_8px_32px_rgba(0,0,0,0.1)] hover:shadow-[0_12px_48px_rgba(0,0,0,0.15)] transition-all duration-500 overflow-hidden relative ${className}`}>
    {/* Glassmorphism gradient overlay */}
    <div className="absolute inset-0 bg-gradient-to-br from-white/30 via-white/10 to-transparent rounded-3xl pointer-events-none"></div>
    <div className="relative z-10">
      {children}
    </div>
  </div>
);

const ProgressBar = ({ value }: { value: number }) => (
  <div className="w-full h-2 rounded-full bg-white/30 backdrop-blur-xl border border-white/40 shadow-inner">
    <div 
      className="h-2 rounded-full bg-gradient-to-r from-gray-600 to-gray-700 transition-[width] duration-700 ease-out shadow-lg"
      style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
    />
  </div>
);

const Icon = ({ name, className = "w-5 h-5" }: { name: string; className?: string }) => {
  const icons: Record<string, React.JSX.Element> = {
    'target': (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
        <circle cx="12" cy="12" r="10"/>
        <circle cx="12" cy="12" r="6"/>
        <circle cx="12" cy="12" r="2"/>
      </svg>
    ),
    'zap': (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
        <polygon points="13,2 3,14 12,14 11,22 21,10 12,10"/>
      </svg>
    ),
    'droplet': (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
        <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/>
      </svg>
    ),
    'sparkles': (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
        <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/>
        <path d="M20 3v4"/>
        <path d="M22 5h-4"/>
        <path d="M4 17v2"/>
        <path d="M5 18H3"/>
      </svg>
    ),
    'flask': (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
        <path d="M9 2v6l-2 2v8a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2v-8l-2-2V2"/>
        <path d="M9 2h6"/>
        <path d="M12 10v4"/>
      </svg>
    ),
    'calendar': (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
        <line x1="16" y1="2" x2="16" y2="6"/>
        <line x1="8" y1="2" x2="8" y2="6"/>
        <line x1="3" y1="10" x2="21" y2="10"/>
      </svg>
    ),
    'sun': (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
        <circle cx="12" cy="12" r="5"/>
        <line x1="12" y1="1" x2="12" y2="3"/>
        <line x1="12" y1="21" x2="12" y2="23"/>
        <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
        <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
        <line x1="1" y1="12" x2="3" y2="12"/>
        <line x1="21" y1="12" x2="23" y2="12"/>
        <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
        <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
      </svg>
    ),
    'moon': (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
      </svg>
    ),
    'shopping-cart': (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
        <circle cx="9" cy="21" r="1"/>
        <circle cx="20" cy="21" r="1"/>
        <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
      </svg>
    ),
    'send': (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
        <line x1="22" y1="2" x2="11" y2="13"/>
        <polygon points="22,2 15,22 11,13 2,9"/>
      </svg>
    ),
    'camera': (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
        <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/>
        <circle cx="12" cy="13" r="3"/>
      </svg>
    ),
    'eye': (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
        <circle cx="12" cy="12" r="3"/>
      </svg>
    ),
    'lock': (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
        <circle cx="12" cy="16" r="1"/>
        <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
      </svg>
    ),
    'plus': (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
        <line x1="12" y1="5" x2="12" y2="19"/>
        <line x1="5" y1="12" x2="19" y2="12"/>
      </svg>
    ),
    'refresh': (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
        <polyline points="23 4 23 10 17 10" />
        <polyline points="1 20 1 14 7 14" />
        <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10" />
        <path d="M20.49 15a9 9 0 0 1-14.85 3.36L1 14" />
      </svg>
    ),
    'x': (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
        <line x1="18" y1="6" x2="6" y2="18"/>
        <line x1="6" y1="6" x2="18" y2="18"/>
      </svg>
    )
  };
  return icons[name] || <div className={className} />;
};

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
      (answers.skinType || answers.concerns || answers.primaryGoal) : false;
  }, [answers]);

  useEffect(() => {
    if (!hasCompletedQuiz) {
      navigate("/quiz");
    }
  }, [hasCompletedQuiz, navigate]);

  const analysis = useMemo(() => buildAnalysis(answers), [answers]);
  const plan = useMemo(() => buildPlan(analysis), [analysis]);
  const schedule = useMemo(() => build28DaySchedule(analysis), [analysis]);
  const adviceSnapshot = useMemo<AnalysisSnapshot>(() => ({
    skinType: analysis.skinType,
    sensitivity: analysis.sensitivity,
    oiliness: analysis.oiliness,
    concerns: analysis.concerns,
    primaryGoal: analysis.primaryGoal,
    recommendedActives: analysis.recommendedActives,
    riskFlags: analysis.riskFlags,
  }), [analysis]);
  const [hasPremium, setHasPremium] = useState(isPremium());
  const [itemsAddedToCart, setItemsAddedToCart] = useState(false);
  const [isPageLoaded] = useState(true);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [showDayDetails, setShowDayDetails] = useState(false);
  const [dailyAdvice, setDailyAdvice] = useState<string | null>(null);
  const [adviceLoading, setAdviceLoading] = useState(false);
  const [adviceError, setAdviceError] = useState<string | null>(null);
  const [adviceRefreshToken, setAdviceRefreshToken] = useState(0);
  
  const hasPhotoData = useMemo(() => {
    return !!(answers.photo_data_url || (answers.photo_scans && answers.photo_scans.length > 0));
  }, [answers]);
  

  
  const unlockPremium = async () => {
    setPremium(true);
    setHasPremium(true);
  };




  const addAllToCart = () => {
    try {
      [...plan.morning, ...plan.evening].forEach(addToCart);
      console.log("Все продукты добавлены в корзину");
      
      // Меняем состояние кнопки
      setItemsAddedToCart(true);
      
      alert("Все продукты добавлены в корзину!");
    } catch (error) {
      console.error("Ошибка добавления товаров:", error);
      alert("Ошибка при добавлении товаров в корзину");
    }
  };

  const goToCart = () => {
    navigate("/cart");
  };

  useEffect(() => {
    const cacheKey = buildAdviceCacheKey(adviceSnapshot);
    const cachedAdvice = (() => {
      try {
        return localStorage.getItem(cacheKey) || null;
      } catch {
        return null;
      }
    })();

    if (cachedAdvice && adviceRefreshToken === 0) {
      setDailyAdvice(cachedAdvice);
      setAdviceLoading(false);
      return;
    }

    const controller = new AbortController();
    setAdviceLoading(true);
    setAdviceError(null);

    fetchDailyAdvice(adviceSnapshot, controller.signal)
      .then((adviceText) => {
        setDailyAdvice(adviceText);
        try {
          localStorage.setItem(cacheKey, adviceText);
        } catch {}
      })
      .catch((error) => {
        if (error.name === "AbortError") return;
        console.error("Не удалось получить ежедневный совет:", error);
        setAdviceError("Не удалось загрузить совет. Попробуйте обновить позже.");
      })
      .finally(() => {
        setAdviceLoading(false);
      });

    return () => controller.abort();
  }, [adviceSnapshot, adviceRefreshToken]);

  const refreshAdvice = () => {
    try {
      const cacheKey = buildAdviceCacheKey(adviceSnapshot);
      localStorage.removeItem(cacheKey);
    } catch {}
    setAdviceRefreshToken((v) => v + 1);
  };

  // Функция для сброса состояния корзины (если пользователь хочет добавить еще)
  const resetCartState = () => {
    setItemsAddedToCart(false);
  };




  useEffect(() => {
    try {
      localStorage.setItem("skiniq.plan", JSON.stringify(plan));
    } catch {}
  }, [plan]);

  if (!hasCompletedQuiz) {
    return (
      <div className="w-full min-h-screen relative overflow-x-hidden">
        {/* Background gradient */}
        <div 
          className="fixed inset-0 -z-10 bg-gradient-to-br from-gray-100 via-slate-100 to-gray-200"
        />
        
        
        <div className="relative z-20 px-4 pt-32 pb-8 w-full">
          <div className="bg-white/20 backdrop-blur-xl border border-white/40 shadow-[0_8px_24px_rgba(0,0,0,0.08)] rounded-3xl p-6 md:p-8">
            <h2 className="text-[18px] font-semibold text-gray-900 mb-2">План недоступен</h2>
            <p className="text-[14px] text-gray-600 mb-6">Сначала пройди анкету — затем я соберу план автоматически.</p>
            <a 
              href="/quiz" 
              className="inline-block px-5 py-3 rounded-2xl bg-gradient-to-r from-gray-600 to-gray-700 text-white text-[15px] font-semibold hover:from-gray-700 hover:to-gray-800 transition-all duration-200 shadow-[0_4px_16px_rgba(0,0,0,0.15)]"
            >
              К анкете
            </a>
          </div>
        </div>
      </div>
    );
  }

  const BlurredContent = ({ children, showOverlay = true }: { children: React.ReactNode; showOverlay?: boolean }) => (
    <div className="relative">
      <div className="pointer-events-none select-none blur-sm brightness-95">
        {children}
      </div>
      {showOverlay && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/80 backdrop-blur-sm rounded-2xl">
          <div className="text-center p-4">
            <div className="text-sm font-medium mb-2 flex items-center justify-center gap-2">
              <Icon name="lock" className="w-4 h-4" />
              Премиум-контент
            </div>
            <Button size="sm" onClick={unlockPremium}>
              Разблокировать за 199₽
            </Button>
          </div>
        </div>
      )}
    </div>
  );

  const ProductSection = ({ title, items }: { title: string; items: any[] }) => (
    <Card className="p-6 md:p-8">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-[18px] font-semibold text-gray-900">{title}</h3>
        {hasPremium && (
          itemsAddedToCart ? (
            <Button variant="ghost" onClick={goToCart}>
              🛒 В корзину
            </Button>
          ) : (
            <Button variant="ghost" onClick={() => items.forEach(addToCart)}>
              Добавить всё
            </Button>
          )
        )}
      </div>
      
      {hasPremium ? (
        <div className="flex flex-col gap-4 max-h-none overflow-visible">
          {items.map(item => (
            <div 
              key={`${item.timeOfDay}-${item.step}-${item.name}`}
              className="flex items-start justify-between gap-4 rounded-2xl border border-white/40 p-5 bg-white/30 backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.1)] hover:bg-white/40 hover:shadow-[0_12px_48px_rgba(0,0,0,0.15)] transition-all duration-500 hover:scale-[1.02]"
            >
              <div className="flex-1">
                <div className="text-lg font-semibold text-gray-900 mb-2">{item.name}</div>
                <div className="text-sm text-gray-600 font-medium">{item.step}</div>
              </div>
              <Button size="sm" onClick={() => addToCart(item)}>
                Добавить в корзину
              </Button>
            </div>
          ))}
        </div>
      ) : (
        <BlurredContent>
          <div className="flex flex-col gap-4 max-h-none overflow-visible">
            {items.map(item => (
            <div 
              key={`${item.timeOfDay}-${item.step}-${item.name}`}
              className="flex items-start justify-between gap-4 rounded-2xl border border-gray-200/50 p-5 bg-gray-50/40 backdrop-blur-xl shadow-[0_4px_12px_rgba(0,0,0,0.08)]"
            >
                <div className="flex-1">
                  <div className="text-lg font-semibold text-gray-900 mb-2">{item.name}</div>
                  <div className="text-sm text-gray-600 font-medium">{item.step}</div>
                </div>
                <Button size="sm">Добавить в корзину</Button>
              </div>
            ))}
          </div>
        </BlurredContent>
      )}
    </Card>
  );

  const PhotoSection = () => {
    if (!hasPhotoData) {
      // Пользователи без фото - предложение добавить
      return (
        <Card className="p-4 mb-4 border-2 border-dashed border-blue-200 bg-blue-50/30">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-medium mb-1">📸 Улучшить план с помощью фото</h3>
              <p className="text-sm text-neutral-600">Загрузите фото лица для более точных рекомендаций с ИИ-анализом</p>
            </div>
            <div>
              <Link to="/photo">
                <Button variant="secondary">Перейти к скану</Button>
              </Link>
            </div>
          </div>
        </Card>
      );
    }

    // Пользователи с фото - виджет с результатами
    const latestScan = answers.photo_scans?.[answers.photo_scans.length - 1];
    const photoAnalysis = answers.photo_analysis || latestScan?.analysis;

    return (
      <Card className="p-4 mb-4 bg-green-50/50 border border-green-200">
        <div className="flex items-start gap-4">
          {/* Миниатюра последнего фото */}
          <div className="relative">
            <img 
              src={answers.photo_data_url || latestScan?.preview} 
              alt="Анализ кожи" 
              className="w-20 h-20 rounded-xl border object-cover"
            />
            <div className="absolute -top-1 -right-1 w-6 h-6 bg-green-500 text-white rounded-full flex items-center justify-center text-xs font-bold">
              ✓
            </div>
          </div>
          
          {/* Информация об анализе */}
          <div className="flex-1">
            <h3 className="text-lg font-medium mb-1">ИИ-анализ кожи</h3>
            <div className="text-sm text-zinc-700 space-y-1">
              <div><strong>Тип:</strong> {photoAnalysis?.skinType}</div>
              <div><strong>Проблемы:</strong> {photoAnalysis?.concerns?.join(", ")}</div>
              <div className="text-xs text-zinc-500">
                Последний анализ: {latestScan ? new Date(latestScan.ts).toLocaleString() : "сейчас"}
              </div>
            </div>
          </div>
          
          {/* Действия */}
          <div className="flex flex-col gap-2">
            <div className="flex gap-1">
              <Link to="/photo">
                <Button size="sm" variant="secondary">
                  <Icon name="camera" className="w-4 h-4 mr-2" />
                  Новое фото
                </Button>
              </Link>

            </div>
            <Link to="/photo/results" state={{ analysisData: photoAnalysis }}>
              <Button size="sm" variant="ghost">
                <Icon name="eye" className="w-4 h-4 mr-2" />
                Подробнее
              </Button>
            </Link>
          </div>
        </div>

      </Card>
    );
  };


  const MetricsSection = () => (
    <Card className="p-6 md:p-8">
      <div className="flex items-start justify-between mb-6">
        <h3 className="text-[18px] font-semibold text-gray-900">Skin-характеристики</h3>
        <div className="text-sm text-gray-600 bg-white/30 backdrop-blur-xl px-3 py-1.5 rounded-full border border-gray-200/50">Базируется на ваших ответах</div>
      </div>
      
      {hasPremium ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="rounded-2xl border border-white/40 p-5 bg-white/30 backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.1)] hover:shadow-[0_12px_48px_rgba(0,0,0,0.15)] transition-all duration-500 hover:scale-[1.02]">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-8 h-8 rounded-full bg-white/50 backdrop-blur-xl flex items-center justify-center shadow-sm">
                  <Icon name="target" className="w-4 h-4 text-gray-700" />
                </div>
                <div className="text-sm text-gray-600 font-semibold">Тип кожи</div>
              </div>
              <div className="text-lg font-bold text-gray-900 capitalize">{analysis.skinType}</div>
            </div>
            <div className="rounded-2xl border border-white/40 p-5 bg-white/30 backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.1)] hover:shadow-[0_12px_48px_rgba(0,0,0,0.15)] transition-all duration-500 hover:scale-[1.02]">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 rounded-full bg-white/50 backdrop-blur-xl flex items-center justify-center shadow-sm">
                  <Icon name="zap" className="w-4 h-4 text-gray-700" />
                </div>
                <div className="text-sm text-gray-600 font-semibold">Чувствительность</div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-full">
                  <ProgressBar value={analysis.sensitivity ? 70 : 30} />
                </div>
                <div className="text-base font-bold w-8 text-right text-gray-900">
                  {analysis.sensitivity ? 9 : 3}
                </div>
              </div>
            </div>
            <div className="rounded-2xl border border-white/40 p-5 bg-white/30 backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.1)] hover:shadow-[0_12px_48px_rgba(0,0,0,0.15)] transition-all duration-500 hover:scale-[1.02]">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 rounded-full bg-white/50 backdrop-blur-xl flex items-center justify-center shadow-sm">
                  <Icon name="droplet" className="w-4 h-4 text-gray-700" />
                </div>
                <div className="text-sm text-gray-600 font-semibold">Жирность</div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-full">
                  <ProgressBar value={
                    analysis.oiliness === "высокая" ? 85 : 
                    analysis.oiliness === "средняя" ? 55 : 25
                  } />
                </div>
                <div className="text-base font-bold w-12 text-right text-gray-900 capitalize">
                  {analysis.oiliness}
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-2xl border border-white/40 p-5 bg-white/30 backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.1)] hover:shadow-[0_12px_48px_rgba(0,0,0,0.15)] transition-all duration-500 hover:scale-[1.02]">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-8 h-8 rounded-full bg-white/50 backdrop-blur-xl flex items-center justify-center shadow-sm">
                  <Icon name="sparkles" className="w-4 h-4 text-gray-700" />
                </div>
                <div className="text-sm text-gray-600 font-semibold">Основная цель</div>
              </div>
              <div className="font-bold text-gray-900 capitalize text-base">{analysis.primaryGoal}</div>
            </div>
            <div className="rounded-2xl border border-white/40 p-5 bg-white/30 backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.1)] hover:shadow-[0_12px_48px_rgba(0,0,0,0.15)] transition-all duration-500 hover:scale-[1.02]">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-8 h-8 rounded-full bg-white/50 backdrop-blur-xl flex items-center justify-center shadow-sm">
                  <Icon name="flask" className="w-4 h-4 text-gray-700" />
                </div>
                <div className="text-sm text-gray-600 font-semibold">Ключевые активы</div>
              </div>
              <div className="text-base text-gray-800 font-medium">
                {analysis.recommendedActives.slice(0, 3).join(", ")}
              </div>
            </div>
          </div>
        </>
      ) : (
        <BlurredContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">
            <div className="rounded-xl border border-gray-200/50 bg-gray-50/20 backdrop-blur-xl p-3">
              <div className="text-xs text-gray-600 mb-1">Тип кожи</div>
              <div className="text-lg font-semibold">комбинированная</div>
            </div>
            <div className="rounded-xl border border-gray-200/50 bg-gray-50/20 backdrop-blur-xl p-3">
              <div className="text-xs text-gray-600 mb-2">Чувствительность</div>
              <div className="flex items-center gap-3">
                <div className="w-full">
                  <ProgressBar value={50} />
                </div>
                <div className="text-sm font-medium w-8 text-right">5</div>
              </div>
            </div>
            <div className="rounded-xl border border-gray-200/50 bg-gray-50/20 backdrop-blur-xl p-3">
              <div className="text-xs text-gray-600 mb-2">Жирность</div>
              <div className="flex items-center gap-3">
                <div className="w-full">
                  <ProgressBar value={60} />
                </div>
                <div className="text-sm font-medium w-12 text-right">средняя</div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-xl border border-gray-200/50 bg-gray-50/20 backdrop-blur-xl p-3">
              <div className="text-xs text-gray-600 mb-1">Основная цель</div>
              <div className="font-medium">улучшить состояние</div>
            </div>
            <div className="rounded-xl border border-gray-200/50 bg-gray-50/20 backdrop-blur-xl p-3">
              <div className="text-xs text-gray-600 mb-1">Ключевые активы</div>
              <div className="text-sm text-gray-700">
                BHA, Ниацинамид, SPF
              </div>
            </div>
          </div>
        </BlurredContent>
      )}
    </Card>
  );

  const CalendarSection = () => {
    const handleDayClick = (day: number) => {
      setSelectedDay(day);
      setShowDayDetails(true);
    };

    const closeDayDetails = () => {
      setShowDayDetails(false);
      setSelectedDay(null);
    };

    const selectedDayData = selectedDay ? schedule.find(d => d.day === selectedDay) : null;

    return (
      <>
        <Card className="p-6 md:p-8">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-10 h-10 rounded-full bg-white/50 backdrop-blur-xl flex items-center justify-center shadow-sm">
              <Icon name="calendar" className="w-5 h-5 text-gray-700" />
            </div>
            <h3 className="text-[18px] font-semibold text-gray-900">Календарь ухода</h3>
          </div>
          
          {/* Календарная сетка */}
          <div className="grid grid-cols-7 gap-2 mb-4">
            {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map(day => (
              <div key={day} className="text-center text-sm font-semibold text-gray-600 py-2">
                {day}
              </div>
            ))}
          </div>
          
          <div className="grid grid-cols-7 gap-2">
            {Array.from({ length: 28 }, (_, i) => {
              const dayNumber = i + 1;
              const isCompleted = dayNumber <= 7; // Примерно первые 7 дней выполнены
              
              return (
                <button
                  key={dayNumber}
                  onClick={() => handleDayClick(dayNumber)}
                  className={`aspect-square rounded-xl border-2 transition-all duration-200 hover:scale-105 ${
                    isCompleted
                      ? 'bg-gradient-to-br from-green-400 to-green-500 border-green-300 text-white shadow-lg'
                      : 'bg-white/30 border-white/40 text-gray-700 hover:bg-white/40'
                  }`}
                >
                  <div className="flex flex-col items-center justify-center h-full">
                    <span className="text-sm font-bold">{dayNumber}</span>
                    {isCompleted && (
                      <Icon name="check" className="w-3 h-3 mt-1" />
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </Card>

        {/* Модальное окно с деталями дня */}
        {showDayDetails && selectedDayData && (
          <div className="fixed inset-0 z-50 flex items-end justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div
              className="bg-white/95 backdrop-blur-xl rounded-t-3xl w-full max-w-md max-h-[85vh] overflow-hidden shadow-2xl animate-[slideUp_0.3s_ease-out]"
              style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 20px)' }}
            >
              <div className="overflow-y-auto px-6 pt-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-bold text-gray-900">День {selectedDayData.day}</h3>
                  <button
                    onClick={closeDayDetails}
                    className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors"
                  >
                    <Icon name="x" className="w-4 h-4" />
                  </button>
                </div>
                
                <div className="space-y-4">
                  <div className="bg-gradient-to-r from-yellow-100 to-orange-100 rounded-2xl p-4">
                    <div className="flex items-center gap-2 text-orange-700 font-semibold mb-2">
                      <Icon name="sun" className="w-5 h-5" />
                      Утренний уход
                    </div>
                    <div className="text-orange-800 text-sm">
                      {selectedDayData.morningNotes.join("; ")}
                    </div>
                  </div>
                  
                  <div className="bg-gradient-to-r from-indigo-100 to-purple-100 rounded-2xl p-4">
                    <div className="flex items-center gap-2 text-purple-700 font-semibold mb-2">
                      <Icon name="moon" className="w-5 h-5" />
                      Вечерний уход
                    </div>
                    <div className="text-purple-800 text-sm">
                      {selectedDayData.eveningNotes.join("; ")}
                    </div>
                  </div>
                </div>
                
                <div className="px-6 pb-4">
                  <button
                    onClick={closeDayDetails}
                    className="w-full mt-6 py-3 bg-gradient-to-r from-gray-600 to-gray-700 text-white rounded-2xl font-semibold hover:from-gray-700 hover:to-gray-800 transition-all duration-200"
                  >
                    Закрыть
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </>
    );
  };

  const AdviceSection = () => (
    <Card className="p-6 md:p-8 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-[#f0f4ff]/70 via-white/60 to-[#f7f0ff]/70 pointer-events-none" />
      <div className="relative z-10 flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-[12px] uppercase tracking-[0.24em] text-gray-500 font-semibold mb-1">Совет дня</div>
            <h3 className="text-[18px] font-semibold text-gray-900">Персональная подсказка по уходу</h3>
          </div>
          <button
            type="button"
            onClick={refreshAdvice}
            disabled={adviceLoading}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/70 border border-white/80 text-sm text-gray-700 hover:bg-white/90 transition disabled:opacity-60"
          >
            <Icon name="refresh" className="w-4 h-4" />
            Обновить
          </button>
        </div>
        {adviceLoading && (
          <div className="animate-pulse bg-white/70 border border-white/80 rounded-2xl p-5 text-sm text-gray-600">
            Генерируем подсказку для твоей кожи...
          </div>
        )}
        {!adviceLoading && adviceError && (
          <div className="bg-white/70 border border-red-200 rounded-2xl p-5 text-sm text-red-600">
            {adviceError}
          </div>
        )}
        {!adviceLoading && dailyAdvice && (
          <div className="bg-white/80 border border-white/80 rounded-2xl p-5 shadow-[0_12px_30px_rgba(79,70,229,0.08)] text-[15px] text-gray-800 leading-relaxed">
            {dailyAdvice}
          </div>
        )}
        {!adviceLoading && !dailyAdvice && !adviceError && (
          <div className="bg-white/70 border border-white/80 rounded-2xl p-5 text-sm text-gray-600">
            Мы подготовим совет после краткой генерации. Нажми «Обновить», если нужно получить подсказку повторно.
          </div>
        )}
      </div>
    </Card>
  );

  return (
    <div
      className="w-full min-h-screen relative"
      style={{
        paddingTop: 'env(safe-area-inset-top, 0px)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)'
      }}
    >
      {/* Background gradient */}
      <div 
        className="fixed inset-0 -z-10 plan-gradient-animation"
      />
      
      <style>{`
        @keyframes slideUp {
          from { transform: translateY(100%); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        .plan-gradient-animation {
          background: linear-gradient(130deg, #d9dbe6 0%, #e9ebf2 40%, #ffffff 70%, #e2e5ed 100%);
          background-size: 300% 300%;
          animation: gradientMotion 20s ease-in-out infinite;
        }
        @keyframes gradientMotion {
          0% { background-position: 0% 0%; }
          25% { background-position: 50% 50%; }
          50% { background-position: 100% 100%; }
          75% { background-position: 50% 50%; }
          100% { background-position: 0% 0%; }
        }
      `}</style>

      
      {/* Header */}
      <div
        className="relative z-20 px-4 w-full"
        style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 20px)' }}
      >
        <div className="text-center sm:flex sm:items-center sm:justify-between mb-6">
          <div className="flex-1">
            <h1 className="text-[18px] font-semibold text-gray-900 mb-2">Мой план ухода</h1>
            <p className="text-[14px] text-gray-600">Персональные рекомендации для вашей кожи</p>
          </div>
          <div className="flex flex-wrap gap-2 justify-center sm:justify-end mt-4 sm:mt-0">
            <Button variant="secondary" onClick={() => navigate("/cart")} size="sm">
              <Icon name="shopping-cart" className="w-4 h-4 mr-2" />
              Корзина
            </Button>
            <Button variant="ghost" onClick={() => alert("📋 Функция отправки в PDF временно недоступна")} size="sm">
              <Icon name="send" className="w-4 h-4 mr-2" />
              Отправить PDF
            </Button>
          </div>
        </div>
      </div>
      
      <div
        className={`relative z-20 space-y-6 px-4 w-full transition-all duration-500 ${
        isPageLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
      }`}
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 32px)' }}
      >
      
      <AdviceSection />
 
      <PhotoSection />
      
      {!hasPremium && (
        <Card className="p-6 text-center mb-4">
          <div className="text-lg font-semibold mb-2 flex items-center justify-center gap-2">
            <Icon name="lock" className="w-5 h-5" />
            Персональные рекомендации
          </div>
          <div className="text-sm opacity-70 mb-4">Разблокируй детальный план ухода и расписание на 28 дней</div>
          <Button onClick={unlockPremium}>
            Разблокировать рекомендации за 199₽
          </Button>
          <div className="text-xs opacity-60 mt-2">
            Оплата единовременная · доступ сразу
          </div>
        </Card>
      )}

      <div className="space-y-4">
        <MetricsSection />
        <ProductSection title="Уход сегодня" items={[...plan.morning, ...plan.evening]} />
        
        {/* Кнопка перепройти к подробному плану */}
        <Card className="p-4 text-center">
          <h3 className="text-lg font-semibold mb-2">Получить подробный план</h3>
          <p className="text-sm text-neutral-600 mb-4">
            Разблокируйте детальное расписание на 28 дней и персональные рекомендации
          </p>
          <Button onClick={unlockPremium} size="lg">
            Перепройти к подробному плану
          </Button>
        </Card>
        
        {hasPremium && (
          <Card className="p-4 md:p-5">
            <div className="flex items-center justify-between">
              <div className="text-sm opacity-70">
                Быстро добавить все средства в корзину
              </div>
              <div className="flex gap-2">
                {itemsAddedToCart ? (
                  <>
                    <Button onClick={goToCart} variant="secondary">
                      🛒 Перейти в корзину
                    </Button>
                    <Button onClick={resetCartState} variant="ghost" size="sm">
                      ↻
                    </Button>
                  </>
                ) : (
                  <Button onClick={addAllToCart}>Добавить все</Button>
                )}
              </div>
            </div>
          </Card>
        )}
        
        {hasPremium ? (
          <CalendarSection />
        ) : (
          <Card className="p-4 md:p-5">
            <h3 className="text-xl font-semibold mb-3">Расписание 28 дней</h3>
            <BlurredContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {schedule.slice(0, 6).map(day => (
                  <div key={day.day} className="rounded-xl border border-gray-200/50 bg-gray-50/20 backdrop-blur-xl p-3">
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
            </BlurredContent>
          </Card>
        )}
        </div>
      </div>
      
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