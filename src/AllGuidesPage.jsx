import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import Navbar from './Navbar';
import Footer from './Footer';
import Seo from './components/Seo.jsx';
import { CATEGORY_ORDER } from './utils/monthlyCategoryConfig.js';
import {
  PHILLY_TIME_ZONE,
  getZonedDate,
  indexToMonthSlug,
  formatMonthYear,
} from './utils/dateUtils.js';
import { SITE_BASE_URL } from './utils/seoHelpers.js';

export default function AllGuidesPage() {
  const now = useMemo(() => getZonedDate(new Date(), PHILLY_TIME_ZONE), []);
  const monthSlug = indexToMonthSlug(now.getMonth() + 1);
  const year = now.getFullYear();
  const monthLabel = formatMonthYear(now, PHILLY_TIME_ZONE);

  const categoryButtons = CATEGORY_ORDER.map(cat => ({
    label: `${cat.label} (${monthLabel})`,
    href: `/${cat.slug}-events-in-philadelphia-${monthSlug}-${year}/`,
  }));

  const buttons = [
    {
      label: 'Philly Traditions Calendar',
      href: `/philadelphia-events-${monthSlug}-${year}/`,
    },
    {
      label: 'This Weekend in Philadelphia',
      href: '/this-weekend-in-philadelphia/',
    },
    ...categoryButtons,
  ];

  const pageTitle = `All Guides – Philadelphia Events & Traditions (${monthLabel})`;
  const description = `Browse Our Philly guides: traditions calendar, this weekend picks, and ${monthLabel} event roundups by category.`;
  const canonicalUrl = `${SITE_BASE_URL}/all-guides/`;

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <Seo
        title={pageTitle}
        description={description}
        canonicalUrl={canonicalUrl}
        ogImage={`${SITE_BASE_URL}/og-image.png`}
        ogType="website"
      />
      <Navbar />
      <main className="flex-1 pt-36 pb-16">
        <div className="mx-auto w-full max-w-5xl px-4">
          <header className="text-center">
            <h1 className="text-4xl sm:text-5xl font-[Barrio] text-[#28313e]">All Guides</h1>
            <p className="mt-4 text-lg text-gray-700">
              Quick links to every Our Philly guide, updated for {monthLabel}.
            </p>
          </header>
          <div className="mt-12 grid gap-6 sm:grid-cols-2">
            {buttons.map(button => (
              <Link
                key={button.href}
                to={button.href}
                className="flex items-center justify-center rounded-3xl bg-indigo-600 px-6 py-8 text-center text-xl font-semibold text-white shadow-lg transition hover:bg-indigo-700 focus:outline-none focus-visible:ring-4 focus-visible:ring-indigo-300"
              >
                {button.label}
              </Link>
            ))}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
