import { Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import Quiz from "./pages/Quiz";
import Cart from "./pages/Cart";
import Plan from "./pages/Plan";
import Photo from "./pages/Photo";
import Insights from "./pages/Insights";
import Header from "./ui/Header";

function App() {
  return (
    <>
      <Header />
      <main style={{maxWidth: 1200, margin: "0 auto", padding: "0 16px 48px"}}>
        <Routes>
          <Route path="/" element={<Home/>} />
          <Route path="/quiz" element={<Quiz/>} />
          <Route path="/cart" element={<Cart/>} />
          <Route path="/plan" element={<Plan/>} />
          <Route path="/photo" element={<Photo/>} />
          <Route path="/insights" element={<Insights/>} />
        </Routes>
      </main>
    </>
  );
}

export default App;