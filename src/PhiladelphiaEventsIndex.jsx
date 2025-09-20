import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getZonedDate, PHILLY_TIME_ZONE, indexToMonthSlug } from './utils/dateUtils';

export default function PhiladelphiaEventsIndex() {
  const navigate = useNavigate();

  useEffect(() => {
    const now = getZonedDate(new Date(), PHILLY_TIME_ZONE);
    const slug = indexToMonthSlug(now.getMonth() + 1);
    const year = now.getFullYear();
    navigate(`/family-friendly-events-in-philadelphia-${slug}-${year}/`, { replace: true });
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-white text-gray-600">
      Redirecting to this month’s events…
    </div>
  );
}

