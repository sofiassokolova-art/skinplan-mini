import { useMemo, useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";

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
  const baseClass = "inline-flex items-center justify-center rounded-2xl transition-all duration-200 focus:outline-none disabled:opacity-50 disabled:pointer-events-none font-medium";
  const sizeClass = size === "sm" ? "px-3 py-1.5 text-sm" : "px-5 py-2.5";
  const variantClass = variant === "primary" ? "bg-gradient-to-br from-purple-500 to-purple-600 text-white shadow-lg shadow-purple-500/30 hover:shadow-xl hover:shadow-purple-500/40" :
                      variant === "secondary" ? "border border-purple-200/50 bg-white/70 backdrop-blur-xl hover:bg-white/90 hover:border-purple-300/60 shadow-sm" :
                      "border border-transparent hover:bg-purple-100/30";
  
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
  <div className={`rounded-3xl border border-purple-200/30 bg-white/60 backdrop-blur-xl shadow-[0_8px_32px_rgba(139,92,246,0.12)] ${className}`}>
    {children}
  </div>
);

const ProgressBar = ({ value }: { value: number }) => (
  <div className="w-full h-2 rounded-full bg-purple-100/50">
    <div 
      className="h-2 rounded-full bg-gradient-to-r from-purple-400 via-purple-500 to-purple-600 transition-[width] duration-500 shadow-sm"
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
  const [itemsAddedToCart, setItemsAddedToCart] = useState(false);
  const [isPageLoaded, setIsPageLoaded] = useState(false);
  
  const hasPhotoData = useMemo(() => {
    return !!(answers.photo_data_url || (answers.photo_scans && answers.photo_scans.length > 0));
  }, [answers]);

  useEffect(() => {
    setIsPageLoaded(true);
  }, []);
  

  
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

  // Функция для сброса состояния корзины (если пользователь хочет добавить еще)
  const resetCartState = () => {
    setItemsAddedToCart(false);
  };

  const sendToTelegram = async () => {
    try {
      // Временно отключено
      alert("📋 Функция отправки в Telegram временно недоступна");
    } catch (error) {
      console.error('Error sending to Telegram:', error);
      alert("Ошибка отправки. Проверьте подключение к интернету.");
    }
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

  const BlurredContent = ({ children, showOverlay = true }: { children: React.ReactNode; showOverlay?: boolean }) => (
    <div className="relative">
      <div className="pointer-events-none select-none blur-sm brightness-95">
        {children}
      </div>
      {showOverlay && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/80 backdrop-blur-sm rounded-2xl">
          <div className="text-center p-4">
            <div className="text-sm font-medium mb-2">🔒 Премиум-контент</div>
            <Button size="sm" onClick={unlockPremium}>
              Разблокировать за 199₽
            </Button>
          </div>
        </div>
      )}
    </div>
  );

  const ProductSection = ({ title, items }: { title: string; items: any[] }) => (
    <Card className="p-4 md:p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xl font-semibold">{title}</h3>
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
      ) : (
        <BlurredContent>
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
                <Button size="sm" variant="secondary">📷 Новое фото</Button>
              </Link>

            </div>
            <Link to="/photo/results" state={{ analysisData: photoAnalysis }}>
              <Button size="sm" variant="ghost">👁️ Подробнее</Button>
            </Link>
          </div>
        </div>

      </Card>
    );
  };

  const Header = () => (
    <div className="text-center sm:flex sm:items-center sm:justify-between mb-4">
      <h1 className="text-xl sm:text-2xl md:text-3xl font-bold mb-3 sm:mb-0">Мой план ухода</h1>
      <div className="flex flex-wrap gap-2 justify-center sm:justify-end">
        <Button variant="secondary" onClick={() => navigate("/cart")} size="sm">
          🛒 Корзина
        </Button>
        <Button variant="ghost" onClick={sendToTelegram} size="sm">
          💬 Отправить PDF
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
      
      {hasPremium ? (
        <>
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
        </>
      ) : (
        <BlurredContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">
            <div className="rounded-xl border border-neutral-200 p-3">
              <div className="text-xs text-neutral-500 mb-1">Тип кожи</div>
              <div className="text-lg font-semibold">комбинированная</div>
            </div>
            <div className="rounded-xl border border-neutral-200 p-3">
              <div className="text-xs text-neutral-500 mb-2">Чувствительность</div>
              <div className="flex items-center gap-3">
                <div className="w-full">
                  <ProgressBar value={50} />
                </div>
                <div className="text-sm font-medium w-8 text-right">5</div>
              </div>
            </div>
            <div className="rounded-xl border border-neutral-200 p-3">
              <div className="text-xs text-neutral-500 mb-2">Жирность</div>
              <div className="flex items-center gap-3">
                <div className="w-full">
                  <ProgressBar value={60} />
                </div>
                <div className="text-sm font-medium w-12 text-right">средняя</div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-xl border border-neutral-200 p-3">
              <div className="text-xs text-neutral-500 mb-1">Основная цель</div>
              <div className="font-medium">улучшить состояние</div>
            </div>
            <div className="rounded-xl border border-neutral-200 p-3">
              <div className="text-xs text-neutral-500 mb-1">Ключевые активы</div>
              <div className="text-sm text-neutral-700">
                BHA, Ниацинамид, SPF
              </div>
            </div>
          </div>
        </BlurredContent>
      )}
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

  return (
    <div className="w-full min-h-screen relative">
      {/* Background layers: PNG image */}
      <div 
        className={`fixed inset-0 -z-10 bg-cover bg-center bg-no-repeat transition-opacity duration-500 ${
          isPageLoaded ? 'opacity-100' : 'opacity-0'
        }`}
        style={{
          backgroundImage: "url('/bg/IMG_8368 (2).PNG')"
        }}
      />
      
      <div className={`relative z-20 space-y-4 p-4 pt-24 print:px-0 transition-all duration-500 ${
        isPageLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
      }`}>
        <Header />
      
      <PhotoSection />
      
      {!hasPremium && (
        <Card className="p-6 text-center mb-4">
          <div className="text-lg font-semibold mb-2">🔒 Персональные рекомендации</div>
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
        <ProductSection title="Утро" items={plan.morning} />
        <ProductSection title="Вечер" items={plan.evening} />
        
        <Card className="p-4 md:p-5">
          <div className="flex items-center justify-between">
            <div className="text-sm opacity-70">
              Быстро добавить все средства в корзину
            </div>
            {hasPremium ? (
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
            ) : (
              <BlurredContent showOverlay={false}>
                <Button>Добавить все</Button>
              </BlurredContent>
            )}
          </div>
        </Card>
        
        {hasPremium ? (
          <ScheduleSection />
        ) : (
          <Card className="p-4 md:p-5">
            <h3 className="text-xl font-semibold mb-3">Расписание 28 дней</h3>
            <BlurredContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {schedule.slice(0, 6).map(day => (
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