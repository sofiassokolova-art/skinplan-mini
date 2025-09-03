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
          <div className="text-2xl sm:text-3xl md:text-4xl font-black bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent tracking-tight group-hover:scale-105 transition-transform duration-200">
            SkinIQ
          </div>
        </Link>
      </div>
    </header>
  );
}