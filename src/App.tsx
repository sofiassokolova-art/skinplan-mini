import { Routes, Route, Link } from "react-router-dom";
import Home from "./pages/Home";
import Quiz from "./pages/Quiz";
import Cart from "./pages/Cart";
import Plan from "./pages/Plan";
import SkinInsights from "./pages/SkinInsights";
import Onboarding, { useOnboarding } from "./components/Onboarding";

const Shell: React.FC<{ children: React.ReactNode; onShowHelp: () => void }> = ({ children, onShowHelp }) => (
  <div className="min-h-dvh bg-gradient-to-b from-rose-50 via-slate-50 to-orange-50 text-stone-900">
    <header className="px-6 sm:px-10 py-5 flex items-center justify-between">
      <Link to="/" className="font-semibold tracking-tight text-lg">SkinPlan</Link>
      <nav className="flex items-center gap-3 text-sm">
        <Link className="px-3 py-1.5 rounded-full hover:bg-white/70 border" to="/quiz">Анкета</Link>
        <Link className="px-3 py-1.5 rounded-full hover:bg-white/70 border" to="/plan">План</Link>
        <Link className="px-3 py-1.5 rounded-full hover:bg-white/70 border" to="/cart">Корзина</Link>
        <button 
          onClick={onShowHelp}
          className="text-gray-500 hover:text-gray-700 p-1 rounded transition"
          title="Показать инструкцию"
        >
          ❓
        </button>
      </nav>
    </header>
    <main className="px-6 sm:px-10 pb-14">{children}</main>
  </div>
);

export default function App() {
  const { showOnboarding, completeOnboarding, skipOnboarding, resetOnboarding } = useOnboarding();

  return (
    <>
      <Shell onShowHelp={resetOnboarding}>
        <Routes>
          <Route path="/" element={<Home/>} />
          <Route path="/quiz" element={<Quiz/>} />
          {/* маршрут профиля удалён */}
          <Route path="/cart" element={<Cart/>} />
          <Route path="/plan" element={<Plan/>} />
          <Route path="/insights" element={<SkinInsights/>} />
        </Routes>
      </Shell>
      
      {showOnboarding && (
        <Onboarding 
          onComplete={completeOnboarding}
          onSkip={skipOnboarding}
        />
      )}
    </>
  );
}
