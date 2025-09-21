interface TaskCardProps {
  icon: string;
  title: string;
  subtitle?: string;
  completed?: boolean;
  onClick?: () => void;
  className?: string;
}

export default function TaskCard({
  icon,
  title,
  subtitle,
  completed = false,
  onClick,
  className = ""
}: TaskCardProps) {
  return (
    <div 
      className={`
        card p-4 cursor-pointer transition-all duration-300
        ${completed ? 'card-active opacity-75' : 'hover:shadow-glow'}
        ${className}
      `}
      onClick={onClick}
    >
      <div className="flex items-center gap-4">
        {/* Иконка */}
        <div className={`
          w-12 h-12 rounded-2xl flex items-center justify-center text-xl
          transition-all duration-300
          ${completed 
            ? 'bg-accent2/20 shadow-neumorphism-inset' 
            : 'bg-accent2/10 shadow-neumorphism'
          }
        `}>
          {icon}
        </div>
        
        {/* Контент */}
        <div className="flex-1">
          <h4 className={`
            font-sans font-medium text-text-primary transition-colors duration-300
            ${completed ? 'line-through opacity-60' : ''}
          `}>
            {title}
          </h4>
          {subtitle && (
            <p className="text-sm text-text-secondary mt-1">
              {subtitle}
            </p>
          )}
        </div>
        
        {/* Чекбокс */}
        <div className={`
          w-6 h-6 rounded-full border-2 flex items-center justify-center
          transition-all duration-300
          ${completed 
            ? 'bg-accent2 border-accent2 shadow-glow' 
            : 'border-accent2/40 hover:border-accent2'
          }
        `}>
          {completed && (
            <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
          )}
        </div>
      </div>
    </div>
  );
}