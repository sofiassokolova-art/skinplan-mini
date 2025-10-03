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
    default: "bg-white/60 border-purple-200/30 shadow-[0_8px_32px_rgba(139,92,246,0.12)]",
    gradient: "bg-gradient-to-br from-white/70 to-purple-50/50 border-purple-200/40 shadow-[0_8px_32px_rgba(139,92,246,0.15)]",
    glass: "bg-white/50 border-purple-200/25 shadow-[0_12px_40px_rgba(139,92,246,0.1)]"
  };
  
  const hoverStyles = hover ? "hover:shadow-[0_12px_48px_rgba(139,92,246,0.18)] hover:-translate-y-1 transition-all duration-300 ease-out" : "";
  
  return (
    <div className={`${baseStyles} ${variants[variant]} ${hoverStyles} ${className}`}>
      {/* Decorative lavender gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-transparent via-transparent to-purple-500/5 pointer-events-none"></div>
      <div className="relative z-10">
        {children}
      </div>
    </div>
  );
}