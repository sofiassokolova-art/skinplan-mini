import { useEffect, useRef, useState } from "react";
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
function ProgressRing({ value = 0, size = 156, stroke = 6 }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (value / 100) * c;
  return (
    <svg width={size} height={size} className="block">
        <defs>
        <linearGradient id="grad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#FFC6D9" />
          <stop offset="100%" stopColor="#E9C987" />
          </linearGradient>
        </defs>
      <circle cx={size / 2} cy={size / 2} r={r} stroke="rgba(255,255,255,0.35)" strokeWidth={stroke} fill="none" />
        <circle 
        cx={size / 2}
        cy={size / 2}
          r={r} 
        stroke="url(#grad)"
        strokeLinecap="round"
          strokeWidth={stroke} 
        fill="none"
        style={{ strokeDasharray: c, strokeDashoffset: offset, transition: "stroke-dashoffset 600ms cubic-bezier(0.22,1,0.36,1)" }}
      />
      <foreignObject x="0" y="0" width={size} height={size}>
        <div className="w-full h-full flex items-center justify-center">
          <div className="text-center">
            <div className="text-2xl font-semibold text-neutral-900">{Math.round(value)}%</div>
            <div className="text-xs text-neutral-600">выполнено</div>
          </div>
        </div>
      </foreignObject>
      </svg>
  );
}

function RoutineCard({ item, onToggle, onOpen }: { item: RoutineItem; onToggle: () => void; onOpen: () => void }) {
  return (
    <div className={`${glass} ${radiusCard} h-[72px] px-3 py-2 flex items-center gap-3 select-none`}>
      <div className="w-10 h-10 rounded-2xl bg-white/60 flex items-center justify-center overflow-hidden">
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
          className={`w-6 h-6 rounded-xl border transition-all duration-200 flex items-center justify-center ${item.done ? 'border-transparent bg-neutral-900 text-white' : 'border-white/60 bg-white/40 text-transparent'}`}
        >
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </span>
        </button>
    </div>
  );
}

function Confetti({ show }: { show: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!show || !ref.current) return;
    const root = ref.current;
    const N = 24;
    root.innerHTML = "";
    for (let i = 0; i < N; i++) {
      const s = document.createElement("span");
      s.className = "absolute w-1 h-2 rounded-sm";
      s.style.left = Math.random() * 100 + "%";
      s.style.top = "0%";
      s.style.background = i % 2 ? "#FFC6D9" : "#E9C987";
      s.style.transform = `translateY(-20px) rotate(${Math.random() * 360}deg)`;
      s.style.animation = `confetti-fall ${800 + Math.random() * 600}ms ease-out ${Math.random() * 200}ms forwards`;
      root.appendChild(s);
    }
  }, [show]);
  return <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden ref={ref} />;
}

