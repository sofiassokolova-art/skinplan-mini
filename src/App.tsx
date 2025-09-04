import { Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import Quiz from "./pages/Quiz";
import Cart from "./pages/Cart";
import Plan from "./pages/Plan";
import Photo from "./pages/Photo";
import PhotoResults from "./pages/PhotoResults";
import Insights from "./pages/Insights";
import Header from "./ui/Header";
import ErrorBoundary from "./ErrorBoundary";
import Onboarding, { useOnboarding } from "./components/Onboarding";

function App() {
  const { showOnboarding, completeOnboarding, skipOnboarding, resetOnboarding } = useOnboarding();

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-gray-50 relative overflow-hidden">
        
        <Header onShowHelp={resetOnboarding} />
        <main className="px-4 py-6 max-w-sm mx-auto sm:max-w-lg md:max-w-2xl lg:max-w-4xl sm:px-6 relative z-10">
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
        
        {showOnboarding && (
          <Onboarding 
            onComplete={completeOnboarding}
            onSkip={skipOnboarding}
          />
        )}
      </div>
    </ErrorBoundary>
  );
}

export default App;