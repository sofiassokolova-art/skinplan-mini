import type { ReactNode } from 'react';

interface ModernButtonProps {
  children: ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'pill';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  className?: string;
  type?: 'button' | 'submit';
  fullWidth?: boolean;
}

export default function ModernButton({
  children,
  onClick,
  variant = 'primary',
  size = 'md',
  disabled = false,
  className = '',
  type = 'button',
  fullWidth = false,
  ...props
}: ModernButtonProps) {
  const baseStyles = "inline-flex items-center justify-center font-bold rounded-full transition-all duration-200 ease-out focus:outline-none focus:ring-4 focus:ring-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed relative overflow-hidden";
  
  const sizes = {
    sm: "px-4 py-2 text-sm",
    md: "px-6 py-3 text-base", 
    lg: "px-8 py-4 text-lg"
  };
  
  const variants = {
    primary: "bg-gradient-to-r from-purple-500 to-violet-500 text-white shadow-lg shadow-purple-500/25 hover:shadow-xl hover:shadow-purple-500/30 hover:scale-105 active:scale-95",
    secondary: "bg-white/80 text-purple-700 border border-purple-200/50 shadow-lg shadow-purple-500/5 hover:shadow-xl hover:shadow-purple-500/10 hover:bg-white hover:-translate-y-0.5",
    ghost: "bg-transparent text-purple-600 hover:bg-purple-50/50 hover:text-purple-800",
    pill: "bg-gradient-to-r from-purple-400 to-violet-400 text-white shadow-lg shadow-purple-500/25 hover:shadow-xl hover:shadow-purple-500/30 hover:scale-105 active:scale-95"
  };
  
  const widthClass = fullWidth ? "w-full" : "";
  
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${baseStyles} ${sizes[size]} ${variants[variant]} ${widthClass} ${className}`}
      {...props}
    >
      {/* Блеск при hover */}
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-out"></div>
      <span className="relative z-10" style={variant === 'primary' ? { color: 'white' } : undefined}>{children}</span>
    </button>
  );
}