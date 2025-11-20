import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
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
      <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" onClick={onClose} />
      <div 
        className="absolute left-0 right-0 bottom-0 max-h-[90vh] overflow-y-auto translate-y-0 animate-[sheetUp_220ms_cubic-bezier(0.22,1,0.36,1)] relative"
        style={{ 
          backgroundColor: 'rgba(250, 251, 253, 0.92)',
          backdropFilter: 'blur(32px)',
          WebkitBackdropFilter: 'blur(32px)',
          borderTopLeftRadius: '28px',
          borderTopRightRadius: '28px',
          borderTop: '1px solid rgba(15, 118, 110, 0.12)',
          boxShadow: '0 -8px 32px rgba(0,0,0,0.08)',
          padding: '24px 20px 40px'
        }}
      >
        {/* Handle bar - top center */}
        <div className="mx-auto h-1 w-10 rounded-full mb-6" style={{ backgroundColor: '#CBD5E1' }} />
        
        {/* Close button - top right */}
        <button
          onClick={onClose}
          className="absolute top-6 right-6 w-8 h-8 flex items-center justify-center rounded-full transition-all duration-200 hover:bg-gray-100 active:scale-95 z-10"
          style={{
            color: '#94A3B8',
            fontSize: '24px',
            lineHeight: 1
          }}
        >
          ×
        </button>
        
        {/* Product header */}
        <div className="flex items-center gap-4 mb-6">
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
              className="text-[22px] font-bold"
              style={{ 
                color: '#0F766E',
                fontFamily: "'Satoshi', 'Manrope', -apple-system, BlinkMacSystemFont, sans-serif",
                fontWeight: 700,
                letterSpacing: '-0.01em'
              }}
            >
              {item.title}
            </div>
            <div 
              className="text-[15px] mt-1"
              style={{ 
                color: '#475569',
                fontFamily: "'Manrope', -apple-system, BlinkMacSystemFont, sans-serif",
                fontWeight: 400
              }}
            >
              {item.subtitle}
          </div>
        </div>
        </div>
        
        {/* Instructions */}
        <div className="mb-6">
          <div className="text-[14px] font-semibold mb-2" style={{ color: '#334155', fontFamily: "'Manrope', -apple-system, BlinkMacSystemFont, sans-serif" }}>Как выполнить</div>
          <ol className="list-decimal list-inside text-[15px] space-y-2" style={{ color: '#334155', lineHeight: '1.6', fontFamily: "'Manrope', -apple-system, BlinkMacSystemFont, sans-serif" }}>
            {item.howto?.steps?.map((s: string, i: number) => (
              <li key={i}>{s || ''}</li>
            )) || <li>Инструкции скоро появятся</li>}
          </ol>
            </div>
        
        {/* Badges */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <div 
            className="rounded-2xl p-4 border transition-all duration-200"
            style={{
              backgroundColor: '#F0FDFB',
              borderColor: '#CCFBF1',
              borderWidth: '1px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.03)'
            }}
          >
            <div 
              className="text-[12px] mb-2 font-semibold"
              style={{ 
                color: '#0F766E',
                fontFamily: "'Manrope', -apple-system, BlinkMacSystemFont, sans-serif",
                fontWeight: 600
              }}
            >
              Объём
            </div>
            <div 
              className="text-[14px] font-medium"
              style={{ 
                color: '#334155',
                fontFamily: "'Manrope', -apple-system, BlinkMacSystemFont, sans-serif"
              }}
            >
              {item.howto?.volume || '—'}
          </div>
        </div>
          <div 
            className="rounded-2xl p-4 border transition-all duration-200"
            style={{
              backgroundColor: '#F0FDFB',
              borderColor: '#CCFBF1',
              borderWidth: '1px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.03)'
            }}
          >
            <div 
              className="text-[12px] mb-2 font-semibold"
              style={{ 
                color: '#0F766E',
                fontFamily: "'Manrope', -apple-system, BlinkMacSystemFont, sans-serif",
                fontWeight: 600
              }}
            >
              Совет
            </div>
            <div 
              className="text-[14px] font-medium"
              style={{ 
                color: '#334155',
                fontFamily: "'Manrope', -apple-system, BlinkMacSystemFont, sans-serif"
              }}
            >
              {item.howto?.tip || '—'}
            </div>
          </div>
        </div>
        
        {/* Buttons */}
        <div className="flex gap-3">
          <button 
            onClick={onClose} 
            className="flex-1 h-12 rounded-2xl text-[15px] font-medium border transition-all duration-200 hover:opacity-80 active:scale-95"
            style={{
              backgroundColor: 'transparent',
              borderColor: '#CBD5E1',
              borderWidth: '1px',
              color: '#475569',
              fontFamily: "'Manrope', -apple-system, BlinkMacSystemFont, sans-serif",
              fontWeight: 500
            }}
          >
            Закрыть
          </button>
          <button 
            onClick={onClose} 
            className="flex-1 h-12 rounded-2xl text-[15px] font-semibold transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
            style={{
              background: '#0F766E',
              border: 'none',
              color: 'white',
              fontFamily: "'Manrope', -apple-system, BlinkMacSystemFont, sans-serif",
              fontWeight: 600,
              boxShadow: '0 4px 12px rgba(15, 118, 110, 0.25)'
            }}
          >
            Понятно →
          </button>
        </div>
      </div>
    </div>
  );
}

