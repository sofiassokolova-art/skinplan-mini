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
    subtitle: "La Roche-Posay Toleriane",
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
    title: "SPF-защита",
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
          backgroundColor: 'rgba(250, 251, 253, 0.75)',
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
  
  // Сообщаем App.tsx о состоянии BottomSheet для скрытия навигации
  useEffect(() => {
    const event = new CustomEvent('bottomSheetToggle', { detail: { isOpen: sheetOpen } });
    window.dispatchEvent(event);
  }, [sheetOpen]);
  const [sheetItem, setSheetItem] = useState<RoutineItem | null>(null);
  const [greeting, setGreeting] = useState('');
  const [userName, setUserName] = useState('друг');
  const [ripples, setRipples] = useState<Array<{id: number, x: number, y: number, itemId: string}>>([]);
  const [hintShown, setHintShown] = useState(false);
  const [gradientBright, setGradientBright] = useState(false);
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);

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

  // Celebration when all completed (only once per tab)
  useEffect(() => {
    if (hasCompletedQuiz !== true) return;
    
    const currentItems = tab === "AM" ? morning : evening;
    const currentCompleted = currentItems?.filter((i) => i.done)?.length || 0;
    
    // Проверяем, показывалось ли уже сообщение успеха для этого таба
    const successShownKey = `successMessageShown_${tab}`;
    const successShown = storage.get<boolean>(successShownKey, false);
    
    if (currentItems && currentItems.length > 0 && currentCompleted === currentItems.length && !successShown) {
      // Золотисто-мятная вспышка вместо конфетти
      setGradientBright(true);
      setTimeout(() => setGradientBright(false), 2300); // Увеличено до 2.3s для более плавного перехода
      
      // Показываем плашку успеха
      setShowSuccessMessage(true);
      setTimeout(() => setShowSuccessMessage(false), 3000);
      
      // Сохраняем, что сообщение уже было показано для этого таба
      storage.set(successShownKey, true);
      
      // Вибрация "успех"
      if (navigator.vibrate) {
        navigator.vibrate([100, 50, 100, 50, 100]);
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
        @keyframes fadeOut {
          from { opacity: 1; }
          to { opacity: 0; }
        }
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateX(-50%) translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateX(-50%) translateY(0);
          } 
        }
        @keyframes meshGradient {
          0% {
            background-position: 0% 0%;
          }
          25% {
            background-position: 100% 25%;
          }
          50% {
            background-position: 100% 100%;
          }
          75% {
            background-position: 0% 75%;
          }
          100% {
            background-position: 0% 0%;
          }
        }
        @keyframes radialWave {
          0% {
            transform: translate(-50%, -50%) scale(1);
            opacity: 0.4;
          }
          50% {
            transform: translate(-50%, -50%) scale(1.2);
            opacity: 0.2;
          }
          100% {
            transform: translate(-50%, -50%) scale(1);
            opacity: 0.4;
          } 
        }
      `}</style>

      <div
        className="w-full min-h-screen relative overflow-x-hidden"
        style={{ 
          paddingBottom: '40px',
          position: 'relative'
        }}
      >
        {/* Animated mesh gradient background */}
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 0,
            background: gradientBright 
              ? 'linear-gradient(135deg, #94E4C8 0%, #ABEDD8 15%, #C5F5E8 30%, #DBF9F0 50%, #EBFCF6 70%, #F5FFFC 85%, #FFFFFF 100%)'
              : 'linear-gradient(135deg, #A1E8D0 0%, #B8F0DE 18%, #CDF5EA 35%, #DFF9F1 52%, #EDFCF7 70%, #F7FFFC 85%, #FFFFFF 100%)',
            backgroundSize: '300% 300%',
            animation: 'meshGradient 20s ease-in-out infinite',
            transition: 'background 2.3s ease-in-out'
          }}
        />
        
        {/* Radial wave effects */}
        <div
          style={{
            position: 'fixed',
            top: '20%',
            left: '10%',
            width: '400px',
            height: '400px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(148, 228, 200, 0.18) 0%, rgba(171, 237, 216, 0.12) 40%, rgba(197, 245, 232, 0.06) 60%, transparent 75%)',
            zIndex: 0,
            animation: 'radialWave 8s ease-in-out infinite',
            pointerEvents: 'none'
          }}
        />
        <div
          style={{
            position: 'fixed',
            bottom: '20%',
            right: '15%',
            width: '500px',
            height: '500px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(161, 232, 208, 0.15) 0%, rgba(184, 240, 222, 0.10) 40%, rgba(205, 245, 234, 0.05) 60%, transparent 75%)',
            zIndex: 0,
            animation: 'radialWave 12s ease-in-out infinite reverse',
            pointerEvents: 'none'
          }}
        />
        
        {/* Content container */}
        <div
          style={{
            position: 'relative',
            zIndex: 1
          }}
        >
        {/* Золотисто-мятная вспышка при 100% завершении */}
        {showSuccessMessage && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              width: '100%',
              height: '100vh',
              backgroundColor: 'rgba(204, 251, 241, 0.3)', // #CCFBF1 alpha 0.3
              pointerEvents: 'none',
              zIndex: 2000,
              animation: 'fadeIn 0.8s ease-in-out, fadeOut 1.5s ease-in-out 0.8s',
              animationFillMode: 'forwards'
            }}
          />
        )}
        
        {/* Плашка "Идеально!" при 100% */}
        {showSuccessMessage && (
          <div
            style={{
              position: 'fixed',
              bottom: '140px',
              left: '50%',
              transform: 'translateX(-50%)',
              backgroundColor: 'rgba(10, 95, 89, 0.5)',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              color: 'white',
              padding: '16px 40px',
              borderRadius: '24px',
              fontFamily: "'Manrope', -apple-system, BlinkMacSystemFont, sans-serif",
              fontSize: '16px',
              fontWeight: 600,
              zIndex: 3000,
              animation: 'fadeInUp 0.4s ease-out, fadeOut 0.3s ease-out 2.7s',
              animationFillMode: 'forwards',
              boxShadow: '0 8px 24px rgba(10, 95, 89, 0.2)',
              minWidth: '200px',
              textAlign: 'center'
            }}
          >
            Идеально!
          </div>
        )}

        {/* Logo - SkinIQ сверху посередине */}
        <div style={{ 
          width: '100%',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          marginTop: '8px',
          marginBottom: '0px'
        }}>
          <img 
            src="/skiniq-logo.png" 
            alt="SkinIQ" 
            style={{
              height: '140px',
              width: 'auto',
              objectFit: 'contain'
            }}
          />
        </div>

        {/* Header - Greeting (without avatar) */}
        <div style={{ 
          width: '90%',
          maxWidth: '600px',
          margin: '0 auto 8px auto'
        }}>
          <div
            style={{
              fontFamily: "'Satoshi', 'Manrope', -apple-system, BlinkMacSystemFont, sans-serif",
              fontWeight: 600,
              fontSize: '26px',
              color: '#374151',
              lineHeight: '1.2'
            }}
          >
            {greeting},<br />
            <span style={{ fontWeight: 600, fontSize: '26px', color: '#374151' }}>{userName}</span>
          </div>
          <div
            style={{
              fontFamily: "'Manrope', -apple-system, BlinkMacSystemFont, sans-serif",
              fontWeight: 400,
              fontSize: '16px',
              color: '#475467',
              lineHeight: '1.4',
              marginTop: '4px'
            }}
          >
            Время заботиться о своей коже
          </div>
        </div>

        {/* Toggle - AM/PM (premium glassmorphism) */}
        <div
          style={{
            width: '90%',
            maxWidth: '600px',
            margin: '0 auto 16px auto',
            display: 'flex',
            backgroundColor: 'rgba(255, 255, 255, 0.42)',
            backdropFilter: 'blur(32px)',
            WebkitBackdropFilter: 'blur(32px)',
            borderRadius: '28px',
            padding: '6px',
            gap: '6px',
            border: '1px solid rgba(255, 255, 255, 0.3)',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.06), inset 0 1px 0 rgba(255, 255, 255, 0.6)'
          }}
        >
          <button
            onClick={() => setTab("AM")}
            style={{
              flex: 1,
              padding: '14px 20px',
              borderRadius: '24px',
              border: 'none',
              backgroundColor: tab === "AM" 
                ? 'rgba(10, 95, 89, 0.75)' 
                : 'rgba(255, 255, 255, 0.3)',
              backdropFilter: tab === "AM" ? 'blur(20px)' : 'blur(16px)',
              WebkitBackdropFilter: tab === "AM" ? 'blur(20px)' : 'blur(16px)',
              color: tab === "AM" ? 'white' : '#0A5F59',
              fontFamily: "'Manrope', -apple-system, BlinkMacSystemFont, sans-serif",
              fontWeight: 600,
              fontSize: '16px',
              cursor: 'pointer',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              boxShadow: tab === "AM" 
                ? '0 4px 16px rgba(10, 95, 89, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.2)' 
                : 'none',
              transform: tab === "AM" ? 'scale(1.02)' : 'scale(1)'
            }}
            onMouseEnter={(e) => {
              if (tab !== "AM") {
                e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.45)';
              }
            }}
            onMouseLeave={(e) => {
              if (tab !== "AM") {
                e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.3)';
              }
            }}
          >
            Утро
          </button>
          <button
            onClick={() => setTab("PM")}
            style={{
              flex: 1,
              padding: '14px 20px',
              borderRadius: '24px',
              border: 'none',
              backgroundColor: tab === "PM" 
                ? 'rgba(10, 95, 89, 0.75)' 
                : 'rgba(255, 255, 255, 0.3)',
              backdropFilter: tab === "PM" ? 'blur(20px)' : 'blur(16px)',
              WebkitBackdropFilter: tab === "PM" ? 'blur(20px)' : 'blur(16px)',
              color: tab === "PM" ? 'white' : '#0A5F59',
              fontFamily: "'Manrope', -apple-system, BlinkMacSystemFont, sans-serif",
              fontWeight: 600,
              fontSize: '16px',
              cursor: 'pointer',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              boxShadow: tab === "PM" 
                ? '0 4px 16px rgba(10, 95, 89, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.2)' 
                : 'none',
              transform: tab === "PM" ? 'scale(1.02)' : 'scale(1)'
            }}
            onMouseEnter={(e) => {
              if (tab !== "PM") {
                e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.45)';
              }
            }}
            onMouseLeave={(e) => {
              if (tab !== "PM") {
                e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.3)';
              }
            }}
          >
            Вечер
          </button>
          </div>
          
        {/* Title Strip - Уход сегодня (with steps count on the right) */}
        <div
          style={{
            width: '90%',
            maxWidth: '600px',
            margin: '0 auto 12px auto',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-end',
            gap: '12px'
          }}
        >
          <div style={{ flex: 1 }}>
            <div
              style={{
                fontFamily: "'Satoshi', 'Manrope', -apple-system, BlinkMacSystemFont, sans-serif",
                fontWeight: 700,
                fontSize: '24px',
                color: '#374151',
                marginBottom: '12px'
              }}
            >
              Уход сегодня
            </div>
            {/* Тонкая изумрудная полоска */}
            <div
              style={{
                width: '100%',
                height: '2px',
                backgroundColor: '#0A5F59',
                borderRadius: '1px',
                marginTop: '4px'
              }}
            />
          </div>
          <div
            style={{
              fontFamily: "'Manrope', -apple-system, BlinkMacSystemFont, sans-serif",
              fontWeight: 400,
              fontSize: '16px',
              color: '#0A5F59',
              marginBottom: '2px',
              whiteSpace: 'nowrap'
            }}
          >
            {completed}/{total} шагов
          </div>
      </div>

        {/* Tip Card (separate glass card, smaller) */}
        <div
          style={{
            width: '90%',
            maxWidth: '600px',
            margin: '0 auto 16px auto',
            backgroundColor: 'rgba(232, 253, 250, 0.82)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            borderRadius: '28px',
            padding: '12px 16px',
            border: '1px solid rgba(10, 95, 89, 0.15)',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px'
          }}
        >
          <div
            style={{
              fontFamily: "'Manrope', -apple-system, BlinkMacSystemFont, sans-serif",
              fontWeight: 600,
              fontSize: '10px',
              color: '#0A5F59',
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}
          >
            СОВЕТ ОТ ЭКСПЕРТА
        </div>
          <div
            style={{
              fontFamily: "'Manrope', -apple-system, BlinkMacSystemFont, sans-serif",
              fontWeight: 400,
              fontSize: '15px',
              color: '#111827',
              lineHeight: '1.5'
            }}
          >
            {getAdvice()}
          </div>
        </div>

        {/* Routine Steps - Each on separate card (without big container) */}
        <div style={{ 
          width: '90%',
          maxWidth: '600px',
          margin: '0 auto 16px auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px'
        }}>
            {items.map((item, idx) => {
              const isCompleted = item.done;
              
              return (
                <div
                  key={item.id}
                  onClick={toggleAt(idx)}
                  style={{
                    height: '88px',
                    backgroundColor: 'rgba(255, 255, 255, 0.55)',
                    backdropFilter: 'blur(20px)',
                    WebkitBackdropFilter: 'blur(20px)',
                    borderRadius: '24px',
                    border: '1px solid rgba(255, 255, 255, 0.3)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '16px',
                    padding: '0 20px',
                    cursor: 'pointer',
                    position: 'relative',
                    opacity: isCompleted ? 0.6 : 1,
                    transition: 'opacity 0.2s ease-out, transform 0.2s ease-out',
                    boxShadow: '0 4px 16px rgba(0, 0, 0, 0.04)'
                  }}
                >
                  {/* Ripple Effect при отметке шага */}
                  {ripples.filter(r => r.itemId === item.id).map((ripple) => (
                    <div
                      key={ripple.id}
                      style={{
                        position: 'absolute',
                        left: `${ripple.x}%`,
                        top: `${ripple.y}%`,
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
                  ))}

                  {/* Step Number Circle (32dp - same size as info button) */}
                  <div
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '50%',
                      backgroundColor: isCompleted ? '#0A5F59' : '#0A5F59',
                      border: 'none',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      fontFamily: "'Manrope', -apple-system, BlinkMacSystemFont, sans-serif",
                      fontWeight: 700,
                      fontSize: '14px',
                      color: 'white',
                      position: 'relative',
                      transition: 'all 0.3s ease-out',
                      transform: isCompleted ? 'scale(1.15)' : 'scale(1)'
                    }}
                  >
                    {isCompleted ? '✓' : idx + 1}
        </div>

                  {/* Product Icon (60dp, no white background) */}
                  {item.icon && (
                    <img
                      src={item.icon}
                      alt={item.title}
                      style={{
                        width: '60px',
                        height: '60px',
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
                        fontSize: '17px',
                        color: '#0A5F59',
                        marginBottom: '4px',
                        lineHeight: '1.3',
                        textDecoration: isCompleted ? 'line-through' : 'none',
                        textDecorationColor: '#0A5F59',
                        textDecorationThickness: '1.5px'
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
                        lineHeight: '1.4',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        textDecoration: isCompleted ? 'line-through' : 'none',
                        textDecorationColor: '#475467',
                        textDecorationThickness: '1px'
                      }}
                    >
                      {item.subtitle}
          </div>
        </div>
          
                  {/* Info Button (i circle #0A5F59 - slightly smaller) */}
          <button
                    onClick={(e) => {
                      e.stopPropagation();
                      openHowTo(idx)();
                    }}
                    style={{
                      width: '28px',
                      height: '28px',
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
                      fontSize: '12px',
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
            
        {/* Action Buttons (outside big card, 2 buttons in row) */}
        <div style={{ 
          width: '90%',
          maxWidth: '600px',
          margin: '0 auto 20px auto',
          display: 'flex',
          gap: '12px'
        }}>
          <button
            onClick={() => navigate('/plan')}
            style={{
              flex: 1,
              height: '64px',
              borderRadius: '32px',
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
            Подробный план →
          </button>
          <button 
            onClick={() => {
              storage.remove('skinQuizCompleted');
              navigate('/quiz');
            }}
            style={{
              flex: 1,
              height: '64px',
              borderRadius: '32px',
              border: 'none',
              backgroundColor: '#0A5F59',
              color: 'white',
              fontFamily: "'Manrope', -apple-system, BlinkMacSystemFont, sans-serif",
              fontWeight: 600,
              fontSize: '16px',
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(10, 95, 89, 0.25)',
              transition: 'all 0.2s ease-out',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              whiteSpace: 'pre-line',
              lineHeight: '1.3'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'scale(1.02)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'scale(1)';
            }}
          >
            Пройти анкету{'\n'}заново →
          </button>
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
      </div>
    </>
  );
}
