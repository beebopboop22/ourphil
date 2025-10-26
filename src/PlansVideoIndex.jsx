import React, { useState, useEffect } from 'react';
import Navbar from './Navbar';
import { Link } from 'react-router-dom';

export default function PlansVideoIndex() {
  const [navHeight, setNavHeight] = useState(0);

  useEffect(() => {
    const navEl = document.querySelector('nav');
    if (!navEl) return;
    const updateHeight = () => setNavHeight(navEl.offsetHeight);
    updateHeight();
    const observer = new ResizeObserver(updateHeight);
    observer.observe(navEl);
    window.addEventListener('resize', updateHeight);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updateHeight);
    };
  }, []);

  const links = [
    { to: '/plans-video/today', label: 'Today' },
    { to: '/plans-video/weekend-plans', label: 'This Weekend' },
    { to: '/plans-video/this-sunday', label: 'This Sunday' },
    { to: '/plans-video-arts', label: 'Arts' },
    { to: '/plans-video-food', label: 'Nomnomslurp' },
    { to: '/plans-video-fitness', label: 'Fitness' },
    { to: '/plans-video-halloween', label: 'Halloween' },
    { to: '/plans-video-family', label: 'Family' },
    { to: '/plans-video-pride', label: 'Pride' },
    { to: '/plans-video-music', label: 'Music' },
    { to: '/plans-video-birds', label: 'Birds' },
    { to: '/plans-video/traditions-gallery', label: 'Traditions gAllery' },
    { to: '/plans-video/traditions-video', label: 'Traditions Video' },
    { to: '/plans-video/traditions-poster', label: 'Traditions Poster' },
    { to: '/plans-video-oktoberfest', label: 'Oktoberfest' },
    { to: '/plans-video-peco', label: 'PECO Multicultural' },
    { to: '/plans-video-markets', label: 'Markets' },
    { to: '/screenshots', label: 'Screenshots' },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div
        className="max-w-md mx-auto p-4 grid grid-cols-2 gap-4"
        style={{ marginTop: navHeight }}
      >
        {links.map(link => (
          <Link
            key={link.to}
            to={link.to}
            className="block p-8 bg-white rounded-lg shadow text-center text-lg font-semibold hover:bg-gray-100"
          >
            {link.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
