// Premium Onboarding Screen with Glassmorphism 2025
// СРОЧНО — 8 МИНУТ ДО 100%
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
      {/* Main glass card - 88% width, отступы 6% с каждой стороны */}
      <div 
        className="relative flex flex-col items-center justify-between"
        style={{
          width: '88%',
          maxWidth: '420px',
          minHeight: '82vh',
          maxHeight: '82vh',
          backgroundColor: 'rgba(255, 255, 255, 0.58)',
          backdropFilter: 'blur(26px)',
          WebkitBackdropFilter: 'blur(26px)',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          borderRadius: '44px',
          padding: '0 28px',
          paddingTop: '36px',
          paddingBottom: '32px',
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
            justifyContent: 'flex-start',
            width: '100%'
          }}
        >
          {/* Logo - SkinIQ 48sp (как в примере) */}
          <div 
            style={{
              marginTop: '0',
              marginBottom: '36px',
              opacity: mounted ? 1 : 0,
              transform: mounted ? 'translateY(0)' : 'translateY(-10px)',
              transition: 'opacity 0.5s ease-out 0.2s, transform 0.5s ease-out 0.2s',
              transitionDelay: '0.2s'
            }}
          >
            <SkinIQLogo size={48} />
          </div>

          {/* Title - 36sp, lineHeight 42sp, 3 lines exactly as specified */}
          <h1 
            className="leading-tight"
            style={{
              fontFamily: "'Satoshi', 'Manrope', -apple-system, BlinkMacSystemFont, sans-serif",
              fontWeight: 700,
              fontSize: '36px',
              lineHeight: '42px',
              color: '#0A5F59',
              marginBottom: '28px',
              opacity: mounted ? 1 : 0,
              transform: mounted ? 'translateY(0)' : 'translateY(-10px)',
              transition: 'opacity 0.6s ease-out 0.5s, transform 0.6s ease-out 0.5s',
              transitionDelay: '0.5s',
              textAlign: 'center'
            }}
          >
            Получите план ухода<br />
            уровня косметолога-<br />
            дерматолога
          </h1>

          {/* Subtitle - 18sp #475467, margin 28px */}
          <p 
            style={{
              fontFamily: "'Manrope', -apple-system, BlinkMacSystemFont, sans-serif",
              fontWeight: 400,
              fontSize: '18px',
              lineHeight: '1.5',
              color: '#475467',
              marginBottom: '28px',
              opacity: mounted ? 1 : 0,
              transform: mounted ? 'translateY(0)' : 'translateY(-10px)',
              transition: 'opacity 0.5s ease-out 0.7s, transform 0.5s ease-out 0.7s',
              transitionDelay: '0.7s'
            }}
          >
            Персональная программа от дипломированного специалиста
          </p>

          {/* Benefits list - 3 items with green circles, 28px spacing */}
          <div 
            className="w-full"
            style={{
              width: '100%',
              marginTop: '0',
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
                  transition: `opacity 0.4s ease-out ${0.9 + index * 0.15}s, transform 0.4s ease-out ${0.9 + index * 0.15}s`,
                  transitionDelay: `${0.9 + index * 0.15}s`,
                  marginBottom: '28px',
                  justifyContent: 'flex-start',
                  alignItems: 'flex-start'
                }}
              >
                <div 
                  className="flex-shrink-0"
                  style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    backgroundColor: '#0A5F59',
                    flexShrink: 0,
                    marginTop: '9px'
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

        {/* Button - inside card, bottom, отступ 36dp от последнего пункта, ширина 84% от карточки */}
        <button 
          onClick={handleGetPlan}
          className="rounded-[32px] text-[19px] font-medium transition-all duration-200 active:scale-[0.98] relative overflow-hidden"
          style={{
            width: '84%',
            height: '64px',
            background: '#0A5F59',
            color: 'white',
            border: 'none',
            borderRadius: '32px',
            fontFamily: "'Manrope', -apple-system, BlinkMacSystemFont, sans-serif",
            fontWeight: 500,
            fontSize: '19px',
            boxShadow: '0 8px 24px rgba(10, 95, 89, 0.3), 0 4px 12px rgba(10, 95, 89, 0.2)',
            marginTop: '36px',
            marginBottom: '0',
            opacity: mounted ? 1 : 0,
            transform: mounted ? 'translateY(0)' : 'translateY(20px)',
            transition: 'opacity 0.5s ease-out 1.4s, transform 0.5s ease-out 1.4s',
            transitionDelay: '1.4s',
            cursor: 'pointer'
          }}
        >
          Получить свой план →
        </button>
      </div>

      {/* Secondary link - outside card, below, отступ 28dp от карточки */}
      <button
        onClick={() => navigate('/plan')}
        className="text-center text-[15px] transition-all duration-200 active:opacity-70"
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
          marginTop: '28px',
          opacity: mounted ? 1 : 0,
          transform: mounted ? 'translateY(0)' : 'translateY(10px)',
          transition: 'opacity 0.5s ease-out 1.6s, transform 0.5s ease-out 1.6s',
          transitionDelay: '1.6s',
          position: 'absolute',
          bottom: '100px'
        }}
      >
        Посмотреть пример плана
      </button>
    </div>
  );
}
