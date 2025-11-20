// Premium Onboarding Screen with Glassmorphism 2025
// СРОЧНО — 25 МИНУТ — НЕ КАКАШКА
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import SkinIQLogo from "../components/SkinIQLogo";

export default function OnboardingScreen() {
  const navigate = useNavigate();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleGetPlan = () => {
    navigate('/quiz');
    if (navigator.vibrate) {
      navigator.vibrate(50);
    }
  };

  return (
    <div 
      className="min-h-screen relative overflow-hidden flex items-center justify-center"
      style={{
        background: 'linear-gradient(180deg, #F5FFFC 0%, #E8FBF7 100%)',
        padding: '20px 0',
        position: 'relative'
      }}
    >
      {/* Main glass card - 88% width, ~78% height */}
      <div 
        className="relative flex flex-col items-center justify-between"
        style={{
          width: '88%',
          maxWidth: '420px',
          minHeight: '78vh',
          maxHeight: '78vh',
          backgroundColor: 'rgba(255, 255, 255, 0.62)',
          backdropFilter: 'blur(26px)',
          WebkitBackdropFilter: 'blur(26px)',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          borderRadius: '40px',
          padding: '44px 32px 32px 32px',
          boxShadow: '0 16px 48px rgba(0, 0, 0, 0.12), 0 8px 24px rgba(0, 0, 0, 0.08)',
          opacity: mounted ? 1 : 0,
          transform: mounted ? 'scale(1)' : 'scale(0.94)',
          transition: 'opacity 0.6s ease-out, transform 0.6s ease-out',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}
      >
        {/* Content wrapper - centered */}
        <div 
          className="flex flex-col items-center text-center w-full"
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'flex-start'
          }}
        >
          {/* Logo - SkinIQ 44sp */}
          <div 
            className="mb-6"
            style={{
              opacity: mounted ? 1 : 0,
              transform: mounted ? 'translateY(0)' : 'translateY(-10px)',
              transition: 'opacity 0.5s ease-out 0.2s, transform 0.5s ease-out 0.2s',
              transitionDelay: '0.2s'
            }}
          >
            <SkinIQLogo size={44} />
          </div>

          {/* Title - 38sp bold, 3 lines, line-height 1.1, appears later */}
          <h1 
            className="leading-tight mb-6"
            style={{
              fontFamily: "'Satoshi', 'Manrope', -apple-system, BlinkMacSystemFont, sans-serif",
              fontWeight: 700,
              fontSize: '38px',
              lineHeight: '1.1',
              color: '#0A5F59',
              marginBottom: '24px',
              opacity: mounted ? 1 : 0,
              transform: mounted ? 'translateY(0)' : 'translateY(-10px)',
              transition: 'opacity 0.6s ease-out 0.4s, transform 0.6s ease-out 0.4s',
              transitionDelay: '0.4s'
            }}
          >
            Получите план ухода<br />
            уровня косметолога-<br />
            дерматолога
          </h1>

          {/* Subtitle - 18sp #475467, margin 24px */}
          <p 
            className="mb-8"
            style={{
              fontFamily: "'Manrope', -apple-system, BlinkMacSystemFont, sans-serif",
              fontWeight: 400,
              fontSize: '18px',
              lineHeight: '1.5',
              color: '#475467',
              marginBottom: '24px',
              opacity: mounted ? 1 : 0,
              transform: mounted ? 'translateY(0)' : 'translateY(-10px)',
              transition: 'opacity 0.5s ease-out 0.6s, transform 0.5s ease-out 0.6s',
              transitionDelay: '0.6s'
            }}
          >
            Персональная программа от дипломированного специалиста
          </p>

          {/* Benefits list - 3 items with green circles */}
          <div 
            className="w-full space-y-7"
            style={{
              width: '100%',
              marginTop: '24px',
              marginBottom: 'auto'
            }}
          >
            {[
              'Точная диагностика типа и состояния кожи',
              'Ритуалы утром и вечером под ваш тип',
              'Только рабочие продукты и правильная последовательность'
            ].map((benefit, index) => (
              <div 
                key={index}
                className="flex items-start gap-4"
                style={{
                  opacity: mounted ? 1 : 0,
                  transform: mounted ? 'translateX(0)' : 'translateX(-10px)',
                  transition: `opacity 0.4s ease-out ${0.8 + index * 0.15}s, transform 0.4s ease-out ${0.8 + index * 0.15}s`,
                  transitionDelay: `${0.8 + index * 0.15}s`,
                  marginBottom: '28px'
                }}
              >
                <div 
                  className="flex-shrink-0 mt-1"
                  style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    backgroundColor: '#0A5F59',
                    flexShrink: 0,
                    marginTop: '8px'
                  }}
                />
                <span 
                  style={{
                    fontFamily: "'Manrope', -apple-system, BlinkMacSystemFont, sans-serif",
                    fontWeight: 400,
                    fontSize: '19px',
                    lineHeight: '1.5',
                    color: '#1F2A44',
                    textAlign: 'left'
                  }}
                >
                  {benefit}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Button - inside card, bottom */}
        <button 
          onClick={handleGetPlan}
          className="w-full rounded-[28px] text-[19px] font-medium transition-all duration-200 active:scale-[0.98] relative overflow-hidden"
          style={{
            width: '100%',
            height: '62px',
            background: '#0A5F59',
            color: 'white',
            border: 'none',
            borderRadius: '28px',
            fontFamily: "'Manrope', -apple-system, BlinkMacSystemFont, sans-serif",
            fontWeight: 500,
            fontSize: '19px',
            boxShadow: '0 8px 24px rgba(10, 95, 89, 0.3), 0 4px 12px rgba(10, 95, 89, 0.2)',
            marginTop: 'auto',
            marginBottom: '32px',
            opacity: mounted ? 1 : 0,
            transform: mounted ? 'translateY(0)' : 'translateY(20px)',
            transition: 'opacity 0.5s ease-out 1.3s, transform 0.5s ease-out 1.3s',
            transitionDelay: '1.3s',
            cursor: 'pointer'
          }}
        >
          Получить свой план →
        </button>
      </div>

      {/* Secondary link - outside card, below */}
      <button
        onClick={() => navigate('/plan')}
        className="absolute bottom-6 left-0 right-0 text-center text-[15px] transition-all duration-200 active:opacity-70"
        style={{
          color: '#0A5F59',
          fontFamily: "'Manrope', -apple-system, BlinkMacSystemFont, sans-serif",
          fontWeight: 400,
          fontSize: '15px',
          textDecoration: 'underline',
          textUnderlineOffset: '4px',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          padding: '8px',
          opacity: mounted ? 1 : 0,
          transform: mounted ? 'translateY(0)' : 'translateY(10px)',
          transition: 'opacity 0.5s ease-out 1.5s, transform 0.5s ease-out 1.5s',
          transitionDelay: '1.5s',
          position: 'absolute',
          bottom: '24px',
          left: '50%',
          transform: mounted ? 'translateX(-50%)' : 'translateX(-50%) translateY(10px)'
        }}
      >
        Посмотреть пример плана
      </button>
    </div>
  );
}
