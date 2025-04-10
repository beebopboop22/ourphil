import React from 'react';

const Footer = () => {
  const year = new Date().getFullYear();

  return (
    <footer className="bg-gray-900 text-gray-300 py-12 px-6">
      <div className="max-w-screen-xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-10">
        {/* Brand */}
        <div className="col-span-1 md:col-span-2">
          <h2 className="text-2xl font-bold text-white mb-2">Our Philly</h2>
          <p className="text-sm text-gray-400 mb-4">
            Making community more accessible in the city we love.
          </p>
          <p className="text-xs text-gray-500">&copy; {year} Our Philly. All rights reserved.</p>
        </div>

        {/* Navigation */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-white uppercase tracking-wide">Explore</h3>
          <ul className="space-y-2 text-sm">
            <li><a href="/" className="hover:text-white transition">Home</a></li>
            <li><a href="/groups" className="hover:text-white transition">Groups</a></li>
            <li><a href="/events" className="hover:text-white transition">Events</a></li>
            <li><a href="/about" className="hover:text-white transition">About</a></li>
          </ul>
        </div>

        {/* Email Signup */}
        <div>
          <h3 className="text-sm font-semibold text-white uppercase tracking-wide mb-3">Stay in the loop</h3>
          <form className="flex flex-col gap-3">
            <input
              type="email"
              placeholder="Your email address"
              className="px-4 py-2 rounded-lg bg-gray-800 border border-gray-700 text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
            <button
              type="submit"
              className="bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-semibold px-4 py-2 rounded-lg transition"
            >
              Sign Up
            </button>
          </form>
          <p className="text-xs text-gray-500 mt-2">We'll never spam you.</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
