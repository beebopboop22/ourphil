// src/Footer.jsx
import React from 'react';
import { Link } from 'react-router-dom';
import { getCurrentMonthlyLabel, getCurrentMonthlyPath } from './utils/dateUtils';

const Footer = () => {
  const year = new Date().getFullYear();
  const weekendPath = '/this-weekend-in-philadelphia/';
  const currentMonthlyPath = getCurrentMonthlyPath();
  const currentMonthlyLabel = getCurrentMonthlyLabel();
  const monthlyNavLabel = currentMonthlyLabel ? `${currentMonthlyLabel} Traditions` : 'Monthly Traditions';
  const heartUrl =
    'https://qdartpzrxmftmaftfdbd.supabase.co/storage/v1/object/sign/group-images/OurPhilly-CityHeart-1.png?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1cmwiOiJncm91cC1pbWFnZXMvT3VyUGhpbGx5LUNpdHlIZWFydC0xLnBuZyIsImlhdCI6MTc0NTYxMjg5OSwiZXhwIjozMzI4MTYxMjg5OX0.NniulJ-CMLkbor5PBSay30rMbFwtGFosxvhAkBKGFbU';

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
        <p className="text-4xl sm:text-6xl md:text-7xl font-[Barrio] text-white leading-tight mb-6 max-w-4xl">
          Our Philly: The most comprehensive events calendar in Philadelphia.
        </p>

        <div className="mt-8 flex flex-wrap items-center gap-4 text-sm uppercase tracking-wide text-indigo-200">
          <Link to={weekendPath} className="hover:text-white transition">
            This Weekend in Philly
          </Link>
          <span className="hidden sm:inline text-indigo-400">•</span>
          <Link to={currentMonthlyPath} className="hover:text-white transition">
            {monthlyNavLabel}
          </Link>
        </div>

        <p className="text-xs text-gray-500">&copy; {year} Our Philly. All rights reserved.</p>
      </div>
    </footer>
  );
};

export default Footer;
