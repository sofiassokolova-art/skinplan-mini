import { Link } from "react-router-dom";
import SkinIQLogo from "../components/SkinIQLogo";

export default function Header() {
  return (
    <header className="px-4 py-2 relative z-20">
      <div className="flex items-center justify-between">
        <Link 
          to="/" 
          aria-label="На главную" 
          className="flex items-center group"
        >
          <SkinIQLogo size={28} className="group-hover:scale-105 transition-transform duration-300" />
        </Link>
      </div>
    </header>
  );
}