// ----- Main Component -----
export default function MobileSkinIQHome() {
  const navigate = useNavigate();
  const location = useLocation();
  const [hasCompletedQuiz, setHasCompletedQuiz] = useState<boolean | null>(null);
  const [tab, setTab] = useState<"AM" | "PM">("AM");
  const [morning, setMorning] = useState<RoutineItem[]>(morningDefault);
  const [evening, setEvening] = useState<RoutineItem[]>(eveningDefault);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetItem, setSheetItem] = useState<RoutineItem | null>(null);
  const [greeting, setGreeting] = useState('');
  const [userName, setUserName] = useState('друг');
  const [hintShown, setHintShown] = useState(false);

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
      if (user) {
        const firstName = user.first_name || '';
        const lastName = user.last_name || '';
        const fullName = lastName ? `${firstName} ${lastName}` : firstName || 'друг';
        setUserName(fullName);
      } else {
        setUserName('друг');
      }

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

  // Celebration when all completed - moved before conditional returns
  useEffect(() => {
    if (hasCompletedQuiz !== true) return;
    
    const currentItems = tab === "AM" ? morning : evening;
    const currentCompleted = currentItems?.filter((i) => i.done)?.length || 0;
    
    if (currentItems && currentItems.length > 0 && currentCompleted === currentItems.length) {
      if (navigator.vibrate) {
        navigator.vibrate([100, 50, 100]);
      }
    }
  }, [tab, morning, evening, hasCompletedQuiz]);

  // Show loading spinner while checking
  if (hasCompletedQuiz === null) {
    return (
      <div 
        className="min-h-screen flex items-center justify-center"
        style={{ background: '#FAFBFD' }}
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

  // Calculate items and completed only after we know quiz is completed
  const items = tab === "AM" ? morning : evening;
  const completed = items?.filter((i) => i.done)?.length || 0;

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
      const currentItems = tab === "AM" ? morning : evening;
      if (!currentItems || idx < 0 || idx >= currentItems.length) {
        console.warn('openHowTo: invalid index or items', { idx, itemsLength: currentItems?.length });
        return;
      }
      const selectedItem = currentItems[idx];
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

  return (
    <div
      className="w-full min-h-screen relative overflow-x-hidden"
      style={{ 
          backgroundColor: '#FAFBFD',
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


      {/* Header - Logo */}
      <header 
        className="flex items-center justify-center px-5 pt-5 pb-3 relative z-10"
      >
        <h1 
          className="text-[32px] font-black tracking-tight text-center"
          style={{ 
            background: 'linear-gradient(135deg, #0F766E 0%, #14B8A6 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            fontFamily: "'Satoshi', 'Manrope', -apple-system, BlinkMacSystemFont, sans-serif",
            fontWeight: 900,
            letterSpacing: '-0.03em'
          }}
        >
          SkinIQ
        </h1>
      </header>

      {/* Personal Greeting */}
      <div 
        className="px-6 pt-2 pb-4 relative z-10"
        style={{
          textAlign: 'left'
        }}
      >
        <div 
          className="text-[22px] font-bold leading-tight"
          style={{
            color: '#334155',
            fontFamily: "'Satoshi', 'Manrope', -apple-system, BlinkMacSystemFont, sans-serif",
            fontWeight: 700,
            lineHeight: 1.2
          }}
        >
          {greeting || 'Добрый день'}, {userName}
            </div>
        <div 
          className="text-[14px] mt-1 font-medium"
          style={{
            color: '#64748B',
            fontFamily: "'Manrope', -apple-system, BlinkMacSystemFont, sans-serif",
            fontWeight: 500,
            marginTop: '4px'
          }}
        >
          Ваш {tab === "AM" ? "утренний" : "вечерний"} ритуал готов · {items.length} шаг{items.length > 1 ? (items.length < 5 ? "а" : "ов") : ""}
        </div>
      </div>

      {/* Tab switcher */}
      <div className="mb-4 relative z-10" style={{ paddingLeft: '24px', paddingRight: '24px' }}>
        <div 
          className="inline-flex rounded-full p-0.5"
          style={{
            backgroundColor: 'rgba(255, 255, 255, 0.6)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            border: '1px solid rgba(15, 118, 110, 0.2)',
            borderRadius: '9999px'
          }}
        >
          {(["AM", "PM"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-6 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
                tab === t ? 'active' : ''
              }`}
              style={{
                ...(tab === t 
                  ? { 
                      background: '#0F766E',
                      color: 'white',
                      fontFamily: "'Manrope', -apple-system, BlinkMacSystemFont, sans-serif",
                      fontWeight: 600,
                      border: 'none'
                    }
                  : { 
                      color: '#0F766E',
                      backgroundColor: 'transparent',
                      border: '1px solid #0F766E',
                      fontFamily: "'Manrope', -apple-system, BlinkMacSystemFont, sans-serif",
                      fontWeight: 500
                    }
                )
              }}
            >
              {t === "AM" ? "Утро" : "Вечер"}
            </button>
          ))}
          </div>
        </div>

      {/* Title Row */}
      <div 
        className="flex justify-between items-center px-6 py-4 relative z-10"
        style={{ paddingLeft: '24px', paddingRight: '24px' }}
      >
        <h2 
          className="text-[28px] font-black"
          style={{ 
            color: '#334155',
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
            color: '#0F766E',
            fontFamily: "'Manrope', -apple-system, BlinkMacSystemFont, sans-serif",
            fontWeight: 500
          }}
        >
          {completed}/{items.length} steps
        </span>
        </div>
            
      {/* Divider line */}
      <div 
        className="mb-4 h-px relative z-10"
        style={{ 
          backgroundColor: 'rgba(15, 118, 110, 0.2)',
          marginLeft: '24px',
          marginRight: '24px'
        }}
      />
      
      {/* Dermatologist Tip */}
      <div 
        className="mb-4 p-4 rounded-2xl border relative z-10"
        style={{
          backgroundColor: 'rgba(240, 253, 251, 0.7)',
          backdropFilter: 'blur(32px)',
          WebkitBackdropFilter: 'blur(32px)',
          borderColor: '#CCFBF1',
          borderWidth: '1px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.04)',
          marginLeft: '20px',
          marginRight: '20px'
        }}
      >
        <div className="flex items-start gap-3">
          <div 
            className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold"
            style={{
              backgroundColor: '#0F766E',
              color: 'white',
              fontFamily: "'Manrope', -apple-system, BlinkMacSystemFont, sans-serif",
              fontWeight: 700
            }}
          >
            Tip
              </div>
          <p 
            className="text-[14px] leading-relaxed flex-1"
            style={{
              color: '#334155',
              fontFamily: "'Manrope', -apple-system, BlinkMacSystemFont, sans-serif",
              fontWeight: 400
            }}
          >
            Сегодня идеальная влажность — после тонера подождите 60 секунд перед сывороткой
          </p>
          </div>
        </div>
          
      {/* Steps */}
      <main className="pb-32 relative z-10" style={{ paddingLeft: '20px', paddingRight: '20px' }}>
        {items.map((item, index) => {
          const isCompleted = item.done;
          const isFirstUncompleted = index === 0 && !isCompleted && !hintShown;
          return (
          <div key={item.id} className="relative" style={{ marginBottom: index < items.length - 1 ? '14px' : '0' }}>
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
                  Нажмите карточку → выполнен
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
              className={`w-full flex items-center backdrop-blur-[32px] border rounded-[24px] p-[18px] transition-all duration-300 relative ${
                isCompleted ? 'completed' : ''
              }`}
              style={{
                animation: `fadeInUp 0.6s backwards`,
                animationDelay: `${index * 0.1}s`,
                backgroundColor: 'rgba(255, 255, 255, 0.68)',
                WebkitBackdropFilter: 'blur(32px)',
                backdropFilter: 'blur(32px)',
                borderColor: 'rgba(255, 255, 255, 0.4)',
                borderWidth: '1px',
                borderRadius: '24px',
                boxShadow: '0 12px 32px rgba(0,0,0,0.08)'
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
                    color: '#0F766E',
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
                    color: '#334155',
                    fontFamily: "'Satoshi', 'Manrope', -apple-system, BlinkMacSystemFont, sans-serif",
                    fontWeight: 700,
                    letterSpacing: '-0.02em'
                  }}
                >
                  {item.subtitle}
              </div>
            </div>
            
              {/* Step indicator - bottom right (i button or checkmark) */}
              {!isCompleted ? (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    openHowTo(index)();
                  }}
                  className="absolute transition-all duration-300 hover:scale-110 active:scale-95"
                  style={{
                    position: 'absolute',
                    right: '16px',
                    bottom: '16px',
                    width: '36px',
                    height: '36px',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '18px',
                    fontWeight: 700,
                    backgroundColor: 'transparent',
                    border: '1.8px solid #0F766E',
                    color: '#0F766E',
                    fontFamily: "'Manrope', -apple-system, BlinkMacSystemFont, sans-serif",
                    zIndex: 10,
                    pointerEvents: 'auto'
                  }}
                >
                  i
                </button>
              ) : (
                <div
                  className="absolute"
                  style={{
                    position: 'absolute',
                    right: '16px',
                    bottom: '16px',
                    width: '36px',
                    height: '36px',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '18px',
                    fontWeight: 300,
                    backgroundColor: '#0F766E',
                    color: 'white',
                    border: 'none',
                    animation: 'fadeInUp 0.3s ease',
                    fontFamily: "'Manrope', -apple-system, BlinkMacSystemFont, sans-serif"
                  }}
                >
                  ✓
                    </div>
                )}
            </button>
              </div>
          );
        })}
      </main>

      {/* Action Buttons - after cards */}
      <div className="mt-6 mb-6 relative z-10 flex gap-3" style={{ 
        marginTop: '32px', 
        marginBottom: '24px',
        paddingLeft: '20px',
        paddingRight: '20px'
      }}>
        <button
          onClick={() => navigate("/plan")}
          className="flex-1 h-12 px-5 rounded-[16px] font-semibold text-base transition-all duration-200 hover:opacity-90 active:scale-95 border"
          style={{
            background: 'transparent',
            border: '1.5px solid #0F766E',
            color: '#0F766E',
            fontFamily: "'Manrope', -apple-system, BlinkMacSystemFont, sans-serif",
            fontWeight: 600
          }}
        >
          Подробный план ухода →
          </button>
          <button 
            onClick={() => navigate("/quiz")}
          className="flex-1 h-12 px-5 rounded-[16px] font-semibold text-base transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
          style={{
            background: '#0F766E',
            color: 'white',
            border: 'none',
            fontFamily: "'Manrope', -apple-system, BlinkMacSystemFont, sans-serif",
            fontWeight: 600,
            boxShadow: '0 4px 12px rgba(15, 118, 110, 0.25)'
          }}
        >
          Пройти анкету заново →
          </button>
        </div>

      {/* Aura glow when all completed */}
      {completed === items.length && items.length > 0 && (
        <div 
          className="fixed inset-0 pointer-events-none z-20"
          style={{
            background: 'radial-gradient(circle at center, rgba(15, 118, 110, 0.1) 0%, transparent 70%)',
            animation: 'pulse 1.5s ease-in-out'
          }}
        />
      )}

      {/* Bottom Navigation - Premium Floating Glass Tab 2025 */}
      <nav 
        className="fixed flex justify-around items-center z-1000"
        style={{
          position: 'fixed',
          bottom: '14px',
          left: '16px',
          right: '16px',
          height: '76px',
          backgroundColor: 'rgba(255, 255, 255, 0.78)',
          backdropFilter: 'blur(40px)',
          WebkitBackdropFilter: 'blur(40px)',
          border: '1px solid rgba(15, 118, 110, 0.15)',
          borderRadius: '26px',
          boxShadow: '0 12px 32px rgba(0, 0, 0, 0.1), 0 2px 8px rgba(0, 0, 0, 0.04)',
          padding: '0 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-around',
          zIndex: 1000,
          paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 0px)'
        }}
      >
        {/* Home */}
        <button 
          onClick={() => navigate("/")}
          className="flex flex-col items-center justify-center gap-1 transition-all duration-200 relative"
          style={{ 
            color: location.pathname === '/' ? '#0F766E' : '#94A3B8',
            minWidth: '60px',
            position: 'relative'
          }}
        >
          {location.pathname === '/' && (
            <div 
              className="absolute -top-1 left-1/2 transform -translate-x-1/2"
              style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                backgroundColor: '#0F766E'
              }}
            />
          )}
          <svg 
            viewBox="0 0 24 24" 
            width="24" 
            height="24" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="2" 
            strokeLinecap="round" 
            strokeLinejoin="round"
            style={{ 
              stroke: location.pathname === '/' ? '#0F766E' : '#94A3B8',
              fill: 'none'
            }}
          >
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
            <polyline points="9 22 9 12 15 12 15 22" />
          </svg>
          <span 
            className="text-[11px] font-semibold"
            style={{
              color: location.pathname === '/' ? '#0F766E' : '#94A3B8',
              fontFamily: "'Manrope', -apple-system, BlinkMacSystemFont, sans-serif",
              fontWeight: 600
            }}
          >
            Главная
          </span>
        </button>
        
        {/* Plan */}
        <button 
          onClick={() => navigate("/plan")}
          className="flex flex-col items-center justify-center gap-1 transition-all duration-200 relative"
          style={{ 
            color: location.pathname === '/plan' ? '#0F766E' : '#94A3B8',
            minWidth: '60px',
            position: 'relative'
          }}
        >
          {location.pathname === '/plan' && (
            <div 
              className="absolute -top-1 left-1/2 transform -translate-x-1/2"
              style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                backgroundColor: '#0F766E'
              }}
            />
          )}
          <svg 
            viewBox="0 0 24 24" 
            width="24" 
            height="24" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="2" 
            strokeLinecap="round" 
            strokeLinejoin="round"
            style={{ 
              stroke: location.pathname === '/plan' ? '#0F766E' : '#94A3B8',
              fill: 'none'
            }}
          >
            <path d="M8 6h13" />
            <path d="M8 12h13" />
            <path d="M8 18h13" />
            <path d="M3 6h.01" />
            <path d="M3 12h.01" />
            <path d="M3 18h.01" />
                </svg>
          <span 
            className="text-[11px] font-semibold"
            style={{
              color: location.pathname === '/plan' ? '#0F766E' : '#94A3B8',
              fontFamily: "'Manrope', -apple-system, BlinkMacSystemFont, sans-serif",
              fontWeight: 600
            }}
          >
            План
          </span>
        </button>
        
        {/* Cart */}
        <button 
          onClick={() => navigate("/cart")}
          className="flex flex-col items-center justify-center gap-1 transition-all duration-200 relative"
          style={{ 
            color: location.pathname === '/cart' ? '#0F766E' : '#94A3B8',
            minWidth: '60px',
            position: 'relative'
          }}
        >
          {location.pathname === '/cart' && (
            <div 
              className="absolute -top-1 left-1/2 transform -translate-x-1/2"
              style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                backgroundColor: '#0F766E'
              }}
            />
          )}
          <svg 
            viewBox="0 0 24 24" 
            width="24" 
            height="24" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="2" 
            strokeLinecap="round" 
            strokeLinejoin="round"
            style={{ 
              stroke: location.pathname === '/cart' ? '#0F766E' : '#94A3B8',
              fill: 'none'
            }}
          >
            <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
            <line x1="3" y1="6" x2="21" y2="6" />
            <path d="M16 10a4 4 0 0 1-8 0" />
          </svg>
          <span 
            className="text-[11px] font-semibold"
            style={{
              color: location.pathname === '/cart' ? '#0F766E' : '#94A3B8',
              fontFamily: "'Manrope', -apple-system, BlinkMacSystemFont, sans-serif",
              fontWeight: 600
            }}
          >
            Корзина
          </span>
        </button>
        
        {/* Profile */}
        <button 
          onClick={() => navigate("/profile")}
          className="flex flex-col items-center justify-center gap-1 transition-all duration-200 relative"
          style={{ 
            color: location.pathname === '/profile' ? '#0F766E' : '#94A3B8',
            minWidth: '60px',
            position: 'relative'
          }}
        >
          {location.pathname === '/profile' && (
            <div 
              className="absolute -top-1 left-1/2 transform -translate-x-1/2"
              style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                backgroundColor: '#0F766E'
              }}
            />
          )}
          <svg 
            viewBox="0 0 24 24" 
            width="24" 
            height="24" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="2" 
            strokeLinecap="round" 
            strokeLinejoin="round"
            style={{ 
              stroke: location.pathname === '/profile' ? '#0F766E' : '#94A3B8',
              fill: 'none'
            }}
          >
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
          <span 
            className="text-[11px] font-semibold"
            style={{
              color: location.pathname === '/profile' ? '#0F766E' : '#94A3B8',
              fontFamily: "'Manrope', -apple-system, BlinkMacSystemFont, sans-serif",
              fontWeight: 600
            }}
          >
            Профиль
          </span>
        </button>
      </nav>

      {/* BottomSheet */}
      <BottomSheet open={sheetOpen} onClose={() => setSheetOpen(false)} item={sheetItem} />
            </div>
  );
}
