import { Routes, Route, useLocation } from "react-router-dom";
import { useState, useEffect } from "react";
import Home from "./pages/Home";
import Quiz from "./pages/Quiz";
import Cart from "./pages/Cart";
import Plan from "./pages/Plan";
import Photo from "./pages/Photo";
import PhotoResults from "./pages/PhotoResults";
import Insights from "./pages/Insights";
import Header from "./ui/Header";
import ErrorBoundary from "./ErrorBoundary";
import BottomNavigation from "./components/BottomNavigation";
import { storage } from "./utils/storage";

function App() {
  const location = useLocation();
  const [showNavigation, setShowNavigation] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [bottomSheetOpen, setBottomSheetOpen] = useState(false);
  
  // Слушаем событие открытия/закрытия BottomSheet
  useEffect(() => {
    const handleBottomSheetToggle = (event: CustomEvent) => {
      setBottomSheetOpen(event.detail.isOpen);
    };
    
    window.addEventListener('bottomSheetToggle', handleBottomSheetToggle as EventListener);
    return () => {
      window.removeEventListener('bottomSheetToggle', handleBottomSheetToggle as EventListener);
    };
  }, []);
  
  // Показываем Header только на страницах, где он нужен (не на главной и не в анкете)
  const showHeader = location.pathname !== '/' && location.pathname !== '/quiz';
  
  // Проверяем состояние онбординга для показа/скрытия навигации
  useEffect(() => {
    try {
      const quizCompleted = storage.get<boolean>('skinQuizCompleted', false);
      const isOnboarding = location.pathname === '/' && !quizCompleted;
      const shouldShowNav = location.pathname !== '/quiz' && 
                            !location.pathname.startsWith('/quiz') && 
                            !isOnboarding &&
                            !bottomSheetOpen; // Скрываем навигацию когда открыт BottomSheet
      setShowNavigation(shouldShowNav);
      setIsLoading(false);
    } catch (error) {
      console.error('Error checking quiz status in App:', error);
      setShowNavigation(location.pathname !== '/quiz' && !location.pathname.startsWith('/quiz') && !bottomSheetOpen);
      setIsLoading(false);
    }
  }, [location.pathname, bottomSheetOpen]);
  
  // Не показываем навигацию пока загружаемся
  if (isLoading) {
    return null;
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen relative">
        {showHeader && <Header />}
        
        <main className={showHeader ? "px-4 py-2 w-full sm:px-6 relative z-10" : "relative z-10"} style={{ paddingBottom: showNavigation ? '120px' : '0' }}>
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
        
        {showNavigation && <BottomNavigation />}
      </div>
    </ErrorBoundary>
  );
}

export default App;
