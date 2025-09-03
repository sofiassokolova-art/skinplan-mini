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

function App() {
  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50">
        <Header />
        <main className="px-4 py-4 max-w-sm mx-auto sm:max-w-lg md:max-w-2xl lg:max-w-4xl sm:px-6">
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