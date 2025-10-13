// src/Footer.jsx
import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import NewsletterPromo from './components/NewsletterPromo';
import {
  getZonedDate,
  PHILLY_TIME_ZONE,
  formatMonthYear,
  formatMonthName,
  indexToMonthSlug,
} from './utils/dateUtils';

const Footer = () => {
  const heartUrl =
    'https://qdartpzrxmftmaftfdbd.supabase.co/storage/v1/object/sign/group-images/OurPhilly-CityHeart-1.png?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1cmwiOiJncm91cC1pbWFnZXMvT3VyUGhpbGx5LUNpdHlIZWFydC0xLnBuZyIsImlhdCI6MTc0NTYxMjg5OSwiZXhwIjozMzI4MTYxMjg5OX0.NniulJ-CMLkbor5PBSay30rMbFwtGFosxvhAkBKGFbU';

  const now = getZonedDate(new Date(), PHILLY_TIME_ZONE);
  const currentYear = now.getFullYear();
  const monthSlug = indexToMonthSlug(now.getMonth() + 1);
  const monthLabel = formatMonthYear(now, PHILLY_TIME_ZONE);
  const monthName = formatMonthName(now, PHILLY_TIME_ZONE);

  const traditionsPath = monthSlug
    ? `/philadelphia-events-${monthSlug}-${currentYear}/`
    : '/philadelphia-events/';

  const buildMonthlyPath = segment =>
    monthSlug ? `/${segment}-${monthSlug}-${currentYear}/` : `/${segment}/`;

  const guideLinks = [
    { key: 'weekend', label: 'This Weekend in Philadelphia', href: '/this-weekend-in-philadelphia/' },
    { key: 'traditions', label: monthName ? `${monthName}'s Traditions` : 'Monthly Traditions', href: traditionsPath },
    { key: 'family', label: `Family-Friendly – ${monthLabel}`, href: buildMonthlyPath('family-friendly-events-in-philadelphia') },
    { key: 'arts', label: `Arts & Culture – ${monthLabel}`, href: buildMonthlyPath('arts-culture-events-in-philadelphia') },
    { key: 'food', label: `Food & Drink – ${monthLabel}`, href: buildMonthlyPath('food-drink-events-in-philadelphia') },
    { key: 'fitness', label: `Fitness & Wellness – ${monthLabel}`, href: buildMonthlyPath('fitness-events-in-philadelphia') },
    { key: 'music', label: `Music – ${monthLabel}`, href: buildMonthlyPath('music-events-in-philadelphia') },
  ];

  return (
    <footer className="relative bg-gray-900 text-gray-300 pt-64 pb-12 px-6 overflow-visible">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 pointer-events-none">
        <img
          src={heartUrl}
          alt="Heart"
          className="w-16 sm:w-20 h-auto -translate-y-1/2"
        />
      </div>

      <div className="max-w-screen-xl mx-auto relative z-10">
        <NewsletterPromo variant="footer" className="mx-auto mb-16 mt-14 max-w-3xl" />
        <div className="flex flex-col gap-12 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-4xl sm:text-6xl md:text-7xl font-[Barrio] text-white leading-tight">
              Our Philly: The most comprehensive events calendar in Philadelphia.
            </p>
            <p className="mt-6 text-base sm:text-lg text-gray-400 max-w-2xl">
              Built to help you discover what&apos;s happening across every neighborhood, every weekend, and every month.
            </p>
          </div>
          <nav
            aria-labelledby="footer-guides-heading"
            className="w-full max-w-sm lg:max-w-md"
          >
            <h2
              id="footer-guides-heading"
              className="text-sm font-semibold uppercase tracking-[0.3em] text-gray-400"
            >
              All Guides
            </h2>
            <ul className="mt-5 grid grid-cols-1 gap-3 text-sm">
              {guideLinks.map(guide => (
                <li key={guide.key}>
                  <Link
                    to={guide.href}
                    className="group flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-gray-200 transition hover:bg-white/10 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                  >
                    <span className="font-medium">{guide.label}</span>
                    <ArrowUpRight
                      className="h-4 w-4 text-indigo-200 transition group-hover:text-white"
                      aria-hidden="true"
                    />
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        <div className="mt-16 flex flex-col gap-3 text-xs text-gray-500 sm:flex-row sm:items-center sm:justify-between">
          <p>&copy; {currentYear} Our Philly. All rights reserved.</p>
          <Link
            to="/all-guides/"
            className="inline-flex items-center gap-2 text-xs font-semibold text-gray-300 hover:text-white"
          >
            Browse every guide
            <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
