import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

// === SkinIQ Mobile Home — FULL PREVIEW (syntax fixed) ===
// Fix: removed stray closing parenthesis in FloatingSpheres that caused a SyntaxError.
// Also kept greeting safeguards and added more boundary tests for greeting logic.

// ---------- Types ----------
interface RoutineItem {
  id: string;
  title: string;
  subtitle: string;
  icon: string;
  howto: {
    steps: string[];
    volume: string;
    tip: string;
  };
  done: boolean;
}


// ---------- Helpers ----------
const USER_FALLBACK = "друг";
function getGreetingByHour(h: number): string {
  if (h >= 5 && h < 12) return "Доброе утро";
  if (h >= 12 && h < 18) return "Добрый день";
  return "Добрый вечер";
}
function getGreeting(date = new Date()): string {
  return getGreetingByHour(date.getHours());
}

// Tiny sanity tests (log only)
(function testGreeting() {
  try {
    console.assert(getGreetingByHour(5) === "Доброе утро", "5h should be morning");
    console.assert(getGreetingByHour(6) === "Доброе утро", "6h should be morning");
    console.assert(getGreetingByHour(11) === "Доброе утро", "11h should be morning");
    console.assert(getGreetingByHour(12) === "Добрый день", "12h should be day boundary");
    console.assert(getGreetingByHour(13) === "Добрый день", "13h should be day");
    console.assert(getGreetingByHour(17) === "Добрый день", "17h should be day");
    console.assert(getGreetingByHour(18) === "Добрый вечер", "18h should be evening boundary");
    console.assert(getGreetingByHour(21) === "Добрый вечер", "21h should be evening");
    console.assert(typeof getGreeting() === "string", "getGreeting returns string");
  } catch (e) {
    console.warn("Greeting tests: ", e);
  }
})();

// Helper for SPF recommendation based on UV index
function getSPFRecommendation(uv: number | null): string {
  if (uv === null) return "SPF 30";
  if (uv <= 2) return "SPF 15-30";
  if (uv <= 5) return "SPF 30";
  if (uv <= 7) return "SPF 30-50";
  if (uv <= 10) return "SPF 50";
  return "SPF 50+";
}

function getUVLevel(uv: number | null): string {
  if (uv === null) return "Умеренный";
  if (uv <= 2) return "Низкий";
  if (uv <= 5) return "Умеренный";
  if (uv <= 7) return "Высокий";
  if (uv <= 10) return "Очень высокий";
  return "Экстремальный";
}


// ----- Tokens -----
const glass = "bg-white/20 backdrop-blur-xl border border-white/40 shadow-[0_8px_24px_rgba(0,0,0,0.08)]";
const radiusPanel = "rounded-3xl";
const radiusCard = "rounded-2xl";

// ----- Icons (using PNG files) -----
const ICONS = {
  cleanser: "/icons/cleanser1.PNG",
  toner: "/icons/toner1.PNG",
  serum: "/icons/serum.PNG",
  cream: "/icons/cream.PNG",
  spf: "/icons/spf1.PNG",
  acid: "/icons/acid1.PNG",
};

// ----- Routine data -----
const morningDefault = [
  {
    id: "cleanser",
    title: "Очищение",
    subtitle: "La Roche-Posay Toleriane Cleanser",
    icon: ICONS.cleanser,
    howto: {
      steps: [
        "Смочите лицо тёплой водой",
        "1–2 нажатия геля в ладони",
        "Массируйте 30–40 сек",
        "Смойте, промокните полотенцем",
      ],
      volume: "Гель: 1–2 пшика",
      tip: "Если кожа сухая утром — можно умыться только водой.",
    },
    done: false,
  },
  {
    id: "toner",
    title: "Тонер",
    subtitle: "Pyunkang Yul Essence Toner",
    icon: ICONS.toner,
    howto: {
      steps: [
        "Нанесите 3–5 капель на руки",
        "Распределите похлопывающими движениями",
        "Дайте впитаться 30–60 сек",
      ],
      volume: "3–5 капель",
      tip: "Избегайте ватных дисков — тратите меньше продукта.",
    },
    done: false,
  },
  {
    id: "active",
    title: "Актив",
    subtitle: "Purito Galacto Niacin 97",
    icon: ICONS.serum,
    howto: {
      steps: [
        "1–2 пипетки на сухую кожу",
        "Наносите на T‑зону и щеки",
        "Подождите 1–2 минуты до крема",
      ],
      volume: "4–6 капель",
      tip: "Если есть раздражение — пропустите актив на день.",
    },
    done: false,
  },
  {
    id: "cream",
    title: "Крем",
    subtitle: "Uriage Roséliane Cream",
    icon: ICONS.cream,
    howto: {
      steps: ["Горох крема распределить по лицу", "Мягко втереть по массажным линиям"],
      volume: "Горошина",
      tip: "Не забывайте шею и линию подбородка.",
    },
    done: false,
  },
  {
    id: "spf",
    title: "SPF",
    subtitle: "SPF 50 PA++++",
    icon: ICONS.spf,
    howto: {
      steps: [
        "Нанести 2 пальца SPF (лицо/шея)",
        "Обновлять каждые 2–3 часа на улице",
      ],
      volume: "~1.5–2 мл",
      tip: "При UV > 3 — обязательно SPF даже в облачную погоду.",
    },
    done: false,
  },
];

