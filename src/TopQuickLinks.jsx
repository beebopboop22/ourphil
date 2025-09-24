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
  traditionsCount = 0,
  weekendHref = '/this-weekend-in-philadelphia/',
  traditionsHref = '/philadelphia-events/',
  loading = false,
  className = '',
}) {
  const weekendText = loading
    ? 'Loading events…'
    : formatCount(weekendCount, 'event', 'this weekend');
  const traditionsText = loading
    ? 'Loading traditions…'
    : formatCount(traditionsCount, 'tradition', 'this month');

  return (
    <div
      className={`${className} w-full bg-[#BE3D35] text-white`}
      style={{ marginInline: 'calc(50% - 50vw)', width: '100vw' }}
    >
      <div className="mx-auto flex max-w-screen-xl flex-col divide-y divide-white/20 md:flex-row md:divide-y-0 md:divide-x">
        <Link
          to={weekendHref}
          className="flex flex-1 items-center justify-between gap-6 px-6 py-6 transition hover:bg-white/10 focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          <div className="text-left">
            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-white/80">
              Explore the weekend guide
            </p>
            <p className="mt-2 text-lg font-semibold text-white sm:text-xl">{weekendText}</p>
          </div>
          <ArrowUpRight className="h-6 w-6 flex-shrink-0 text-white" aria-hidden="true" />
        </Link>
        <Link
          to={traditionsHref}
          className="flex flex-1 items-center justify-between gap-6 px-6 py-6 transition hover:bg-white/10 focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          <div className="text-left">
            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-white/80">
              This month's traditions
            </p>
            <p className="mt-2 text-lg font-semibold text-white sm:text-xl">{traditionsText}</p>
          </div>
          <ArrowUpRight className="h-6 w-6 flex-shrink-0 text-white" aria-hidden="true" />
        </Link>
      </div>
    </div>
  );
}
