// Premium Onboarding Screen with Glassmorphism 2025
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
        background: 'linear-gradient(180deg, #F0FDFA 0%, #E8FBF7 100%)',
        padding: '40px 20px',
        position: 'relative'
      }}
    >
      {/* Animated background elements */}
      <div 
        className="absolute inset-0 opacity-20"
        style={{
          background: 'radial-gradient(circle at 30% 20%, rgba(10, 95, 89, 0.1) 0%, transparent 50%)',
          animation: 'pulse 4s ease-in-out infinite'
        }}
      />

      {/* Main glass card */}
      <div 
        className="relative w-full max-w-[420px]"
        style={{
          backgroundColor: 'rgba(255, 255, 255, 0.6)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          borderRadius: '38px',
          padding: '48px 32px',
          boxShadow: '0 12px 48px rgba(0, 0, 0, 0.08), 0 4px 16px rgba(0, 0, 0, 0.04)',
          opacity: mounted ? 1 : 0,
          transform: mounted ? 'translateY(0)' : 'translateY(20px)',
          transition: 'opacity 0.6s ease-out, transform 0.6s ease-out'
        }}
      >
        {/* Logo - appears first */}
        <div 
          className="mb-8 flex justify-center"
          style={{
            opacity: mounted ? 1 : 0,
            transform: mounted ? 'translateY(0)' : 'translateY(-10px)',
            transition: 'opacity 0.5s ease-out 0.1s, transform 0.5s ease-out 0.1s',
            transitionDelay: '0.1s'
          }}
        >
          <SkinIQLogo size={40} />
        </div>

        {/* Title - appears second */}
        <h1 
          className="text-center mb-4 leading-tight"
          style={{
            fontFamily: "'Satoshi', 'Manrope', -apple-system, BlinkMacSystemFont, sans-serif",
            fontWeight: 700,
            fontSize: '36px',
            lineHeight: '1.2',
            color: '#0A5F59',
            marginBottom: '16px',
            opacity: mounted ? 1 : 0,
            transform: mounted ? 'translateY(0)' : 'translateY(-10px)',
            transition: 'opacity 0.5s ease-out 0.3s, transform 0.5s ease-out 0.3s',
            transitionDelay: '0.3s'
          }}
        >
          Получите план ухода<br />
          уровня косметолога-<br />
          дерматолога
        </h1>

        {/* Subtitle - appears third */}
        <p 
          className="text-center mb-8"
          style={{
            fontFamily: "'Manrope', -apple-system, BlinkMacSystemFont, sans-serif",
            fontWeight: 400,
            fontSize: '18px',
            lineHeight: '1.5',
            color: '#475467',
            marginBottom: '32px',
            opacity: mounted ? 1 : 0,
            transform: mounted ? 'translateY(0)' : 'translateY(-10px)',
            transition: 'opacity 0.5s ease-out 0.5s, transform 0.5s ease-out 0.5s',
            transitionDelay: '0.5s'
          }}
        >
          Персональная программа от дипломированного специалиста
        </p>

        {/* Benefits list - appears fourth */}
        <div 
          className="space-y-5 mb-8"
          style={{
            marginLeft: '20px',
            marginBottom: '40px',
            opacity: mounted ? 1 : 0,
            transform: mounted ? 'translateY(0)' : 'translateY(-10px)',
            transition: 'opacity 0.5s ease-out 0.7s, transform 0.5s ease-out 0.7s',
            transitionDelay: '0.7s'
          }}
        >
          {[
            'Точная диагностика типа и состояния кожи',
            'Ритуалы утром и вечером под ваш тип',
            'Только рабочие продукты и правильная последовательность'
          ].map((benefit, index) => (
            <div 
              key={index}
              className="flex items-start gap-3"
              style={{
                opacity: mounted ? 1 : 0,
                transform: mounted ? 'translateX(0)' : 'translateX(-10px)',
                transition: `opacity 0.4s ease-out ${0.9 + index * 0.1}s, transform 0.4s ease-out ${0.9 + index * 0.1}s`,
                transitionDelay: `${0.9 + index * 0.1}s`
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
                  marginTop: '6px'
                }}
              />
              <span 
                style={{
                  fontFamily: "'Manrope', -apple-system, BlinkMacSystemFont, sans-serif",
                  fontWeight: 400,
                  fontSize: '18px',
                  lineHeight: '1.5',
                  color: '#1F2A44'
                }}
              >
                {benefit}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Button - appears last, outside card */}
      <div 
        className="fixed bottom-0 left-0 right-0 px-5 pb-6"
        style={{
          paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 24px)',
          zIndex: 100,
          opacity: mounted ? 1 : 0,
          transform: mounted ? 'translateY(0)' : 'translateY(20px)',
          transition: 'opacity 0.5s ease-out 1.2s, transform 0.5s ease-out 1.2s',
          transitionDelay: '1.2s'
        }}
      >
        {/* Main CTA button */}
        <button 
          onClick={handleGetPlan}
          className="w-full h-14 rounded-2xl text-[18px] font-medium transition-all duration-200 active:scale-[0.98] relative overflow-hidden"
          style={{
            background: '#0A5F59',
            color: 'white',
            border: 'none',
            fontFamily: "'Manrope', -apple-system, BlinkMacSystemFont, sans-serif",
            fontWeight: 500,
            boxShadow: '0 8px 24px rgba(10, 95, 89, 0.3), 0 4px 12px rgba(10, 95, 89, 0.2)',
            marginBottom: '12px'
          }}
        >
          Получить свой план →
        </button>

        {/* Secondary link */}
        <button
          onClick={() => navigate('/plan')}
          className="w-full text-center text-[15px] transition-all duration-200 active:opacity-70"
          style={{
            color: '#0A5F59',
            fontFamily: "'Manrope', -apple-system, BlinkMacSystemFont, sans-serif",
            fontWeight: 400,
            textDecoration: 'underline',
            textUnderlineOffset: '4px',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            padding: '8px'
          }}
        >
          Посмотреть пример плана
        </button>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% {
            opacity: 0.2;
            transform: scale(1);
          }
          50% {
            opacity: 0.3;
            transform: scale(1.05);
          }
        }
      `}</style>
    </div>
  );
}
