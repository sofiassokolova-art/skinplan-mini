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
function ProgressRing({ completed = 0, total = 5, size = 110, stroke = 8 }: { completed?: number; total?: number; size?: number; stroke?: number }) {
  const value = total > 0 ? (completed / total) * 100 : 0;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (value / 100) * c;
  
  return (
    <div className="flex flex-col items-center gap-3">
      <svg width={size} height={size} className="block" style={{overflow: 'visible'}}>
        {/* Background circle - light gray */}
        <circle 
          cx={size / 2}
          cy={size / 2}
          r={r} 
          stroke="#E5E5E5"
          strokeWidth={stroke} 
          fill="none"
        />
        {/* Progress circle - #0A5F59 */}
        <circle 
          cx={size / 2}
          cy={size / 2}
          r={r} 
          stroke="#0A5F59"
          strokeLinecap="round"
          strokeWidth={stroke} 
          fill="none"
          style={{ 
            strokeDasharray: c, 
            strokeDashoffset: offset, 
            transition: "stroke-dashoffset 800ms cubic-bezier(0.22,1,0.36,1)",
            transformOrigin: "center"
          }}
        />
        <foreignObject x="0" y="0" width={size} height={size}>
          <div className="w-full h-full flex items-center justify-center">
            <div className="text-center">
              <div 
                className="text-[32px] font-bold tabular-nums leading-none"
                style={{ color: '#1F2A44' }}
              >
                {completed} из {total}
              </div>
            </div>
          </div>
        </foreignObject>
      </svg>
      {/* Dynamic text below progress */}
      <div 
        className="text-[14px] font-medium text-center min-h-[20px]"
        style={{ color: '#475467' }}
      >
        {completed === 0 && "Начните утренний уход"}
        {completed > 0 && completed < total && `Осталось ${total - completed} ${getRemainingStepsText(total - completed)}`}
        {completed === total && "Уход завершён"}
      </div>
    </div>
  );
}

function getRemainingStepsText(count: number): string {
  if (count === 1) return "шаг";
  if (count >= 2 && count <= 4) return "шага";
  return "шагов";
}

