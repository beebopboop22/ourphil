import React from 'react';
import { Link } from 'react-router-dom';

const DEFAULT_LINKS = [
  { href: '/this-weekend-in-philadelphia/', label: 'This Weekend in Philly' },
  { href: '/philadelphia-events/', label: "Philly Traditions Calendar" },
];

export default function TopQuickLinks({ links = DEFAULT_LINKS, className = '' }) {
  return (
    <div className={className}>
      <div className="mx-auto max-w-screen-xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          {links.map(link => (
            <Link
              key={link.href}
              to={link.href}
              className="inline-flex items-center justify-center rounded-full bg-[#bf3d35] px-5 py-2.5 text-sm font-semibold text-white shadow transition hover:bg-[#a3322d] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#bf3d35]"
            >
              {link.label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
