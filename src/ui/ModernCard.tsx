import type { ReactNode } from 'react';

interface ModernCardProps {
  children: ReactNode;
  className?: string;
  variant?: 'default' | 'gradient' | 'glass';
  hover?: boolean;
}

export default function ModernCard({ 
  children, 
  className = '', 
  variant = 'default',
  hover = true 
}: ModernCardProps) {
  const baseStyles = "rounded-3xl border backdrop-blur-xl relative overflow-hidden";
  
  const variants = {
    default: "bg-white/80 border-white/50 shadow-xl shadow-purple-500/5",
    gradient: "bg-gradient-to-br from-white/90 to-purple-50/80 border-purple-100/50 shadow-xl shadow-purple-500/10",
    glass: "bg-white/60 border-white/40 shadow-2xl shadow-purple-500/10"
  };
  
  const hoverStyles = hover ? "hover:shadow-2xl hover:shadow-black/10 hover:-translate-y-1 transition-all duration-300 ease-out" : "";
  
  return (
    <div className={`${baseStyles} ${variants[variant]} ${hoverStyles} ${className}`}>
      {/* Декоративный градиент */}
      <div className="absolute inset-0 bg-gradient-to-br from-transparent via-transparent to-purple-500/5 pointer-events-none"></div>
      <div className="relative z-10">
        {children}
      </div>
    </div>
  );
}