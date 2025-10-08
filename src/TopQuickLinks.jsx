import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';

function formatCount(count, singularLabel, suffix) {
  if (count === null || count === undefined) return '';
  const safe = Number(count) || 0;
  const plural = safe === 1 ? singularLabel : `${singularLabel}s`;
  return `${safe} ${plural} ${suffix}`;
}

export default function TopQuickLinks({
  weekendCount = 0,
  weekendHref = '/this-weekend-in-philadelphia/',
  loading = false,
  className = '',
}) {
  const weekendText = loading
    ? 'Loading events…'
    : formatCount(weekendCount, 'event', 'this weekend');

  return (
    <div
      className={`${className} w-full bg-[#BE3D35] text-white`}
      style={{ marginInline: 'calc(50% - 50vw)', width: '100vw' }}
    >
      <Link
        to={weekendHref}
        className="mx-auto flex w-full max-w-screen-xl items-center justify-between gap-6 px-6 py-7 transition hover:bg-white/10 focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
      >
        <div className="text-left">
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-white/80">
            Explore the weekend guide
          </p>
          <p className="mt-2 text-2xl font-semibold text-white sm:text-3xl">{weekendText}</p>
        </div>
        <ArrowUpRight className="h-7 w-7 flex-shrink-0 text-white" aria-hidden="true" />
      </Link>
    </div>
  );
}
