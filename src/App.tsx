import { Routes, Route, Link } from "react-router-dom";
import Home from "./pages/Home";
import Quiz from "./pages/Quiz";
import Cart from "./pages/Cart";
import Plan from "./pages/Plan";

const Shell: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="min-h-dvh bg-gradient-to-b from-rose-50 via-slate-50 to-orange-50 text-stone-900">
    <header className="px-6 sm:px-10 py-5 flex items-center justify-between">
      <Link to="/" className="font-semibold tracking-tight text-lg">SkinPlan</Link>
      <nav className="flex gap-3 text-sm">
        <Link className="px-3 py-1.5 rounded-full hover:bg-white/70 border" to="/quiz">Анкета</Link>
        <Link className="px-3 py-1.5 rounded-full hover:bg-white/70 border" to="/plan">План</Link>
        <Link className="px-3 py-1.5 rounded-full hover:bg-white/70 border" to="/cart">Корзина</Link>
        {/* Профиль удалён */}
      </nav>
    </header>
    <main className="px-6 sm:px-10 pb-14">{children}</main>
  </div>
);

export default function App() {
  return (
    <Shell>
      <Routes>
        <Route path="/" element={<Home/>} />
        <Route path="/quiz" element={<Quiz/>} />
        {/* маршрут профиля удалён */}
        <Route path="/cart" element={<Cart/>} />
        <Route path="/plan" element={<Plan/>} />
      </Routes>
    </Shell>
  );
}
