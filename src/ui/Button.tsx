
type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
};

export default function Button({ 
  children, 
  className = "", 
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  ...props 
}: ButtonProps) {
  const baseClasses = "btn font-sans font-semibold transition-all duration-300 ease-out";
  
  const variantClasses = {
    primary: "btn-primary hover:shadow-glow-strong",
    secondary: "bg-pearl-card text-text-primary shadow-neumorphism hover:shadow-glow border border-accent/20",
    ghost: "bg-transparent text-text-primary hover:bg-pearl-card/50"
  };
  
  const sizeClasses = {
    sm: "px-4 py-2 text-sm",
    md: "px-6 py-3 text-base", 
    lg: "px-8 py-4 text-lg"
  };
  
  const widthClass = fullWidth ? "w-full" : "";
  
  return (
    <button
      {...props}
      className={`
        ${baseClasses} 
        ${variantClasses[variant]} 
        ${sizeClasses[size]} 
        ${widthClass} 
        ${className}
      `.trim()}
    >
      {children}
    </button>
  );
}

