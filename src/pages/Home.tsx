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
function ProgressRing({ completed = 0, total = 5, size = 120, stroke = 8 }: { completed?: number; total?: number; size?: number; stroke?: number }) {
  const value = total > 0 ? (completed / total) * 100 : 0;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (value / 100) * c;
  
  return (
    <div className="flex flex-col items-center gap-4">
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
      {/* Dynamic text below progress - 18sp */}
      <div 
        className="text-[18px] font-medium text-center min-h-[24px]"
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
      className="backdrop-blur-[16px] border h-[84px] px-5 flex items-center gap-4 select-none transition-all duration-300 animate-card-appear"
      style={{ 
        animationDelay: `${index * 50}ms`,
        backgroundColor: isCompleted ? 'rgba(10, 95, 89, 0.15)' : 'rgba(255, 255, 255, 0.5)',
        borderColor: 'rgba(255, 255, 255, 0.3)',
        borderTopWidth: index === 0 ? '1px' : '0px',
        borderBottomWidth: '1px',
        borderLeftWidth: '0px',
        borderRightWidth: '0px'
      }}
    >
      {/* Circle with number or checkmark - 48dp */}
      <div 
        className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0"
        style={{ 
          backgroundColor: isCompleted ? '#0A5F59' : 'transparent',
          border: isCompleted ? 'none' : '2px solid #0A5F59'
        }}
      >
        {isCompleted ? (
          <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        ) : (
          <span 
            className="text-lg font-semibold"
            style={{ color: '#0A5F59' }}
          >
            {index + 1}
          </span>
        )}
      </div>
      
      {/* Icon - 48x48dp with white background */}
      <div className="w-12 h-12 flex items-center justify-center flex-shrink-0 rounded-xl bg-white shadow-sm">
        {item.icon ? (
          <img src={item.icon} alt="" className="w-10 h-10 object-contain" />
        ) : (
          <div className="w-10 h-10 bg-gray-200 rounded-lg" />
        )}
      </div>
      
      {/* Content */}
      <button onClick={onOpen} className="flex-1 min-w-0 text-left">
        <div 
          className={`text-[18px] font-bold truncate transition-all ${isCompleted ? 'line-through' : ''}`}
          style={{ color: isCompleted ? '#64748B' : '#1F2A44' }}
        >
          {item.title}
        </div>
        <div 
          className={`text-[15px] truncate mt-0.5 ${isCompleted ? 'line-through' : ''}`}
          style={{ color: isCompleted ? '#94A3B8' : '#475467' }}
        >
          {item.subtitle}
        </div>
      </button>
      
      {/* Toggle button - right */}
      <button
        onClick={(e) => { e.stopPropagation(); onToggle(); }}
        aria-pressed={isCompleted}
        className="ml-auto w-10 h-10 flex items-center justify-center flex-shrink-0"
      >
        {isCompleted ? (
          <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="#0A5F59" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        ) : (
          <div 
            className="w-6 h-6 rounded-full border-2 transition-all duration-200"
            style={{ borderColor: '#0A5F59' }}
          />
        )}
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

      {/* Greeting + Progress Panel - single glass card */}
      <div className="mx-4 mt-20 mb-5">
        <div 
          className="backdrop-blur-[20px] border rounded-[28px] p-5"
          style={{
            backgroundColor: 'rgba(255, 255, 255, 0.55)',
            borderColor: 'rgba(255, 255, 255, 0.3)'
          }}
        >
          {/* Top row: Avatar + Greeting */}
          <div className="flex items-center gap-4 mb-5">
            {/* Avatar */}
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
            
            {/* Greeting text */}
            <div 
              className="text-[24px] sm:text-[26px] font-bold leading-tight"
              style={{ color: '#0A5F59' }}
            >
              {greeting}, {userName}
            </div>
          </div>
          
          {/* Progress Ring - centered */}
          <div className="flex justify-center">
            <ProgressRing completed={completed} total={items.length} size={120} stroke={8} />
          </div>
        </div>
      </div>

      {/* Main Panel */}
      <section className="relative z-20 mx-4 overflow-visible">
        {/* SegmentedButton AM/PM - glass-segmented */}
        <div 
          className="mb-5 rounded-2xl p-1 grid grid-cols-2 h-12 backdrop-blur-[16px] border"
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
                  ? " font-bold"
                  : " bg-transparent"
              }`}
              style={tab === t 
                ? { backgroundColor: '#0A5F59', color: 'white' }
                : { color: '#64748B' }
              }
            >
              {t === "AM" ? "Утро" : "Вечер"}
            </button>
          ))}
        </div>

        {/* Routine list - glass rows container */}
        <div 
          className="mb-5 backdrop-blur-[16px] border rounded-2xl overflow-hidden fade-in-routine"
          style={{
            backgroundColor: 'rgba(255, 255, 255, 0.5)',
            borderColor: 'rgba(255, 255, 255, 0.3)'
          }}
          key={fadeKey}
        >
          {isLoading ? (
            <div className="py-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="skeleton h-[84px] px-5 flex items-center gap-4 border-b border-white/20 last:border-b-0">
                  <div className="w-12 h-12 skeleton rounded-full" />
                  <div className="w-12 h-12 skeleton rounded-lg" />
                  <div className="flex-1 space-y-2">
                    <div className="h-5 skeleton rounded w-3/4" />
                    <div className="h-4 skeleton rounded w-1/2" />
                  </div>
                  <div className="w-6 h-6 skeleton rounded-full" />
                </div>
              ))}
            </div>
          ) : (
            <div className="py-0">
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
          )}
        </div>

        {/* Completion buttons - показать кнопки всегда, но filled только при завершении */}
        <div className="mb-8 mt-6">
          {completed === items.length && items.length > 0 ? (
            /* Все выполнено - показываем обе кнопки */
            <div className="animate-onboarding-fade-in" style={{ animationDelay: '300ms' }}>
              {/* Вариант А: две кнопки в ряд (большие экраны) */}
              <div className="hidden sm:flex gap-3 w-full">
                {/* Outlined кнопка - Перепройти анкету */}
                <button
                  onClick={() => navigate("/quiz")}
                  className="flex-1 h-14 rounded-2xl font-medium text-[16px] transition-all duration-200 hover:opacity-80 active:scale-[0.98] backdrop-blur-[16px] border-2"
                  style={{
                    backgroundColor: 'rgba(255, 255, 255, 0.3)',
                    borderColor: '#0A5F59',
                    color: '#0A5F59'
                  }}
                >
                  Перепройти анкету
                </button>
                
                {/* Filled кнопка - Подробный план */}
                <button
                  onClick={() => navigate("/plan")}
                  className="flex-1 h-14 rounded-2xl font-medium text-[16px] text-white transition-all duration-200 hover:opacity-90 active:scale-[0.98]"
                  style={{
                    backgroundColor: '#0A5F59'
                  }}
                >
                  Подробный план →
                </button>
              </div>

              {/* Вариант Б: одна под другой (маленькие экраны) */}
              <div className="flex flex-col gap-3 sm:hidden w-full">
                {/* Filled кнопка - Подробный план (первая) */}
                <button
                  onClick={() => navigate("/plan")}
                  className="w-full h-14 rounded-2xl font-medium text-[16px] text-white transition-all duration-200 hover:opacity-90 active:scale-[0.98]"
                  style={{
                    backgroundColor: '#0A5F59'
                  }}
                >
                  Подробный план →
                </button>
                
                {/* Outlined кнопка - Перепройти анкету (вторая) */}
                <button
                  onClick={() => navigate("/quiz")}
                  className="w-full h-14 rounded-2xl font-medium text-[16px] transition-all duration-200 hover:opacity-80 active:scale-[0.98] backdrop-blur-[16px] border-2"
                  style={{
                    backgroundColor: 'rgba(255, 255, 255, 0.3)',
                    borderColor: '#0A5F59',
                    color: '#0A5F59'
                  }}
                >
                  Перепройти анкету
                </button>
              </div>
            </div>
          ) : (
            /* Не все выполнено - показываем только кнопку "Перепройти анкету" */
            <button
              onClick={() => navigate("/quiz")}
              className="w-full h-14 rounded-2xl font-medium text-[16px] transition-all duration-200 hover:opacity-80 active:scale-[0.98] backdrop-blur-[16px] border-2"
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.3)',
                borderColor: '#0A5F59',
                color: '#0A5F59'
              }}
            >
              Перепройти анкету
            </button>
          )}
        </div>

        {/* Widgets carousel - горизонтальный скролл */}
        <div className="mt-4 mb-20">
          <div className="relative overflow-visible px-4" id="widgets-container">
            <div 
              className="flex gap-4 overflow-x-auto overflow-y-hidden pr-4 py-2 snap-x snap-mandatory scrollbar-hide"
              style={{
                touchAction: 'pan-x', 
                overscrollBehavior: 'contain',
                WebkitOverflowScrolling: 'touch',
                scrollbarWidth: 'none',
                msOverflowStyle: 'none'
              }}
            >
              {/* Daily Advice Card - glassmorphism expert style */}
              <article 
                className="snap-start shrink-0 w-[320px] h-[200px] backdrop-blur-[16px] border rounded-2xl p-5 flex flex-col animate-card-appear"
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

              {/* Hydration Widget */}
              <article 
                className="snap-start shrink-0 w-[320px] h-[200px] backdrop-blur-[16px] border rounded-2xl p-5 flex flex-col animate-card-appear"
                style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.5)',
                  borderColor: 'rgba(255, 255, 255, 0.3)',
                  animationDelay: '100ms'
                }}
              >
                <div 
                  className="text-[13px] mb-3"
                  style={{ color: '#475467' }}
                >
                  Гидрация
                </div>
                <div className="flex items-start gap-4 h-full -mt-2">
                  <div className="relative w-20 h-20 flex items-center justify-center flex-shrink-0">
                    <img src="/icons/hydration.PNG" alt="Hydration" className="w-full h-full object-contain" />
                  </div>
                  <div className="flex flex-col justify-center flex-1">
                    <div 
                      className="text-[12px] mb-1"
                      style={{ color: '#64748B' }}
                    >
                      Уровень
                    </div>
                    <div 
                      className="text-[15px] font-semibold"
                      style={{ color: '#1F2A44' }}
                    >
                      Оптимально
                    </div>
                  </div>
                </div>
              </article>

              {/* UV Index Widget */}
              <article 
                className="snap-start shrink-0 w-[320px] h-[200px] backdrop-blur-[16px] border rounded-2xl p-5 flex flex-col animate-card-appear"
                style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.5)',
                  borderColor: 'rgba(255, 255, 255, 0.3)',
                  animationDelay: '200ms'
                }}
              >
                <div 
                  className="text-[13px] mb-3"
                  style={{ color: '#475467' }}
                >
                  UV-индекс
                </div>
                <div className="flex items-center gap-4 h-full">
                  <div 
                    className="text-[56px] font-bold tabular-nums leading-none flex-shrink-0"
                    style={{ color: '#1F2A44' }}
                  >
                    —
                  </div>
                  <div className="flex flex-col justify-center flex-1">
                    <div 
                      className="text-[11px] mb-1 font-medium"
                      style={{ color: '#64748B' }}
                    >
                      Умеренный
                    </div>
                    <div 
                      className="text-[13px] leading-tight"
                      style={{ color: '#475467' }}
                    >
                      Сегодня: SPF 30
                    </div>
                  </div>
                </div>
              </article>

              {/* Подробный план - карточка-кнопка */}
              <article 
                className="snap-start shrink-0 w-[320px] h-[200px] backdrop-blur-[16px] border rounded-2xl p-5 flex flex-col justify-center items-center animate-card-appear cursor-pointer hover:opacity-90 transition-opacity"
                style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.5)',
                  borderColor: 'rgba(255, 255, 255, 0.3)',
                  animationDelay: '300ms'
                }}
                onClick={() => navigate("/plan")}
              >
                <div 
                  className="w-16 h-16 rounded-full flex items-center justify-center mb-4"
                  style={{ backgroundColor: '#0A5F59' }}
                >
                  <svg 
                    className="w-8 h-8" 
                    fill="none" 
                    stroke="white" 
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div 
                  className="text-[18px] font-bold mb-2 text-center"
                  style={{ color: '#1F2A44' }}
                >
                  Подробный план
                </div>
                <div 
                  className="text-[14px] text-center leading-relaxed"
                  style={{ color: '#475467' }}
                >
                  Полная программа ухода на 12 недель с детальными рекомендациями
                </div>
              </article>
            </div>
          </div>
        </div>
      </section>


      {/* Bottom Sheet */}
      <BottomSheet open={sheetOpen} onClose={() => setSheetOpen(false)} item={sheetItem} />
    </div>
  );
}
