import { Link } from "react-router-dom";

export default function Header() {
  return (
    <header className="px-4 py-3 bg-white/80 backdrop-blur-sm border-b border-gray-100">
      <div className="max-w-sm mx-auto sm:max-w-lg md:max-w-2xl lg:max-w-4xl flex items-center justify-center">
        <Link 
          to="/" 
          aria-label="На главную" 
          className="flex items-center"
        >
          <img 
            src="/skiniq-logo.png" 
            alt="Skin IQ" 
            className="h-16 w-auto sm:h-20 md:h-24"
          />
        </Link>
      </div>
    </header>
  );
}