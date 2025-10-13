import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Sparkles } from 'lucide-react';

const headline = 'The Never-Miss-A-Thing Newsletter';
const blurb =
  'Curated events, neighborhood gems, and timely callouts to help you plan your next Philly outing.';

function SpotlightLayout({ className = '' }) {
  return (
    <section className={`relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#bf3d35] via-[#d16255] to-[#f7c094] p-8 text-white shadow-xl ${className}`}>
      <div className="pointer-events-none absolute -right-10 -top-10 h-48 w-48 rounded-full bg-white/10 blur-2xl" aria-hidden="true" />
      <div className="pointer-events-none absolute -bottom-12 left-1/2 h-64 w-64 -translate-x-1/2 rounded-full bg-white/10 blur-3xl" aria-hidden="true" />
      <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="max-w-2xl space-y-4">
          <p className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1 text-xs font-semibold uppercase tracking-[0.35em] text-white/80">
            <Sparkles className="h-4 w-4" aria-hidden="true" />
            Inbox Magic
          </p>
          <h2 className="text-3xl font-semibold leading-tight sm:text-4xl lg:text-5xl">{headline}</h2>
          <p className="text-sm leading-6 text-white/80 sm:text-base">{blurb}</p>
        </div>
        <Link
          to="/newsletter"
          className="inline-flex items-center justify-center rounded-full bg-white px-6 py-3 text-sm font-semibold text-[#bf3d35] shadow-lg transition hover:bg-white/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          Plan With Us
          <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
        </Link>
      </div>
    </section>
  );
}

function CompactLayout({ className = '' }) {
  return (
    <section className={className}>
      <Link
        to="/newsletter"
        className="flex w-full flex-col gap-3 rounded-2xl border border-[#bf3d35]/20 bg-[#fff7f5] px-5 py-6 text-left shadow-sm transition hover:-translate-y-0.5 hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#bf3d35] sm:flex-row sm:items-center sm:justify-between"
      >
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-[#bf3d35]">Never miss a thing</p>
          <h3 className="mt-2 text-xl font-semibold text-[#28313e]">Get the weekly rundown in your inbox</h3>
          <p className="mt-2 text-sm text-[#5b6472]">
            Subscribe for the freshest festivals, underground shows, and neighbor-made events we uncover each week.
          </p>
        </div>
        <span className="inline-flex items-center gap-2 self-start rounded-full bg-[#bf3d35] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#a3322c] sm:self-center">
          Sign up free
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </span>
      </Link>
    </section>
  );
}

function FooterLayout({ className = '' }) {
  return (
    <div className={`rounded-3xl border border-white/10 bg-white/5 p-6 text-white shadow-lg backdrop-blur ${className}`}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-white/60">Stay looped in</p>
          <h3 className="text-2xl font-semibold">{headline}</h3>
          <p className="text-sm text-white/80">
            A once-a-week hit of standout plans, local intel, and Philly weirdness worth sharing.
          </p>
        </div>
        <Link
          to="/newsletter"
          className="inline-flex items-center justify-center rounded-full bg-white/15 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-white/25 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          Read the latest edition
          <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
        </Link>
      </div>
    </div>
  );
}

export default function NewsletterPromo({ variant = 'spotlight', className = '' }) {
  if (variant === 'compact') {
    return <CompactLayout className={className} />;
  }
  if (variant === 'footer') {
    return <FooterLayout className={className} />;
  }
  return <SpotlightLayout className={className} />;
}
