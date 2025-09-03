import { Link } from "react-router-dom";

export default function Header() {
  return (
    <header className="px-4 py-4 bg-white/70 backdrop-blur-xl border-b border-white/50 relative z-20">
      <div className="max-w-sm mx-auto sm:max-w-lg md:max-w-2xl lg:max-w-4xl flex items-center justify-center">
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
      </div>
    </header>
  );
}