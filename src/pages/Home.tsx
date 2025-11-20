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
function ProgressRing({ completed = 0, total = 5, size = 100, stroke = 2 }: { completed?: number; total?: number; size?: number; stroke?: number }) {
  const value = total > 0 ? (completed / total) * 100 : 0;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (value / 100) * c;
  const isCompleted = completed === total && total > 0;
  
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative" style={{ width: size, height: size }}>
        {/* Glass background circle */}
        <div 
          className="absolute inset-0 rounded-full backdrop-blur-[20px] border"
          style={{
            backgroundColor: 'rgba(255, 255, 255, 0.05)',
            borderColor: 'rgba(255, 255, 255, 0.08)',
            borderWidth: '0.5px'
          }}
        />
        {/* Progress ring - gold/white thin line */}
        <svg width={size} height={size} className="absolute inset-0" style={{overflow: 'visible', transform: 'rotate(-90deg)'}}>
          {/* Background track - very subtle */}
        <circle 
          cx={size / 2}
          cy={size / 2}
          r={r} 
            stroke="rgba(255, 255, 255, 0.05)"
          strokeWidth={stroke} 
          fill="none"
        />
          {/* Progress circle - gold/white with glow */}
        <circle 
        cx={size / 2}
        cy={size / 2}
          r={r} 
            stroke={isCompleted ? '#D4C19C' : 'rgba(255, 255, 255, 0.4)'}
        strokeLinecap="round"
          strokeWidth={stroke} 
        fill="none"
        style={{ 
          strokeDasharray: c, 
          strokeDashoffset: offset, 
              transition: "stroke-dashoffset 800ms cubic-bezier(0.22,1,0.36,1)",
              transformOrigin: "center",
              filter: isCompleted ? 'drop-shadow(0 0 8px rgba(212, 193, 156, 0.6))' : 'none'
        }}
      />
        </svg>
        {/* Center text */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <div 
              className="text-[20px] font-medium tabular-nums leading-none"
              style={{ color: '#F5F5F5' }}
            >
              {completed}/{total}
          </div>
        </div>
        </div>
      </div>
      {/* Dynamic text below progress */}
      {isCompleted ? (
        <div className="flex items-center gap-2">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#D4C19C" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ filter: 'drop-shadow(0 0 4px rgba(212, 193, 156, 0.6))' }}>
            <polyline points="20 6 9 17 4 12" />
      </svg>
          <div 
            className="text-[16px] font-medium text-center"
            style={{ color: '#D4C19C' }}
          >
            Ритуал завершён
          </div>
        </div>
      ) : (
        <div 
          className="text-[14px] font-regular text-center min-h-[20px]"
          style={{ color: '#B8B8B8' }}
        >
          {completed === 0 && `${total === 4 ? 'Вечерний' : 'Утренний'} ритуал • ${total} шага`}
          {completed > 0 && completed < total && `• ${total - completed} ${getRemainingStepsText(total - completed)} осталось`}
        </div>
      )}
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
      className="backdrop-blur-[25px] border h-[88px] px-5 flex items-center gap-4 select-none transition-all duration-300 animate-card-appear relative overflow-hidden"
      style={{ 
        animationDelay: `${index * 50}ms`,
        backgroundColor: isCompleted ? 'rgba(10, 61, 66, 0.15)' : 'rgba(255, 255, 255, 0.06)',
        borderColor: 'rgba(255, 255, 255, 0.12)',
        borderWidth: '0.5px',
        borderTopWidth: index === 0 ? '0.5px' : '0px',
        borderBottomWidth: '0.5px',
        borderLeftWidth: '0px',
        borderRightWidth: '0px',
        boxShadow: isCompleted 
          ? 'inset 0 1px 2px rgba(212, 193, 156, 0.1), 0 4px 12px rgba(0, 0, 0, 0.4)' 
          : 'inset 0 1px 1px rgba(255, 255, 255, 0.05), 0 4px 12px rgba(0, 0, 0, 0.4)',
        opacity: isCompleted ? 1 : 0.85
      }}
    >
      {/* Circle with number - glass with glow */}
      <div 
        className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 backdrop-blur-[10px] border relative"
        style={{ 
          backgroundColor: isCompleted ? 'rgba(212, 193, 156, 0.2)' : 'rgba(255, 255, 255, 0.08)',
          borderColor: isCompleted ? 'rgba(212, 193, 156, 0.4)' : 'rgba(255, 255, 255, 0.12)',
          borderWidth: '0.5px',
          boxShadow: isCompleted ? '0 0 12px rgba(212, 193, 156, 0.3)' : 'none'
        }}
      >
        {isCompleted ? (
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#D4C19C" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ filter: 'drop-shadow(0 0 4px rgba(212, 193, 156, 0.6))' }}>
            <polyline points="20 6 9 17 4 12" />
          </svg>
        ) : (
          <span 
            className="text-base font-medium"
            style={{ color: '#E8E8E8' }}
          >
            {index + 1}
          </span>
        )}
          </div>
      
      {/* Icon - larger with inner glow */}
      <div 
        className="w-14 h-14 flex items-center justify-center flex-shrink-0 rounded-xl relative"
        style={{
          backgroundColor: 'rgba(255, 255, 255, 0.03)',
          boxShadow: 'inset 0 1px 2px rgba(255, 255, 255, 0.1)'
        }}
      >
        {item.icon ? (
          <img src={item.icon} alt="" className="w-12 h-12 object-contain" style={{ filter: isCompleted ? 'opacity(0.6)' : 'none' }} />
        ) : (
          <div className="w-12 h-12 bg-gray-700 rounded-lg opacity-30" />
        )}
      </div>
      
      {/* Content */}
      <button onClick={onOpen} className="flex-1 min-w-0 text-left">
        <div 
          className={`text-[18px] sm:text-[20px] font-medium truncate transition-all leading-tight ${isCompleted ? 'line-through' : ''}`}
          style={{ 
            color: isCompleted ? '#D4C19C' : '#F5F5F5',
            fontWeight: isCompleted ? 400 : 500,
            textDecorationColor: 'rgba(212, 193, 156, 0.5)'
          }}
        >
          {item.title}
        </div>
        <div 
          className={`text-[14px] sm:text-[15px] truncate mt-1 ${isCompleted ? 'line-through' : ''}`}
          style={{ 
            color: isCompleted ? '#B8B8B8' : '#B8B8B8',
            lineHeight: '1.4',
            textDecorationColor: 'rgba(212, 193, 156, 0.3)'
          }}
        >
          {item.subtitle}
        </div>
        </button>
      
      {/* Toggle button - right, gold checkmark when completed */}
        <button
        onClick={(e) => { e.stopPropagation(); onToggle(); }}
        aria-pressed={isCompleted}
        className="ml-auto w-10 h-10 flex items-center justify-center flex-shrink-0"
      >
        {isCompleted ? (
          <div 
            className="w-7 h-7 rounded-full flex items-center justify-center backdrop-blur-[10px] border relative"
            style={{ 
              backgroundColor: 'rgba(212, 193, 156, 0.2)',
              borderColor: 'rgba(212, 193, 156, 0.4)',
              borderWidth: '0.5px',
              boxShadow: '0 0 12px rgba(212, 193, 156, 0.4)',
              animation: 'pulse 2s ease-in-out infinite'
            }}
          >
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#D4C19C" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ filter: 'drop-shadow(0 0 4px rgba(212, 193, 156, 0.8))' }}>
            <polyline points="20 6 9 17 4 12" />
          </svg>
          </div>
        ) : (
          <div 
            className="w-6 h-6 rounded-full border transition-all duration-200"
            style={{ borderColor: 'rgba(255, 255, 255, 0.2)', borderWidth: '1px' }}
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
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div 
        className="absolute left-0 right-0 bottom-0 rounded-t-3xl p-4 max-h-[70vh] overflow-y-auto translate-y-0 animate-[sheetUp_220ms_cubic-bezier(0.22,1,0.36,1)] backdrop-blur-[30px] border-t"
        style={{
          backgroundColor: 'rgba(11, 18, 21, 0.95)',
          borderTopColor: 'rgba(255, 255, 255, 0.12)',
          borderTopWidth: '0.5px',
          boxShadow: '0 -8px 32px rgba(0, 0, 0, 0.8)'
        }}
      >
        <div className="mx-auto h-1 w-10 rounded-full mb-3" style={{ backgroundColor: 'rgba(255, 255, 255, 0.3)' }} />
        <div className="flex items-center gap-3">
          {item.icon ? (
            <div 
              className="w-10 h-10 rounded-2xl flex items-center justify-center backdrop-blur-[10px] border"
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.06)',
                borderColor: 'rgba(255, 255, 255, 0.12)',
                borderWidth: '0.5px',
                boxShadow: 'inset 0 1px 1px rgba(255, 255, 255, 0.05)'
              }}
            >
              <img src={item.icon} alt="" className="w-6 h-6 object-contain opacity-90" />
            </div>
          ) : (
            <div 
              className="w-10 h-10 rounded-2xl backdrop-blur-[10px] border"
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.06)',
                borderColor: 'rgba(255, 255, 255, 0.12)',
                borderWidth: '0.5px'
              }}
            />
          )}
          <div>
            <div className="text-[16px] font-medium" style={{ color: '#F5F5F5' }}>{item.title}</div>
            <div className="text-[12px]" style={{ color: '#B8B8B8' }}>{item.subtitle}</div>
          </div>
        </div>
        <div className="mt-3">
          <div className="text-[13px] font-medium mb-1" style={{ color: '#E8E8E8' }}>Как выполнить</div>
          <ol className="list-decimal list-inside text-[14px] space-y-1" style={{ color: '#B8B8B8', lineHeight: '1.4' }}>
            {item.howto?.steps?.map((s: string, i: number) => (
              <li key={i}>{s}</li>
            ))}
          </ol>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <div 
              className="rounded-2xl p-3 backdrop-blur-[20px] border"
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.04)',
                borderColor: 'rgba(255, 255, 255, 0.12)',
                borderWidth: '0.5px'
              }}
            >
              <div className="text-[12px]" style={{ color: '#B8B8B8' }}>Объём</div>
              <div className="text-[14px] font-medium" style={{ color: '#E8E8E8' }}>{item.howto?.volume}</div>
            </div>
            <div 
              className="rounded-2xl p-3 backdrop-blur-[20px] border"
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.04)',
                borderColor: 'rgba(255, 255, 255, 0.12)',
                borderWidth: '0.5px'
              }}
            >
              <div className="text-[12px]" style={{ color: '#B8B8B8' }}>Совет</div>
              <div className="text-[14px] font-medium" style={{ color: '#E8E8E8' }}>{item.howto?.tip}</div>
            </div>
          </div>
        </div>
        <div className="mt-4 flex gap-2">
          <button 
            onClick={onClose} 
            className="flex-1 h-12 rounded-2xl text-[15px] font-medium backdrop-blur-[20px] border transition-all duration-200 hover:opacity-80"
            style={{
              backgroundColor: 'rgba(255, 255, 255, 0.04)',
              borderColor: 'rgba(255, 255, 255, 0.12)',
              borderWidth: '0.5px',
              color: '#E8E8E8'
            }}
          >
            Закрыть
          </button>
          <button 
            onClick={onClose} 
            className="flex-1 h-12 rounded-2xl text-[15px] font-medium transition-all duration-200 hover:opacity-90"
            style={{
              background: 'linear-gradient(135deg, rgba(10, 61, 66, 0.9) 0%, rgba(15, 43, 51, 0.9) 100%)',
              borderColor: 'rgba(212, 193, 156, 0.3)',
              borderWidth: '0.5px',
              color: '#F5F5F5',
              boxShadow: '0 0 20px rgba(10, 61, 66, 0.5)'
            }}
          >
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
      {/* Background - dark premium #0B1215 */}
      <div 
        className="fixed inset-0 -z-10"
        style={{
          background: 'linear-gradient(180deg, #0B1215 0%, #0F1419 100%)'
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
        @keyframes pulse {
          0%, 100% {
            opacity: 1;
            transform: scale(1);
            box-shadow: 0 0 12px rgba(212, 193, 156, 0.3);
          }
          50% {
            opacity: 0.8;
            transform: scale(1.02);
            box-shadow: 0 0 20px rgba(212, 193, 156, 0.5);
          }
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
          background: linear-gradient(90deg, rgba(255,255,255,0.05) 0px, rgba(255,255,255,0.15) 40px, rgba(255,255,255,0.05) 80px);
          background-size: 200px 100%;
          animation: skeleton-loading 1.5s ease-in-out infinite;
        }
      `}</style>


      {/* Header - dark glass */}
      <div className="absolute top-4 left-4 z-20 backdrop-blur-[20px] border rounded-2xl px-4 py-2"
        style={{
          backgroundColor: 'rgba(255, 255, 255, 0.05)',
          borderColor: 'rgba(255, 255, 255, 0.08)',
          borderWidth: '0.5px'
        }}
      >
        <img 
          src="/skiniq-logo.png" 
          alt="SkinIQ" 
          className="h-8 w-auto object-contain opacity-90"
          style={{ filter: 'brightness(1.2)' }}
        />
      </div>

      {/* Top section - glass panel with greeting and stats (40% height) */}
      <div className="mx-4 mt-16 mb-5">
        {/* Glass panel */}
        <div 
          className="backdrop-blur-[30px] border rounded-3xl p-5 relative overflow-hidden"
          style={{
            backgroundColor: 'rgba(255, 255, 255, 0.06)',
            borderColor: 'rgba(255, 255, 255, 0.12)',
            borderWidth: '0.5px',
            boxShadow: 'inset 0 1px 2px rgba(255, 255, 255, 0.08), 0 8px 32px rgba(0, 0, 0, 0.6)',
            minHeight: '35vh',
            maxHeight: '40vh'
          }}
        >
          {/* Top row: Greeting + Stats */}
          <div className="mb-4">
            <div 
              className="text-[20px] sm:text-[22px] font-medium mb-3"
              style={{ color: '#F5F5F5' }}
            >
              {greeting}, {userName.split(' ')[0]}
          </div>
          
            {/* Stats row */}
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-2">
                <div 
                  className="text-[16px] font-medium"
                  style={{ color: '#E8E8E8' }}
                >
                  Skin Score:
            </div>
                <div 
                  className="text-[16px] font-medium"
                  style={{ color: '#D4C19C' }}
                >
                  87/100
                </div>
                <div 
                  className="text-[14px] font-regular"
                  style={{ color: '#D4C19C' }}
                >
                  ↑2
                </div>
              </div>
              <div 
                className="text-[14px] font-regular"
                style={{ color: '#B8B8B8' }}
              >
                •
              </div>
              <div 
                className="text-[14px] font-regular"
                style={{ color: '#B8B8B8' }}
              >
                Гидратация – 82%
              </div>
              <div 
                className="text-[14px] font-regular"
                style={{ color: '#B8B8B8' }}
              >
                •
              </div>
              <div 
                className="text-[14px] font-regular"
                style={{ color: '#B8B8B8' }}
              >
                Воспаление – 6%
          </div>
        </div>
      </div>

          {/* Progress Ring - compact, centered */}
          <div className="flex justify-center items-center mt-4">
            <ProgressRing completed={completed} total={items.length} size={100} stroke={2} />
        </div>
        </div>
      </div>

      {/* Main Panel */}
      <section className="relative z-20 mx-4 overflow-visible">
        {/* SegmentedButton AM/PM - thin glass strip with glow */}
        <div 
          className="mb-5 rounded-2xl p-0.5 grid grid-cols-2 h-10 backdrop-blur-[25px] border relative"
          style={{
            backgroundColor: 'rgba(255, 255, 255, 0.04)',
            borderColor: 'rgba(255, 255, 255, 0.12)',
            borderWidth: '0.5px',
            boxShadow: 'inset 0 1px 1px rgba(255, 255, 255, 0.05), 0 4px 12px rgba(0, 0, 0, 0.4)'
          }}
        >
          {["AM", "PM"].map((t) => (
            <button
              key={t}
              onClick={() => handleTabChange(t)}
              className={`relative rounded-xl text-[14px] font-medium transition-all duration-300 overflow-hidden ${
                tab === t
                  ? " font-medium"
                  : " bg-transparent"
              }`}
              style={tab === t 
                ? { 
                    backgroundColor: 'rgba(212, 193, 156, 0.2)',
                    color: '#D4C19C',
                    boxShadow: '0 0 16px rgba(212, 193, 156, 0.3), inset 0 1px 1px rgba(255, 255, 255, 0.1)'
                  }
                : { 
                    color: '#B8B8B8',
                    backgroundColor: 'transparent'
                  }
              }
            >
              {t === "AM" ? "Утро" : "Вечер"}
            </button>
          ))}
        </div>

        {/* Routine list - dark glass container */}
        <div 
          className="mb-5 backdrop-blur-[25px] border rounded-3xl overflow-hidden fade-in-routine"
          style={{
            backgroundColor: 'rgba(255, 255, 255, 0.04)',
            borderColor: 'rgba(255, 255, 255, 0.12)',
            borderWidth: '0.5px',
            boxShadow: 'inset 0 1px 2px rgba(255, 255, 255, 0.05), 0 8px 32px rgba(0, 0, 0, 0.6)'
          }}
          key={fadeKey}
        >
            {isLoading ? (
            <div className="py-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="skeleton h-[88px] px-5 flex items-center gap-4 border-b last:border-b-0" style={{ borderColor: 'rgba(255, 255, 255, 0.08)' }}>
                  <div className="w-12 h-12 skeleton rounded-full" />
                  <div className="w-14 h-14 skeleton rounded-xl" />
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
          
        {/* Completion buttons - dark premium style */}
        {completed === items.length && items.length > 0 && (
          <div className="mb-6 mt-6 animate-onboarding-fade-in" style={{ animationDelay: '300ms' }}>
            {/* Вариант А: две кнопки в ряд (большие экраны) */}
            <div className="hidden sm:flex gap-3 w-full">
              {/* Outlined кнопка - AI Skin Scan */}
              <button
                onClick={() => navigate("/quiz")}
                className="flex-1 h-14 rounded-2xl font-medium text-[16px] transition-all duration-200 hover:opacity-90 active:scale-[0.98] backdrop-blur-[25px] border relative overflow-hidden"
                style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.04)',
                  borderColor: 'rgba(212, 193, 156, 0.3)',
                  borderWidth: '0.5px',
                  color: '#D4C19C',
                  boxShadow: 'inset 0 1px 1px rgba(255, 255, 255, 0.05), 0 4px 12px rgba(0, 0, 0, 0.4)'
                }}
              >
                <div className="flex items-center justify-center gap-2">
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                    <circle cx="12" cy="13" r="4" />
                  </svg>
                  <span>AI Skin Scan</span>
                </div>
              </button>
              
              {/* Filled кнопка - Подробный план */}
          <button
            onClick={() => navigate("/plan")}
                className="flex-1 h-14 rounded-2xl font-medium text-[16px] transition-all duration-200 hover:opacity-90 active:scale-[0.98] relative overflow-hidden"
                style={{
                  background: 'linear-gradient(135deg, rgba(10, 61, 66, 0.9) 0%, rgba(15, 43, 51, 0.9) 100%)',
                  borderColor: 'rgba(212, 193, 156, 0.3)',
                  borderWidth: '0.5px',
                  color: '#F5F5F5',
                  boxShadow: '0 0 20px rgba(10, 61, 66, 0.5), inset 0 1px 1px rgba(255, 255, 255, 0.1)'
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
                className="w-full h-14 rounded-2xl font-medium text-[16px] transition-all duration-200 hover:opacity-90 active:scale-[0.98] relative overflow-hidden"
                style={{
                  background: 'linear-gradient(135deg, rgba(10, 61, 66, 0.9) 0%, rgba(15, 43, 51, 0.9) 100%)',
                  borderColor: 'rgba(212, 193, 156, 0.3)',
                  borderWidth: '0.5px',
                  color: '#F5F5F5',
                  boxShadow: '0 0 20px rgba(10, 61, 66, 0.5), inset 0 1px 1px rgba(255, 255, 255, 0.1)'
                }}
              >
                Подробный план →
          </button>
              
              {/* Outlined кнопка - AI Skin Scan (вторая) */}
          <button 
            onClick={() => navigate("/quiz")}
                className="w-full h-14 rounded-2xl font-medium text-[16px] transition-all duration-200 hover:opacity-90 active:scale-[0.98] backdrop-blur-[25px] border relative overflow-hidden"
                style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.04)',
                  borderColor: 'rgba(212, 193, 156, 0.3)',
                  borderWidth: '0.5px',
                  color: '#D4C19C',
                  boxShadow: 'inset 0 1px 1px rgba(255, 255, 255, 0.05), 0 4px 12px rgba(0, 0, 0, 0.4)'
                }}
              >
                <div className="flex items-center justify-center gap-2">
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                    <circle cx="12" cy="13" r="4" />
                  </svg>
                  <span>AI Skin Scan</span>
                </div>
          </button>
        </div>
          </div>
        )}
        
        {/* Кнопка "AI Skin Scan" если не все выполнено */}
        {completed < items.length && (
          <div className="mb-6 mt-6">
            <button
              onClick={() => navigate("/quiz")}
              className="w-full h-14 rounded-2xl font-medium text-[16px] transition-all duration-200 hover:opacity-90 active:scale-[0.98] backdrop-blur-[25px] border relative overflow-hidden"
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.04)',
                borderColor: 'rgba(212, 193, 156, 0.3)',
                borderWidth: '0.5px',
                color: '#D4C19C',
                boxShadow: 'inset 0 1px 1px rgba(255, 255, 255, 0.05), 0 4px 12px rgba(0, 0, 0, 0.4)'
              }}
            >
              <div className="flex items-center justify-center gap-2">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                  <circle cx="12" cy="13" r="4" />
                </svg>
                <span>AI Skin Scan</span>
              </div>
            </button>
          </div>
        )}

        {/* Совет косметолога - dark glass card */}
        <div 
          className="mt-6 mb-20 backdrop-blur-[25px] border rounded-3xl p-5 relative overflow-hidden"
          style={{
            backgroundColor: 'rgba(255, 255, 255, 0.06)',
            borderColor: 'rgba(255, 255, 255, 0.12)',
            borderWidth: '0.5px',
            boxShadow: 'inset 0 1px 2px rgba(255, 255, 255, 0.08), 0 8px 32px rgba(0, 0, 0, 0.6)'
          }}
        >
          <div className="flex items-start gap-4">
            {/* Icon in circle with gold glow */}
            <div 
              className="w-14 h-14 rounded-full flex items-center justify-center flex-shrink-0 backdrop-blur-[10px] border relative"
              style={{ 
                backgroundColor: 'rgba(212, 193, 156, 0.15)',
                borderColor: 'rgba(212, 193, 156, 0.3)',
                borderWidth: '0.5px',
                boxShadow: '0 0 16px rgba(212, 193, 156, 0.3)'
              }}
            >
              <svg 
                className="w-7 h-7" 
                fill="none" 
                stroke="#D4C19C" 
                viewBox="0 0 24 24"
                style={{ filter: 'drop-shadow(0 0 4px rgba(212, 193, 156, 0.6))' }}
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
              
            <div className="flex-1 min-w-0">
              {/* Заголовок - 20sp bold gold */}
              <div 
                className="text-[20px] font-medium mb-2 leading-tight"
                style={{ color: '#D4C19C' }}
              >
                Усилить увлажнение
              </div>
              {/* Текст совета - 16sp */}
              <div 
                className="text-[16px] leading-relaxed"
                style={{ color: '#B8B8B8', lineHeight: '1.4' }}
              >
                    В холодное время кожа нуждается в дополнительном увлажнении. Используйте гиалуроновую кислоту утром и плотный крем вечером.
                  </div>
                </div>
            
            {/* Hydration icon - справа, кольцевая с glow */}
            <div className="relative w-20 h-20 flex items-center justify-center flex-shrink-0">
              <div 
                className="w-20 h-20 rounded-full flex items-center justify-center backdrop-blur-[10px] border"
                style={{
                  backgroundColor: 'rgba(212, 193, 156, 0.1)',
                  borderColor: 'rgba(212, 193, 156, 0.2)',
                  borderWidth: '0.5px',
                  boxShadow: '0 0 20px rgba(212, 193, 156, 0.2)'
                }}
              >
                <img src="/icons/hydration.PNG" alt="Hydration" className="w-16 h-16 object-contain opacity-90" />
              </div>
            </div>
          </div>
        </div>
        
        {/* AI + экспертиза подпись - внизу по центру, dark style */}
        <div 
          className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-10 text-center backdrop-blur-[20px] px-4 py-2 rounded-full border"
          style={{ 
            color: '#B8B8B8',
            fontSize: '12px',
            backgroundColor: 'rgba(255, 255, 255, 0.04)',
            borderColor: 'rgba(255, 255, 255, 0.08)',
            borderWidth: '0.5px'
          }}
        >
          AI + экспертиза косметолога
        </div>

        {/* Widgets carousel - горизонтальный скролл (опционально, можно оставить) */}
        <div className="mt-4 mb-20 hidden">
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
