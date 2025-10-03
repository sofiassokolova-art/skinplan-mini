import { Routes, Route, useLocation } from "react-router-dom";
import Home from "./pages/Home";
import Quiz from "./pages/Quiz";
import Cart from "./pages/Cart";
import Plan from "./pages/Plan";
import Photo from "./pages/Photo";
import PhotoResults from "./pages/PhotoResults";
import Insights from "./pages/Insights";
import Header from "./ui/Header";
import ErrorBoundary from "./ErrorBoundary";

function App() {
  const location = useLocation();
  
  // Показываем Header только на страницах, где он нужен (не на главной)
  const showHeader = location.pathname !== '/';

  return (
    <ErrorBoundary>
      <div className="min-h-screen relative">
        {/* Soft lavender gradient background for all pages */}
        {showHeader && (
          <>
            <div className="fixed inset-0 -z-20 bg-gradient-to-br from-[#f5f3ff] via-[#faf5ff] to-[#f0f0f5]" />
            
            {/* Large gradient sphere decoration */}
            <div 
              className="fixed -top-32 -right-32 w-[500px] h-[500px] rounded-full opacity-60 blur-3xl -z-10"
              style={{
                background: 'radial-gradient(circle at 30% 30%, rgba(233, 213, 255, 0.9) 0%, rgba(196, 181, 253, 0.7) 30%, rgba(167, 139, 250, 0.5) 60%, rgba(139, 92, 246, 0.3) 100%)',
                boxShadow: '0 40px 120px rgba(139, 92, 246, 0.3)',
              }}
            />
          </>
        )}
        
        {showHeader && <Header />}
        
        <main className={showHeader ? "px-4 py-2 max-w-sm mx-auto sm:max-w-lg md:max-w-2xl lg:max-w-4xl sm:px-6 relative z-10" : "relative z-10"}>
          <ErrorBoundary>
            <Routes>
              <Route path="/" element={<Home/>} />
              <Route path="/quiz" element={<Quiz/>} />
              <Route path="/cart" element={<Cart/>} />
              <Route path="/plan" element={<Plan/>} />
              <Route path="/photo" element={<Photo/>} />
              <Route path="/photo/results" element={<PhotoResults/>} />
              <Route path="/insights" element={<Insights/>} />
            </Routes>
          </ErrorBoundary>
        </main>
      </div>
    </ErrorBoundary>
  );
}

export default App;