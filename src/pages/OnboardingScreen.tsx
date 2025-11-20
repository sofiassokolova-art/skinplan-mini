import { useNavigate } from "react-router-dom";

export default function OnboardingScreen() {
  const navigate = useNavigate();

  return (
    <div 
      className="min-h-screen relative"
      style={{
        background: '#FAFBFD',
        padding: '40px 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}
    >
      <div 
        className="max-w-[420px] text-center"
      >
        {/* Logo */}
        <div className="mb-8">
          <h1 
            className="text-[28px] font-black tracking-tight"
            style={{ 
              color: '#0F766E',
              fontFamily: "'Satoshi', 'Manrope', -apple-system, BlinkMacSystemFont, sans-serif",
              fontWeight: 900,
              letterSpacing: '-0.03em'
            }}
          >
            SkinIQ
          </h1>
        </div>

        {/* Main heading */}
        <h1 
          className="text-[36px] font-bold leading-tight mb-4"
          style={{
            fontFamily: "'Satoshi', 'Manrope', -apple-system, BlinkMacSystemFont, sans-serif",
            fontWeight: 700,
            lineHeight: 1.2,
            color: '#0F766E',
            marginBottom: '12px'
          }}
        >
          Получите план ухода<br />
          уровня косметолога-дерматолога
        </h1>

        {/* Subtitle */}
        <p 
          className="text-[17px] mb-8"
          style={{
            color: '#475569',
            fontFamily: "'Manrope', -apple-system, BlinkMacSystemFont, sans-serif",
            fontWeight: 400,
            lineHeight: 1.5,
            marginBottom: '32px'
          }}
        >
          Персональная программа от дипломированного специалиста
        </p>

        {/* Benefits card - без галочек */}
        <div 
          className="text-left rounded-[24px] mb-8 backdrop-blur-[32px] border"
          style={{
            background: 'rgba(255, 255, 255, 0.68)',
            backdropFilter: 'blur(32px)',
            WebkitBackdropFilter: 'blur(32px)',
            border: '1px solid rgba(255, 255, 255, 0.4)',
            borderRadius: '24px',
            padding: '28px 24px',
            marginBottom: '32px',
            textAlign: 'left',
            boxShadow: '0 8px 32px rgba(0,0,0,0.07)',
            maxWidth: '420px',
            fontFamily: "'Manrope', -apple-system, BlinkMacSystemFont, sans-serif"
          }}
        >
          <div 
            className="text-[18px] font-bold mb-3"
            style={{
              fontSize: '18px',
              color: '#1E293B',
              fontWeight: 700,
              lineHeight: 1.6,
              marginBottom: '12px'
            }}
          >
            • Точная диагностика типа и состояния кожи
          </div>
          <div 
            className="text-[18px] font-bold mb-3"
            style={{
              fontSize: '18px',
              color: '#1E293B',
              fontWeight: 700,
              lineHeight: 1.6,
              marginBottom: '12px'
            }}
          >
            • Ритуалы утром и вечером под ваш тип
          </div>
          <div 
            className="text-[18px] font-bold"
            style={{
              fontSize: '18px',
              color: '#1E293B',
              fontWeight: 700,
              lineHeight: 1.6
            }}
          >
            • Только рабочие продукты и правильная последовательность
          </div>
        </div>

        {/* Primary button */}
        <button 
          onClick={() => navigate('/quiz')}
          className="w-full rounded-[20px] font-semibold mb-4 transition-all duration-200 hover:opacity-90 active:scale-[0.98]"
          style={{
            background: '#0F766E',
            color: 'white',
            border: 'none',
            fontFamily: "'Manrope', -apple-system, BlinkMacSystemFont, sans-serif",
            fontWeight: 600,
            fontSize: '18px',
            padding: '18px 24px',
            borderRadius: '20px',
            marginBottom: '16px',
            boxShadow: '0 8px 24px rgba(15,118,110,0.3)',
            height: '56px'
          }}
        >
          Получить свой план →
        </button>

        {/* Secondary link */}
        <button 
          onClick={() => navigate('/plan')}
          className="text-[15px] bg-transparent border-none transition-all duration-200 hover:opacity-70 underline"
          style={{
            color: '#64748B',
            fontFamily: "'Manrope', -apple-system, BlinkMacSystemFont, sans-serif",
            fontSize: '15px',
            textDecoration: 'underline',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer'
          }}
        >
          Посмотреть пример плана
        </button>
      </div>
    </div>
  );
}

