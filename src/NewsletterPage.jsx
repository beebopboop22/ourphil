import React from 'react';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import {
  ArrowUpRight,
  CalendarRange,
  MapPin,
  PartyPopper,
  Megaphone,
} from 'lucide-react';
import Navbar from './Navbar';
import Footer from './Footer';
import NewsletterSection from './NewsletterSection';
import NewsletterPromo from './components/NewsletterPromo';

const features = [
  {
    title: 'Weekend cheat sheet',
    description:
      'Hit the ground running with a shortlist of the best festivals, pop-ups, and performances for the days ahead.',
    icon: CalendarRange,
    accent: 'bg-indigo-100 text-indigo-700',
  },
  {
    title: 'Neighborhood gems',
    description:
      "See what's bubbling up from block captains, community centers, and organizers in every corner of the city.",
    icon: MapPin,
    accent: 'bg-emerald-100 text-emerald-700',
  },
  {
    title: 'Last-minute surprises',
    description:
      'We flag limited ticket releases, flash openings, and quirky one-offs before they vanish.',
    icon: PartyPopper,
    accent: 'bg-amber-100 text-amber-700',
  },
  {
    title: 'Community shout-outs',
    description:
      'Discover the makers, volunteers, and storytellers shaping Philly—plus how to show up for them.',
    icon: Megaphone,
    accent: 'bg-rose-100 text-rose-700',
  },
];

const guideLinks = [
  {
    title: 'This Weekend in Philadelphia',
    description: "Preview the events we'll be talking about in the next send.",
    href: '/this-weekend-in-philadelphia/',
  },
  {
    title: 'Monthly Traditions Guide',
    description: 'See the cultural staples we reference throughout the newsletter.',
    href: '/philadelphia-events/',
  },
  {
    title: 'Neighborhood Community Indexes',
    description: 'Browse by area to find the groups we feature and support.',
    href: '/all-guides/',
  },
];

export default function NewsletterPage() {
  return (
    <div className="min-h-screen bg-[#fff8f6]">
      <Helmet>
        <title>The Never-Miss-A-Thing Newsletter | Our Philly</title>
        <meta
          name="description"
          content="Subscribe to Our Philly's Never-Miss-A-Thing Newsletter for weekly plans, neighborhood gems, and cultural callouts."
        />
        <link rel="canonical" href="https://www.ourphilly.org/newsletter" />
      </Helmet>
      <Navbar />
      <main className="flex flex-col">
        <section className="relative overflow-hidden pb-16 pt-28">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-gradient-to-b from-[#bf3d35]/20 to-transparent" aria-hidden="true" />
          <div className="mx-auto w-full max-w-screen-xl px-4">
            <div className="max-w-3xl">
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-[#bf3d35]">
                Philly's weekly inbox handshake
              </p>
              <h1 className="mt-5 text-4xl font-[Barrio] text-[#28313e] sm:text-5xl lg:text-6xl">
                The Never-Miss-A-Thing Newsletter
              </h1>
              <p className="mt-6 text-base text-[#4a5568] sm:text-lg">
                A once-a-week dose of the city's most delightful happenings—curated by real neighbors keeping tabs on pop-ups, traditions, oddities, and underground standouts.
              </p>
              <ul className="mt-8 space-y-3 text-sm text-[#28313e] sm:text-base">
                <li className="flex items-start gap-3">
                  <span className="mt-1 inline-flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-[#bf3d35] text-xs font-semibold text-white">
                    1x
                  </span>
                  <span>Delivered once per week—no inbox overwhelm.</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-1 inline-flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-[#28313e] text-xs font-semibold text-white">
                    🎯
                  </span>
                  <span>Handpicked lineups spanning concerts, cultural nights, family picks, volunteer ops, and more.</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-1 inline-flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-[#f6ad55] text-xs font-semibold text-white">
                    ❤️
                  </span>
                  <span>Community-first features that highlight the people, places, and traditions shaping Philly.</span>
                </li>
              </ul>
            </div>
          </div>
        </section>

        <NewsletterSection className="bg-white" helper="Expect one thoughtful send every week. No spam, ever." />

        <section className="pb-16">
          <div className="mx-auto w-full max-w-screen-xl px-4">
            <div className="mb-10 max-w-2xl">
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-[#bf3d35]">What you'll get</p>
              <h2 className="mt-3 text-3xl font-semibold text-[#28313e] sm:text-4xl">Inside every edition</h2>
              <p className="mt-3 text-sm text-[#4a5568] sm:text-base">
                Each Wednesday we connect the dots between neighborhood happenings and the wider city so you can make the most of your free time.
              </p>
            </div>
            <div className="grid gap-6 md:grid-cols-2">
              {features.map(feature => {
                const Icon = feature.icon;
                return (
                  <div
                    key={feature.title}
                    className="flex h-full flex-col justify-between rounded-3xl border border-[#bf3d35]/10 bg-white p-6 shadow-sm"
                  >
                    <div className="flex items-start gap-4">
                      <span className={`inline-flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl ${feature.accent}`}>
                        <Icon className="h-6 w-6" aria-hidden="true" />
                      </span>
                      <div>
                        <h3 className="text-xl font-semibold text-[#28313e]">{feature.title}</h3>
                        <p className="mt-2 text-sm text-[#4a5568]">{feature.description}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <NewsletterPromo variant="compact" className="mx-auto w-full max-w-screen-xl px-4" />

        <section className="pb-24 pt-16">
          <div className="mx-auto w-full max-w-screen-xl px-4">
            <div className="mb-10 max-w-2xl">
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-[#bf3d35]">Start exploring</p>
              <h2 className="mt-3 text-3xl font-semibold text-[#28313e] sm:text-4xl">Preview the vibes</h2>
              <p className="mt-3 text-sm text-[#4a5568] sm:text-base">
                Want to see what we're linking up? Dive into a few of the guides and calendars that inspire each issue.
              </p>
            </div>
            <div className="grid gap-6 md:grid-cols-3">
              {guideLinks.map(link => (
                <Link
                  key={link.title}
                  to={link.href}
                  className="group flex h-full flex-col justify-between rounded-3xl border border-[#bf3d35]/10 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
                >
                  <div>
                    <h3 className="text-lg font-semibold text-[#28313e]">{link.title}</h3>
                    <p className="mt-2 text-sm text-[#4a5568]">{link.description}</p>
                  </div>
                  <span className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-[#bf3d35] group-hover:text-[#a3322c]">
                    Explore guide
                    <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
