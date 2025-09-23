import React from 'react';
import { useParams } from 'react-router-dom';
import DayEventsPage from './DayEventsPage.jsx';
import ThisMonthInPhiladelphia from './ThisMonthInPhiladelphia.jsx';
import FamilyFriendlyMonthlyPage from './FamilyFriendlyMonthlyPage.jsx';
import ArtsCultureMonthlyPage from './ArtsCultureMonthlyPage.jsx';
import FoodDrinkMonthlyPage from './FoodDrinkMonthlyPage.jsx';
import FitnessWellnessMonthlyPage from './FitnessWellnessMonthlyPage.jsx';
import MusicMonthlyPage from './MusicMonthlyPage.jsx';
import { MONTHLY_GUIDE_CONFIGS } from './monthlyGuideConfigs.js';

const MONTH_VIEW_REGEX = /^philadelphia-events-([a-z-]+)-(\d{4})$/i;

const GUIDE_ROUTES = [
  { regex: MONTHLY_GUIDE_CONFIGS.family.viewRegex, Component: FamilyFriendlyMonthlyPage },
  { regex: MONTHLY_GUIDE_CONFIGS.artsCulture.viewRegex, Component: ArtsCultureMonthlyPage },
  { regex: MONTHLY_GUIDE_CONFIGS.foodDrink.viewRegex, Component: FoodDrinkMonthlyPage },
  { regex: MONTHLY_GUIDE_CONFIGS.fitnessWellness.viewRegex, Component: FitnessWellnessMonthlyPage },
  { regex: MONTHLY_GUIDE_CONFIGS.music.viewRegex, Component: MusicMonthlyPage },
];

export default function ViewRouter() {
  const { view } = useParams();
  const matchesMonthView = typeof view === 'string' && MONTH_VIEW_REGEX.test(view);
  const guideRoute =
    typeof view === 'string' && GUIDE_ROUTES.find(route => route.regex.test(view));

  if (matchesMonthView) {
    return <ThisMonthInPhiladelphia />;
  }

  if (guideRoute) {
    const { Component } = guideRoute;
    return <Component />;
  }

  return <DayEventsPage />;
}

