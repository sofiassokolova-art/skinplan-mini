// Bottom Navigation Component
// Используется на всех страницах приложения
import { useNavigate, useLocation } from "react-router-dom";

export default function BottomNavigation() {
  const navigate = useNavigate();
  const location = useLocation();

  const navItems = [
    { path: '/', label: 'Главная', icon: 'home' },
    { path: '/plan', label: 'План', icon: 'plan' },
    { path: '/photo', label: 'Фото', icon: 'camera' },
    { path: '/insights', label: 'Анализ', icon: 'chart' },
  ];

  const isActive = (path: string) => location.pathname === path;

  return (
    <nav 
      className="fixed flex justify-around items-center z-1000"
      style={{
        position: 'fixed',
        bottom: '14px',
        left: '16px',
        right: '16px',
        height: '76px',
        backgroundColor: 'rgba(255, 255, 255, 0.6)',
        backdropFilter: 'blur(25px)',
        WebkitBackdropFilter: 'blur(25px)',
        border: '1px solid rgba(255, 255, 255, 0.4)',
        borderRadius: '26px',
        boxShadow: '0 -8px 24px rgba(0, 0, 0, 0.08), 0 -4px 12px rgba(0, 0, 0, 0.04)',
        padding: '0 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-around',
        zIndex: 1000,
        paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 0px)'
      }}
    >
      {navItems.map((item) => {
        const active = isActive(item.path);
        return (
          <button
            key={item.path}
            onClick={() => navigate(item.path)}
            className="flex flex-col items-center justify-center gap-1 transition-all duration-200 relative"
            style={{ 
              color: active ? '#0A5F59' : '#94A3B8',
              minWidth: '60px',
              position: 'relative',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: '8px'
            }}
          >
            {active && (
              <div 
                className="absolute -top-1 left-1/2 transform -translate-x-1/2"
                style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  backgroundColor: '#0A5F59'
                }}
              />
            )}
            {item.icon === 'home' && (
              <svg 
                viewBox="0 0 24 24" 
                width="24" 
                height="24" 
                fill="none" 
                stroke="currentColor" 
                strokeWidth="2" 
                strokeLinecap="round" 
                strokeLinejoin="round"
              >
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                <polyline points="9 22 9 12 15 12 15 22" />
              </svg>
            )}
            {item.icon === 'plan' && (
              <svg 
                viewBox="0 0 24 24" 
                width="24" 
                height="24" 
                fill="none" 
                stroke="currentColor" 
                strokeWidth="2" 
                strokeLinecap="round" 
                strokeLinejoin="round"
              >
                <path d="M9 11l3 3L22 4" />
                <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
              </svg>
            )}
            {item.icon === 'camera' && (
              <svg 
                viewBox="0 0 24 24" 
                width="24" 
                height="24" 
                fill="none" 
                stroke="currentColor" 
                strokeWidth="2" 
                strokeLinecap="round" 
                strokeLinejoin="round"
              >
                <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
                <circle cx="12" cy="13" r="3" />
              </svg>
            )}
            {item.icon === 'chart' && (
              <svg 
                viewBox="0 0 24 24" 
                width="24" 
                height="24" 
                fill="none" 
                stroke="currentColor" 
                strokeWidth="2" 
                strokeLinecap="round" 
                strokeLinejoin="round"
              >
                <line x1="18" y1="20" x2="18" y2="10" />
                <line x1="12" y1="20" x2="12" y2="4" />
                <line x1="6" y1="20" x2="6" y2="14" />
              </svg>
            )}
            <span 
              className="text-[11px] font-semibold"
              style={{
                color: active ? '#0A5F59' : '#94A3B8',
                fontFamily: "'Manrope', -apple-system, BlinkMacSystemFont, sans-serif",
                fontWeight: 600
              }}
            >
              {item.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}

