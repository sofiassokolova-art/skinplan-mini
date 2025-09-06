// src/ui/Header.tsx
import { Link } from "react-router-dom";
import logoUrl from "../assets/skiniq-logo.png"; // <-- импортируем файл

export default function Header() {
  return (
    <header className="px-4 py-3" style={{ position: "sticky", top: 0, zIndex: 40 }}>
      <div style={{ maxWidth: 1200, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Link to="/" aria-label="На главную" style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
          <img
            src={logoUrl}
            alt="Skin IQ"
            style={{ height: 106, width: "auto", display: "block" }}
          />
        </Link>
      </div>
    </header>
  );
}

