// Bottom Navigation Component для Next.js
// Glass pill, no labels, lime active tab

'use client';

import { useRouter, usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useCart } from '@/hooks/useCart';

export default function BottomNavigation() {
  const router = useRouter();
  const pathname = usePathname();
  const [scrollY, setScrollY] = useState(0);

  const isOnQuizPage = pathname === '/quiz' || pathname.startsWith('/quiz/');

  // Always call hooks before any conditional return
  const { data: cartData } = useCart();
  const cartCount = cartData?.items?.length || 0;

  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  if (isOnQuizPage) return null;

  const navItems = [
    { path: '/home', icon: 'home' },
    { path: '/plan', icon: 'plan' },
    { path: '/cart', icon: 'wishlist' },
    { path: '/profile', icon: 'profile' },
  ];

  const showCartButton = cartCount > 0;

  const isActive = (path: string) => {
    if (path === '/home') return pathname === '/home';
    if (path === '/cart') return pathname === '/cart' || (pathname.startsWith('/cart/') && !pathname.startsWith('/cart-new'));
    if (path === '/plan') return pathname === '/plan' || (pathname.startsWith('/plan/') && !pathname.startsWith('/plan/calendar'));
    return pathname.startsWith(path);
  };

  // Subtle parallax lift on scroll, max 8px
  const translateY = Math.min(scrollY / 250, 8);

  return (
    <nav
      style={{
        position: 'fixed',
        bottom: '20px',
        left: '3%',
        width: '94%',
        height: '64px',
        backgroundColor: 'rgba(255,255,255,0.72)',
        backdropFilter: 'blur(28px) saturate(200%)',
        WebkitBackdropFilter: 'blur(28px) saturate(200%)',
        border: '1px solid rgba(255,255,255,0.90)',
        borderRadius: '34px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.10), 0 0 0 0.5px rgba(0,0,0,0.04)',
        padding: '0 12px',
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
        const iconColor = active ? '#0A0A0A' : '#BBBBBB';
        return (
          <button
            key={item.path}
            onClick={() => {
              router.push(item.path);
              if (navigator.vibrate) navigator.vibrate(10);
            }}
            style={{
              background: active ? '#D5FE61' : 'transparent',
              border: 'none',
              borderRadius: '22px',
              cursor: 'pointer',
              padding: '10px 18px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background 0.2s',
              minWidth: '56px',
            }}
          >
            {item.icon === 'home' && (
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke={iconColor} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                <polyline points="9 22 9 12 15 12 15 22" />
              </svg>
            )}
            {item.icon === 'plan' && (
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke={iconColor} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="3" />
                <polyline points="9 12 11 14 15 10" />
              </svg>
            )}
            {item.icon === 'wishlist' && (
              <svg viewBox="0 0 24 24" width="22" height="22" fill={active ? '#0A0A0A' : 'none'} stroke={iconColor} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
              </svg>
            )}
            {item.icon === 'profile' && (
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke={iconColor} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            )}
          </button>
        );
      })}

      {/* Cart button — shown only when cart has items */}
      {showCartButton && (
        <button
          onClick={() => {
            router.push('/cart-new');
            if (navigator.vibrate) navigator.vibrate(10);
          }}
          style={{
            background: pathname === '/cart-new' ? '#D5FE61' : 'transparent',
            border: 'none',
            borderRadius: '22px',
            cursor: 'pointer',
            padding: '10px 18px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'background 0.2s',
            minWidth: '56px',
            position: 'relative',
          }}
        >
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke={pathname === '/cart-new' ? '#0A0A0A' : '#BBBBBB'} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
            <line x1="3" y1="6" x2="21" y2="6" />
            <path d="M16 10a4 4 0 0 1-8 0" />
          </svg>
          {cartCount > 0 && (
            <span style={{
              position: 'absolute',
              top: '6px',
              right: '10px',
              backgroundColor: '#EF4444',
              color: 'white',
              borderRadius: '10px',
              minWidth: '18px',
              height: '18px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '10px',
              fontWeight: 700,
              padding: '0 3px',
            }}>
              {cartCount > 9 ? '9+' : cartCount}
            </span>
          )}
        </button>
      )}
    </nav>
  );
}
