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
      className="min-h-screen relative overflow-hidden flex flex-col items-center justify-center"
      style={{
        background: 'linear-gradient(180deg, #F5FFFC 0%, #E8FBF7 100%)',
        padding: '0',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 0
      }}
    >
      {/* Logo - над карточкой, отступ снизу 32px */}
      <div 
        style={{
          marginBottom: '32px',
          opacity: mounted ? 1 : 0,
          transform: mounted ? 'translateY(0)' : 'translateY(-10px)',
          transition: 'opacity 0.5s ease-out 0.2s, transform 0.5s ease-out 0.2s',
          transitionDelay: '0.2s'
        }}
      >
        <SkinIQLogo size={48} />
      </div>

      {/* Main glass card - 88% width, centered with 6% margins */}
      <div 
        className="relative flex flex-col items-center"
        style={{
          width: '88%',
          maxWidth: '420px',
          minHeight: 'auto',
          backgroundColor: 'rgba(255, 255, 255, 0.58)',
          backdropFilter: 'blur(26px)',
          WebkitBackdropFilter: 'blur(26px)',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          borderRadius: '44px',
          padding: '36px 28px 32px 28px',
          boxShadow: '0 16px 48px rgba(0, 0, 0, 0.12), 0 8px 24px rgba(0, 0, 0, 0.08)',
          opacity: mounted ? 1 : 0,
          transform: mounted ? 'scale(1)' : 'scale(0.94)',
          transition: 'opacity 0.6s ease-out 0.4s, transform 0.6s ease-out 0.4s',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'flex-start',
          gap: 0
        }}
      >
        {/* Title - 36sp, lineHeight 42px, margin 28px снизу */}
        <h1 
          style={{
            fontFamily: "'Satoshi', 'Manrope', -apple-system, BlinkMacSystemFont, sans-serif",
            fontWeight: 700,
            fontSize: '36px',
            lineHeight: '42px',
            color: '#0A5F59',
            margin: '0 0 28px 0',
            padding: 0,
            textAlign: 'center',
            opacity: mounted ? 1 : 0,
            transform: mounted ? 'translateY(0)' : 'translateY(-10px)',
            transition: 'opacity 0.6s ease-out 0.6s, transform 0.6s ease-out 0.6s',
            transitionDelay: '0.6s'
          }}
        >
          Получите план ухода<br />
          уровня косметолога-<br />
          дерматолога
        </h1>

        {/* Subtitle - 18sp #475467, margin 28px снизу */}
        <p 
          style={{
            fontFamily: "'Manrope', -apple-system, BlinkMacSystemFont, sans-serif",
            fontWeight: 400,
            fontSize: '18px',
            lineHeight: '1.5',
            color: '#475467',
            margin: '0 0 28px 0',
            padding: 0,
            textAlign: 'center',
            opacity: mounted ? 1 : 0,
            transform: mounted ? 'translateY(0)' : 'translateY(-10px)',
            transition: 'opacity 0.5s ease-out 0.8s, transform 0.5s ease-out 0.8s',
            transitionDelay: '0.8s'
          }}
        >
          Персональная программа от дипломированного специалиста
        </p>

        {/* Benefits list - 3 items with green circles, 28px spacing */}
        <div 
          style={{
            width: '100%',
            margin: '0 0 auto 0',
            padding: 0
          }}
        >
          {[
            'Точная диагностика типа и состояния кожи',
            'Ритуалы утром и вечером под ваш тип',
            'Только рабочие продукты и правильная последовательность'
          ].map((benefit, index) => (
            <div 
              key={index}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '12px',
                marginBottom: index < 2 ? '28px' : '0',
                opacity: mounted ? 1 : 0,
                transform: mounted ? 'translateX(0)' : 'translateX(-10px)',
                transition: `opacity 0.4s ease-out ${1.0 + index * 0.15}s, transform 0.4s ease-out ${1.0 + index * 0.15}s`,
                transitionDelay: `${1.0 + index * 0.15}s`
              }}
            >
              <div 
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
                  textAlign: 'left',
                  flex: 1
                }}
              >
                {benefit}
              </span>
            </div>
          ))}
        </div>

        {/* Button - inside card, отступ 36dp от последнего пункта, ширина 84% */}
        <button 
          onClick={handleGetPlan}
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
            padding: '0',
            cursor: 'pointer',
            opacity: mounted ? 1 : 0,
            transform: mounted ? 'translateY(0) scale(1)' : 'translateY(20px) scale(0.95)',
            transition: 'opacity 0.5s ease-out 1.5s, transform 0.5s ease-out 1.5s',
            transitionDelay: '1.5s'
          }}
          onMouseDown={(e) => {
            e.currentTarget.style.transform = 'translateY(0) scale(0.95)';
          }}
          onMouseUp={(e) => {
            e.currentTarget.style.transform = 'translateY(0) scale(1)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0) scale(1)';
          }}
        >
          Получить свой план →
        </button>
      </div>

      {/* Secondary link - под карточкой, отступ 28dp от карточки */}
      <button
        onClick={() => navigate('/plan')}
        style={{
          marginTop: '28px',
          color: '#0A5F59',
          fontFamily: "'Manrope', -apple-system, BlinkMacSystemFont, sans-serif",
          fontWeight: 400,
          fontSize: '15px',
          textDecoration: 'underline',
          textUnderlineOffset: '4px',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          padding: '8px 12px',
          opacity: mounted ? 1 : 0,
          transform: mounted ? 'translateY(0)' : 'translateY(10px)',
          transition: 'opacity 0.5s ease-out 1.7s, transform 0.5s ease-out 1.7s',
          transitionDelay: '1.7s'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.opacity = '0.7';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.opacity = mounted ? '1' : '0';
        }}
      >
        Посмотреть пример плана
      </button>
    </div>
  );
}