function RoutineCard({ item, index, onToggle, onOpen }: { item: RoutineItem; index: number; onToggle: () => void; onOpen: () => void }) {
  const isCompleted = item.done;
  
  return (
    <div 
      className="backdrop-blur-[16px] border rounded-2xl h-[80px] px-4 py-3 flex items-center gap-4 select-none shadow-[0_8px_32px_rgba(0,0,0,0.12)] transition-all duration-300 animate-card-appear"
      style={{ 
        animationDelay: `${index * 50}ms`,
        backgroundColor: isCompleted ? 'rgba(10, 95, 89, 0.2)' : 'rgba(255, 255, 255, 0.5)',
        borderColor: 'rgba(255, 255, 255, 0.3)'
      }}
    >
      {/* Circle with number or checkmark */}
      <div 
        className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
        style={{ 
          backgroundColor: isCompleted ? '#0A5F59' : 'transparent',
          border: isCompleted ? 'none' : '2px solid #0A5F59'
        }}
      >
        {isCompleted ? (
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        ) : (
          <span 
            className="text-base font-semibold"
            style={{ color: '#0A5F59' }}
          >
            {index + 1}
          </span>
        )}
      </div>
      
      {/* Icon - 48x48dp */}
      <div className="w-12 h-12 flex items-center justify-center flex-shrink-0">
        {item.icon ? (
          <div className="w-12 h-12 rounded-xl flex items-center justify-center">
            <img src={item.icon} alt="" className="w-10 h-10 object-contain" />
          </div>
        ) : (
          <div className="w-12 h-12 rounded-xl bg-gray-200" />
        )}
      </div>
      
      {/* Content */}
      <button onClick={onOpen} className="flex-1 min-w-0 text-left">
        <div 
          className={`text-[15px] font-semibold truncate transition-all ${isCompleted ? 'line-through' : ''}`}
          style={{ color: isCompleted ? '#64748B' : '#1F2A44' }}
        >
          {item.title}
        </div>
        <div 
          className={`text-[12px] truncate ${isCompleted ? 'line-through' : ''}`}
          style={{ color: isCompleted ? '#94A3B8' : '#475467' }}
        >
          {item.subtitle}
        </div>
      </button>
      
      {/* Toggle button */}
      <button
        onClick={(e) => { e.stopPropagation(); onToggle(); }}
        aria-pressed={isCompleted}
        className="ml-auto w-10 h-10 flex items-center justify-center flex-shrink-0"
      >
        <div 
          className="w-7 h-7 rounded-full flex items-center justify-center transition-all duration-200"
          style={{ 
            backgroundColor: isCompleted ? '#0A5F59' : 'transparent',
            border: isCompleted ? 'none' : '2px solid #0A5F59'
          }}
        >
          {isCompleted ? (
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          ) : null}
        </div>
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
          {item.icon ? (
            <div className="w-10 h-10 rounded-2xl bg-white flex items-center justify-center shadow-[0_6px_18px_rgba(0,0,0,0.08)]">
              <img src={item.icon} alt="" className="w-6 h-6 object-contain" />
            </div>
          ) : (
            <div className="w-10 h-10 rounded-2xl bg-white shadow-[0_6px_18px_rgba(0,0,0,0.06)]" />
          )}
          <div>
            <div className="text-[16px] font-semibold text-gray-900">{item.title}</div>
            <div className="text-[12px] text-gray-600">{item.subtitle}</div>
          </div>
        </div>
        <div className="mt-3">
          <div className="text-[13px] font-semibold text-gray-900 mb-1">Как выполнить</div>
          <ol className="list-decimal list-inside text-[14px] text-neutral-800 space-y-1">
            {item.howto?.steps?.map((s: string, i: number) => (
              <li key={i}>{s}</li>
            ))}
          </ol>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <div className={`${glass} ${radiusCard} p-3`}>
              <div className="text-[12px] text-gray-600">Объём</div>
              <div className="text-[14px] font-medium">{item.howto?.volume}</div>
            </div>
            <div className={`${glass} ${radiusCard} p-3`}>
              <div className="text-[12px] text-gray-600">Совет</div>
              <div className="text-[14px] font-medium">{item.howto?.tip}</div>
            </div>
          </div>
        </div>
        <div className="mt-4 flex gap-2">
          <button onClick={onClose} className={`flex-1 h-12 ${radiusCard} ${glass} text-[15px] font-semibold`}>
            Закрыть
          </button>
          <button onClick={onClose} className={`flex-1 h-12 ${radiusCard} bg-gradient-to-r from-gray-600 to-gray-700 text-white text-[15px] font-semibold`}>
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
  const [fadeKey, setFadeKey] = useState(0); // For fade-in animation when switching tabs
  const [isLoading, setIsLoading] = useState(true); // Skeleton loading state

  // Greeting state
  const [userName, setUserName] = useState(USER_FALLBACK);
  const [greeting, setGreeting] = useState(getGreeting());
  useEffect(() => {
    setGreeting(getGreeting());
    const tg = (window as any)?.Telegram?.WebApp;
    const name =
      tg?.initDataUnsafe?.user?.first_name || tg?.initDataUnsafe?.user?.username || USER_FALLBACK;
    setUserName(name);
    
    // Simulate loading time for skeleton
    const timer = setTimeout(() => setIsLoading(false), 300);
    return () => clearTimeout(timer);
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
  
  const handleTabChange = (newTab: string) => {
    setTab(newTab);
    setFadeKey(prev => prev + 1); // Trigger fade-in animation
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
    <div
      className="w-full min-h-screen relative overflow-x-hidden pb-16 sm:pb-20"
      style={{ paddingBottom: `calc(env(safe-area-inset-bottom, 0px) + 72px)` }}
    >
      {/* Background - light gradient */}
      <div 
        className="fixed inset-0 -z-10"
        style={{
          background: 'linear-gradient(180deg, #F8FFFD 0%, #F0FDFA 100%)'
        }}
      />
      
      <style>{`
        @keyframes sheetUp { from { transform: translateY(12px); opacity: .5; } to { transform: translateY(0); opacity: 1; } }
        .home-gradient-animation {
          background: linear-gradient(130deg, #d9dbe6 0%, #e9ebf2 40%, #ffffff 70%, #e2e5ed 100%);
          background-size: 300% 300%;
          animation: gradientMotion 18s ease-in-out infinite;
        }
        @keyframes gradientMotion {
          0% { background-position: 0% 0%; }
          25% { background-position: 50% 50%; }
          50% { background-position: 100% 100%; }
          75% { background-position: 50% 50%; }
          100% { background-position: 0% 0%; }
        }
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
        @keyframes fade-in {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .fade-in-routine {
          animation: fade-in 0.3s ease-out;
        }
        @keyframes skeleton-loading {
          0% {
            background-position: -200px 0;
          }
          100% {
            background-position: calc(200px + 100%) 0;
          }
        }
        .skeleton {
          background: linear-gradient(90deg, rgba(255,255,255,0.1) 0px, rgba(255,255,255,0.3) 40px, rgba(255,255,255,0.1) 80px);
          background-size: 200px 100%;
          animation: skeleton-loading 1.5s ease-in-out infinite;
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

      {/* Greeting + Progress Panel - glassmorphism */}
      <div className="mx-4 mt-24 mb-6">
        <div 
          className="backdrop-blur-[20px] border rounded-3xl p-6 shadow-[0_8px_32px_rgba(0,0,0,0.12)]"
          style={{
            backgroundColor: 'rgba(255, 255, 255, 0.5)',
            borderColor: 'rgba(255, 255, 255, 0.3)'
          }}
        >
          {/* Greeting */}
          <div className="flex items-center gap-4 mb-6">
            <div 
              className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: '#0A5F59' }}
            >
              {(() => {
                const hour = new Date().getHours();
                if (hour >= 5 && hour < 18) {
                  return (
                    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="white" strokeWidth="2" className="w-6 h-6">
                      <circle cx="12" cy="12" r="4" />
                      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
                    </svg>
                  );
                } else {
                  return (
                    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="white" strokeWidth="2" className="w-6 h-6">
                      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                    </svg>
                  );
                }
              })()}
            </div>
            <div 
              className="text-[24px] sm:text-[26px] font-bold leading-tight"
              style={{ color: '#0A5F59' }}
            >
              {greeting}, {userName}
            </div>
          </div>
          
          {/* Progress Ring */}
          <div className="mt-6">
            <ProgressRing completed={completed} total={items.length} size={110} stroke={8} />
          </div>
        </div>
      </div>

      {/* Main Panel */}
      <section className="relative z-20 mx-4 overflow-visible">
        {/* SegmentedButton AM/PM - glassmorphism */}
        <div 
          className="mb-4 rounded-2xl p-1 grid grid-cols-2 h-12 backdrop-blur-[16px] border shadow-[0_8px_32px_rgba(0,0,0,0.12)]"
          style={{
            backgroundColor: 'rgba(255, 255, 255, 0.5)',
            borderColor: 'rgba(255, 255, 255, 0.3)'
          }}
        >
          {["AM", "PM"].map((t) => (
            <button
              key={t}
              onClick={() => handleTabChange(t)}
              className={`relative rounded-xl text-[14px] font-medium transition-all duration-300 overflow-hidden ${
                tab === t
                  ? " bg-white font-bold shadow-sm"
                  : " bg-transparent"
              }`}
              style={tab === t ? {} : { color: '#64748B' }}
            >
              {t === "AM" ? "Утро" : "Вечер"}
            </button>
          ))}
        </div>

        {/* Routine list with fade-in animation */}
        {isLoading ? (
          <div className="mb-8 space-y-3 pb-6">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="skeleton bg-white/40 backdrop-blur-xl border border-white/50 rounded-2xl h-[80px] px-4 py-3 flex items-center gap-4">
                <div className="w-6 h-6 skeleton rounded" />
                <div className="w-12 h-12 skeleton rounded-xl" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 skeleton rounded w-3/4" />
                  <div className="h-3 skeleton rounded w-1/2" />
                </div>
                <div className="w-10 h-10 skeleton rounded-full" />
              </div>
            ))}
          </div>
        ) : (
          <div className="mb-8 fade-in-routine" key={fadeKey}>
            <div className="space-y-3 pb-6">
              {items.map((it, idx) => (
                <RoutineCard
                  key={it.id}
                  item={it}
                  index={idx}
                  onToggle={toggleAt(idx)}
                  onOpen={openHowTo(idx)}
                />
              ))}
            </div>
          </div>
        )}
          
        {/* CTA - text link only */}
        <div className="mt-6 pt-4">
          <button 
            onClick={() => navigate("/plan")}
            className="text-[14px] font-medium transition-colors w-full text-center"
            style={{ color: '#0A5F59' }}
          >
            Подробный план
          </button>
        </div>
      </section>

      {/* Widgets carousel */}
      <section className="mt-4 pb-12 px-4">
        <div className="relative overflow-visible" id="widgets-container">
          
          <div 
            className="flex gap-3 overflow-x-auto pr-8 py-1 snap-x snap-mandatory scrollbar-hide"
            style={{touchAction: 'pan-x', overscrollBehavior: 'contain'}}
          >
            {/* Daily Advice Card - glassmorphism expert style */}
            <article 
              className="snap-start shrink-0 w-[280px] h-[180px] mx-0 backdrop-blur-[16px] border rounded-3xl p-5 flex flex-col shadow-[0_8px_32px_rgba(0,0,0,0.12)] animate-card-appear"
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.5)',
                borderColor: 'rgba(255, 255, 255, 0.3)'
              }}
            >
              <div className="flex items-start gap-4 mb-3">
                {/* Icon 64x64dp in #0A5F59 */}
                <div 
                  className="w-16 h-16 rounded-2xl flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: 'rgba(10, 95, 89, 0.1)' }}
                >
                  <svg 
                    className="w-10 h-10" 
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                    style={{ color: '#0A5F59' }}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                </div>
                
                <div className="flex-1 min-w-0">
                  <div 
                    className="text-[11px] mb-1 font-bold tracking-wide uppercase"
                    style={{ color: '#0A5F59' }}
                  >
                    Совет косметолога
                  </div>
                  <div 
                    className="text-[15px] font-bold mb-2 leading-tight"
                    style={{ color: '#1F2A44' }}
                  >
                    Усильте увлажнение
                  </div>
                  <div 
                    className="text-[12px] leading-relaxed"
                    style={{ color: '#475467' }}
                  >
                    В холодное время кожа нуждается в дополнительном увлажнении. Используйте гиалуроновую кислоту утром и плотный крем вечером.
                  </div>
                </div>
              </div>
              
              {/* "More advice" button */}
              <button 
                className="mt-auto text-[13px] font-semibold transition-colors text-left hover:opacity-70"
                style={{ color: '#0A5F59' }}
              >
                Ещё советы →
              </button>
            </article>
            <WidgetCard title="Гидрация">
              <div className="flex items-start gap-4 h-full -mt-2">
                <div className="relative w-20 h-20 flex items-center justify-center flex-shrink-0">
                  <img src="/icons/hydration.PNG" alt="Hydration" className="w-full h-full object-contain" />
                </div>
                <div className="flex flex-col justify-center flex-1">
                  <div className="text-[12px] text-gray-600 mb-1">Уровень</div>
                  <div className="text-[15px] font-semibold text-gray-900">Оптимально</div>
                </div>
              </div>
            </WidgetCard>
            <WidgetCard title="UV-индекс">
              <div className="flex items-center gap-4 h-full">
                {uvLoading ? (
                  <div className="text-sm text-neutral-500">Загрузка...</div>
                ) : (
                  <>
                    <div className="text-[56px] font-bold tabular-nums text-gray-900 leading-none flex-shrink-0">{uvIndex ?? "—"}</div>
                    <div className="flex flex-col justify-center flex-1">
                      <div className="text-[11px] text-neutral-500 mb-1 font-medium">{getUVLevel(uvIndex)}</div>
                      <div className="text-[13px] text-gray-600 leading-tight">Сегодня: {getSPFRecommendation(uvIndex)}</div>
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
      
      {/* AI + экспертиза подпись */}
      <div 
        className="fixed bottom-4 left-1/2 transform -translate-x-1/2 z-10"
        style={{ color: '#94A3B8', fontSize: '12px' }}
      >
        AI + экспертиза косметолога
      </div>
    </div>
  );
}


function WidgetCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <article 
      className="snap-start shrink-0 w-[280px] h-[140px] mx-0 backdrop-blur-[16px] border rounded-3xl p-4 flex flex-col shadow-[0_8px_32px_rgba(0,0,0,0.12)]"
      style={{
        backgroundColor: 'rgba(255, 255, 255, 0.5)',
        borderColor: 'rgba(255, 255, 255, 0.3)'
      }}
    >
      <div 
        className="text-[13px] mb-3"
        style={{ color: '#475467' }}
      >
        {title}
      </div>
      <div 
        className="flex-1"
        style={{ color: '#1F2A44' }}
      >
        {children}
      </div>
    </article>
  );
}
