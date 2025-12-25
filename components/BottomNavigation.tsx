// Bottom Navigation Component для Next.js
// Telegram-style glassmorphism navigation - Premium 2025

'use client';

import { useRouter, usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import { useCart } from '@/hooks/useCart';

export default function BottomNavigation() {
  const router = useRouter();
  const pathname = usePathname();
  const [scrollY, setScrollY] = useState(0);
  
  // ТЗ: НЕ вызываем useCart на /quiz, чтобы предотвратить лишние запросы
  // Проверяем pathname синхронно через window.location для надежности
  // КРИТИЧНО: Проверяем ПЕРЕД вызовом useCart, чтобы предотвратить любые запросы
  const currentPath = typeof window !== 'undefined' ? window.location.pathname : pathname;
  const isOnQuizPage = currentPath === '/quiz' || currentPath.startsWith('/quiz/') ||
                       pathname === '/quiz' || pathname.startsWith('/quiz/');
  
  // ТЗ: Если на /quiz, не вызываем useCart вообще (возвращаем null для компонента)
  // Это предотвращает любые запросы к API корзины на странице анкеты
  if (isOnQuizPage) {
    // ИСПРАВЛЕНО: Логируем для диагностики (только в dev режиме)
    if (process.env.NODE_ENV === 'development') {
      console.log('🚫 BottomNavigation: returning null on /quiz', {
        currentPath,
        pathname,
        isOnQuizPage,
      });
    }
    return null; // КРИТИЧНО: Не рендерим компонент на /quiz
  }
  
  // ИСПРАВЛЕНО: Используем React Query для кэширования корзины
  // Это значительно снижает количество запросов к API
  // Кэш автоматически обновляется при добавлении/удалении товаров через React Query хуки
  const { data: cartData } = useCart();
  const cartCount = cartData?.items?.length || 0;

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
    { path: '/cart', label: 'Избранное', icon: 'wishlist' },
    { path: '/profile', label: 'Профиль', icon: 'profile' },
  ];
  
  // Добавляем кнопку корзины, если есть товары
  const showCartButton = cartCount > 0;

  const isActive = (path: string) => {
    if (path === '/') {
      return pathname === '/';
    }
    // Для /cart нужно точное совпадение или /cart/..., но не /cart-new
    if (path === '/cart') {
      return pathname === '/cart' || (pathname.startsWith('/cart/') && !pathname.startsWith('/cart-new'));
    }
    // Для /plan не подсвечиваем, если открыт календарь
    if (path === '/plan') {
      return pathname === '/plan' || (pathname.startsWith('/plan/') && !pathname.startsWith('/plan/calendar'));
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
            {item.icon === 'calendar' && (
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
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
            )}
            {item.icon === 'wishlist' && (
              <svg 
                viewBox="0 0 24 24" 
                width="24" 
                height="24" 
                fill={active ? '#0A5F59' : 'none'} 
                stroke={active ? '#0A5F59' : '#94A3B8'} 
                strokeWidth="2" 
                strokeLinecap="round" 
                strokeLinejoin="round"
              >
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
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
      
      {/* Кнопка корзины (показывается только когда есть товары) */}
      {showCartButton && (
        <button
          onClick={() => {
            router.push('/cart-new');
            if (navigator.vibrate) {
              navigator.vibrate(10);
            }
          }}
          style={{ 
            color: pathname === '/cart-new' ? '#0A5F59' : '#94A3B8',
            minWidth: '64px',
            position: 'relative',
            background: pathname === '/cart-new' ? 'rgba(10, 95, 89, 0.20)' : 'transparent',
            border: 'none',
            borderRadius: '36px',
            cursor: 'pointer',
            padding: '8px 12px',
            transform: pathname === '/cart-new' ? 'scale(1.06)' : 'scale(1)',
            transition: 'transform 0.2s ease-out, background-color 0.2s ease-out',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '4px',
          }}
        >
          <div style={{ position: 'relative' }}>
            <svg 
              viewBox="0 0 24 24" 
              width="24" 
              height="24" 
              fill="none" 
              stroke={pathname === '/cart-new' ? '#0A5F59' : '#94A3B8'} 
              strokeWidth="2" 
              strokeLinecap="round" 
              strokeLinejoin="round"
            >
              <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
              <line x1="3" y1="6" x2="21" y2="6" />
              <path d="M16 10a4 4 0 0 1-8 0" />
            </svg>
            {cartCount > 0 && (
              <span
                style={{
                  position: 'absolute',
                  top: '-8px',
                  right: '-8px',
                  backgroundColor: '#EF4444',
                  color: 'white',
                  borderRadius: '10px',
                  width: '20px',
                  height: '20px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '10px',
                  fontWeight: 'bold',
                }}
              >
                {cartCount > 9 ? '9+' : cartCount}
              </span>
            )}
          </div>
          <span 
            style={{
              color: pathname === '/cart-new' ? '#0A5F59' : '#94A3B8',
              fontFamily: "'Manrope', -apple-system, BlinkMacSystemFont, sans-serif",
              fontWeight: pathname === '/cart-new' ? 700 : 500,
              fontSize: '11px',
              lineHeight: '1.2',
            }}
          >
            Корзина
          </span>
        </button>
      )}
    </nav>
  );
}