function BottomSheet({ open, onClose, item }: { open: boolean; onClose: () => void; item: RoutineItem | null }) {
  if (!open || !item) return null;
  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className={`absolute left-0 right-0 bottom-0 ${glass} ${radiusPanel} p-4 max-h-[70vh] overflow-y-auto translate-y-0 animate-[sheetUp_220ms_cubic-bezier(0.22,1,0.36,1)]`}>
        <div className="mx-auto h-1 w-10 rounded-full bg-white/60 mb-3" />
        <div className="flex items-center gap-3">
          <img src={item.icon} alt="" className="w-10 h-10 object-contain" />
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
  const [celebrate, setCelebrate] = useState(false);
  const [showScrollArrows, setShowScrollArrows] = useState(true);

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

  const items = tab === "AM" ? morning : evening;
  const completed = items.filter((i) => i.done).length;
  const progress = items.length ? (completed / items.length) * 100 : 0;

  useEffect(() => {
    if (progress === 100) {
      setCelebrate(true);
      const t = setTimeout(() => setCelebrate(false), 1400);
      return () => clearTimeout(t);
    }
  }, [progress]);

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

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.target as HTMLDivElement;
    if (target.scrollLeft > 10) {
      setShowScrollArrows(false);
    } else {
      setShowScrollArrows(true);
    }
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
    <div className="w-full min-h-screen relative">
      {/* Background layers: PNG image with floating spheres */}
      <div 
        className="absolute inset-0 -z-10 bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: "url('/bg/IMG_8368 (2).PNG')"
        }}
      />
      
      <style>{`
        @keyframes shimmer { 0% { transform: translateX(-100%);} 100% { transform: translateX(100%);} }
        .btn-shimmer > span::before{ content:''; position:absolute; top:0; left:0; height:100%; width:60%; opacity:.25; filter: blur(10px); background: linear-gradient(90deg, transparent, white, transparent); animation: shimmer 2.4s infinite; }
        @keyframes confetti-fall { to { transform: translateY(110vh) rotate(540deg); opacity: 0; } }
        @keyframes sheetUp { from { transform: translateY(12px); opacity: .5; } to { transform: translateY(0); opacity: 1; } }
      `}</style>

      {/* Header */}
      <div className="sticky top-0 z-20 mx-4 pt-4 flex items-start justify-start bg-transparent">
        <img 
          src="/skiniq-logo.png" 
          alt="SkinIQ" 
          className="h-24 w-auto object-contain"
        />
      </div>

      {/* Greeting */}
      <div className="mx-4 mt-4 mb-2">
        <div className="text-[16px] font-medium text-neutral-800">
          {greeting}, {userName}!
        </div>
      </div>

      {/* Main Panel */}
      <section className={`bg-white/5 backdrop-blur-sm border border-white/10 ${radiusPanel} relative z-20 mx-4 p-4`}>
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
              className={`relative ${radiusCard} text-[14px] font-medium transition-all duration-200` +
                (tab === t
                  ? " bg-white/50 text-neutral-900 shadow-inner border border-white/60"
                  : " text-neutral-700 hover:text-neutral-900")}
            >
              {t === "AM" ? "Утро" : "Вечер"}
            </button>
          ))}
        </div>

        {/* Routine list */}
        <div className="relative mt-3">
          {/* Scroll indicator for routine cards */}
          <div className="absolute top-0 right-0 z-10 flex flex-col items-center gap-1 opacity-60">
            <div className="w-1 h-1 bg-neutral-400 rounded-full animate-bounce"></div>
            <div className="w-1 h-1 bg-neutral-400 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
            <div className="w-1 h-1 bg-neutral-400 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
            <svg className="w-3 h-3 text-neutral-400 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
            </svg>
          </div>
          
          <div className="space-y-2 max-h-[288px] overflow-y-auto pr-6 scrollbar-hide">
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
        <div className="mt-4 flex flex-col items-center relative">
          <div
            className={`relative ${
              progress === 100
                ? "shadow-[0_0_0_12px_rgba(233,201,135,0.15)] rounded-full"
                : ""
            }`}
          >
            <ProgressRing value={progress} />
            {celebrate && <Confetti show />}
          </div>
          <div className="text-[13px] text-neutral-600 mt-1">
            Выполнено {completed} из {items.length}
          </div>
          <button
            onClick={() => navigate("/plan")}
            className={`relative btn-shimmer ${radiusCard} mt-3 w-full h-12 text-white text-[15px] font-semibold flex items-center justify-center`}
            style={{
              background:
                progress === 100
                  ? "linear-gradient(90deg,#FFC6D9,#E9C987)"
                  : "#171717",
              color: "white",
            }}
          >
            <span className="relative inline-block text-white">
              {progress === 0
                ? "Перейти к подробному плану"
                : progress === 100
                ? "Посмотреть итоги"
                : "Открыть подробный план"}
            </span>
          </button>
          <button 
            onClick={() => navigate("/quiz")}
            className="mt-2 text-[14px] text-neutral-800 underline/20 hover:text-neutral-600 transition-colors"
          >
            Перепройти анкету
          </button>
        </div>
      </section>

      {/* Widgets carousel */}
      <section className="mt-4 pb-20">
        <div className="relative" id="widgets-container">
          {/* Horizontal scroll indicators - only right arrow */}
          {showScrollArrows && (
            <div className="absolute right-0 top-1/2 -translate-y-1/2 z-10 flex items-center gap-1 opacity-60 transition-opacity duration-300">
              <div className="w-1 h-1 bg-neutral-400 rounded-full animate-bounce"></div>
              <div className="w-1 h-1 bg-neutral-400 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
              <div className="w-1 h-1 bg-neutral-400 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
              <svg className="w-3 h-3 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          )}
          
          <div 
            className="flex gap-3 overflow-x-auto pl-8 pr-8 snap-x snap-mandatory scrollbar-hide"
            onScroll={handleScroll}
          >
            <WidgetCard title="">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-black flex items-center justify-center flex-shrink-0">
                  <img src="/icons/icon_sparkles.svg" alt="Совет" className="w-6 h-6" />
                </div>
                <div className="flex-1 text-left">
                  <div className="text-[12px] text-neutral-600 mb-1">Ежедневный совет</div>
                  <div className="text-[15px] font-semibold mb-1">Усильте увлажнение</div>
                  <div className="text-[11px] text-neutral-500 leading-tight">
                    В холодное время года кожа нуждается в дополнительном увлажнении. Используйте гиалуроновую кислоту утром и плотный крем с керамидами вечером.
                  </div>
                </div>
              </div>
            </WidgetCard>
            <WidgetCard title="Гидрация">
              <MiniRing value={72} />
              <div>
                <div className="text-[12px] text-neutral-600">Статус</div>
                <div className="text-[15px] font-semibold">Оптимально</div>
              </div>
            </WidgetCard>
            <WidgetCard title="UV-индекс">
              <div className="text-4xl font-semibold">3</div>
              <div className="text-[12px] text-neutral-600">Сегодня: SPF 30</div>
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
    <article className={`snap-start shrink-0 w-[280px] h-[140px] mx-0 ${glass} ${radiusCard} p-4 flex items-center justify-between mb-2`}>
      <div className="flex flex-col gap-1">
        <div className="text-[13px] text-neutral-600">{title}</div>
        <div className="text-neutral-900">{children}</div>
      </div>
    </article>
  );
}

function MiniRing({ value }: { value: number }) {
  const size = 56,
    stroke = 5;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (value / 100) * c;
  return (
    <svg width={56} height={56} className="mr-3">
      <defs>
        <linearGradient id="mini" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#FFC6D9" />
          <stop offset="100%" stopColor="#E9C987" />
        </linearGradient>
      </defs>
      <circle cx={28} cy={28} r={r} stroke="rgba(255,255,255,0.4)" strokeWidth={stroke} fill="none" />
      <circle cx={28} cy={28} r={r} stroke="url(#mini)" strokeWidth={stroke} strokeLinecap="round" fill="none" style={{ strokeDasharray: c, strokeDashoffset: offset }} />
      <foreignObject x="0" y="0" width={56} height={56}>
        <div className="w-full h-full flex items-center justify-center">
          <span className="text-[11px] text-neutral-900 font-medium">{value}%</span>
    </div>
      </foreignObject>
    </svg>
  );
}