const eveningDefault = [
  {
    id: "cleanser",
    title: "Очищение",
    subtitle: "Bioderma Sensibio Oil → LRP Toleriane",
    icon: ICONS.cleanser,
    howto: {
      steps: [
        "1) Масло: сухими руками распределить, эмульгировать водой",
        "2) Гель: умыть 30–40 сек, смыть",
      ],
      volume: "1–2 дозы масла + 1–2 пшика геля",
      tip: "Двойное очищение — в дни макияжа/кислот.",
    },
    done: false,
  },
  {
    id: "acid",
    title: "Кислоты (по расписанию)",
    subtitle: "Some By Mi AHA/BHA/PHА / молочный пилинг",
    icon: ICONS.acid,
    howto: {
      steps: [
        "Нанести тонким слоем на Т‑зону",
        "Выдержать 5–10 минут (по переносимости)",
        "Смыть/нейтрализовать, далее крем",
      ],
      volume: "Тонкий слой",
      tip: "При покраснении — пауза 3–5 дней.",
    },
    done: false,
  },
  {
    id: "serum",
    title: "Сыворотка",
    subtitle: "Пептидная / успокаивающая",
    icon: ICONS.serum,
    howto: {
      steps: ["3–6 капель", "Равномерно нанести, дать впитаться 1 мин"],
      volume: "3–6 капель",
      tip: "В дни кислот сыворотка — без кислот/ретинола.",
    },
    done: false,
  },
  {
    id: "cream",
    title: "Крем",
    subtitle: "LRP Lipikar AP+M или Avene Tolerance",
    icon: ICONS.cream,
    howto: {
      steps: ["Горох крема", "Распределить, не втирая сильно"],
      volume: "Горошина",
      tip: "Если сухо — добавьте каплю масла локально.",
    },
    done: false,
  },
];

// ----- Visual components -----
function ProgressRing({ value = 0, size = 180, stroke = 7 }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (value / 100) * c;
  return (
    <svg width={size} height={size} className="block" style={{overflow: 'visible'}}>
        <defs>
        <linearGradient id="grad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#D8BFD8" />
          <stop offset="50%" stopColor="#E6E6FA" />
          <stop offset="100%" stopColor="#F0E6FF" />
          </linearGradient>
        <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="8" result="coloredBlur"/>
          <feMerge> 
            <feMergeNode in="coloredBlur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
        <filter id="pulseGlow" x="-100%" y="-100%" width="300%" height="300%">
          <feGaussianBlur stdDeviation="12" result="coloredBlur"/>
          <feMerge> 
            <feMergeNode in="coloredBlur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
        </defs>
        {/* Background circle - gray */}
        <circle 
          cx={size / 2}
          cy={size / 2}
          r={r} 
          stroke="#E5E7EB"
          strokeWidth={stroke} 
          fill="none"
        />
        {/* Progress circle */}
        <circle 
        cx={size / 2}
        cy={size / 2}
          r={r} 
        stroke="url(#grad)"
        strokeLinecap="round"
          strokeWidth={stroke} 
        fill="none"
        filter={value === 100 ? "url(#pulseGlow)" : "url(#glow)"}
        style={{ 
          strokeDasharray: c, 
          strokeDashoffset: offset, 
          transition: "stroke-dashoffset 600ms cubic-bezier(0.22,1,0.36,1)",
          animation: value === 100 ? "pulseGlow 2s ease-in-out infinite" : "none",
          transformOrigin: "center"
        }}
      />
      <foreignObject x="0" y="0" width={size} height={size}>
        <div className="w-full h-full flex items-center justify-center">
          <div className="text-center">
            <div className="text-2xl font-bold text-neutral-900" style={{fontVariantNumeric: 'tabular-nums'}}>{Math.round(value)}%</div>
            <div className="text-xs text-neutral-600">выполнено</div>
          </div>
        </div>
      </foreignObject>
      </svg>
  );
}

