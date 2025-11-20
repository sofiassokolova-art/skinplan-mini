import { useNavigate } from "react-router-dom";

export default function OnboardingScreen() {
  const navigate = useNavigate();
  const tg = (window as any)?.Telegram?.WebApp;
  const user = tg?.initDataUnsafe?.user;
  const name = user?.first_name || 'друг';

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Доброе утро' : hour < 18 ? 'Добрый день' : 'Добрый вечер';

  return (
    <div 
      className="min-h-screen relative"
      style={{
        background: '#0C1219',
        color: 'white',
        position: 'relative',
        padding: '40px 24px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center'
      }}
    >
      {/* Noise overlay */}
      <div 
        className="fixed inset-0 pointer-events-none z-0"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='4' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
          backgroundSize: '200px 200px',
          opacity: 0.04
        }}
      />

      <div 
        className="relative z-10 max-w-[380px] mx-auto text-center"
      >
        <h1 
          className="text-[36px] font-extrabold leading-tight mb-4"
          style={{
            fontFamily: "'Satoshi', 'Manrope', -apple-system, BlinkMacSystemFont, sans-serif",
            fontWeight: 800,
            lineHeight: 1.15,
            color: '#FAFAFA'
          }}
        >
          {greeting},<br />
          <span 
            style={{
              background: 'linear-gradient(90deg, #E8E1D9, #D4C9B8)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              fontFamily: "'Satoshi', 'Manrope', -apple-system, BlinkMacSystemFont, sans-serif",
              fontWeight: 800
            }}
          >
            {name}
          </span>
        </h1>

        <p 
          className="text-[18px] mb-10"
          style={{
            color: '#94A3B8',
            fontFamily: "'Manrope', -apple-system, BlinkMacSystemFont, sans-serif",
            lineHeight: 1.5
          }}
        >
          Получите персональный план ухода<br />
          уровня косметолога-дерматолога
        </p>

        <div 
          className="text-left rounded-2xl p-5 mb-12 backdrop-blur-[32px] border"
          style={{
            background: 'rgba(18,24,36,0.78)',
            backdropFilter: 'blur(32px)',
            WebkitBackdropFilter: 'blur(32px)',
            border: '1px solid rgba(226, 232, 240, 0.1)',
            borderRadius: '24px',
            fontSize: '16px',
            color: '#CBD5E1',
            fontFamily: "'Manrope', -apple-system, BlinkMacSystemFont, sans-serif"
          }}
        >
          <div 
            className="relative pl-7 mb-4"
            style={{
              position: 'relative',
              paddingLeft: '28px'
            }}
          >
            <span 
              className="absolute left-0 font-bold"
              style={{
                position: 'absolute',
                left: 0,
                color: '#E8E1D9',
                fontWeight: 700
              }}
            >
              ✓
            </span>
            Точная диагностика типа и состояния кожи
          </div>
          <div 
            className="relative pl-7 mb-4"
            style={{
              position: 'relative',
              paddingLeft: '28px'
            }}
          >
            <span 
              className="absolute left-0 font-bold"
              style={{
                position: 'absolute',
                left: 0,
                color: '#E8E1D9',
                fontWeight: 700
              }}
            >
              ✓
            </span>
            Ритуалы утром и вечером под ваш тип
          </div>
          <div 
            className="relative pl-7"
            style={{
              position: 'relative',
              paddingLeft: '28px'
            }}
          >
            <span 
              className="absolute left-0 font-bold"
              style={{
                position: 'absolute',
                left: 0,
                color: '#E8E1D9',
                fontWeight: 700
              }}
            >
              ✓
            </span>
            Только рабочие продукты и правильная последовательность
          </div>
        </div>

        <button 
          onClick={() => navigate('/quiz')}
          className="w-full h-14 rounded-[22px] font-semibold text-lg mb-4 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
          style={{
            background: 'linear-gradient(90deg, #E8E1D9, #D4C9B8)',
            color: '#0C1219',
            border: 'none',
            fontFamily: "'Manrope', -apple-system, BlinkMacSystemFont, sans-serif",
            fontWeight: 600,
            boxShadow: '0 12px 30px rgba(232,225,217,0.3)'
          }}
        >
          Пройти диагностику кожи →
        </button>

        <button 
          onClick={() => navigate('/plan')}
          className="text-[15px] underline bg-transparent border-none transition-all duration-200 hover:opacity-70"
          style={{
            color: '#94A3B8',
            fontFamily: "'Manrope', -apple-system, BlinkMacSystemFont, sans-serif"
          }}
        >
          Посмотреть пример плана
        </button>
      </div>
    </div>
  );
}

