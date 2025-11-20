import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import OnboardingScreen from "./OnboardingScreen";
import { logger } from "../utils/logger";
import { storage } from "../utils/storage";
import { tg } from "../lib/tg";

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
        <div className="mx-auto h-1 w-10 rounded-full mb-6" style={{ backgroundColor: '#CBD5E1' }} />
        
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
        
        <div className="mb-6">
          <div className="text-[14px] font-semibold mb-2" style={{ color: '#334155', fontFamily: "'Manrope', -apple-system, BlinkMacSystemFont, sans-serif" }}>Как выполнить</div>
          <ol className="list-decimal list-inside text-[15px] space-y-2" style={{ color: '#334155', lineHeight: '1.6', fontFamily: "'Manrope', -apple-system, BlinkMacSystemFont, sans-serif" }}>
            {item.howto?.steps?.map((s: string, i: number) => (
              <li key={i}>{s || ''}</li>
            )) || <li>Инструкции скоро появятся</li>}
          </ol>
            </div>
        
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
  const [ripples, setRipples] = useState<Array<{id: number, x: number, y: number, itemId: string}>>([]);
  const [hintShown, setHintShown] = useState(false);
  const [cardMounted, setCardMounted] = useState(false);
  const [gradientBright, setGradientBright] = useState(false);

  // Check if quiz is completed
  useEffect(() => {
    try {
      const quizDone = storage.get<boolean>('skinQuizCompleted', false);
      setHasCompletedQuiz(quizDone);
      
      const hintWasShown = storage.get<boolean>('firstStepHintShown', false);
      setHintShown(hintWasShown);
      
      if (tg) {
        tg.ready();
        tg.expand();
      }
      
      const savedMorning = storage.get<RoutineItem[]>('morningRoutine', morningDefault);
      const savedEvening = storage.get<RoutineItem[]>('eveningRoutine', eveningDefault);
      setMorning(savedMorning);
      setEvening(savedEvening);
      
      setTimeout(() => setCardMounted(true), 50);
    } catch (error) {
      logger.error('Error checking quiz status:', error);
      setHasCompletedQuiz(false);
    }
  }, []);

  // Personalization: get greeting and user name
  useEffect(() => {
    try {
      const user = tg?.initDataUnsafe?.user;
      if (user) {
        const firstName = user.first_name || '';
        const lastName = user.last_name || '';
        const fullName = lastName ? `${firstName} ${lastName}` : firstName || 'друг';
        setUserName(fullName);
      } else {
        setUserName('друг');
      }

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

  // Celebration when all completed
  useEffect(() => {
    if (hasCompletedQuiz !== true) return;
    
    const currentItems = tab === "AM" ? morning : evening;
    const currentCompleted = currentItems?.filter((i) => i.done)?.length || 0;
    
    if (currentItems && currentItems.length > 0 && currentCompleted === currentItems.length) {
      const particles = Array.from({ length: 12 }, (_, i) => ({
        id: Date.now() + i,
        x: Math.random() * 100,
        y: Math.random() * 100
      }));
      setConfetti(particles);
      setTimeout(() => setConfetti([]), 900);
      
      setGradientBright(true);
      setTimeout(() => setGradientBright(false), 2000);
      
      if (navigator.vibrate) {
        navigator.vibrate([100, 50, 100]);
      }
    }
  }, [tab, morning, evening, hasCompletedQuiz]);

  // Conditional rendering
  if (hasCompletedQuiz === null) {
    return (
      <div 
        className="min-h-screen flex items-center justify-center"
        style={{ background: 'linear-gradient(180deg, #F5FFFC 0%, #E8FBF7 100%)' }}
      >
        <div 
          className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
          style={{ 
            borderColor: '#0A5F59',
            borderTopColor: 'transparent'
          }}
        />
      </div>
    );
  }

  if (!hasCompletedQuiz) {
    return <OnboardingScreen />;
  }

  const items = tab === "AM" ? morning : evening;
  const completed = items?.filter((i) => i.done)?.length || 0;
  const total = items?.length || 0;

  const toggleAt = (idx: number) => (e?: React.MouseEvent) => {
    try {
      const currentItems = tab === "AM" ? morning : evening;
      if (!currentItems || idx < 0 || idx >= currentItems.length) {
        logger.warn('toggleAt: invalid index or items', { idx, itemsLength: currentItems?.length });
        return;
      }
      
      if (e) {
        const rect = e.currentTarget.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 100;
        const y = ((e.clientY - rect.top) / rect.height) * 100;
        const newRipple = { id: Date.now(), x, y, itemId: currentItems[idx].id };
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
      
      if (navigator.vibrate) {
        navigator.vibrate(50);
      }
    } catch (error) {
      logger.error('Error toggling item:', error);
    }
    
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

  const getAdvice = () => {
    if (tab === "AM") {
      return "Для утреннего ухода важно не пересушить кожу. Используйте мягкие очищающие средства и обязательно SPF.";
    }
    return "Вечером уделите внимание восстановлению кожи. Двойное очищение и увлажняющий крем — ваши друзья.";
  };

  return (
    <>
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
        @keyframes cardAppear {
          from { 
            opacity: 0;
            transform: scale(0.96);
          }
          to { 
            opacity: 1;
            transform: scale(1);
          }
        }
        @keyframes ripple {
          0% {
            transform: scale(0);
            opacity: 1;
          } 
          100% {
            transform: scale(4);
            opacity: 0;
          }
        }
        @keyframes confettiFall {
          0% {
            transform: translateY(0) rotate(0deg);
            opacity: 1;
          }
          100% {
            transform: translateY(100vh) rotate(360deg);
            opacity: 0;
          } 
        }
      `}</style>

      <div
        className="w-full min-h-screen relative overflow-x-hidden"
        style={{ 
          paddingBottom: '120px',
          background: gradientBright 
            ? 'linear-gradient(180deg, #E0FAF5 0%, #D0F5EB 100%)'
            : 'linear-gradient(180deg, #F5FFFC 0%, #E8FBF7 100%)',
          transition: 'background 2s ease-out'
        }}
      >
        {/* Confetti */}
        {confetti.map((particle) => (
          <div
            key={particle.id}
            style={{
              position: 'fixed',
              left: `${particle.x}%`,
              top: `${particle.y}%`,
              width: '8px',
              height: '8px',
              backgroundColor: '#0A5F59',
              borderRadius: '50%',
              pointerEvents: 'none',
              zIndex: 3000,
              animation: 'confettiFall 0.9s ease-out forwards',
              transform: `translate(${Math.random() * 40 - 20}px, ${Math.random() * 40 - 20}px)`
            }}
          />
        ))}

        {/* Main Content - Large Glass Card (90% width, 5% margins, radius 40dp top, 0dp bottom) */}
        <div
          style={{
            width: '90%',
            maxWidth: '600px',
            margin: '20px auto 0 auto',
            backgroundColor: 'rgba(255, 255, 255, 0.58)',
            backdropFilter: 'blur(26px)',
            WebkitBackdropFilter: 'blur(26px)',
            border: '1px solid rgba(255, 255, 255, 0.15)', // #26FFFFFF = rgba(255,255,255,0.15)
            borderRadius: '40px 40px 0 0',
            padding: '24px 20px 32px 20px',
            boxShadow: '0 16px 48px rgba(0, 0, 0, 0.08)',
            opacity: cardMounted ? 1 : 0,
            transform: cardMounted ? 'scale(1)' : 'scale(0.96)',
            transition: 'opacity 0.6s ease-out, transform 0.6s ease-out',
            display: 'flex',
            flexDirection: 'column',
            gap: '20px'
          }}
        >
          {/* Header - Greeting with Avatar (64dp circle with 2dp border) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                border: '2px solid #0A5F59',
                backgroundColor: '#E8FDFA',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                backgroundImage: `url('https://ui-avatars.com/api/?name=${encodeURIComponent(userName)}&background=0A5F59&color=fff&size=64')`,
                backgroundSize: 'cover',
                backgroundPosition: 'center'
              }}
            />
            <div style={{ flex: 1 }}>
              <div
                style={{
                  fontFamily: "'Satoshi', 'Manrope', -apple-system, BlinkMacSystemFont, sans-serif",
                  fontWeight: 700,
                  fontSize: '28px',
                  color: '#0A5F59',
                  lineHeight: '1.2',
                  marginBottom: '4px'
                }}
              >
                {greeting}, {userName}
          </div>
              <div
                style={{
                  fontFamily: "'Manrope', -apple-system, BlinkMacSystemFont, sans-serif",
                  fontWeight: 400,
                  fontSize: '16px',
                  color: '#475467',
                  lineHeight: '1.4'
                }}
              >
                Ваш {tab === "AM" ? "утренний" : "вечерний"} ритуал готов · {total} шагов
          </div>
        </div>
      </div>

          {/* Toggle - AM/PM (glass-segmented) */}
          <div
            style={{
              display: 'flex',
              backgroundColor: 'rgba(255, 255, 255, 0.4)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              borderRadius: '16px',
              padding: '4px',
              gap: '4px'
            }}
          >
            <button
              onClick={() => setTab("AM")}
              style={{
                flex: 1,
                padding: '12px 20px',
                borderRadius: '12px',
                border: 'none',
                backgroundColor: tab === "AM" ? '#0A5F59' : 'transparent',
                color: tab === "AM" ? 'white' : '#0A5F59',
                fontFamily: "'Manrope', -apple-system, BlinkMacSystemFont, sans-serif",
                fontWeight: 600,
                fontSize: '16px',
                cursor: 'pointer',
                transition: 'all 0.2s ease-out'
              }}
            >
              Утро
            </button>
            <button
              onClick={() => setTab("PM")}
              style={{
                flex: 1,
                padding: '12px 20px',
                borderRadius: '12px',
                border: 'none',
                backgroundColor: tab === "PM" ? '#0A5F59' : 'transparent',
                color: tab === "PM" ? 'white' : '#0A5F59',
                fontFamily: "'Manrope', -apple-system, BlinkMacSystemFont, sans-serif",
                fontWeight: 600,
                fontSize: '16px',
                cursor: 'pointer',
                transition: 'all 0.2s ease-out'
              }}
            >
              Вечер
            </button>
        </div>

          {/* Title Strip - Morning/Evening Ritual (thin glass strip, radius 28dp) */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              backgroundColor: 'rgba(255, 255, 255, 0.55)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              borderRadius: '28px',
              padding: '16px 20px',
              border: '1px solid rgba(255, 255, 255, 0.3)'
            }}
          >
            <div
              style={{
                fontFamily: "'Satoshi', 'Manrope', -apple-system, BlinkMacSystemFont, sans-serif",
                fontWeight: 700,
                fontSize: '34px',
                color: '#0A5F59'
              }}
            >
              {tab === "AM" ? "Morning Ritual" : "Evening Ritual"}
            </div>
            <div
              style={{
                fontFamily: "'Manrope', -apple-system, BlinkMacSystemFont, sans-serif",
                fontWeight: 500,
                fontSize: '17px',
                color: '#0A5F59'
              }}
            >
              {completed}/{total} steps
          </div>
        </div>
          
          {/* Tip Card (separate glass card #E8FDFA alpha 0.7, radius 28dp) */}
          <div
            style={{
              backgroundColor: 'rgba(232, 253, 250, 0.7)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              borderRadius: '28px',
              padding: '16px 20px',
              border: '1px solid rgba(10, 95, 89, 0.15)',
              display: 'flex',
              gap: '12px',
              alignItems: 'flex-start'
            }}
          >
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                backgroundColor: '#0A5F59',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                <path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32l1.41 1.41M2 12h2m16 0h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
              </svg>
            </div>
            <div
              style={{
                fontFamily: "'Manrope', -apple-system, BlinkMacSystemFont, sans-serif",
                fontWeight: 400,
                fontSize: '17px',
                color: '#1F2A44',
                lineHeight: '1.5',
                flex: 1
              }}
            >
              {getAdvice()}
        </div>
          </div>

          {/* Routine Steps - Inside Card (104dp height rows, NOT separate cards) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {items.map((item, idx) => {
              const isCompleted = item.done;
              const showRipple = ripples.find(r => r.itemId === item.id);
              
              return (
                <div
                  key={item.id}
                  onClick={toggleAt(idx)}
                  style={{
                    height: '104px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '16px',
                    padding: '0 4px',
                    cursor: 'pointer',
                    position: 'relative',
                    opacity: isCompleted ? 0.7 : 1,
                    textDecoration: isCompleted ? 'line-through' : 'none',
                    textDecorationColor: '#0A5F59',
                    transition: 'opacity 0.2s ease-out'
                  }}
                >
                  {/* Ripple Effect */}
                  {showRipple && (
                    <div
                      style={{
                        position: 'absolute',
                        left: `${showRipple.x}%`,
                        top: `${showRipple.y}%`,
                        width: '40px',
                        height: '40px',
                        borderRadius: '50%',
                        backgroundColor: 'rgba(10, 95, 89, 0.3)',
                        transform: 'translate(-50%, -50%)',
                        pointerEvents: 'none',
                        animation: 'ripple 0.6s ease-out',
                        zIndex: 1
                      }}
                    />
                  )}

                  {/* Step Number Circle (56dp) */}
                  <div
                    style={{
                      width: '56px',
                      height: '56px',
                      borderRadius: '50%',
                      backgroundColor: isCompleted ? '#0A5F59' : 'transparent',
                      border: isCompleted ? 'none' : '2px solid #0A5F59',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      fontFamily: "'Manrope', -apple-system, BlinkMacSystemFont, sans-serif",
                      fontWeight: 700,
                      fontSize: '20px',
                      color: isCompleted ? 'white' : '#0A5F59',
                      position: 'relative',
                      transition: 'all 0.3s ease-out',
                      transform: isCompleted ? 'scale(1.1)' : 'scale(1)'
                    }}
                  >
                    {isCompleted ? '✓' : idx + 1}
              </div>
              
                  {/* Product Icon (72dp, no white background) */}
                  {item.icon && (
                    <img
                      src={item.icon}
                      alt={item.title}
                      style={{
                        width: '72px',
                        height: '72px',
                        borderRadius: '16px',
                        objectFit: 'contain',
                        flexShrink: 0
                      }}
                    />
                  )}

                  {/* Text Content */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontFamily: "'Satoshi', 'Manrope', -apple-system, BlinkMacSystemFont, sans-serif",
                        fontWeight: 700,
                        fontSize: '21px',
                        color: '#0A5F59',
                        marginBottom: '4px',
                        lineHeight: '1.3'
                      }}
                    >
                      {item.title}
                  </div>
                    <div
                      style={{
                        fontFamily: "'Manrope', -apple-system, BlinkMacSystemFont, sans-serif",
                        fontWeight: 400,
                        fontSize: '16px',
                        color: '#475467',
                        lineHeight: '1.4'
                      }}
                    >
                      {item.subtitle}
                </div>
              </div>

                  {/* Info Button (i circle #0A5F59) */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      openHowTo(idx)();
                    }}
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '50%',
                      border: '1.5px solid #0A5F59',
                      backgroundColor: 'transparent',
                      color: '#0A5F59',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      flexShrink: 0,
                      fontFamily: "'Manrope', -apple-system, BlinkMacSystemFont, sans-serif",
                      fontWeight: 700,
                      fontSize: '14px',
                      transition: 'all 0.2s ease-out'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = '#0A5F59';
                      e.currentTarget.style.color = 'white';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                      e.currentTarget.style.color = '#0A5F59';
                    }}
                  >
                    i
                  </button>
                </div>
              );
            })}
                </div>

          {/* Action Buttons (inside card, 2 buttons in row, height 62dp, radius 31dp) */}
          <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
            <button
              onClick={() => navigate('/plan')}
              style={{
                flex: 1,
                height: '62px',
                borderRadius: '31px',
                border: '2px solid #0A5F59',
                backgroundColor: 'transparent',
                color: '#0A5F59',
                fontFamily: "'Manrope', -apple-system, BlinkMacSystemFont, sans-serif",
                fontWeight: 600,
                fontSize: '16px',
                cursor: 'pointer',
                transition: 'all 0.2s ease-out'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(10, 95, 89, 0.1)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              Подробный план ухода →
            </button>
            <button
              onClick={() => {
                storage.remove('skinQuizCompleted');
                navigate('/quiz');
              }}
              style={{
                flex: 1,
                height: '62px',
                borderRadius: '31px',
                border: 'none',
                backgroundColor: '#0A5F59',
                color: 'white',
                fontFamily: "'Manrope', -apple-system, BlinkMacSystemFont, sans-serif",
                fontWeight: 600,
                fontSize: '16px',
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(10, 95, 89, 0.25)',
                transition: 'all 0.2s ease-out'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'scale(1.02)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'scale(1)';
              }}
            >
              Пройти анкету заново →
            </button>
              </div>
                    </div>

        {/* First Step Hint */}
        {!hintShown && items.length > 0 && !items[0].done && (
          <div
            style={{
              position: 'fixed',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              backgroundColor: 'rgba(10, 95, 89, 0.95)',
              color: 'white',
              padding: '16px 24px',
              borderRadius: '20px',
              fontFamily: "'Manrope', -apple-system, BlinkMacSystemFont, sans-serif",
              fontSize: '14px',
              fontWeight: 500,
              zIndex: 2000,
              animation: 'pulse 2s infinite',
              pointerEvents: 'none'
            }}
          >
            Нажмите, чтобы отметить выполненным
              </div>
        )}

        {/* BottomSheet */}
      <BottomSheet open={sheetOpen} onClose={() => setSheetOpen(false)} item={sheetItem} />
            </div>
    </>
  );
}
