// Bottom Navigation Component для Next.js
// Dark pill, lime active indicator. Items: home, plan, favorites (/cart), cart (/cart-new)

'use client';

import { useRouter, usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useCart } from '@/hooks/useCart';

export default function BottomNavigation() {
  const router = useRouter();
  const pathname = usePathname();
  const [scrollY, setScrollY] = useState(0);

  const isOnQuizPage = pathname === '/quiz' || pathname.startsWith('/quiz/');

  const { data: cartData } = useCart();
  const cartCount = cartData?.items?.length || 0;

  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  if (isOnQuizPage) return null;

  const isActive = (path: string) => {
    if (path === '/home') return pathname === '/home';
    if (path === '/cart') return pathname === '/cart' || (pathname.startsWith('/cart/') && !pathname.startsWith('/cart-new'));
    if (path === '/cart-new') return pathname === '/cart-new' || pathname.startsWith('/cart-new/');
    if (path === '/plan') return pathname === '/plan' || (pathname.startsWith('/plan/') && !pathname.startsWith('/plan/calendar'));
    return pathname.startsWith(path);
  };

  // Subtle parallax lift on scroll, max 8px
  const translateY = Math.min(scrollY / 250, 8);

  const navItems = [
    { path: '/home', icon: 'home' },
    { path: '/plan', icon: 'plan' },
    { path: '/cart', icon: 'favorites' },
    { path: '/cart-new', icon: 'cart' },
  ];

  return (
    <nav
      style={{
        position: 'fixed',
        bottom: 'calc(16px + env(safe-area-inset-bottom, 0px))',
        left: '5%',
        width: '90%',
        height: '64px',
        background:
          'radial-gradient(120% 80% at 50% 0%, rgba(213,254,97,0.10) 0%, transparent 70%), rgba(10,10,10,0.92)',
        backdropFilter: 'blur(28px) saturate(200%)',
        WebkitBackdropFilter: 'blur(28px) saturate(200%)',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: '34px',
        boxShadow: '0 14px 36px rgba(10,10,10,0.28), inset 0 1px 0 rgba(255,255,255,0.06)',
        padding: '0 14px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-around',
        zIndex: 1000,
        transform: `translateY(-${translateY}px)`,
        transition: 'transform 0.3s ease-out',
      }}
    >
      {navItems.map((item) => {
        const active = isActive(item.path);
        const color = active ? 'var(--accent)' : 'rgba(255,255,255,0.42)';
        const fill = active ? 'rgba(213,254,97,0.14)' : 'none';
        const isCartTab = item.path === '/cart-new';
        return (
          <button
            key={item.path}
            onClick={() => {
              router.push(item.path);
              if (navigator.vibrate) navigator.vibrate(10);
            }}
            aria-label={item.icon}
            style={{
              position: 'relative',
              minWidth: '52px',
              height: '48px',
              border: 'none',
              borderRadius: '16px',
              background: 'transparent',
              color,
              display: 'grid',
              placeItems: 'center',
              cursor: 'pointer',
            }}
          >
            {active && (
              <span
                style={{
                  position: 'absolute',
                  top: '4px',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  width: '18px',
                  height: '3px',
                  borderRadius: '999px',
                  background: 'var(--accent)',
                  boxShadow: '0 0 10px rgba(213,254,97,0.7)',
                }}
              />
            )}
            {item.icon === 'home' && (
              <svg viewBox="0 0 24 24" width="23" height="23" fill={fill} stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 9.5 12 3l9 6.5V20a1.5 1.5 0 0 1-1.5 1.5h-4V14h-7v7.5h-4A1.5 1.5 0 0 1 3 20Z" />
              </svg>
            )}
            {item.icon === 'plan' && (
              <svg viewBox="0 0 24 24" width="23" height="23" fill={fill} stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3.5" y="3.5" width="17" height="17" rx="3" />
                <path d="m8.5 12 2.5 2.5 4.5-5" />
              </svg>
            )}
            {item.icon === 'favorites' && (
              <svg viewBox="0 0 24 24" width="23" height="23" fill={fill} stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78L12 21.23l7.78-7.84a5.5 5.5 0 0 0 1.06-8.78Z" />
              </svg>
            )}
            {item.icon === 'cart' && (
              <svg viewBox="0 0 24 24" width="23" height="23" fill={fill} stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5.5 8h13l-1.2 10.2a2 2 0 0 1-2 1.8H8.7a2 2 0 0 1-2-1.8Z" />
                <path d="M8.5 8V6a3.5 3.5 0 0 1 7 0v2" />
              </svg>
            )}
            {isCartTab && cartCount > 0 && (
              <span
                style={{
                  position: 'absolute',
                  top: '6px',
                  right: '6px',
                  minWidth: '16px',
                  height: '16px',
                  padding: '0 4px',
                  borderRadius: '999px',
                  display: 'grid',
                  placeItems: 'center',
                  background: '#F6B27A',
                  color: 'var(--ink)',
                  fontSize: '9.5px',
                  fontWeight: 700,
                  border: '1.5px solid var(--ink)',
                }}
              >
                {cartCount > 9 ? '9+' : cartCount}
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );
}
