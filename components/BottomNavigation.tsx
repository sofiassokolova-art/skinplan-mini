// components/BottomNavigation.tsx
// Перенесено из src/components/BottomNavigation.tsx

'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';

export default function BottomNavigation() {
  const pathname = usePathname();
  const router = useRouter();
  const [scrollProgress, setScrollProgress] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
      const scrolled = window.scrollY;
      setScrollProgress(scrolled / scrollHeight);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const opacity = 0.25 - (scrollProgress * 0.08); // Starts at 0.25, becomes 0.33 when scrolled

  const navItems = [
    { path: '/', icon: '🏠', label: 'Главная' },
    { path: '/plan', icon: '📋', label: 'План' },
    { path: '/insights', icon: '💡', label: 'Инсайты' },
  ];

  return (
    <nav
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 1000,
        backgroundColor: `rgba(255, 255, 255, ${opacity})`,
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderTop: '1px solid rgba(255, 255, 255, 0.2)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        transition: 'background-color 0.3s ease',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-around',
          alignItems: 'center',
          padding: '12px 0',
          maxWidth: '600px',
          margin: '0 auto',
        }}
      >
        {navItems.map((item) => {
          const isActive = pathname === item.path;
          return (
            <button
              key={item.path}
              onClick={() => router.push(item.path)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '4px',
                padding: '8px 16px',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: isActive ? '#0A5F59' : '#94A3B8',
                fontSize: '12px',
                fontWeight: isActive ? 600 : 400,
                transition: 'color 0.2s ease',
              }}
            >
              <span style={{ fontSize: '20px' }}>{item.icon}</span>
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
