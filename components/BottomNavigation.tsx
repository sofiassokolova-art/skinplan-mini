// Bottom Navigation Component для Next.js
// Telegram-style glassmorphism navigation - Premium 2025

'use client';

import { useRouter, usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';

export default function BottomNavigation() {
  const router = useRouter();
  const pathname = usePathname();
  const [scrollY, setScrollY] = useState(0);

  // Track scroll for hide/show effect
  useEffect(() => {
    const handleScroll = () => {
      setScrollY(window.scrollY);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navItems = [
    { path: '/', label: 'Главная', icon: 'home' },
    { path: '/plan', label: 'План', icon: 'plan' },
    { path: '/cart', label: 'Корзина', icon: 'cart' },
    { path: '/profile', label: 'Профиль', icon: 'profile' },
  ];

  const isActive = (path: string) => {
    if (path === '/') {
      return pathname === '/';
    }
    return pathname.startsWith(path);
  };

  // Calculate opacity and transform based on scroll
  const scrollProgress = Math.min(scrollY / 100, 1);
  const opacity = 0.25 - (scrollProgress * 0.06); // Starts at 0.25, becomes 0.31 when scrolled (more transparent)
  const translateY = Math.min(scrollY / 200, 10); // Max 10px up

  return (
    <nav 
      style={{
        position: 'fixed',
        bottom: '20px',
        left: '3%',
        right: '3%',
        width: '94%',
        height: '78px',
        backgroundColor: `rgba(255, 255, 255, ${opacity})`,
        backdropFilter: 'blur(28px)',
        WebkitBackdropFilter: 'blur(28px)',
        border: '1px solid rgba(255, 255, 255, 0.2)',
        borderRadius: '34px',
        boxShadow: '0 -8px 32px rgba(0, 0, 0, 0.12), 0 -4px 16px rgba(0, 0, 0, 0.08)',
        padding: '0 20px',
        paddingTop: '8px',
        paddingBottom: `calc(env(safe-area-inset-bottom, 0px) + 12px)`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-around',
        zIndex: 1000,
        transform: `translateY(-${translateY}px)`,
        transition: 'transform 0.2s ease-out, background-color 0.2s ease-out, opacity 0.2s ease-out',
      }}
    >
      {navItems.map((item) => {
        const active = isActive(item.path);
        return (
          <button
            key={item.path}
            onClick={() => {
              router.push(item.path);
              // Haptic feedback
              if (navigator.vibrate) {
                navigator.vibrate(10);
              }
            }}
            style={{ 
              color: active ? '#0A5F59' : '#94A3B8',
              minWidth: '64px',
              position: 'relative',
              background: active ? 'rgba(10, 95, 89, 0.20)' : 'transparent',
              border: 'none',
              borderRadius: '36px',
              cursor: 'pointer',
              padding: '8px 12px',
              transform: active ? 'scale(1.06)' : 'scale(1)',
              transition: 'transform 0.2s ease-out, background-color 0.2s ease-out',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px',
            }}
            onMouseDown={(e) => {
              e.currentTarget.style.transform = active ? 'scale(1.0)' : 'scale(0.95)';
            }}
            onMouseUp={(e) => {
              e.currentTarget.style.transform = active ? 'scale(1.06)' : 'scale(1)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = active ? 'scale(1.06)' : 'scale(1)';
            }}
          >
            {item.icon === 'home' && (
              <svg 
                viewBox="0 0 24 24" 
                width="24" 
                height="24" 
                fill="none" 
                stroke={active ? '#0A5F59' : '#94A3B8'} 
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
                stroke={active ? '#0A5F59' : '#94A3B8'} 
                strokeWidth="2" 
                strokeLinecap="round" 
                strokeLinejoin="round"
              >
                <path d="M9 11l3 3L22 4" />
                <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
              </svg>
            )}
            {item.icon === 'cart' && (
              <svg 
                viewBox="0 0 24 24" 
                width="24" 
                height="24" 
                fill="none" 
                stroke={active ? '#0A5F59' : '#94A3B8'} 
                strokeWidth="2" 
                strokeLinecap="round" 
                strokeLinejoin="round"
              >
                <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
                <line x1="3" y1="6" x2="21" y2="6" />
                <path d="M16 10a4 4 0 0 1-8 0" />
              </svg>
            )}
            {item.icon === 'profile' && (
              <svg 
                viewBox="0 0 24 24" 
                width="24" 
                height="24" 
                fill="none" 
                stroke={active ? '#0A5F59' : '#94A3B8'} 
                strokeWidth="2" 
                strokeLinecap="round" 
                strokeLinejoin="round"
              >
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            )}
            <span 
              style={{
                color: active ? '#0A5F59' : '#94A3B8',
                fontFamily: "'Manrope', -apple-system, BlinkMacSystemFont, sans-serif",
                fontWeight: active ? 700 : 500,
                fontSize: '11px',
                lineHeight: '1.2',
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
