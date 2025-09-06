import { Routes, Route } from "react-router-dom";
import Header from "./ui/Header";

import Home from "./pages/Home";
import Photo from "./pages/Photo";
import Quiz from "./pages/Quiz";
import Plan from "./pages/Plan";
import Cart from "./pages/Cart";
import Consult from "./pages/Consult";

export default function App() {
  return (
    <>
      <Header />
      <main style={{ maxWidth: 1200, margin: "0 auto", padding: "0 16px 48px" }}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/quiz" element={<Quiz />} />
          <Route path="/photo" element={<Photo />} />
          <Route path="/plan" element={<Plan />} />
          <Route path="/cart" element={<Cart />} />
          <Route path="/consult" element={<Consult />} />
          {/* запасной маршрут */}
          <Route path="*" element={<Home />} />
        </Routes>
      </main>
    </>
  );
}

