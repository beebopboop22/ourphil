import React, { useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import Seo from './components/Seo.jsx';
import { getCurrentMonthlyLabel, getCurrentMonthlyPath } from './utils/dateUtils';

const SITE_BASE_URL = 'https://ourphilly.org';
const DEFAULT_OG_IMAGE = 'https://ourphilly.org/og-image.png';

export default function PhiladelphiaEventsIndex() {
  const navigate = useNavigate();
  const currentMonthlyPath = useMemo(() => getCurrentMonthlyPath(), []);
  const currentMonthlyLabel = useMemo(() => getCurrentMonthlyLabel(), []);
  const canonicalUrl = `${SITE_BASE_URL}${currentMonthlyPath}`;
  const title = currentMonthlyLabel
    ? `Events in Philadelphia – ${currentMonthlyLabel}`
    : 'Events in Philadelphia – Our Philly';
  const description = currentMonthlyLabel
    ? `Explore ${currentMonthlyLabel} traditions, festivals, and family-friendly events in Philadelphia with Our Philly.`
    : 'Explore monthly Philadelphia traditions, festivals, markets, and family-friendly events with Our Philly.';

  useEffect(() => {
    navigate(currentMonthlyPath, { replace: true });
  }, [navigate, currentMonthlyPath]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-white text-gray-600">
      <Seo
        title={title}
        description={description}
        canonicalUrl={canonicalUrl}
        ogImage={DEFAULT_OG_IMAGE}
      />
      Redirecting to this month’s events…
    </div>
  );
}

