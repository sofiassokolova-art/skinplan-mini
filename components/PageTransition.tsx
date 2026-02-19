'use client';

// ОПТИМИЗАЦИЯ: CSS-only переходы вместо framer-motion (~637 KB не грузятся в layout)
import { usePathname } from 'next/navigation';
import { ReactNode } from 'react';

interface PageTransitionProps {
  children: ReactNode;
}

export default function PageTransition({ children }: PageTransitionProps) {
  const pathname = usePathname();

  return (
    <div key={pathname} className="page-transition-enter">
      {children}
    </div>
  );
}