function RoutineCard({ item, onToggle, onOpen }: { item: RoutineItem; onToggle: () => void; onOpen: () => void }) {
  return (
    <div className={`bg-white/40 backdrop-blur-xl border border-white/50 rounded-2xl h-[72px] px-3 py-2 flex items-center gap-3 select-none shadow-[0_4px_12px_rgba(0,0,0,0.04)]`}>
      <div className="w-10 h-10 rounded-2xl bg-white/80 flex items-center justify-center overflow-hidden shadow-sm">
        {item.icon ? (
          <img src={item.icon} alt="" className="w-6 h-6 object-contain" />
        ) : (
          <div className="w-6 h-6 rounded-xl bg-neutral-900/80" />
        )}
      </div>
      <button onClick={onOpen} className="flex-1 min-w-0 text-left">
        <div className="text-[15px] font-semibold text-neutral-900 truncate">{item.title}</div>
        <div className="text-[12px] text-neutral-600 truncate">{item.subtitle}</div>
        </button>
        <button
        onClick={(e) => { e.stopPropagation(); onToggle(); }}
        aria-pressed={item.done}
        className="ml-auto w-9 h-9 flex items-center justify-center"
      >
        <span
          className={`w-6 h-6 rounded-xl border flex items-center justify-center transition-all duration-120 ${item.done ? 'border-transparent bg-neutral-900 text-white scale-100' : 'border-neutral-300 bg-neutral-200 text-neutral-400 scale-95'}`}
        >
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </span>
        </button>
    </div>
  );
}


function BottomSheet({ open, onClose, item }: { open: boolean; onClose: () => void; item: RoutineItem | null }) {
  if (!open || !item) return null;
  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className={`absolute left-0 right-0 bottom-0 ${glass} ${radiusPanel} p-4 max-h-[70vh] overflow-y-auto translate-y-0 animate-[sheetUp_220ms_cubic-bezier(0.22,1,0.36,1)]`}>
        <div className="mx-auto h-1 w-10 rounded-full bg-white/60 mb-3" />
        <div className="flex items-center gap-3">
          <img src={item.icon} alt="" className="w-10 h-10 object-contain mix-blend-multiply" />
          <div>
            <div className="text-[16px] font-semibold text-neutral-900">{item.title}</div>
            <div className="text-[12px] text-neutral-600">{item.subtitle}</div>
          </div>
        </div>
        <div className="mt-3">
          <div className="text-[13px] font-semibold text-neutral-900 mb-1">Как выполнить</div>
          <ol className="list-decimal list-inside text-[14px] text-neutral-800 space-y-1">
            {item.howto?.steps?.map((s: string, i: number) => (
              <li key={i}>{s}</li>
            ))}
          </ol>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <div className={`${glass} ${radiusCard} p-3`}>
              <div className="text-[12px] text-neutral-600">Объём</div>
              <div className="text-[14px] font-medium">{item.howto?.volume}</div>
            </div>
            <div className={`${glass} ${radiusCard} p-3`}>
              <div className="text-[12px] text-neutral-600">Совет</div>
              <div className="text-[14px] font-medium">{item.howto?.tip}</div>
            </div>
          </div>
        </div>
        <div className="mt-4 flex gap-2">
          <button onClick={onClose} className={`flex-1 h-12 ${radiusCard} ${glass} text-[15px] font-semibold`}>
            Закрыть
          </button>
          <button onClick={onClose} className={`flex-1 h-12 ${radiusCard} bg-neutral-900 text-white text-[15px] font-semibold`}>
            Понятно
          </button>
        </div>
      </div>
    </div>
  );
}


