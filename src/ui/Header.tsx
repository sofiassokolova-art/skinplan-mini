import { Link } from "react-router-dom";

interface HeaderProps {
  onShowHelp?: () => void;
}

export default function Header({ onShowHelp }: HeaderProps) {
  return (
    <header className="px-4 py-4 bg-white border-b border-gray-100 relative z-20">
      <div className="max-w-sm mx-auto sm:max-w-lg md:max-w-2xl lg:max-w-4xl flex items-center justify-between">
        <Link 
          to="/" 
          aria-label="На главную" 
          className="flex items-center group"
        >
          <img 
            src="/skiniq-logo.png" 
            alt="Skin IQ" 
            className="h-16 w-auto sm:h-18 md:h-20 lg:h-22 group-hover:scale-105 transition-transform duration-200 drop-shadow-lg"
          />
        </Link>
        
        {onShowHelp && (
          <button 
            onClick={onShowHelp}
            className="text-gray-500 hover:text-gray-700 p-2 rounded-full hover:bg-gray-100 transition"
            title="Показать инструкцию"
          >
            ❓
          </button>
        )}
      </div>
    </header>
  );
}