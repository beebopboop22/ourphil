import React from 'react';
import { useParams } from 'react-router-dom';
import MainEvents from './MainEvents.jsx';
import ThisMonthInPhiladelphia from './ThisMonthInPhiladelphia.jsx';

const MONTH_VIEW_REGEX = /^philadelphia-events-([a-z-]+)-(\d{4})$/i;

export default function ViewRouter() {
  const { view } = useParams();
  const matchesMonthView = typeof view === 'string' && MONTH_VIEW_REGEX.test(view);

  if (matchesMonthView) {
    return <ThisMonthInPhiladelphia />;
  }

  return <MainEvents />;
}

