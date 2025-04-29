import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'

import App from './App.jsx'
import SportsPage from './SportsPage.jsx'
import ConcertPage from './ConcertPage.jsx'
import TriviaNights from './TriviaNights.jsx'
import GroupsPage from './GroupsPage.jsx'
import VoicemailPage from './VoicemailPage.jsx'
import VolunteerGroups from './VolunteerGroups.jsx'
import GroupDetailPage from './GroupDetailPage.jsx'
import GroupTypePage from './GroupTypePage.jsx'
import LoginPage from './LoginPage.jsx'
import SignUpPage from './SignUpPage.jsx'
import ProfilePage from './ProfilePage.jsx'; 
import { AuthProvider } from './AuthProvider.jsx'
import MomentsExplorer from './MomentsExplorer.jsx' 

import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {/* Wrap entire app with AuthProvider to supply session & user */}
    <AuthProvider>
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
          <Route path="/groups/type/:tagSlug" element={<GroupTypePage />} />
          {/* Auth route for login */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignUpPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/moments" element={<MomentsExplorer />} />
          <Route path="/moments/:id" element={<MomentsExplorer />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  </React.StrictMode>
)
