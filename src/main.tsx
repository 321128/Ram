import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import DubbingInterface from './components/DubbingInterface';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        {/* Boot directly into your interface */}
        <Route path="/" element={<DubbingInterface />} />
        {/* Optional mirrors if you’re serving under subpaths */}
        <Route path="/frontx/*" element={<DubbingInterface />} />
        <Route path="/fronty/*" element={<DubbingInterface />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>
);
