import { Link } from "react-router-dom";

interface HeaderProps {
  onShowHelp?: () => void;
}

export default function Header({ onShowHelp }: HeaderProps) {
  return (
    <header className="container-premium py-6 relative z-20">
      <div className="flex items-center justify-between">
        <Link 
          to="/" 
          aria-label="На главную" 
          className="flex items-center group"
        >
          <img 
            src="/skiniq-logo.png" 
            alt="SkinIQ" 
            className="h-12 w-auto group-hover:scale-105 transition-transform duration-300 drop-shadow-sm"
          />
        </Link>
        
        {onShowHelp && (
          <button 
            onClick={onShowHelp}
            className="chip text-text-secondary hover:text-text-primary"
            title="Показать инструкцию по использованию"
          >
            Помощь
          </button>
        )}
      </div>
    </header>
  );
}