// src/Footer.jsx
import React from 'react';

const Footer = () => {
  const year = new Date().getFullYear();
  const heartUrl =
    'https://qdartpzrxmftmaftfdbd.supabase.co/storage/v1/object/sign/group-images/OurPhilly-CityHeart-1.png?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1cmwiOiJncm91cC1pbWFnZXMvT3VyUGhpbGx5LUNpdHlIZWFydC0xLnBuZyIsImlhdCI6MTc0NTYxMjg5OSwiZXhwIjozMzI4MTYxMjg5OX0.NniulJ-CMLkbor5PBSay30rMbFwtGFosxvhAkBKGFbU';

  return (
    <footer className="relative bg-gray-900 text-gray-300 pt-64 pb-12 px-6 overflow-visible">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 pointer-events-none">
        <img
          src={heartUrl}
          alt="Heart"
          className="w-20 sm:w-24 h-auto -translate-y-1/2"
        />
      </div>

      <div className="max-w-screen-xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-10 relative z-10">
        {/* Brand / Copyright */}
        <div className="col-span-1 md:col-span-2">
          <p className="text-4xl sm:text-6xl md:text-7xl font-[Barrio] text-white leading-tight mb-6">
            Our Philly: The most comprehensive events calendar in Philadelphia.
          </p>

          <p className="text-xs text-gray-500">&copy; {year} Our Philly. All rights reserved.</p>
        </div>

        {/* Help nav */}
        <div className="md:text-right md:justify-self-end">
          <h3 className="text-lg font-semibold text-white mb-3">more</h3>
          <ul className="space-y-2">
            <li>
              <a href="/traditions-faq" className="text-sm text-gray-400 hover:text-white">Traditions Hosts FAQ</a>
            </li>
            <li>
              <a href="/groups-faq" className="text-sm text-gray-400 hover:text-white">Groups FAQ</a>
            </li>
            <li>
              <a href="/about" className="text-sm text-gray-400 hover:text-white">About</a>
            </li>
          </ul>
        </div>

        {/* empty spacer to align heart */}
        <div className="col-span-1 md:col-span-1" />
      </div>
    </footer>
  );
};

export default Footer;
