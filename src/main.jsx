// src/main.jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import App from './App.jsx';
import SportsPage from './SportsPage.jsx';
import TriviaNights from './TriviaNights';
import VolunteerGroups from './VolunteerGroups';

import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/sports" element={<SportsPage />} />
        <Route path="/trivia" element={<TriviaNights />} />
        <Route path="/volunteer" element={<VolunteerGroups />} />


      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);