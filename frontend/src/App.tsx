import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Sidebar from "@/components/Sidebar";
import Home from "@/pages/Home";
import Backtest from "@/pages/Backtest";
import Scoring from "@/pages/Scoring";
import Portfolio from "@/pages/Portfolio";

export default function App() {
  return (
    <Router>
      <Sidebar />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/backtest" element={<Backtest />} />
        <Route path="/scoring" element={<Scoring />} />
        <Route path="/portfolio" element={<Portfolio />} />
      </Routes>
    </Router>
  );
}
