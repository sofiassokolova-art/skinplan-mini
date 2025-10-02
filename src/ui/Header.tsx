import { Link } from "react-router-dom";

export default function Header() {
  return (
    <header className="px-4 py-1 relative z-20">
      <div className="flex items-center justify-between">
        <Link 
          to="/" 
          aria-label="На главную" 
          className="flex items-center group"
        >
          <img 
            src="/skiniq-logo.png" 
            alt="SkinIQ" 
            className="h-20 w-auto group-hover:scale-105 transition-transform duration-300 drop-shadow-sm"
          />
        </Link>
      </div>
    </header>
  );
}