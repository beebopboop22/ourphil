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
import PublicProfilePage from './PublicProfilePage.jsx';
import OnboardingFlow from './OnboardingFlow.jsx';
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
import AdminComments from './AdminComments.jsx';
import SocialVideoCarousel from './SocialVideoCarousel.jsx';
import PlansVideoCarousel from './PlansVideoCarousel.jsx';
import PlansVideoIndex from './PlansVideoIndex.jsx';
import AdminVideoPromo from './AdminVideoPromo.jsx';
import BigBoardEventPage  from './BigBoardEventPage';
import BigBoardCarousel from './BigBoardCarousel.jsx';
import MainEvents from './MainEvents.jsx';
import VenuePage from './VenuePage';
import MainEventsDetail from './MainEventsDetail.jsx';
import GroupEventDetailPage from './GroupEventDetailPage.jsx';
import ScrollToTop from './ScrollToTop'
import TagPage from './TagPage.jsx'
import ContactPage from './ContactPage.jsx'
import TraditionsFAQ from './TraditionsFAQ.jsx'
import GroupsFAQ from './GroupsFAQ.jsx'
import RecurringPage from './RecurringEventPage.jsx'
import SportsEventPage from './SportsEventPage.jsx'
import AboutPage from './AboutPage.jsx'









import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {/* Wrap entire app with AuthProvider to supply session & user */}
    <AuthProvider>
      <BrowserRouter>
      <ScrollToTop />
        <Routes>
          <Route path="/" element={<MainEvents />} />
          <Route path="/:view" element={<MainEvents />} />
          <Route path="/old" element={<App />} />
          <Route path="/sports" element={<SportsPage />} />
          <Route path="/sports/:id" element={<SportsEventPage />} />
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
          <Route path="/onboarding-preview" element={<OnboardingFlow demo />} />
          <Route path="/u/:slug" element={<PublicProfilePage />} />
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
          <Route path="/admin/comments" element={<AdminComments />} />
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/admin/activity" element={<AdminActivity />} />
          <Route path="/admin/video-promo" element={<AdminVideoPromo />} />
          <Route path="/social-video-arts" element={<SocialVideoCarousel tag="arts" />} />
          <Route path="/social-video-food" element={<SocialVideoCarousel tag="nomnomslurp" />} />
          <Route path="/social-video-fitness" element={<SocialVideoCarousel tag="fitness" />} />
          <Route path="/plans-video-arts" element={<PlansVideoCarousel tag="arts" />} />
          <Route path="/plans-video-food" element={<PlansVideoCarousel tag="nomnomslurp" />} />
          <Route path="/plans-video-birds" element={<PlansVideoCarousel tag="birds" />} />
          <Route path="/plans-video-fitness" element={<PlansVideoCarousel tag="fitness" limit={40} />} />
          <Route path="/plans-video-music" element={<PlansVideoCarousel tag="music" />} />
          <Route path="/plans-video-oktoberfest" element={<PlansVideoCarousel tag="oktoberfest" />} />
          <Route
            path="/plans-video-traditions"
            element={<PlansVideoCarousel onlyEvents headline="Upcoming Philly Traditions" />}
          />
          <Route path="/plans-video-peco" element={<PlansVideoCarousel tag="peco-multicultural" />} />
          <Route path="/plans-video-markets" element={<PlansVideoCarousel tag="markets" />} />
          <Route
            path="/plans-video/today"
            element={<PlansVideoCarousel today headline="Events Today in Philly" limit={30} />}
          />
        <Route
          path="/plans-video/weekend-plans"
          element={<PlansVideoCarousel weekend headline="Events This Weekend in Philly" limit={30} />}
        />
        <Route
          path="/plans-video/this-sunday"
          element={<PlansVideoCarousel sunday headline="Events This Sunday in Philly" limit={30} />}
        />
        <Route path="/plans-video" element={<PlansVideoIndex />} />
          <Route path="/big-board/:slug"  element={<BigBoardEventPage />} />
          <Route path="/board-carousel" element={<BigBoardCarousel />} />
          <Route path="/:venue" element={<VenuePage />} />
          <Route path="/:venue/:slug" element={<MainEventsDetail />} />
          <Route path="/groups/:slug/events/:eventId" element={<GroupEventDetailPage />} />
          <Route path="/tags/:slug" element={<TagPage />} />
          <Route path="/contact" element={<ContactPage />} />
          <Route path="/traditions-faq" element={<TraditionsFAQ />} />
          <Route path="/groups-faq" element={<GroupsFAQ />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/series/:slug/:date" element={<RecurringPage />} />







          
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  </React.StrictMode>
)
