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
        background: '#FAFAFA',
        padding: '40px 24px',
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
            fontWeight: 800,
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
            fontFamily: "'Manrope', -apple-system, BlinkMacSystemFont, sans-serif",
            lineHeight: 1.5,
            marginBottom: '40px'
          }}
        >
          Получите персональный план ухода<br />
          уровня косметолога-дерматолога
        </p>

        <div 
          className="text-left rounded-[20px] p-6 mb-12"
          style={{
            background: 'white',
            border: '1px solid #E2E8F0',
            borderRadius: '20px',
            padding: '24px',
            marginBottom: '48px',
            textAlign: 'left',
            boxShadow: '0 4px 20px rgba(0,0,0,0.04)',
            fontFamily: "'Manrope', -apple-system, BlinkMacSystemFont, sans-serif"
          }}
        >
          <div 
            className="relative pl-8 mb-4 text-[16px]"
            style={{
              position: 'relative',
              paddingLeft: '32px',
              marginBottom: '16px',
              fontSize: '16px',
              color: '#334155'
            }}
          >
            <span 
              className="absolute left-0 font-bold text-[18px]"
              style={{
                position: 'absolute',
                left: 0,
                color: '#10B981',
                fontWeight: 700,
                fontSize: '18px'
              }}
            >
              ✓
            </span>
            Точная диагностика типа и состояния кожи
          </div>
          <div 
            className="relative pl-8 mb-4 text-[16px]"
            style={{
              position: 'relative',
              paddingLeft: '32px',
              marginBottom: '16px',
              fontSize: '16px',
              color: '#334155'
            }}
          >
            <span 
              className="absolute left-0 font-bold text-[18px]"
              style={{
                position: 'absolute',
                left: 0,
                color: '#10B981',
                fontWeight: 700,
                fontSize: '18px'
              }}
            >
              ✓
            </span>
            Ритуалы утром и вечером под ваш тип
          </div>
          <div 
            className="relative pl-8 text-[16px]"
            style={{
              position: 'relative',
              paddingLeft: '32px',
              fontSize: '16px',
              color: '#334155'
            }}
          >
            <span 
              className="absolute left-0 font-bold text-[18px]"
              style={{
                position: 'absolute',
                left: 0,
                color: '#10B981',
                fontWeight: 700,
                fontSize: '18px'
              }}
            >
              ✓
            </span>
            Только рабочие продукты и правильная последовательность
          </div>
        </div>

        <button 
          onClick={() => navigate('/quiz')}
          className="w-full h-14 rounded-[20px] font-semibold text-lg mb-4 transition-all duration-200 hover:opacity-90 active:scale-[0.98]"
          style={{
            background: '#0F766E',
            color: 'white',
            border: 'none',
            fontFamily: "'Manrope', -apple-system, BlinkMacSystemFont, sans-serif",
            fontWeight: 600,
            fontSize: '18px',
            padding: '18px',
            borderRadius: '20px',
            marginBottom: '16px',
            boxShadow: '0 8px 25px rgba(15,118,110,0.2)'
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

