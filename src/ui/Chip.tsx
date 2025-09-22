type ChipProps = {
  children: React.ReactNode;
  active?: boolean;
  onClick?: () => void;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
};

export default function Chip({ 
  children, 
  active = false, 
  onClick, 
  className = "",
  size = 'md'
}: ChipProps) {
  const sizeClasses = {
    sm: "px-3 py-1.5 text-xs",
    md: "px-4 py-2 text-sm",
    lg: "px-6 py-3 text-base"
  };

  const chipClasses = `
    chip
    ${active ? 'chip-active' : ''}
    ${onClick ? 'cursor-pointer' : ''}
    ${sizeClasses[size]}
    ${className}
  `.trim();

  return (
    <button 
      className={chipClasses} 
      onClick={onClick}
      type="button"
    >
      {children}
    </button>
  );
}