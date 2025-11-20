import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import OnboardingScreen from "./OnboardingScreen";
import { logger } from "../utils/logger";
import { storage } from "../utils/storage";
import { tg } from "../lib/tg";
import SkinIQLogo from "../components/SkinIQLogo";

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
  // Early returns for safety
  if (!open || !item) return null;
  if (!item.howto) {
    logger.warn('BottomSheet: item.howto is missing', item);
    return null;
  }
  
  return (
    <div 
      className="fixed inset-0" 
        style={{ 
        zIndex: 2000,
        display: open ? 'block' : 'none'
      }}
    >
      <div 
        className="absolute inset-0 bg-black/20 backdrop-blur-sm" 
        onClick={onClose}
        style={{
          animation: 'fadeIn 200ms ease-out'
        }}
      />
      <div 
        className="absolute left-0 right-0 bottom-0 max-h-[85vh] overflow-y-auto"
        style={{ 
          position: 'fixed',
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(250, 251, 253, 0.92)',
          backdropFilter: 'blur(32px)',
          WebkitBackdropFilter: 'blur(32px)',
          borderTopLeftRadius: '28px',
          borderTopRightRadius: '28px',
          borderTop: '1px solid rgba(15, 118, 110, 0.12)',
          boxShadow: '0 -8px 32px rgba(0,0,0,0.08)',
          padding: '24px 20px',
          paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 24px)',
          maxHeight: '85vh',
          animation: 'sheetUp 300ms cubic-bezier(0.22, 1, 0.36, 1)',
          zIndex: 2001
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
              className="w-14 h-14 rounded-2xl object-contain flex-shrink-0"
              style={{ borderRadius: '14px', backgroundColor: 'rgba(255, 255, 255, 0.5)' }}
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
  const [hasCompletedQuiz, setHasCompletedQuiz] = useState<boolean | null>(null);
  const [tab, setTab] = useState<"AM" | "PM">("AM");
  const [morning, setMorning] = useState<RoutineItem[]>(morningDefault);
  const [evening, setEvening] = useState<RoutineItem[]>(eveningDefault);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetItem, setSheetItem] = useState<RoutineItem | null>(null);
  const [greeting, setGreeting] = useState('');
  const [userName, setUserName] = useState('друг');
  const [confetti, setConfetti] = useState<Array<{id: number, x: number, y: number}>>([]);
  const [ripples, setRipples] = useState<Array<{id: number, x: number, y: number}>>([]);
  const [hintShown, setHintShown] = useState(false);

  // Check if quiz is completed
  useEffect(() => {
    try {
      const quizDone = storage.get<boolean>('skinQuizCompleted', false);
      setHasCompletedQuiz(quizDone);
      
      // Check if hint was shown
      const hintWasShown = storage.get<boolean>('firstStepHintShown', false);
      setHintShown(hintWasShown);
      
      // Telegram ready
      if (tg) {
        tg.ready();
        tg.expand();
      }
    } catch (error) {
      logger.error('Error checking quiz status:', error);
      setHasCompletedQuiz(false);
    }
  }, []);

  // Personalization: get greeting and user name
  useEffect(() => {
    try {
      // Get name from Telegram
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
      logger.error('Error setting greeting:', error);
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
      // Confetti animation
      const particles = Array.from({ length: 12 }, (_, i) => ({
        id: Date.now() + i,
        x: Math.random() * 100,
        y: Math.random() * 100
      }));
      setConfetti(particles);
      setTimeout(() => setConfetti([]), 800);
      
      // Haptic feedback
      if (navigator.vibrate) {
        navigator.vibrate([100, 50, 100]);
      }
    }
  }, [tab, morning, evening, hasCompletedQuiz]);

  // Conditional rendering - must be after all hooks
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

  if (!hasCompletedQuiz) {
    return <OnboardingScreen />;
  }

  // Calculate items and completed only after we know quiz is completed
  const items = tab === "AM" ? morning : evening;
  const completed = items?.filter((i) => i.done)?.length || 0;

  const toggleAt = (idx: number) => (e?: React.MouseEvent) => {
    try {
      const currentItems = tab === "AM" ? morning : evening;
      if (!currentItems || idx < 0 || idx >= currentItems.length) {
        logger.warn('toggleAt: invalid index or items', { idx, itemsLength: currentItems?.length });
        return;
      }
      
      // Ripple effect on tap
      if (e) {
        const rect = e.currentTarget.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 100;
        const y = ((e.clientY - rect.top) / rect.height) * 100;
        const newRipple = { id: Date.now(), x, y };
        setRipples(prev => [...prev, newRipple]);
        setTimeout(() => {
          setRipples(prev => prev.filter(r => r.id !== newRipple.id));
        }, 600);
      }
      
      const newItems = [...currentItems];
      newItems[idx] = { ...newItems[idx], done: !newItems[idx].done };
    if (tab === "AM") {
        setMorning(newItems);
        try {
          storage.set('morningRoutine', newItems);
        } catch (e) {
          logger.error('Error saving morning routine:', e);
        }
      } else {
        setEvening(newItems);
        try {
          storage.set('eveningRoutine', newItems);
        } catch (e) {
          logger.error('Error saving evening routine:', e);
        }
      }
      
      // Haptic feedback
      if (navigator.vibrate) {
        navigator.vibrate(50);
      }
    } catch (error) {
      logger.error('Error toggling item:', error);
    }
    
    // Hide hint after first interaction
    if (!hintShown && idx === 0) {
      storage.set('firstStepHintShown', true);
      setHintShown(true);
    }
  };

  const openHowTo = (idx: number) => () => {
    try {
      const currentItems = tab === "AM" ? morning : evening;
      if (!currentItems || idx < 0 || idx >= currentItems.length) {
        logger.warn('openHowTo: invalid index or items', { idx, itemsLength: currentItems?.length });
        return;
      }
      const selectedItem = currentItems[idx];
      if (selectedItem && selectedItem.howto) {
        setSheetItem(selectedItem);
    setSheetOpen(true);
      } else {
        logger.warn('openHowTo: item or howto is missing', { idx, item: selectedItem });
      }
    } catch (error) {
      logger.error('Error opening how-to:', error);
    }
  };

  // Celebration confetti when all completed
  useEffect(() => {
    if (hasCompletedQuiz !== true) return;
    
    const currentItems = tab === "AM" ? morning : evening;
    const currentCompleted = currentItems?.filter((i) => i.done)?.length || 0;
    
    if (currentItems && currentItems.length > 0 && currentCompleted === currentItems.length) {
      // Confetti animation
      const particles = Array.from({ length: 12 }, (_, i) => ({
        id: Date.now() + i,
        x: Math.random() * 100,
        y: Math.random() * 100
      }));
      setConfetti(particles);
      setTimeout(() => setConfetti([]), 800);
      
      // Haptic feedback
      if (navigator.vibrate) {
        navigator.vibrate([100, 50, 100]);
      }
    }
  }, [tab, morning, evening, hasCompletedQuiz]);

  return (
    <div
      className="w-full min-h-screen relative overflow-x-hidden"
      style={{ 
        paddingBottom: '120px'
      }}
    >
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes sheetUp { 
          from { 
            transform: translateY(100%); 
            opacity: 0; 
          } 
          to { 
            transform: translateY(0); 
            opacity: 1; 
          } 
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
        @keyframes livingGradient {
          0% {
            background-position: 0% 50%;
          }
          50% {
            background-position: 100% 50%;
          }
          100% {
            background-position: 0% 50%;
          }
        }
        @keyframes meshGradient {
          0% {
            background-position: 0% 0%, 50% 50%, 100% 100%;
          }
          33% {
            background-position: 100% 0%, 0% 50%, 0% 100%;
          }
          66% {
            background-position: 100% 100%, 50% 0%, 0% 50%;
          }
          100% {
            background-position: 0% 0%, 50% 50%, 100% 100%;
          }
        }
        @keyframes radialWave {
          0% {
            transform: scale(0.8);
            opacity: 0.12;
          }
          50% {
            transform: scale(1.2);
            opacity: 0.08;
          }
          100% {
            transform: scale(0.8);
            opacity: 0.12;
          }
        }
        @keyframes greenFlash {
          0%, 100% {
            opacity: 0;
          }
          50% {
            opacity: 0.15;
          }
        }
        @keyframes ripple {
          0% {
            transform: scale(0);
            opacity: 1;
          }
          100% {
            transform: scale(2);
            opacity: 0;
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
        @keyframes cardAppear {
          from {
            opacity: 0;
            transform: translateY(30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          } 
        }
      `}</style>

      {/* Mesh gradient background with animated circles */}
      <div 
        className="fixed inset-0 -z-10 overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, #E8FBF7 0%, #E0FAF5 25%, #E8FDFA 50%, #D8F7F0 75%, #E8FBF7 100%)',
          backgroundSize: '200% 200%',
          animation: 'meshGradient 35s ease infinite'
        }}
      >
        {/* Animated radial waves from center */}
        <div
          className="absolute"
          style={{
            top: '30%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: '120vw',
            height: '120vw',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(192, 245, 232, 0.12) 0%, transparent 70%)',
            animation: 'radialWave 8s ease-in-out infinite',
            pointerEvents: 'none'
          }}
        />
        <div
          className="absolute"
          style={{
            top: '40%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: '160vw',
            height: '160vw',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(10, 95, 89, 0.08) 0%, transparent 70%)',
            animation: 'radialWave 12s ease-in-out infinite 2s',
            pointerEvents: 'none'
          }}
        />
        
        {/* Green flash on completion */}
        {completed === items.length && items.length > 0 && (
          <div
            className="absolute inset-0"
            style={{
              background: 'radial-gradient(circle at center, rgba(10, 95, 89, 0.15) 0%, transparent 70%)',
              animation: 'greenFlash 2s ease-out',
              pointerEvents: 'none',
              zIndex: 1
            }}
          />
        )}
      </div>

      {/* Confetti particles */}
      {confetti.map(particle => (
        <div
          key={particle.id}
          className="fixed pointer-events-none z-50"
          style={{
            left: `${particle.x}%`,
            top: `${particle.y}%`,
            width: '8px',
            height: '8px',
            backgroundColor: '#0A5F59',
            borderRadius: '50%',
            animation: 'confetti 0.8s ease-out forwards',
            boxShadow: '0 0 8px rgba(10, 95, 89, 0.5)'
          }}
        />
      ))}

      {/* Header - Logo */}
      <header 
        className="flex items-center justify-center px-5 pt-5 pb-3 relative z-10"
        style={{ animation: 'cardAppear 0.4s ease-out', animationDelay: '0ms' }}
      >
        <SkinIQLogo size={32} />
      </header>

      {/* Premium Greeting Glass Card - 35% screen height */}
      <div 
        className="mx-5 mb-4 p-6 relative z-10 rounded-[36px]"
        style={{
          height: '35vh',
          maxHeight: '280px',
          minHeight: '240px',
          backgroundColor: 'rgba(255, 255, 255, 0.58)',
          backdropFilter: 'blur(22px)',
          WebkitBackdropFilter: 'blur(22px)',
          border: '1px solid rgba(255, 255, 255, 0.15)', // #26FFFFFF = rgba(255,255,255,0.15)
          borderRadius: '36px',
          boxShadow: '0 12px 40px rgba(0,0,0,0.08)',
          display: 'flex',
          alignItems: 'center',
          gap: '20px',
          animation: 'cardAppear 0.5s ease-out',
          animationDelay: '80ms',
          animationFillMode: 'backwards'
        }}
      >
        {/* Avatar - 56dp с тонкой обводкой */}
        <div
          style={{
            width: '56px',
            height: '56px',
            borderRadius: '50%',
            border: '1px solid #0A5F59', // Тонкая обводка
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            backgroundColor: 'rgba(10, 95, 89, 0.08)',
            fontSize: '24px',
            fontFamily: "'Manrope', -apple-system, BlinkMacSystemFont, sans-serif",
            fontWeight: 700,
            color: '#0A5F59'
          }}
        >
          {userName.charAt(0).toUpperCase()}
          </div>
          
        {/* Greeting Text */}
        <div className="flex-1 min-w-0">
          <div 
            className="text-[28px] font-bold leading-tight mb-1"
            style={{
              color: '#0A5F59',
              fontFamily: "'Satoshi', 'Manrope', -apple-system, BlinkMacSystemFont, sans-serif",
              fontWeight: 700,
              lineHeight: 1.2
            }}
          >
            {greeting || 'Добрый день'}, {userName}
            </div>
          <div 
            className="text-[17px] font-medium"
            style={{
              color: '#475467',
              fontFamily: "'Manrope', -apple-system, BlinkMacSystemFont, sans-serif",
              fontWeight: 500
            }}
          >
            Ваш {tab === "AM" ? "утренний" : "вечерний"} ритуал готов · {items.length} шаг{items.length > 1 ? (items.length < 5 ? "а" : "ов") : ""}
          </div>
        </div>
      </div>

      {/* Glass Tab Switcher */}
      <div 
        className="mb-4 relative z-10" 
        style={{ 
          paddingLeft: '24px', 
          paddingRight: '24px',
          animation: 'cardAppear 0.5s ease-out',
          animationDelay: '160ms',
          animationFillMode: 'backwards'
        }}
      >
        <div 
          className="inline-flex rounded-full p-0.5"
          style={{
            backgroundColor: 'rgba(255, 255, 255, 0.4)',
            backdropFilter: 'blur(18px)',
            WebkitBackdropFilter: 'blur(18px)',
            border: '1px solid rgba(255, 255, 255, 0.3)',
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
                      background: '#0A5F59',
                      color: 'white',
                      fontFamily: "'Manrope', -apple-system, BlinkMacSystemFont, sans-serif",
                      fontWeight: 600,
                      border: 'none'
                    }
                  : { 
                      color: '#0A5F59',
                      backgroundColor: 'transparent',
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

      {/* Title Glass Strip */}
      <div 
        className="flex justify-between items-center mx-5 mb-4 px-5 relative z-10 rounded-[24px]"
        style={{
          height: '72px',
          backgroundColor: 'rgba(255, 255, 255, 0.55)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: '1px solid rgba(255, 255, 255, 0.4)',
          borderRadius: '24px',
          boxShadow: '0 8px 24px rgba(0,0,0,0.06)',
          animation: 'cardAppear 0.5s ease-out',
          animationDelay: '240ms',
          animationFillMode: 'backwards'
        }}
      >
        <h2 
          className="text-[32px] font-bold"
          style={{ 
            color: '#0A5F59',
            fontFamily: "'Satoshi', 'Manrope', -apple-system, BlinkMacSystemFont, sans-serif",
            fontWeight: 700,
            letterSpacing: '-0.02em'
          }}
        >
          {tab === "AM" ? "Morning Ritual" : "Evening Ritual"}
        </h2>
        <span 
          className="text-[18px] font-medium"
          style={{ 
            color: '#0A5F59',
            fontFamily: "'Manrope', -apple-system, BlinkMacSystemFont, sans-serif",
            fontWeight: 500
          }}
        >
          {completed}/{items.length} steps
        </span>
      </div>
      
      {/* Dermatologist Tip - Glass Card */}
      <div 
        className="mb-4 mx-5 p-4 rounded-[24px] border relative z-10 flex items-center gap-3"
        style={{
          backgroundColor: 'rgba(232, 253, 250, 0.7)', // #E8FDFA alpha 0.7
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderColor: 'rgba(10, 95, 89, 0.15)',
          borderWidth: '1px',
          borderRadius: '24px',
          boxShadow: '0 8px 24px rgba(0,0,0,0.06)',
          animation: 'cardAppear 0.5s ease-out',
          animationDelay: '320ms',
          animationFillMode: 'backwards'
        }}
      >
        {/* Tip icon in circle #0A5F59 */}
        <div 
          className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
          style={{
            width: '40px',
            height: '40px',
            borderRadius: '50%',
            backgroundColor: '#0A5F59',
            color: 'white',
            fontFamily: "'Manrope', -apple-system, BlinkMacSystemFont, sans-serif",
            fontWeight: 700,
            fontSize: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          💡
        </div>
        <p 
          className="text-[17px] leading-relaxed flex-1"
          style={{
            fontSize: '17px',
            color: '#1F2A44',
            fontFamily: "'Manrope', -apple-system, BlinkMacSystemFont, sans-serif",
            fontWeight: 400,
            lineHeight: 1.5
          }}
        >
          Сегодня идеальная влажность — после тонера подождите 60 секунд перед сывороткой
        </p>
      </div>
          
      {/* Steps */}
      <main className="pb-4 relative z-10" style={{ paddingLeft: '20px', paddingRight: '20px' }}>
        {items.map((item, index) => {
          const isCompleted = item.done;
          const isFirstUncompleted = index === 0 && !isCompleted && !hintShown;
          return (
          <div key={item.id} className="relative" style={{ marginBottom: index < items.length - 1 ? '14px' : '20px' }}>
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
              onClick={(e) => {
                toggleAt(index)(e);
              }}
              onDoubleClick={openHowTo(index)}
              className={`w-full flex items-center backdrop-blur-[20px] border rounded-[24px] transition-all duration-300 relative overflow-hidden ${
                isCompleted ? 'completed' : ''
              }`}
              style={{
                height: '96px',
                padding: '0 18px',
                animation: `cardAppear 0.5s ease-out backwards`,
                animationDelay: `${400 + index * 80}ms`,
                backgroundColor: 'rgba(255, 255, 255, 0.55)',
                WebkitBackdropFilter: 'blur(20px)',
                backdropFilter: 'blur(20px)',
                borderColor: 'rgba(255, 255, 255, 0.4)',
                borderWidth: '1px',
                borderRadius: '24px',
                boxShadow: '0 8px 24px rgba(0,0,0,0.06)'
              }}
            >
              {/* Ripple effects */}
              {ripples.filter(r => r.id > Date.now() - 600).map(ripple => (
                <div
                  key={ripple.id}
                  className="absolute pointer-events-none rounded-full"
                  style={{
                    left: `${ripple.x}%`,
                    top: `${ripple.y}%`,
                    width: '200px',
                    height: '200px',
                    backgroundColor: 'rgba(10, 95, 89, 0.15)',
                    transform: 'translate(-50%, -50%)',
                    animation: 'ripple 0.6s ease-out',
                    borderRadius: '50%'
                  }}
              />
            ))}

              {/* Left Circle - Step Number/Checkmark */}
              <div
                style={{
                  width: '56px',
                  height: '56px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  backgroundColor: isCompleted ? '#0A5F59' : 'transparent',
                  border: isCompleted ? 'none' : '2px solid #0A5F59',
                  marginRight: '16px',
                  fontSize: '24px',
                  fontFamily: "'Manrope', -apple-system, BlinkMacSystemFont, sans-serif",
                  fontWeight: 700,
                  color: isCompleted ? 'white' : '#0A5F59',
                  transition: 'all 0.3s ease'
                }}
              >
                {isCompleted ? '✓' : index + 1}
              </div>

              {/* Product Icon - 64dp without white background */}
              <img 
                src={item.icon} 
                alt={item.title}
                className="w-16 h-16 rounded-2xl object-contain flex-shrink-0"
                style={{ 
                  borderRadius: '16px', 
                  marginRight: '16px',
                  width: '64px',
                  height: '64px'
                }}
              />

              {/* Text Container */}
              <div className="flex-1 text-left min-w-0">
                <div 
                  className="text-[20px] font-bold truncate"
                  style={{ 
                    color: '#0A5F59',
                    fontFamily: "'Satoshi', 'Manrope', -apple-system, BlinkMacSystemFont, sans-serif",
                    fontWeight: 700,
                    letterSpacing: '-0.01em'
                  }}
                >
                  {item.title}
                </div>
                <div 
                  className="text-[15px] font-medium truncate mt-1"
                  style={{ 
                    color: '#475467',
                    fontFamily: "'Manrope', -apple-system, BlinkMacSystemFont, sans-serif",
                    fontWeight: 500
                  }}
                >
                  {item.subtitle}
          </div>
        </div>
          
              {/* Right Indicator - Info or Checkmark */}
              {!isCompleted ? (
          <button
                  onClick={(e) => {
                    e.stopPropagation();
                    openHowTo(index)();
                  }}
                  className="transition-all duration-300 hover:scale-110 active:scale-95 flex-shrink-0 self-center"
                  style={{
                    width: '26px',
                    height: '26px',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '12px',
                    fontWeight: 700,
                    backgroundColor: 'transparent',
                    border: '1.5px solid #0A5F59',
                    color: '#0A5F59',
                    fontFamily: "'Manrope', -apple-system, BlinkMacSystemFont, sans-serif",
                    zIndex: 10,
                    pointerEvents: 'auto',
                    marginLeft: '12px',
                    alignSelf: 'center'
                  }}
                >
                  i
                </button>
              ) : (
                <div
                  className="flex-shrink-0 self-center"
                  style={{
                    width: '26px',
                    height: '26px',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '16px',
                    fontWeight: 300,
                    backgroundColor: '#0A5F59', // Зелёная галочка (используем #0A5F59 как зелёный)
                    color: 'white',
                    border: 'none',
                    animation: 'fadeInUp 0.3s ease',
                    fontFamily: "'Manrope', -apple-system, BlinkMacSystemFont, sans-serif",
                    marginLeft: '12px',
                    alignSelf: 'center'
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
      <div className="mb-6 relative z-10 flex gap-3" style={{ 
        marginTop: '20px', 
        marginBottom: '24px',
        paddingLeft: '20px',
        paddingRight: '20px'
      }}>
        <button
          onClick={() => navigate("/plan")}
          className="flex-1 h-12 px-5 rounded-[16px] font-semibold text-base transition-all duration-200 hover:opacity-90 active:scale-95 border"
          style={{
            background: 'transparent',
            border: '1.5px solid #0A5F59',
            color: '#0A5F59',
            fontFamily: "'Manrope', -apple-system, BlinkMacSystemFont, sans-serif",
            fontWeight: 600,
            animation: 'cardAppear 0.5s ease-out backwards',
            animationDelay: `${400 + (items?.length || 0) * 80}ms`
          }}
        >
          Подробный план ухода →
          </button>
          <button 
            onClick={() => navigate("/quiz")}
          className="flex-1 h-12 px-5 rounded-[16px] font-semibold text-base transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
          style={{
            background: '#0A5F59',
            color: 'white',
            border: 'none',
            fontFamily: "'Manrope', -apple-system, BlinkMacSystemFont, sans-serif",
            fontWeight: 600,
            boxShadow: '0 4px 12px rgba(10, 95, 89, 0.25)',
            animation: 'cardAppear 0.5s ease-out backwards',
            animationDelay: `${400 + (items?.length || 0) * 80 + 80}ms`
          }}
        >
          Пройти анкету заново →
          </button>
        </div>

      {/* Aura glow when all completed - removed (handled in background) */}

      {/* BottomSheet */}
      <BottomSheet open={sheetOpen} onClose={() => setSheetOpen(false)} item={sheetItem} />
            </div>
  );
}
