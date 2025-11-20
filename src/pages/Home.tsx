import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

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
const morningDefault: RoutineItem[] = [
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

const eveningDefault: RoutineItem[] = [
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

// ----- BottomSheet Component -----
function BottomSheet({ open, onClose, item }: { open: boolean; onClose: () => void; item: RoutineItem | null }) {
  if (!open || !item) return null;
  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div 
        className="absolute left-0 right-0 bottom-0 rounded-t-3xl p-4 max-h-[70vh] overflow-y-auto translate-y-0 animate-[sheetUp_220ms_cubic-bezier(0.22,1,0.36,1)] backdrop-blur-[28px] border-t"
        style={{
          backgroundColor: 'rgba(20, 26, 36, 0.95)',
          borderTopColor: 'rgba(255, 255, 255, 0.09)',
          borderTopWidth: '1px',
          boxShadow: '0 -8px 32px rgba(0, 0, 0, 0.5)'
        }}
      >
        <div className="mx-auto h-1 w-10 rounded-full mb-3" style={{ backgroundColor: 'rgba(255, 255, 255, 0.3)' }} />
        <div className="flex items-center gap-3 mb-4">
          {item.icon ? (
            <div 
              className="w-10 h-10 rounded-2xl flex items-center justify-center backdrop-blur-[10px] border"
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.06)',
                borderColor: 'rgba(255, 255, 255, 0.09)',
                borderWidth: '1px'
              }}
            >
              <img src={item.icon} alt="" className="w-6 h-6 object-contain opacity-90" />
            </div>
          ) : null}
          <div>
            <div className="text-[16px] font-medium" style={{ color: '#FAFAFA' }}>{item.title}</div>
            <div className="text-[12px]" style={{ color: '#B8B8B8' }}>{item.subtitle}</div>
          </div>
        </div>
        <div className="mt-3">
          <div className="text-[13px] font-medium mb-1" style={{ color: '#FAFAFA' }}>Как выполнить</div>
          <ol className="list-decimal list-inside text-[14px] space-y-1" style={{ color: '#B8B8B8', lineHeight: '1.4' }}>
            {item.howto?.steps?.map((s: string, i: number) => (
              <li key={i}>{s}</li>
            ))}
          </ol>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <div 
              className="rounded-2xl p-3 backdrop-blur-[20px] border"
              style={{
                backgroundColor: 'rgba(20, 26, 36, 0.72)',
                borderColor: 'rgba(255, 255, 255, 0.09)',
                borderWidth: '1px'
              }}
            >
              <div className="text-[12px]" style={{ color: '#B8B8B8' }}>Объём</div>
              <div className="text-[14px] font-medium" style={{ color: '#FAFAFA' }}>{item.howto?.volume}</div>
            </div>
            <div 
              className="rounded-2xl p-3 backdrop-blur-[20px] border"
              style={{
                backgroundColor: 'rgba(20, 26, 36, 0.72)',
                borderColor: 'rgba(255, 255, 255, 0.09)',
                borderWidth: '1px'
              }}
            >
              <div className="text-[12px]" style={{ color: '#B8B8B8' }}>Совет</div>
              <div className="text-[14px] font-medium" style={{ color: '#FAFAFA' }}>{item.howto?.tip}</div>
            </div>
          </div>
        </div>
        <div className="mt-4 flex gap-2">
          <button 
            onClick={onClose} 
            className="flex-1 h-12 rounded-2xl text-[15px] font-medium backdrop-blur-[20px] border transition-all duration-200 hover:opacity-80"
            style={{
              backgroundColor: 'rgba(20, 26, 36, 0.72)',
              borderColor: 'rgba(255, 255, 255, 0.09)',
              borderWidth: '1px',
              color: '#FAFAFA'
            }}
          >
            Закрыть
          </button>
          <button 
            onClick={onClose} 
            className="flex-1 h-12 rounded-2xl text-[15px] font-medium transition-all duration-200 hover:opacity-90"
            style={{
              background: 'linear-gradient(135deg, rgba(13, 74, 82, 0.9) 0%, rgba(13, 74, 82, 0.7) 100%)',
              borderColor: 'rgba(212, 165, 116, 0.2)',
              borderWidth: '1px',
              color: '#FAFAFA',
              boxShadow: '0 0 20px rgba(13, 74, 82, 0.6)'
            }}
          >
            Понятно
          </button>
        </div>
      </div>
    </div>
  );
}

