import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import DubbingInterface from './components/DubbingInterface';
import FrontX from './FrontX';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        {/* Boot directly into your interface */}
        <Route path="/" element={<DubbingInterface />} />
        {/* Optional mirrors if you’re serving under subpaths */}
        <Route path="/frontx/*" element={<FrontX />} />
        <Route path="/fronty/*" element={<DubbingInterface />} /> {/* or another variant */}
      </Routes>
    </BrowserRouter>
  </StrictMode>
);