export default function MobileSkinIQHome() {
  const navigate = useNavigate();
  const [tab, setTab] = useState("AM");
  const [morning, setMorning] = useState(morningDefault);
  const [evening, setEvening] = useState(eveningDefault);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetItem, setSheetItem] = useState<RoutineItem | null>(null);
  const [backgroundLoaded, setBackgroundLoaded] = useState(false);

  // Greeting state
  const [userName, setUserName] = useState(USER_FALLBACK);
  const [greeting, setGreeting] = useState(getGreeting());
  useEffect(() => {
    setGreeting(getGreeting());
    const tg = (window as any)?.Telegram?.WebApp;
    const name =
      tg?.initDataUnsafe?.user?.first_name || tg?.initDataUnsafe?.user?.username || USER_FALLBACK;
    setUserName(name);
  }, []);

  // Load background image
  useEffect(() => {
    const img = new Image();
    img.onload = () => setBackgroundLoaded(true);
    img.src = "/bg/IMG_8368 (2).PNG";
  }, []);

  // UV Index state
  const [uvIndex, setUvIndex] = useState<number | null>(null);
  const [uvLoading, setUvLoading] = useState(true);

  // Fetch UV Index based on user location
  useEffect(() => {
    const fetchUVIndex = async () => {
      try {
        // Get user location
        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject);
        });

        const { latitude, longitude } = position.coords;

        // Fetch UV index from Open-Meteo API
        const response = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&daily=uv_index_max&timezone=auto&forecast_days=1`
        );
        
        const data = await response.json();
        const uvValue = data.daily?.uv_index_max?.[0];
        
        if (uvValue !== undefined) {
          setUvIndex(Math.round(uvValue));
        }
      } catch (error) {
        console.error('Error fetching UV index:', error);
        // Fallback to default value
        setUvIndex(3);
      } finally {
        setUvLoading(false);
      }
    };

    fetchUVIndex();
  }, []);

  const items = tab === "AM" ? morning : evening;
  const completed = items.filter((i) => i.done).length;
  const progress = items.length ? (completed / items.length) * 100 : 0;


  const toggleAt = (idx: number) => () => {
    if (tab === "AM") {
      const copy = [...morning];
      copy[idx] = { ...copy[idx], done: !copy[idx].done };
      setMorning(copy);
      } else {
      const copy = [...evening];
      copy[idx] = { ...copy[idx], done: !copy[idx].done };
      setEvening(copy);
    }
  };
  const openHowTo = (idx: number) => () => {
    setSheetItem(items[idx]);
    setSheetOpen(true);
  };


  // Background now uses image instead of CSS gradient
  // const bg = useMemo(
  //   () => ({
  //     background:
  //       "radial-gradient(120% 140% at 70% 0%, #ffe7ef 0%, #f3e6cf 35%, #efeef2 65%, #e7e7ea 100%)",
  //   }),
  //   []
  // );

  return (
    <div className="w-full min-h-screen relative overflow-x-hidden">
      {/* Background layers: PNG image with floating spheres */}
      <div 
        className={`fixed inset-0 -z-10 bg-cover bg-center bg-no-repeat transition-opacity duration-1000 ${
          backgroundLoaded ? 'opacity-100' : 'opacity-0'
        }`}
        style={{
          backgroundImage: "url('/bg/IMG_8368 (2).PNG')"
        }}
      />
      
      {/* Premium shimmer loading effect */}
      {!backgroundLoaded && (
        <div className="fixed inset-0 -z-10 bg-gradient-to-br from-gray-100 via-gray-50 to-gray-100 shimmer-wrapper">
        </div>
      )}
      
      <style>{`
        @keyframes sheetUp { from { transform: translateY(12px); opacity: .5; } to { transform: translateY(0); opacity: 1; } }
        @keyframes pulseGlow { 
          0%, 100% { 
            filter: url(#glow);
            transform: scale(1);
            opacity: 1;
          } 
          50% { 
            filter: url(#pulseGlow);
            transform: scale(1.05);
            opacity: 0.8;
          } 
        }
      `}</style>

      {/* Header */}
      <div className="absolute top-4 left-4 z-20">
        <img 
          src="/skiniq-logo.png" 
          alt="SkinIQ" 
          className="h-32 w-auto object-contain"
        />
      </div>

      {/* Greeting Widget */}
      <div className="mx-4 mt-32 mb-2">
        <div className="bg-white/20 backdrop-blur-xl border border-white/40 shadow-[0_8px_24px_rgba(0,0,0,0.08)] rounded-3xl p-4 flex items-center gap-4">
          {/* Icon circle with sun/moon */}
          <div className="w-14 h-14 rounded-full bg-neutral-900 flex items-center justify-center flex-shrink-0 shadow-lg">
            {(() => {
              const hour = new Date().getHours();
              if (hour >= 5 && hour < 18) {
                // Morning & Day - sun icon
                return (
                  <img src="/icons/icon_morning.PNG" alt="Day" className="w-10 h-10 object-contain" />
                );
              } else {
                // Evening - moon
                return (
                  <svg className="w-10 h-10 text-blue-300" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
                  </svg>
                );
              }
            })()}
          </div>
          
          {/* Greeting text */}
          <div className="flex-1">
            <div className="text-[20px] font-semibold text-neutral-800 leading-tight">
              {greeting},<br/>{userName}!
            </div>
          </div>
        </div>
      </div>

      {/* Main Panel */}
      <section className={`bg-white/20 backdrop-blur-xl border border-white/40 shadow-[0_8px_24px_rgba(0,0,0,0.08)] ${radiusPanel} relative z-20 mx-4 p-4 overflow-visible`}>
        <h3 className="text-[18px] font-semibold text-neutral-900">Уход сегодня</h3>
        <p className="text-[12px] text-neutral-600 mt-0.5">
          {progress === 0
            ? "Начните с первого шага"
            : progress === 100
            ? "Все шаги выполнены"
            : "Завершите шаги рутины"}
        </p>

        {/* Tabs AM/PM */}
        <div className={`mt-3 ${radiusCard} p-1 ${glass} grid grid-cols-2 h-12`}>
          {["AM", "PM"].map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`relative ${radiusCard} text-[14px] font-medium transition-all duration-200 overflow-hidden` +
                (tab === t
                  ? " bg-white/50 text-neutral-900 shadow-inner border border-white/60"
                  : " text-neutral-700 hover:text-neutral-900")}
            >
              {t === "AM" ? "Утро" : "Вечер"}
            </button>
          ))}
        </div>

        {/* Routine list */}
        <div className="relative mt-3 overflow-visible">
          {/* Scroll indicator for routine cards */}
          <div className="absolute top-0 right-0 z-10 flex flex-col items-center gap-1 opacity-60">
            <div className="w-1 h-1 bg-neutral-400 rounded-full animate-bounce"></div>
            <div className="w-1 h-1 bg-neutral-400 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
            <div className="w-1 h-1 bg-neutral-400 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
            <svg className="w-3 h-3 text-neutral-400 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
            </svg>
          </div>
          
          <div className="space-y-3 max-h-[288px] overflow-y-auto pr-6 scrollbar-hide" style={{overflowX: 'visible'}}>
            {items.map((it, idx) => (
              <RoutineCard
                key={it.id}
                item={it}
                onToggle={toggleAt(idx)}
                onOpen={openHowTo(idx)}
              />
            ))}
          </div>
          </div>
          
        {/* Progress + CTA */}
        <div className="mt-3 flex flex-col items-center relative">
          <div className="w-full flex justify-center py-8 px-12" style={{overflow: 'visible'}}>
            <ProgressRing value={progress} />
          </div>
          <div className="text-[13px] text-neutral-600 -mt-2 tabular-nums">
            Выполнено {completed} из {items.length}
          </div>
          <button
            onClick={() => navigate("/plan")}
            className="glossy-black-card mt-2 w-full h-12 text-white text-[15px] font-semibold flex items-center justify-center relative group hover:shadow-2xl transition-all duration-300"
          >
            {/* Decorative spheres */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-30">
              <div className="absolute right-4 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/20 blur-sm"></div>
              <div className="absolute right-12 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-white/10 blur-sm"></div>
            </div>
            
            <span className="relative inline-block text-white z-10">
              {progress === 0
                ? "Перейти к подробному плану"
                : progress === 100
                ? "Открыть подробный план"
                : "Открыть подробный план"}
            </span>
          </button>
          <button 
            onClick={() => navigate("/quiz")}
            className="mt-1.5 text-[14px] text-neutral-800 underline/20 hover:text-neutral-600 transition-colors"
          >
            Перепройти анкету
          </button>
        </div>
      </section>

      {/* Widgets carousel */}
      <section className="mt-4 pb-12 ml-4">
        <div className="relative" id="widgets-container">
          
          <div 
            className="flex gap-3 overflow-x-auto overflow-y-hidden pr-8 snap-x snap-mandatory scrollbar-hide"
            style={{touchAction: 'pan-x', overscrollBehavior: 'contain'}}
          >
            <article className="snap-start shrink-0 w-[280px] h-[140px] mx-0 glossy-black-card p-4 flex items-center justify-between">
              {/* Decorative wave visual */}
              <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <svg className="absolute -right-4 top-0 w-full h-full" viewBox="0 0 280 140" fill="none" preserveAspectRatio="xMaxYMid slice">
                  <defs>
                    <linearGradient id="waveGradient1" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="rgba(255,255,255,0.08)" />
                      <stop offset="50%" stopColor="rgba(255,255,255,0.12)" />
                      <stop offset="100%" stopColor="rgba(255,255,255,0.04)" />
                    </linearGradient>
                    <linearGradient id="waveGradient2" x1="100%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor="rgba(255,255,255,0.05)" />
                      <stop offset="100%" stopColor="rgba(255,255,255,0.15)" />
                    </linearGradient>
                  </defs>
                  
                  {/* Flowing waves */}
                  <path d="M280,20 Q240,10 200,25 T120,35 T40,45 L40,140 L280,140 Z" 
                        fill="url(#waveGradient1)" opacity="0.6"/>
                  <path d="M280,50 Q230,35 180,55 T80,75 L80,140 L280,140 Z" 
                        fill="url(#waveGradient2)" opacity="0.4"/>
                  <path d="M280,80 Q220,65 160,85 T40,105 L40,140 L280,140 Z" 
                        fill="rgba(255,255,255,0.06)" opacity="0.5"/>
                </svg>
              </div>
              
              <div className="flex items-start gap-3 w-full relative z-10">
                <div className="flex-1 text-left">
                  <div className="text-[10px] text-white/60 mb-1 font-medium tracking-wide uppercase">Ежедневный совет</div>
                  <div className="text-[14px] font-bold mb-1 text-white leading-tight">Усильте увлажнение</div>
                  <div className="text-[11px] text-white/80 leading-relaxed">
                    В холодное время кожа нуждается в дополнительном увлажнении. Используйте гиалуроновую кислоту утром и плотный крем вечером.
                  </div>
                </div>
              </div>
            </article>
            <WidgetCard title="Гидрация">
              <div className="flex items-start gap-4 h-full -mt-2">
                <div className="relative w-20 h-20 flex items-center justify-center flex-shrink-0">
                  <img src="/icons/hydration.PNG" alt="Hydration" className="w-full h-full object-contain" />
                </div>
                <div className="flex flex-col justify-center flex-1">
                  <div className="text-[12px] text-neutral-600 mb-1">Уровень</div>
                  <div className="text-[15px] font-semibold text-neutral-900">Оптимально</div>
                </div>
              </div>
            </WidgetCard>
            <WidgetCard title="UV-индекс">
              <div className="flex items-center gap-4 h-full">
                {uvLoading ? (
                  <div className="text-sm text-neutral-500">Загрузка...</div>
                ) : (
                  <>
                    <div className="text-[56px] font-bold tabular-nums text-neutral-900 leading-none flex-shrink-0">{uvIndex ?? "—"}</div>
                    <div className="flex flex-col justify-center flex-1">
                      <div className="text-[11px] text-neutral-500 mb-1 font-medium">{getUVLevel(uvIndex)}</div>
                      <div className="text-[13px] text-neutral-600 leading-tight">Сегодня: {getSPFRecommendation(uvIndex)}</div>
                    </div>
                  </>
                )}
              </div>
            </WidgetCard>
          </div>
        </div>
      </section>

      {/* Bottom Sheet */}
      <BottomSheet open={sheetOpen} onClose={() => setSheetOpen(false)} item={sheetItem} />
            </div>
  );
}

function WidgetCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <article className={`snap-start shrink-0 w-[280px] h-[140px] mx-0 bg-white/40 backdrop-blur-xl border border-white/50 rounded-3xl p-4 flex flex-col shadow-[0_4px_12px_rgba(0,0,0,0.06)]`}>
      <div className="text-[13px] text-neutral-600 mb-3">{title}</div>
      <div className="text-neutral-900 flex-1">{children}</div>
    </article>
  );
}