// ----- Main Component -----
export default function MobileSkinIQHome() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<"AM" | "PM">("AM");
  const [morning, setMorning] = useState<RoutineItem[]>(morningDefault);
  const [evening, setEvening] = useState<RoutineItem[]>(eveningDefault);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetItem, setSheetItem] = useState<RoutineItem | null>(null);

  const items = tab === "AM" ? morning : evening;
  const completed = items.filter((i) => i.done).length;

  const toggleAt = (idx: number) => () => {
    if (tab === "AM") {
      const copy = [...morning];
      copy[idx] = { ...copy[idx], done: !copy[idx].done };
      setMorning(copy);
      // Haptic feedback
      if (navigator.vibrate) {
        navigator.vibrate(50);
      }
    } else {
      const copy = [...evening];
      copy[idx] = { ...copy[idx], done: !copy[idx].done };
      setEvening(copy);
      // Haptic feedback
      if (navigator.vibrate) {
        navigator.vibrate(50);
      }
    }
  };

  const openHowTo = (idx: number) => () => {
    setSheetItem(items[idx]);
    setSheetOpen(true);
  };

  // Telegram WebApp ready
  useEffect(() => {
    if ((window as any)?.Telegram?.WebApp) {
      (window as any).Telegram.WebApp.ready();
      (window as any).Telegram.WebApp.expand();
    }
  }, []);

  // Celebration when all completed
  useEffect(() => {
    if (completed === items.length && items.length > 0) {
      if (navigator.vibrate) {
        navigator.vibrate([100, 50, 100]);
      }
    }
  }, [completed, items.length]);

  return (
    <div 
      className="w-full min-h-screen relative overflow-x-hidden"
      style={{ 
        backgroundColor: '#0B1215',
        paddingBottom: '120px'
      }}
    >
      <style>{`
        @keyframes sheetUp { 
          from { transform: translateY(12px); opacity: .5; } 
          to { transform: translateY(0); opacity: 1; } 
        }
        @keyframes fadeInUp {
          from { 
            opacity: 0; 
            transform: translateY(20px); 
          }
          to { 
            opacity: 1; 
            transform: translateY(0); 
          }
        }
        @keyframes pulse {
          0%, 100% {
            transform: scale(1);
          }
          50% {
            transform: scale(1.02);
          }
        }
        @keyframes confetti {
          0% {
            transform: translateY(0) rotate(0deg);
            opacity: 1;
          }
          100% {
            transform: translateY(-100px) rotate(360deg);
            opacity: 0;
          }
        }
      `}</style>

      {/* Noise overlay */}
      <div 
        className="fixed inset-0 pointer-events-none z-0"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='4' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
          backgroundSize: '200px 200px',
          opacity: 0.04
        }}
      />

      {/* Header */}
      <header 
        className="flex items-center justify-between px-5 pt-5 pb-3 relative z-10"
      >
        <button 
          onClick={() => navigate(-1)}
          className="text-[32px] bg-transparent border-none"
          style={{ color: '#FAFAFA', opacity: 0.7 }}
        >
          ←
        </button>
        <h1 
          className="text-[28px] font-extrabold tracking-wide"
          style={{ 
            color: '#FAFAFA',
            textShadow: '0 0 12px rgba(212, 165, 116, 0.3)'
          }}
        >
          SkinIQ
        </h1>
        <button
          onClick={() => navigate("/quiz")}
          className="backdrop-blur-[20px] border px-4 py-2 rounded-[20px] text-sm font-semibold transition-all duration-200 hover:opacity-90"
          style={{
            backgroundColor: 'rgba(212, 165, 116, 0.18)',
            borderColor: '#D4A574',
            borderWidth: '1px',
            color: '#D4A574'
          }}
        >
          <span className="flex items-center gap-1.5">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
              <circle cx="12" cy="13" r="4" />
            </svg>
            AI Skin Scan
          </span>
        </button>
      </header>

      {/* Tab switcher */}
      <div className="px-5 mb-4 relative z-10">
        <div 
          className="inline-flex rounded-full p-0.5 backdrop-blur-[28px] border"
          style={{
            backgroundColor: 'rgba(20, 26, 36, 0.72)',
            borderColor: 'rgba(255, 255, 255, 0.09)',
            borderWidth: '1px'
          }}
        >
          {(["AM", "PM"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-6 py-2 rounded-full text-sm font-medium transition-all duration-300 ${
                tab === t ? '' : ''
              }`}
              style={tab === t 
                ? { 
                    background: 'linear-gradient(135deg, #0D4A52 0%, #1E6B6F 100%)',
                    color: '#D4A574'
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
      </div>

      {/* Title Row */}
      <div 
        className="flex justify-between items-center px-6 py-6 relative z-10"
      >
        <h2 
          className="text-[28px] font-bold"
          style={{ color: '#FAFAFA' }}
        >
          {tab === "AM" ? "Morning Ritual" : "Evening Ritual"}
        </h2>
        <span 
          className="text-[18px] font-semibold"
          style={{ color: '#D4A574' }}
        >
          {completed}/{items.length} steps
        </span>
      </div>

      {/* Divider line */}
      <div 
        className="mx-6 mb-4 h-px relative z-10"
        style={{ backgroundColor: 'rgba(212, 165, 116, 0.4)' }}
      />

      {/* Steps */}
      <main className="px-5 pb-32 relative z-10">
        {items.map((item, index) => {
          const isCompleted = item.done;
          return (
            <button
              key={item.id}
              onClick={() => {
                toggleAt(index)();
                // Micro-confetti on completion
                if (!isCompleted && navigator.vibrate) {
                  navigator.vibrate(50);
                }
              }}
              onDoubleClick={openHowTo(index)}
              className={`w-full flex items-center backdrop-blur-[28px] border rounded-[24px] p-[18px] mb-3 transition-all duration-300 relative ${
                isCompleted ? 'completed' : ''
              }`}
              style={{
                animation: `fadeInUp 0.6s backwards`,
                animationDelay: `${index * 0.1}s`,
                backgroundColor: 'rgba(20, 26, 36, 0.72)',
                WebkitBackdropFilter: 'blur(28px)',
                backdropFilter: 'blur(28px)',
                borderColor: 'rgba(255, 255, 255, 0.09)',
                borderWidth: '1px',
                borderRadius: '24px',
                boxShadow: isCompleted 
                  ? '0 8px 32px rgba(0,0,0,0.37), 0 0 20px rgba(212,165,116,0.3)'
                  : '0 8px 32px rgba(0,0,0,0.37)'
              }}
            >
              {/* Product Image */}
              <img 
                src={item.icon} 
                alt={item.title}
                className="w-16 h-16 rounded-2xl object-cover flex-shrink-0"
                style={{ borderRadius: '16px' }}
              />

              {/* Text Container */}
              <div className="ml-4 text-left flex-1 min-w-0">
                <div 
                  className="text-[17px] font-medium truncate"
                  style={{ color: '#FAFAFA' }}
                >
                  {item.title}
                </div>
                <div 
                  className="text-[19px] font-bold truncate mt-0.5"
                  style={{ color: '#D4A574' }}
                >
                  {item.subtitle}
                </div>
              </div>

              {/* Chevron / Checkmark */}
              <span 
                className="text-[28px] font-light ml-2 flex-shrink-0"
                style={{ color: '#D4A574' }}
              >
                {isCompleted ? '✓' : '›'}
              </span>

              {/* Glow effect when completed */}
              {isCompleted && (
                <div 
                  className="absolute inset-0 rounded-[24px] pointer-events-none"
                  style={{
                    boxShadow: '0 0 20px rgba(212,165,116,0.4)',
                    animation: 'pulse 2s ease-in-out infinite'
                  }}
                />
              )}
            </button>
          );
        })}
      </main>

      {/* Aura glow when all completed */}
      {completed === items.length && items.length > 0 && (
        <div 
          className="fixed inset-0 pointer-events-none z-20"
          style={{
            background: 'radial-gradient(circle at center, rgba(212, 165, 116, 0.15) 0%, transparent 70%)',
            animation: 'pulse 1.5s ease-in-out'
          }}
        />
      )}

      {/* Bottom Navigation */}
      <nav 
        className="fixed bottom-0 left-0 right-0 backdrop-blur-[20px] border-t flex justify-around items-center py-4 z-30"
        style={{
          backgroundColor: 'rgba(20, 26, 36, 0.8)',
          borderTopColor: 'rgba(255, 255, 255, 0.08)',
          borderTopWidth: '1px',
          paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)'
        }}
      >
        <button className="text-[26px] opacity-60">🏠</button>
        <button className="text-[26px] opacity-60">🔍</button>
        <button 
          className="text-[30px]"
          style={{ 
            color: '#D4A574',
            filter: 'drop-shadow(0 0 8px rgba(212, 165, 116, 0.5))'
          }}
        >
          ✨
        </button>
        <button className="text-[26px] opacity-60">👤</button>
      </nav>

      {/* BottomSheet */}
      <BottomSheet open={sheetOpen} onClose={() => setSheetOpen(false)} item={sheetItem} />
    </div>
  );
}
