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
  
  // Показываем Header только на страницах, где он нужен (не на главной и не в анкете)
  const showHeader = location.pathname !== '/' && location.pathname !== '/quiz';

  return (
    <ErrorBoundary>
      <div className="min-h-screen relative">
        {showHeader && <Header />}
        
        <main className={showHeader ? "px-4 py-2 w-full sm:px-6 relative z-10" : "relative z-10"}>
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