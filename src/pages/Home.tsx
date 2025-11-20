import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import OnboardingScreen from "./OnboardingScreen";

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
  
  // Additional safety check
  if (!item.howto) {
    console.warn('BottomSheet: item.howto is missing', item);
    return null;
  }
  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div 
        className="absolute left-0 right-0 bottom-0 rounded-t-3xl p-4 max-h-[70vh] overflow-y-auto translate-y-0 animate-[sheetUp_220ms_cubic-bezier(0.22,1,0.36,1)] relative"
        style={{
          backgroundColor: 'rgba(18, 24, 36, 0.82)',
          backdropFilter: 'blur(32px)',
          WebkitBackdropFilter: 'blur(32px)',
          border: '1px solid rgba(226, 232, 240, 0.1)',
          borderTopWidth: '1px',
          borderBottomWidth: '0',
          borderLeftWidth: '0',
          borderRightWidth: '0',
          boxShadow: '0 -8px 32px rgba(0, 0, 0, 0.5)'
        }}
      >
        {/* Close button - top right */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full transition-all duration-200 hover:bg-white/10 active:scale-95 z-10"
          style={{
            color: '#FAFAFA',
            opacity: 0.7,
            fontSize: '24px',
            lineHeight: 1
          }}
        >
          ×
        </button>
        
        <div className="mx-auto h-1 w-10 rounded-full mb-3" style={{ backgroundColor: 'rgba(255, 255, 255, 0.3)' }} />
        <div className="flex items-center gap-4 mb-4">
          {item.icon ? (
            <img 
              src={item.icon} 
              alt={item.title}
              className="w-16 h-16 rounded-2xl object-cover flex-shrink-0"
              style={{ borderRadius: '16px' }}
            />
          ) : null}
          <div className="flex-1">
            <div 
              className="text-[18px] font-semibold"
              style={{ 
                color: '#E8E1D9',
                fontFamily: "'Satoshi', 'Manrope', -apple-system, BlinkMacSystemFont, sans-serif",
                fontWeight: 600,
                letterSpacing: '-0.01em'
              }}
            >
              {item.title}
            </div>
            <div 
              className="text-[14px] mt-0.5"
              style={{ 
                color: '#94A3B8',
                fontFamily: "'Manrope', -apple-system, BlinkMacSystemFont, sans-serif",
                fontWeight: 400
              }}
            >
              {item.subtitle}
            </div>
          </div>
        </div>
        <div className="mt-3">
          <div className="text-[13px] font-medium mb-1" style={{ color: '#FAFAFA' }}>Как выполнить</div>
          <ol className="list-decimal list-inside text-[14px] space-y-1" style={{ color: '#94A3B8', lineHeight: '1.4' }}>
            {item.howto?.steps?.map((s: string, i: number) => (
              <li key={i}>{s || ''}</li>
            )) || <li>Инструкции скоро появятся</li>}
          </ol>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div 
              className="rounded-2xl p-3 backdrop-blur-[24px] border transition-all duration-300 hover:border-opacity-60"
              style={{
                backgroundColor: 'rgba(18, 24, 36, 0.78)',
                backdropFilter: 'blur(24px)',
                WebkitBackdropFilter: 'blur(24px)',
                borderColor: '#E8E1D9',
                borderWidth: '1px',
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.08)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow = 'inset 0 1px 0 rgba(255,255,255,0.08), 0 0 12px rgba(232,225,217,0.2)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = 'inset 0 1px 0 rgba(255,255,255,0.08)';
              }}
            >
              <div 
                className="text-[12px] mb-1"
                style={{ 
                  color: '#E8E1D9',
                  fontFamily: "'Manrope', -apple-system, BlinkMacSystemFont, sans-serif",
                  fontWeight: 600,
                  opacity: 0.8
                }}
              >
                Объём
              </div>
              <div 
                className="text-[14px] font-medium"
                style={{ 
                  color: '#FAFAFA',
                  fontFamily: "'Manrope', -apple-system, BlinkMacSystemFont, sans-serif"
                }}
              >
                {item.howto?.volume || '—'}
              </div>
            </div>
            <div 
              className="rounded-2xl p-3 backdrop-blur-[24px] border transition-all duration-300 hover:border-opacity-60"
              style={{
                backgroundColor: 'rgba(18, 24, 36, 0.78)',
                backdropFilter: 'blur(24px)',
                WebkitBackdropFilter: 'blur(24px)',
                borderColor: '#E8E1D9',
                borderWidth: '1px',
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.08)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow = 'inset 0 1px 0 rgba(255,255,255,0.08), 0 0 12px rgba(232,225,217,0.2)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = 'inset 0 1px 0 rgba(255,255,255,0.08)';
              }}
            >
              <div 
                className="text-[12px] mb-1"
                style={{ 
                  color: '#E8E1D9',
                  fontFamily: "'Manrope', -apple-system, BlinkMacSystemFont, sans-serif",
                  fontWeight: 600,
                  opacity: 0.8
                }}
              >
                Совет
              </div>
              <div 
                className="text-[14px] font-medium"
                style={{ 
                  color: '#FAFAFA',
                  fontFamily: "'Manrope', -apple-system, BlinkMacSystemFont, sans-serif"
                }}
              >
                {item.howto?.tip || 'Совет скоро появится'}
              </div>
            </div>
          </div>
        </div>
        <div className="mt-4 flex gap-3">
          <button 
            onClick={onClose} 
            className="flex-1 h-12 rounded-2xl text-[15px] font-medium backdrop-blur-[20px] border transition-all duration-200 hover:opacity-80"
            style={{
              backgroundColor: 'rgba(255, 255, 255, 0.06)',
              backdropFilter: 'blur(24px)',
              WebkitBackdropFilter: 'blur(24px)',
              borderColor: 'rgba(226, 232, 240, 0.1)',
              borderWidth: '1px',
              color: '#FAFAFA',
              fontFamily: "'Manrope', -apple-system, BlinkMacSystemFont, sans-serif"
            }}
          >
            Закрыть
          </button>
          <button 
            onClick={onClose} 
            className="flex-1 h-12 rounded-2xl text-[15px] font-semibold transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
            style={{
              background: 'linear-gradient(135deg, #E8E1D9 0%, #D4C9B8 100%)',
              border: '1px solid rgba(232, 225, 217, 0.5)',
              color: '#0B1215',
              fontFamily: "'Manrope', -apple-system, BlinkMacSystemFont, sans-serif",
              fontWeight: 600,
              boxShadow: '0 4px 16px rgba(232, 225, 217, 0.4), 0 0 20px rgba(232, 225, 217, 0.2)'
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
  const [hasCompletedQuiz, setHasCompletedQuiz] = useState<boolean | null>(null);
  const [tab, setTab] = useState<"AM" | "PM">("AM");
  const [morning, setMorning] = useState<RoutineItem[]>(morningDefault);
  const [evening, setEvening] = useState<RoutineItem[]>(eveningDefault);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetItem, setSheetItem] = useState<RoutineItem | null>(null);
  const [greeting, setGreeting] = useState('');
  const [userName, setUserName] = useState('друг');
  const [hintShown, setHintShown] = useState(false);

  const items = tab === "AM" ? morning : evening;
  const completed = items.filter((i) => i.done).length;

  // Check if quiz is completed
  useEffect(() => {
    try {
      const quizDone = localStorage.getItem('skinQuizCompleted') === 'true';
      setHasCompletedQuiz(quizDone);
      
      // Check if hint was shown
      const hintWasShown = localStorage.getItem('firstStepHintShown') === 'true';
      setHintShown(hintWasShown);
      
      // Telegram ready
      const tg = (window as any)?.Telegram?.WebApp;
      if (tg) {
        tg.ready();
        tg.expand();
      }
    } catch (error) {
      console.error('Error checking quiz status:', error);
      setHasCompletedQuiz(false);
    }
  }, []);

  // Personalization: get greeting and user name
  useEffect(() => {
    try {
      // Get name from Telegram
      const tg = (window as any)?.Telegram?.WebApp;
      const user = tg?.initDataUnsafe?.user;
      const firstName = user?.first_name || 'друг';
      setUserName(firstName);

      // Determine greeting by local time
      const hour = new Date().getHours();
      if (hour >= 5 && hour < 12) setGreeting('Доброе утро');
      else if (hour >= 12 && hour < 18) setGreeting('Добрый день');
      else if (hour >= 18 && hour < 23) setGreeting('Добрый вечер');
      else setGreeting('Доброй ночи');
    } catch (error) {
      console.error('Error setting greeting:', error);
      setGreeting('Добрый день');
      setUserName('друг');
    }
  }, []);

  // Show loading spinner while checking
  if (hasCompletedQuiz === null) {
    return (
      <div 
        className="min-h-screen flex items-center justify-center"
        style={{ background: '#FAFAFA' }}
      >
        <div 
          className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
          style={{ 
            borderColor: '#0F766E',
            borderTopColor: 'transparent'
          }}
        />
      </div>
    );
  }

  // Show onboarding if quiz not completed
  if (!hasCompletedQuiz) {
    return <OnboardingScreen />;
  }

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
    
    // Hide hint after first interaction
    if (!hintShown && idx === 0) {
      localStorage.setItem('firstStepHintShown', 'true');
      setHintShown(true);
    }
  };

  const openHowTo = (idx: number) => () => {
    try {
      const selectedItem = items[idx];
      if (selectedItem && selectedItem.howto) {
        setSheetItem(selectedItem);
        setSheetOpen(true);
      } else {
        console.warn('openHowTo: item or howto is missing', { idx, item: selectedItem });
      }
    } catch (error) {
      console.error('Error opening how-to:', error);
    }
  };


  // Celebration when all completed
  useEffect(() => {
    if (items && items.length > 0 && completed === items.length) {
      if (navigator.vibrate) {
        navigator.vibrate([100, 50, 100]);
      }
    }
  }, [completed, items]);

  return (
    <div
      className="w-full min-h-screen relative overflow-x-hidden"
      style={{ 
          backgroundColor: '#0C1219',
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
          0% { 
            transform: scale(0.9); 
            opacity: 0.7; 
          }
          70% { 
            transform: scale(1.1); 
            opacity: 0; 
          }
          100% { 
            transform: scale(0.9); 
            opacity: 0; 
          }
        }
        @keyframes pulseGlow {
          0%, 100% {
            opacity: 1;
            transform: scale(1);
          }
          50% {
            opacity: 0.7;
            transform: scale(1.1);
          }
        }
        @keyframes bounce {
          0%, 100% { 
            transform: translateX(-50%) translateY(0); 
          }
          50% { 
            transform: translateX(-50%) translateY(-6px); 
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
        className="flex items-center justify-center px-5 pt-5 pb-3 relative z-10"
      >
        <h1 
          className="text-[28px] font-black tracking-tight text-center"
          style={{ 
            color: '#FAFAFA',
            textShadow: '0 0 12px rgba(232, 225, 217, 0.3)',
            fontFamily: "'Satoshi', 'Manrope', -apple-system, BlinkMacSystemFont, sans-serif",
            fontWeight: 900,
            letterSpacing: '-0.03em'
          }}
        >
          SkinIQ
        </h1>
      </header>
      
      {/* Header Actions */}
      <div className="px-5 pb-4 relative z-10 flex gap-3">
        <button
          onClick={() => navigate("/plan")}
          className="flex-1 h-11 px-5 rounded-[18px] font-semibold text-sm transition-all duration-200 hover:opacity-90 active:scale-95"
          style={{
            background: 'transparent',
            border: '1.5px solid #E8E1D9',
            color: '#E8E1D9',
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
            fontFamily: "'Manrope', -apple-system, BlinkMacSystemFont, sans-serif",
            fontWeight: 600
          }}
        >
          Подробный план ухода →
        </button>
        <button
          onClick={() => navigate("/quiz")}
          className="flex-1 h-11 px-5 rounded-[18px] font-semibold text-sm transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
          style={{
            background: 'linear-gradient(90deg, #E8E1D9, #D4C9B8)',
            color: '#0C1219',
            border: 'none',
            fontFamily: "'Manrope', -apple-system, BlinkMacSystemFont, sans-serif",
            fontWeight: 600,
            boxShadow: '0 8px 20px rgba(232,225,217,0.25)'
          }}
        >
          Пройти анкету заново →
        </button>
      </div>

      {/* Personal Greeting */}
      <div 
        className="px-6 pt-2 pb-4 relative z-10"
        style={{
          marginTop: '8px',
          textAlign: 'left'
        }}
      >
        <div 
          className="text-[26px] font-bold leading-tight"
          style={{
            color: '#FAFAFA',
            fontFamily: "'Satoshi', 'Manrope', -apple-system, BlinkMacSystemFont, sans-serif",
            fontWeight: 700,
            lineHeight: 1.2
          }}
        >
          {greeting || 'Добрый день'}, <span 
            style={{
              background: 'linear-gradient(90deg, #E8E1D9, #D4C9B8)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              fontWeight: 800,
              fontFamily: "'Satoshi', 'Manrope', -apple-system, BlinkMacSystemFont, sans-serif"
            }}
          >
            {userName}
          </span>
          </div>
        <div 
          className="text-[15px] mt-1.5 font-medium"
          style={{
            color: '#94A3B8',
            fontFamily: "'Manrope', -apple-system, BlinkMacSystemFont, sans-serif",
            fontWeight: 500,
            marginTop: '6px'
          }}
        >
          Ваш {tab === "AM" ? "утренний" : "вечерний"} ритуал готов · {items.length} шаг{items.length > 1 ? (items.length < 5 ? "а" : "ов") : ""}
        </div>
      </div>

      {/* Tab switcher - glass style */}
      <div className="px-5 mb-4 relative z-10">
        <div 
          className="inline-flex rounded-full p-0.5 backdrop-blur-[24px] border"
          style={{
            backgroundColor: 'rgba(255, 255, 255, 0.06)',
            WebkitBackdropFilter: 'blur(24px)',
            backdropFilter: 'blur(24px)',
            borderColor: 'rgba(226, 232, 240, 0.1)',
            borderWidth: '1px',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.08), 0 8px 16px rgba(0,0,0,0.3)'
          }}
        >
          {(["AM", "PM"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-6 py-2 rounded-full text-sm font-medium transition-all duration-300 border ${
                tab === t ? 'active' : ''
              }`}
              style={{
                ...(tab === t 
                  ? { 
                      background: 'linear-gradient(90deg, rgba(10,95,110,0.8) 0%, rgba(10,95,110,0.6) 100%)',
                      borderColor: '#E8E1D9',
                      borderWidth: '1px',
                      borderStyle: 'solid',
                      color: '#E8E1D9',
                      boxShadow: '0 0 12px rgba(232,225,217,0.2)'
                    }
                  : { 
                      color: '#94A3B8',
                      backgroundColor: 'transparent',
                      borderColor: 'transparent',
                      borderWidth: '1px',
                      borderStyle: 'solid'
                    }
                ),
                fontFamily: "'Manrope', -apple-system, BlinkMacSystemFont, sans-serif",
                fontWeight: 500
              }}
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
          className="text-[28px] font-black"
          style={{ 
            color: '#FAFAFA',
            fontFamily: "'Satoshi', 'Manrope', -apple-system, BlinkMacSystemFont, sans-serif",
            fontWeight: 900,
            letterSpacing: '-0.03em'
          }}
        >
          {tab === "AM" ? "Morning Ritual" : "Evening Ritual"}
        </h2>
        <span 
          className="text-[18px] font-medium"
          style={{ 
            color: completed === items.length && items.length > 0 
              ? '#E8E1D9' 
              : '#E8E1D9',
            background: completed === items.length && items.length > 0
              ? 'linear-gradient(to right, #E8E1D9, #D4C9B8)'
              : 'transparent',
            WebkitBackgroundClip: completed === items.length && items.length > 0 ? 'text' : 'unset',
            WebkitTextFillColor: completed === items.length && items.length > 0 ? 'transparent' : '#E8E1D9',
            textShadow: '0 0 8px rgba(232,225,217,0.5)',
            fontFamily: "'Manrope', -apple-system, BlinkMacSystemFont, sans-serif",
            fontWeight: 500
          }}
        >
          {completed}/{items.length} steps
        </span>
            </div>
            
      {/* Divider line */}
      <div 
        className="mx-6 mb-4 h-px relative z-10"
        style={{ backgroundColor: 'rgba(226, 232, 240, 0.1)' }}
      />
      
      {/* Dermatologist Tip */}
      <div 
        className="mx-5 mb-4 p-4 rounded-2xl backdrop-blur-[32px] border relative z-10"
        style={{
          backgroundColor: 'rgba(18, 24, 36, 0.78)',
          backdropFilter: 'blur(32px)',
          WebkitBackdropFilter: 'blur(32px)',
          borderColor: 'rgba(226, 232, 240, 0.1)',
          borderWidth: '1px',
          boxShadow: '0 12px 32px rgba(0,0,0,0.6)'
        }}
      >
        <div className="flex items-start gap-3">
          <div 
            className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold"
            style={{
              backgroundColor: 'rgba(232, 225, 217, 0.15)',
              border: '1px solid #E8E1D9',
              color: '#E8E1D9',
              fontFamily: "'Manrope', -apple-system, BlinkMacSystemFont, sans-serif"
            }}
          >
            Tip
              </div>
          <p 
            className="text-[14px] leading-relaxed flex-1"
            style={{
              color: '#FAFAFA',
              fontFamily: "'Manrope', -apple-system, BlinkMacSystemFont, sans-serif",
              fontWeight: 400
            }}
          >
            Сегодня идеальная влажность — после тонера подождите 60 секунд перед сывороткой
          </p>
                  </div>
                </div>

      {/* Steps */}
      <main className="px-5 pb-32 relative z-10">
        {items.map((item, index) => {
          const isCompleted = item.done;
          const isFirstUncompleted = index === 0 && !isCompleted && !hintShown;
          return (
          <div key={item.id} className="relative mb-3">
            {/* First step hint */}
            {isFirstUncompleted && (
              <div 
                className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-full mb-2 z-20"
                style={{
                  animation: 'bounce 2s infinite'
                }}
              >
                <div 
                  className="px-4 py-2 rounded-[20px] text-[13px] font-medium whitespace-nowrap"
                  style={{
                    background: '#0F766E',
                    color: 'white',
                    fontFamily: "'Manrope', -apple-system, BlinkMacSystemFont, sans-serif",
                    boxShadow: '0 4px 12px rgba(15, 118, 110, 0.3)'
                  }}
                >
                  Нажмите, чтобы отметить выполненным
                </div>
                {/* Arrow pointer */}
                <div 
                  className="absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-full"
                  style={{
                    width: 0,
                    height: 0,
                    borderLeft: '6px solid transparent',
                    borderRight: '6px solid transparent',
                    borderTop: '6px solid #0F766E'
                  }}
                />
                {/* Pulse ring */}
                <div 
                  className="absolute inset-0 rounded-full"
                  style={{
                    border: '3px solid #0F766E',
                    borderRadius: '50%',
                    animation: 'pulse 2s infinite',
                    transform: 'scale(1.2)',
                    opacity: 0.5
                  }}
                />
              </div>
            )}
            
          <button 
              onClick={() => {
                toggleAt(index)();
                // Micro-confetti on completion
                if (!isCompleted && navigator.vibrate) {
                  navigator.vibrate(50);
                }
              }}
              onDoubleClick={openHowTo(index)}
              className={`w-full flex items-center backdrop-blur-[24px] border rounded-[24px] p-[18px] transition-all duration-300 relative ${
                isCompleted ? 'completed' : ''
              }`}
              style={{
                animation: `fadeInUp 0.6s backwards`,
                animationDelay: `${index * 0.1}s`,
                backgroundColor: 'rgba(18, 24, 36, 0.78)',
                WebkitBackdropFilter: 'blur(24px)',
                backdropFilter: 'blur(24px)',
                borderColor: 'rgba(226, 232, 240, 0.1)',
                borderWidth: '1px',
                borderRadius: '24px',
                boxShadow: isCompleted 
                  ? '0 12px 40px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.08), 0 0 20px rgba(232,225,217,0.3)'
                  : '0 12px 40px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.08)'
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
                  style={{ 
                    color: '#BFC4CD',
                    fontFamily: "'Satoshi', 'Manrope', -apple-system, BlinkMacSystemFont, sans-serif",
                    fontWeight: 500,
                    letterSpacing: '-0.01em'
                  }}
                >
                  {item.title}
                </div>
                <div 
                  className="text-[19px] font-bold truncate mt-0.5"
                  style={{ 
                    color: '#E8E1D9',
                    textShadow: '0 0 4px rgba(232,225,217,0.3)',
                    fontFamily: "'Satoshi', 'Manrope', -apple-system, BlinkMacSystemFont, sans-serif",
                    fontWeight: 700,
                    letterSpacing: '-0.02em'
                  }}
                >
                  {item.subtitle}
                </div>
              </div>

              {/* Chevron / Checkmark */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toggleAt(index)();
                }}
                className="ml-2 flex-shrink-0 w-10 h-10 flex items-center justify-center"
                style={{ 
                  color: '#E8E1D9',
                  textShadow: isCompleted ? '0 0 12px rgba(232,225,217,0.6)' : 'none',
                  animation: isCompleted ? 'pulseGlow 1s infinite' : 'none',
                  fontSize: '28px',
                  fontWeight: 300
                }}
              >
                {isCompleted ? '✓' : '›'}
              </button>

              {/* Info button - bottom right */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  openHowTo(index)();
                }}
                className="absolute right-4 bottom-3 w-7 h-7 flex items-center justify-center rounded-full transition-all duration-300 hover:scale-110 active:scale-95"
                style={{
                  backgroundColor: 'rgba(232, 225, 217, 0.18)',
                  backdropFilter: 'blur(10px)',
                  WebkitBackdropFilter: 'blur(10px)',
                  border: '1px solid #E8E1D9',
                  color: '#E8E1D9',
                  fontSize: '14px',
                  fontWeight: 700,
                  fontFamily: "'Manrope', -apple-system, BlinkMacSystemFont, sans-serif",
                  opacity: isCompleted ? 0.7 : 1,
                  zIndex: 10,
                  pointerEvents: 'auto'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(232, 225, 217, 0.4)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(232, 225, 217, 0.18)';
                }}
              >
                i
              </button>

              {/* Glow effect when completed */}
              {isCompleted && (
                <div 
                  className="absolute inset-0 rounded-[24px] pointer-events-none"
                  style={{
                    boxShadow: '0 0 20px rgba(232,225,217,0.4)',
                    animation: 'pulse 2s ease-in-out infinite'
                  }}
                />
              )}
            </button>
          </div>
          );
        })}
      </main>

      {/* Aura glow when all completed */}
      {completed === items.length && items.length > 0 && (
        <div 
          className="fixed inset-0 pointer-events-none z-20"
          style={{
            background: 'radial-gradient(circle at center, rgba(232, 225, 217, 0.15) 0%, transparent 70%)',
            animation: 'pulse 1.5s ease-in-out'
          }}
        />
      )}

      {/* Bottom Navigation - glass style */}
      <nav 
        className="fixed bottom-0 left-0 right-0 backdrop-blur-[24px] border-t flex justify-around items-center py-4 z-30"
        style={{
          backgroundColor: 'rgba(255, 255, 255, 0.06)',
          WebkitBackdropFilter: 'blur(24px)',
          backdropFilter: 'blur(24px)',
          borderTopColor: 'rgba(226, 232, 240, 0.1)',
          borderTopWidth: '1px',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.08), 0 -8px 16px rgba(0,0,0,0.3)',
          paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)'
        }}
      >
        {/* Home */}
        <button 
          className="w-10 h-10 flex items-center justify-center transition-all duration-200"
          style={{ opacity: 0.6 }}
        >
          <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#FAFAFA' }}>
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
            <polyline points="9 22 9 12 15 12 15 22" />
          </svg>
        </button>
        
        {/* Search */}
        <button 
          className="w-10 h-10 flex items-center justify-center transition-all duration-200"
          style={{ opacity: 0.6 }}
        >
          <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#FAFAFA' }}>
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35" />
          </svg>
        </button>
        
        {/* Scan/Ritual - active */}
        <button 
          className="w-12 h-12 flex items-center justify-center rounded-full transition-all duration-200"
          style={{ 
            color: '#E8E1D9',
            filter: 'drop-shadow(0 0 12px rgba(232, 225, 217, 0.6))'
          }}
        >
          <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
          </svg>
        </button>
        
        {/* Profile */}
        <button 
          className="w-10 h-10 flex items-center justify-center transition-all duration-200"
          style={{ opacity: 0.6 }}
        >
          <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#FAFAFA' }}>
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
        </button>
      </nav>

      {/* BottomSheet */}
      <BottomSheet open={sheetOpen} onClose={() => setSheetOpen(false)} item={sheetItem} />
            </div>
  );
}
