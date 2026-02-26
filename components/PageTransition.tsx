'use client';

// ОПТИМИЗАЦИЯ: CSS-only переходы вместо framer-motion (~637 KB не грузятся в layout)
import { usePathname } from 'next/navigation';
import { ReactNode, useEffect, useState } from 'react';

interface PageTransitionProps {
  children: ReactNode;
}

export default function PageTransition({ children }: PageTransitionProps) {
  const pathname = usePathname();
  // Применяем key только после гидрации — иначе React крашится при несовпадении
  // серверного и клиентского pathname во время первого рендера
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  return (
    <div key={mounted ? pathname : undefined} className="page-transition-enter">
      {children}
    </div>
  );
}
