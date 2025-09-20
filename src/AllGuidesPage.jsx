import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import Navbar from './Navbar';
import Footer from './Footer';
import Seo from './components/Seo.jsx';
import {
  getZonedDate,
  PHILLY_TIME_ZONE,
  formatMonthYear,
  indexToMonthSlug,
} from './utils/dateUtils';
import { SITE_BASE_URL, DEFAULT_OG_IMAGE } from './utils/seoHelpers.js';

export default function AllGuidesPage() {
  const now = useMemo(() => getZonedDate(new Date(), PHILLY_TIME_ZONE), []);
  const monthLabel = formatMonthYear(now, PHILLY_TIME_ZONE);
  const monthSlug = indexToMonthSlug(now.getMonth() + 1);
  const year = now.getFullYear();
  const familyFriendlyPath = monthSlug
    ? `/family-friendly-events-in-philadelphia-${monthSlug}-${year}/`
    : '/family-friendly-events-in-philadelphia/';
  const traditionsPath = monthSlug
    ? `/philadelphia-events-${monthSlug}-${year}/`
    : '/philadelphia-events/';

  const guides = [
    {
      label: 'This Weekend in Philadelphia',
      description: 'Curated festivals, markets, and concerts to help you plan a perfect Philly weekend.',
      href: '/this-weekend-in-philadelphia/',
    },
    {
      label: 'Philly Traditions Calendar',
      description: 'Monthly traditions, markets, and perennial favorites happening all across the city.',
      href: traditionsPath,
    },
    {
      label: `Family-Friendly – ${monthLabel}`,
      description: 'Kid-approved events, storytimes, and hands-on adventures happening throughout the city this month.',
      href: familyFriendlyPath,
    },
  ];

  return (
    <div className="flex flex-col min-h-screen bg-white">
      <Seo
        title="All Guides – Our Philly"
        description="Browse every Our Philly guide in one place, from weekend plans to family-friendly roundups."
        canonicalUrl={`${SITE_BASE_URL}/all-guides/`}
        ogImage={DEFAULT_OG_IMAGE}
        ogType="website"
      />
      <Navbar />
      <main className="flex-1 pt-36 md:pt-40 pb-16">
        <div className="container mx-auto px-4 max-w-4xl">
          <h1 className="text-4xl sm:text-5xl font-[Barrio] text-[#28313e] text-center">All Our Philly Guides</h1>
          <p className="mt-6 text-lg text-gray-700 text-center max-w-3xl mx-auto">
            Everything we publish to help you explore Philadelphia, curated in one place.
          </p>
          <div className="mt-10 grid grid-cols-1 gap-6">
            {guides.map(guide => (
              <Link
                key={guide.href}
                to={guide.href}
                className="block border border-gray-200 rounded-2xl shadow-sm hover:shadow-md transition p-6 bg-white"
              >
                <h2 className="text-2xl font-semibold text-[#28313e]">{guide.label}</h2>
                <p className="mt-2 text-gray-600">{guide.description}</p>
                <span className="mt-4 inline-flex items-center text-indigo-600 font-semibold">
                  Explore guide →
                </span>
              </Link>
            ))}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}

