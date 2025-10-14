import React from 'react';
import { Route, Routes } from 'react-router-dom';
import App from './App.jsx';
import SportsPage from './SportsPage.jsx';
import ConcertPage from './ConcertPage.jsx';
import TriviaNights from './TriviaNights.jsx';
import GroupsPage from './GroupsPage.jsx';
import VoicemailPage from './VoicemailPage.jsx';
import VolunteerGroups from './VolunteerGroups.jsx';
import GroupDetailPage from './GroupDetailPage.jsx';
import GroupTypePage from './GroupTypePage.jsx';
import LoginPage from './LoginPage.jsx';
import SignUpPage from './SignUpPage.jsx';
import ProfilePage from './ProfilePage.jsx';
import PublicProfilePage from './PublicProfilePage.jsx';
import OnboardingFlow from './OnboardingFlow.jsx';
import MomentsExplorer from './MomentsExplorer.jsx';
import EventDetailPage from './EventDetailPage.jsx';
import MonthlyEvents from './MonthlyEvents.jsx';
import AdminClaimRequests from './AdminClaimRequests';
import UpdatePasswordPage from './UpdatePasswordPage';
import TestGroupUpdates from './TestGroupUpdates';
import SeasonalEventDetails from './SeasonalEventDetailPage';
import Bulletin from './Bulletin';
import EventsPage from './EventsPage.jsx';
import Unsubscribe from './Unsubscribe';
import PrivacyPage from './PrivacyPage.jsx';
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
import TraditionsVideo from './TraditionsVideo.jsx';
import BigBoardEventPage from './BigBoardEventPage';
import BigBoardCarousel from './BigBoardCarousel.jsx';
import MainEvents from './MainEvents.jsx';
import VenuePage from './VenuePage';
import MainEventsDetail from './MainEventsDetail.jsx';
import GroupEventDetailPage from './GroupEventDetailPage.jsx';
import TagPage from './TagPage.jsx';
import ContactPage from './ContactPage.jsx';
import TraditionsFAQ from './TraditionsFAQ.jsx';
import GroupsFAQ from './GroupsFAQ.jsx';
import RecurringPage from './RecurringEventPage.jsx';
import SportsEventPage from './SportsEventPage.jsx';
import AboutPage from './AboutPage.jsx';
import MailingListPage from './MailingListPage.jsx';
import ThisWeekendInPhiladelphia from './ThisWeekendInPhiladelphia.jsx';
import ThisMonthInPhiladelphia from './ThisMonthInPhiladelphia.jsx';
import PhiladelphiaEventsIndex from './PhiladelphiaEventsIndex.jsx';
import FamilyFriendlyMonthlyPage from './FamilyFriendlyMonthlyPage.jsx';
import ArtsCultureMonthlyPage from './ArtsCultureMonthlyPage.jsx';
import FoodDrinkMonthlyPage from './FoodDrinkMonthlyPage.jsx';
import FitnessWellnessMonthlyPage from './FitnessWellnessMonthlyPage.jsx';
import MusicMonthlyPage from './MusicMonthlyPage.jsx';
import AllGuidesPage from './AllGuidesPage.jsx';
import SearchResultsPage from './SearchResultsPage.jsx';
import ViewRouter from './ViewRouter.jsx';
import CommunityIndexPage from './CommunityIndexPage.jsx';
import LabsMapPage from './LabsMapPage.jsx';
import { COMMUNITY_REGIONS } from './communityIndexData.js';

