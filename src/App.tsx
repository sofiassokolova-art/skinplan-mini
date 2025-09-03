import { Routes, Route, Link } from "react-router-dom";
import Home from "./pages/Home";
import Quiz from "./pages/Quiz";
import Cart from "./pages/Cart";
import Plan from "./pages/Plan";
import Photo from "./pages/Photo";
import Insights from "./pages/Insights";

const Shell: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="min-h-dvh bg-gradient-to-b from-rose-50 via-slate-50 to-orange-50 text-stone-900">
    <header className="px-4 py-3" style={{position: "sticky", top: 0, zIndex: 40}}>
      <div style={{maxWidth: 1200, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between"}}>
        <Link to="/" aria-label="На главную" style={{display: "inline-flex", alignItems: "center", gap: 8}}>
          <img src="/skiniq-logo.png" alt="Skin IQ" style={{height: 106, width: "auto", display: "block"}} />
        </Link>
      </div>
    </header>
    <main style={{maxWidth: 1200, margin: "0 auto", padding: "0 16px 48px"}}>{children}</main>
  </div>
);

export default function App() {
  return (
    <Shell>
      <Routes>
        <Route path="/" element={<Home/>} />
        <Route path="/quiz" element={<Quiz/>} />
        <Route path="/cart" element={<Cart/>} />
        <Route path="/plan" element={<Plan/>} />
        <Route path="/photo" element={<Photo/>} />
        <Route path="/insights" element={<Insights/>} />
      </Routes>
    </Shell>
  );
}
