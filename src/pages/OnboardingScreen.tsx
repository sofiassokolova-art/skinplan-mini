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
        background: '#FAFBFD',
        padding: '40px 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}
    >
      <div 
        className="max-w-[380px] text-center"
      >
        <h1 
          className="text-[36px] font-extrabold leading-tight mb-4"
          style={{
            fontFamily: "'Satoshi', 'Manrope', -apple-system, BlinkMacSystemFont, sans-serif",
            fontWeight: 900,
            lineHeight: 1.15,
            color: '#0F766E',
            marginBottom: '16px'
          }}
        >
          {greeting},<br />
          <span 
            style={{
              color: '#1E293B',
              fontFamily: "'Satoshi', 'Manrope', -apple-system, BlinkMacSystemFont, sans-serif",
              fontWeight: 900
            }}
          >
            {name}
          </span>
        </h1>

        <p 
          className="text-[18px] mb-10"
          style={{
            color: '#475569',
            fontFamily: "'Satoshi', 'Manrope', -apple-system, BlinkMacSystemFont, sans-serif",
            fontWeight: 500,
            lineHeight: 1.5,
            marginBottom: '40px'
          }}
        >
          Получите персональный план ухода<br />
          уровня косметолога-дерматолога
        </p>

        <div 
          className="text-left rounded-[28px] mb-12 backdrop-blur-[32px] border"
          style={{
            background: 'rgba(255, 255, 255, 0.72)',
            backdropFilter: 'blur(32px)',
            WebkitBackdropFilter: 'blur(32px)',
            border: '1px solid rgba(255, 255, 255, 0.3)',
            borderRadius: '28px',
            padding: '28px',
            marginBottom: '48px',
            textAlign: 'left',
            boxShadow: '0 8px 32px rgba(0,0,0,0.06), inset 0 1px 0 rgba(255,255,255,0.6)',
            maxWidth: '380px',
            fontFamily: "'Satoshi', 'Manrope', -apple-system, BlinkMacSystemFont, sans-serif"
          }}
        >
          <div 
            className="relative text-[16px]"
            style={{
              position: 'relative',
              paddingLeft: '36px',
              marginBottom: '18px',
              fontSize: '16px',
              color: '#1E293B',
              fontWeight: 500
            }}
          >
            <span 
              className="absolute left-0 font-bold"
              style={{
                position: 'absolute',
                left: 0,
                color: '#10B981',
                fontWeight: 700,
                fontSize: '20px'
              }}
            >
              ✓
            </span>
            Точная диагностика типа и состояния кожи
          </div>
          <div 
            className="relative text-[16px]"
            style={{
              position: 'relative',
              paddingLeft: '36px',
              marginBottom: '18px',
              fontSize: '16px',
              color: '#1E293B',
              fontWeight: 500
            }}
          >
            <span 
              className="absolute left-0 font-bold"
              style={{
                position: 'absolute',
                left: 0,
                color: '#10B981',
                fontWeight: 700,
                fontSize: '20px'
              }}
            >
              ✓
            </span>
            Ритуалы утром и вечером под ваш тип
          </div>
          <div 
            className="relative text-[16px]"
            style={{
              position: 'relative',
              paddingLeft: '36px',
              fontSize: '16px',
              color: '#1E293B',
              fontWeight: 500
            }}
          >
            <span 
              className="absolute left-0 font-bold"
              style={{
                position: 'absolute',
                left: 0,
                color: '#10B981',
                fontWeight: 700,
                fontSize: '20px'
              }}
            >
              ✓
            </span>
            Только рабочие продукты и правильная последовательность
          </div>
        </div>

        <button 
          onClick={() => navigate('/quiz')}
          className="w-full rounded-[22px] font-semibold mb-4 transition-all duration-200 hover:opacity-90 active:scale-[0.98]"
          style={{
            background: '#0F766E',
            color: 'white',
            border: 'none',
            fontFamily: "'Manrope', -apple-system, BlinkMacSystemFont, sans-serif",
            fontWeight: 600,
            fontSize: '17px',
            padding: '18px',
            borderRadius: '22px',
            marginTop: '32px',
            marginBottom: '16px',
            boxShadow: '0 12px 30px rgba(15,118,110,0.25)'
          }}
        >
          Пройти диагностику кожи →
        </button>

        <button 
          onClick={() => navigate('/plan')}
          className="text-[15px] underline bg-transparent border-none transition-all duration-200 hover:opacity-70"
          style={{
            color: '#64748B',
            fontFamily: "'Manrope', -apple-system, BlinkMacSystemFont, sans-serif",
            fontSize: '15px',
            textDecoration: 'underline'
          }}
        >
          Посмотреть пример плана
        </button>
      </div>
    </div>
  );
}