export const baseRouteConfig = [
  { path: '/', element: <MainEvents /> },
  {
    path: '/this-weekend-in-philadelphia/',
    element: <ThisWeekendInPhiladelphia />,
  },
  {
    path: '/philadelphia-events/',
    element: <PhiladelphiaEventsIndex />,
  },
  {
    path: '/philadelphia-events-:month-:year/',
    element: <ThisMonthInPhiladelphia />,
  },
  {
    path: '/family-friendly-events-in-philadelphia-:month-:year/',
    element: <FamilyFriendlyMonthlyPage />,
  },
  {
    path: '/arts-culture-events-in-philadelphia-:month-:year/',
    element: <ArtsCultureMonthlyPage />,
  },
  {
    path: '/food-drink-events-in-philadelphia-:month-:year/',
    element: <FoodDrinkMonthlyPage />,
  },
  {
    path: '/fitness-events-in-philadelphia-:month-:year/',
    element: <FitnessWellnessMonthlyPage />,
  },
  {
    path: '/music-events-in-philadelphia-:month-:year/',
    element: <MusicMonthlyPage />,
  },
  { path: '/all-guides/', element: <AllGuidesPage /> },
  { path: '/search', element: <SearchResultsPage /> },
  { path: '/map', element: <LabsMapPage /> },
  { path: '/:view', element: <ViewRouter /> },
  { path: '/old', element: <App /> },
  { path: '/sports', element: <SportsPage /> },
  { path: '/sports/:id', element: <SportsEventPage /> },
  { path: '/trivia', element: <TriviaNights /> },
  { path: '/voicemail', element: <VoicemailPage /> },
  { path: '/groups', element: <GroupsPage /> },
  { path: '/volunteer', element: <VolunteerGroups /> },
  { path: '/concerts', element: <ConcertPage /> },
  { path: '/groups/:slug', element: <GroupDetailPage /> },
  { path: '/groups/type/:tagSlug', element: <GroupTypePage /> },
  { path: '/login', element: <LoginPage /> },
  { path: '/signup', element: <SignUpPage /> },
  { path: '/profile', element: <ProfilePage /> },
  { path: '/onboarding-preview', element: <OnboardingFlow demo /> },
  { path: '/u/:slug', element: <PublicProfilePage /> },
  { path: '/moments', element: <MomentsExplorer /> },
  { path: '/moments/:id', element: <MomentsExplorer /> },
  { path: '/events', element: <MonthlyEvents /> },
  { path: '/events/:slug', element: <EventDetailPage /> },
  { path: '/admin/claims', element: <AdminClaimRequests /> },
  { path: '/update-password', element: <UpdatePasswordPage /> },
  { path: '/test-updates', element: <TestGroupUpdates /> },
  { path: '/seasonal/:slug', element: <SeasonalEventDetails /> },
  { path: '/bulletin', element: <Bulletin /> },
  { path: '/upcoming-events', element: <EventsPage /> },
  { path: '/unsubscribe', element: <Unsubscribe /> },
  { path: '/privacy', element: <PrivacyPage /> },
  { path: '/outlets/:slug', element: <OutletDetailPage /> },
  { path: '/board', element: <BigBoardPage /> },
  { path: '/admin/users', element: <AdminUsers /> },
  { path: '/admin/reviews', element: <AdminReviews /> },
  { path: '/admin/updates', element: <AdminGroupUpdates /> },
  { path: '/admin/comments', element: <AdminComments /> },
  { path: '/admin', element: <AdminDashboard /> },
  { path: '/admin/activity', element: <AdminActivity /> },
  {
    path: '/social-video-arts',
    element: <SocialVideoCarousel tag="arts" />,
  },
  {
    path: '/social-video-food',
    element: <SocialVideoCarousel tag="nomnomslurp" />,
  },
  {
    path: '/social-video-fitness',
    element: <SocialVideoCarousel tag="fitness" />,
  },
  {
    path: '/plans-video-arts',
    element: <PlansVideoCarousel tag="arts" />,
  },
  {
    path: '/plans-video-food',
    element: <PlansVideoCarousel tag="nomnomslurp" />,
  },
  {
    path: '/plans-video-birds',
    element: <PlansVideoCarousel tag="birds" />,
  },
  {
    path: '/plans-video-fitness',
    element: <PlansVideoCarousel tag="fitness" limit={40} />,
  },
  {
    path: '/plans-video-halloween',
    element: <PlansVideoCarousel tag="halloween" />,
  },
  {
    path: '/plans-video-family',
    element: <PlansVideoCarousel tag="family" />,
  },
  {
    path: '/plans-video-pride',
    element: <PlansVideoCarousel tag="pride" />,
  },
  {
    path: '/plans-video-music',
    element: <PlansVideoCarousel tag="music" />,
  },
  {
    path: '/plans-video-oktoberfest',
    element: <PlansVideoCarousel tag="oktoberfest" />,
  },
  {
    path: '/plans-video/traditions-video',
    element: <TraditionsVideo />,
  },
  {
    path: '/plans-video/traditions-gallery',
    element: (
      <PlansVideoCarousel
        onlyEvents
        headline="Traditions gAllery"
        limit={30}
      />
    ),
  },
  {
    path: '/plans-video-peco',
    element: <PlansVideoCarousel tag="peco-multicultural" />,
  },
  {
    path: '/plans-video-markets',
    element: <PlansVideoCarousel tag="markets" />,
  },
  {
    path: '/plans-video/today',
    element: <PlansVideoCarousel today headline="Events Today in Philly" limit={30} />,
  },
  {
    path: '/plans-video/weekend-plans',
    element: (
      <PlansVideoCarousel
        weekend
        headline="Events This Weekend in Philly"
        limit={30}
      />
    ),
  },
  {
    path: '/plans-video/this-sunday',
    element: (
      <PlansVideoCarousel
        sunday
        headline="Events This Sunday in Philly"
        limit={30}
      />
    ),
  },
  { path: '/plans-video', element: <PlansVideoIndex /> },
  { path: '/big-board/:slug', element: <BigBoardEventPage /> },
  { path: '/board-carousel', element: <BigBoardCarousel /> },
  { path: '/:venue', element: <VenuePage /> },
  { path: '/:venue/:slug', element: <MainEventsDetail /> },
  {
    path: '/groups/:slug/events/:eventId',
    element: <GroupEventDetailPage />,
  },
  { path: '/tags/:slug', element: <TagPage /> },
  { path: '/contact', element: <ContactPage /> },
  { path: '/mailing-list', element: <MailingListPage /> },
  { path: '/traditions-faq', element: <TraditionsFAQ /> },
  { path: '/groups-faq', element: <GroupsFAQ /> },
  { path: '/about', element: <AboutPage /> },
  { path: '/series/:slug', element: <RecurringPage /> },
  { path: '/series/:slug/:date', element: <RecurringPage /> },
];

export function AppRoutes() {
  return (
    <Routes>
      {baseRouteConfig.map(route => (
        <Route key={route.path} path={route.path} element={route.element} />
      ))}
      {COMMUNITY_REGIONS.map(region => (
        <Route
          key={`region-${region.slug}`}
          path={`/${region.slug}/`}
          element={<CommunityIndexPage region={region} />}
        />
      ))}
    </Routes>
  );
}

export default AppRoutes;
