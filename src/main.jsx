// src/main.jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import App from './App.jsx';
import SportsPage from './SportsPage.jsx';
import ConcertPage from './ConcertPage.jsx';
import TriviaNights from './TriviaNights';
import GroupsPage from './GroupsPage';
import VoicemailPage from './VoicemailPage';
import VolunteerGroups from './VolunteerGroups';
import GroupDetailPage from './GroupDetailPage';
import GroupTypePage from './GroupTypePage'; // 🆕

import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/sports" element={<SportsPage />} />
        <Route path="/trivia" element={<TriviaNights />} />
        <Route path="/voicemail" element={<VoicemailPage />} />
        <Route path="/groups" element={<GroupsPage />} />
        <Route path="/volunteer" element={<VolunteerGroups />} />
        <Route path="/concerts" element={<ConcertPage />} />
        <Route path="/groups/:slug" element={<GroupDetailPage />} />
        <Route path="/groups/type/:tagSlug" element={<GroupTypePage />} /> {/* 🆕 */}
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);
