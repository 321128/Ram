import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import DubbingInterface from "./components/DubbingInterface";
import FrontX from "./FrontX";
import ProtectedRoute from "./components/ProtectedRoute"; // 👈 add this
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        {/* Audience */}
        <Route path="/frontx/*" element={<FrontX />} />
        {/* Operator (protected by password) */}
        <Route path="/fronty/*" element={<ProtectedRoute />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>
);
