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
import EventDetailPage from './EventDetailPage.jsx'
import MonthlyEvents from './MonthlyEvents.jsx'
import AdminClaimRequests from './AdminClaimRequests';
import UpdatePasswordPage from './UpdatePasswordPage';
import TestGroupUpdates from './TestGroupUpdates';
import SeasonalEventDetails from './SeasonalEventDetailPage';
import Bulletin from './Bulletin';
import EventsPage from './EventsPage.jsx'
import Unsubscribe from './Unsubscribe';
import PrivacyPage from './PrivacyPage.jsx'
import OutletDetailPage from './OutletDetailPage';
import BigBoardPage from './BigBoardPage.jsx';
import AdminUsers from './AdminUsers';
import AdminReviews from './AdminReviews';
import AdminGroupUpdates from './AdminGroupUpdates.jsx';
import AdminDashboard from './AdminDashboard.jsx';
import AdminActivity from './AdminActivity.jsx';






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
          <Route path="/events" element={<MonthlyEvents />} />
          <Route path="/events/:slug" element={<EventDetailPage />} />
          <Route path="/admin/claims" element={<AdminClaimRequests />} />
          <Route path="/update-password" element={<UpdatePasswordPage />} />
          <Route path="/test-updates" element={<TestGroupUpdates />} />
          <Route path="/seasonal/:slug" element={<SeasonalEventDetails />} />
          <Route path="/bulletin" element={<Bulletin />} />
          <Route path="/upcoming-events" element={<EventsPage />} />
          <Route path="/unsubscribe" element={<Unsubscribe />} />
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route path="/outlets/:slug" element={<OutletDetailPage />} />
          <Route path="/board" element={<BigBoardPage />} />
          <Route path="/admin/users" element={<AdminUsers />} />
          <Route path="/admin/reviews" element={<AdminReviews />} />
          <Route path="/admin/updates" element={<AdminGroupUpdates />} />
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/admin/activity" element={<AdminActivity />} />







          
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  </React.StrictMode>
)
