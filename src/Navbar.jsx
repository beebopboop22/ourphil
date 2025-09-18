// src/Navbar.jsx
/* eslint-disable react/prop-types */
import React, { useState, useContext, useEffect, useMemo } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ChevronDown, Menu, X } from 'lucide-react';
import { FaTiktok, FaInstagram } from 'react-icons/fa';
import PostFlyerModal from './PostFlyerModal';
import { AuthContext } from './AuthProvider';
import { supabase } from './supabaseClient';
import NavTagMenu from './NavTagMenu';
import LoginPromptModal from './LoginPromptModal';
import { getCurrentMonthlyLabel, getCurrentMonthlyPath } from './utils/dateUtils';

export default function Navbar({ style }) {
  const { user } = useContext(AuthContext);
  const location = useLocation();
  const navigate = useNavigate();
  const weekendPath = '/this-weekend-in-philadelphia/';
  const currentMonthlyPath = useMemo(() => getCurrentMonthlyPath(), []);
  const currentMonthlyLabel = useMemo(() => getCurrentMonthlyLabel(), []);
  const monthlyNavLabel = currentMonthlyLabel ? `${currentMonthlyLabel} Traditions` : 'Monthly Traditions';

  const [menuOpen, setMenuOpen] = useState(false);
  const [guidesOpen, setGuidesOpen] = useState(false);
  const [showPostModal, setShowPostModal] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);

  useEffect(() => {
    setGuidesOpen(false);
  }, [location.pathname]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  const openPostModal = () => {
    if (!user) {
      setShowLoginModal(true);
      setMenuOpen(false);
      return;
    }
    setShowPostModal(true);
    setMenuOpen(false);
  };

  const linkClass = (path) =>
    `hover:text-gray-900 transition ${
      location.pathname.startsWith(path)
        ? 'text-gray-900 font-semibold'
        : 'text-gray-700'
    }`;

  const exploreActive =
    location.pathname.startsWith('/this-weekend-in-philadelphia') ||
    location.pathname.startsWith('/philadelphia-events');

  return (
    <>
      <nav className="fixed top-0 w-full bg-white shadow z-50" style={style}>
        <div className="max-w-screen-xl mx-auto flex items-center justify-between h-20 px-4">
          {/* Logo */}
          <Link to="/" className="flex-shrink-0">
            <img
              src="https://qdartpzrxmftmaftfdbd.supabase.co/storage/v1/object/public/group-images//logoo.png"
              alt="Our Philly Logo"
              className="h-10 w-auto"
            />
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center space-x-8 text-base">
            {/* Social links */}
            <div className="flex items-center space-x-4">
              <a
                href="https://www.tiktok.com/@ourphilly?lang=en"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="TikTok"
              >
                <FaTiktok className="w-5 h-5 text-gray-700 hover:text-gray-900 transition" />
              </a>
              <a
                href="https://www.instagram.com/ourphillydotorg/"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Instagram"
              >
                <FaInstagram className="w-5 h-5 text-gray-700 hover:text-gray-900 transition" />
              </a>
            </div>

            {/* Primary links */}
            <ul className="flex items-center space-x-6 font-medium">

              <li>
                <button
                  onClick={openPostModal}
                  className="text-gray-700 hover:text-gray-900 transition"
                >
                  Post Event
                </button>
              </li>

              <li
                className="relative"
                onMouseEnter={() => setGuidesOpen(true)}
                onMouseLeave={() => setGuidesOpen(false)}
              >
                <button
                  onClick={() => setGuidesOpen(open => !open)}
                  className={`flex items-center space-x-1 ${
                    exploreActive ? 'text-gray-900 font-semibold' : 'text-gray-700'
                  } hover:text-gray-900 transition`}
                  aria-haspopup="true"
                  aria-expanded={guidesOpen}
                >
                  <span>Events &amp; Guides</span>
                  <ChevronDown
                    className={`w-4 h-4 transition-transform ${guidesOpen ? 'rotate-180' : ''}`}
                  />
                </button>
                {guidesOpen && (
                  <div className="absolute right-0 mt-3 w-64 bg-white border border-gray-200 rounded-xl shadow-lg py-3 z-50">
                    <Link
                      to={weekendPath}
                      className="block px-4 py-2 text-sm text-gray-700 hover:bg-indigo-50 hover:text-indigo-700"
                      onClick={() => setGuidesOpen(false)}
                    >
                      This Weekend in Philadelphia
                    </Link>
                    <Link
                      to={currentMonthlyPath}
                      className="block px-4 py-2 text-sm text-gray-700 hover:bg-indigo-50 hover:text-indigo-700"
                      onClick={() => setGuidesOpen(false)}
                    >
                      {monthlyNavLabel}
                    </Link>
                  </div>
                )}
              </li>

              <li>
                <Link
                  to={weekendPath}
                  className={`flex items-center space-x-1 ${linkClass('/this-weekend-in-philadelphia')}`}
                >
                  <span>This Weekend</span>
                </Link>
              </li>

              <li>
                <Link
                  to={currentMonthlyPath}
                  className={`flex items-center space-x-1 ${linkClass('/philadelphia-events')}`}
                >
                  <span>{monthlyNavLabel}</span>
                </Link>
              </li>

              <li>
                <Link
                  to="/groups"
                  className={`flex items-center space-x-1 ${linkClass('/groups')}`}
                >
                  <span>Groups</span>
                </Link>
              </li>

              <li>
                <Link
                  to="/contact"
                  className={`flex items-center space-x-1 ${linkClass('/contact')}`}
                >
                  <span>Contact</span>
                </Link>
              </li>
              <li>
                <Link
                  to="/about"
                  className={`flex items-center space-x-1 ${linkClass('/about')}`}
                >
                  <span>About</span>
                </Link>
              </li>
            </ul>

            {/* Auth */}
            <div className="flex items-center space-x-6">
              {user ? (
                <>
                  <Link to="/profile" className={linkClass('/profile')}>
                    Profile
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="text-gray-700 hover:text-gray-900 transition"
                  >
                    Log Out
                  </button>
                </>
              ) : (
                <>
                  <Link to="/login" className={linkClass('/login')}>
                    Log In
                  </Link>
                  <Link
                    to="/signup"
                    className="text-indigo-600 hover:text-indigo-800 font-semibold transition"
                  >
                    Sign Up
                  </Link>
                </>
              )}
            </div>
          </div>

          {/* Mobile menu button */}
          <button
            className="md:hidden"
            onClick={() => setMenuOpen(open => !open)}
          >
            {menuOpen ? (
              <X className="w-6 h-6 text-gray-700" />
            ) : (
              <Menu className="w-6 h-6 text-gray-700" />
            )}
          </button>
        </div>

        <NavTagMenu />

        {/* Mobile slide-out */}
        {menuOpen && (
          <div className="md:hidden bg-white shadow-lg px-4 py-6 space-y-4 text-base font-medium">
            <div className="flex space-x-4">
              <a
                href="https://www.tiktok.com/@ourphilly?lang=en"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="TikTok"
              >
                <FaTiktok className="w-5 h-5 text-gray-700 hover:text-gray-900" />
              </a>
              <a
                href="https://www.instagram.com/ourphillydotorg/"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Instagram"
              >
                <FaInstagram className="w-5 h-5 text-gray-700 hover:text-gray-900" />
              </a>
            </div>
            <Link
              to={weekendPath}
              className="block"
              onClick={() => setMenuOpen(false)}
            >
              This Weekend in Philly
            </Link>
            <Link
              to={currentMonthlyPath}
              className="block"
              onClick={() => setMenuOpen(false)}
            >
              {monthlyNavLabel}
            </Link>
            <Link to="/groups" className="block" onClick={() => setMenuOpen(false)}>
              Claim Your Group
            </Link>
            <Link to="/contact" className="block" onClick={() => setMenuOpen(false)}>
              Contact
            </Link>
            <Link to="/about" className="block" onClick={() => setMenuOpen(false)}>
              About
            </Link>
            <button
              onClick={openPostModal}
              className="block text-left w-full"
            >
              Post Event
            </button>
            {user ? (
              <>
                <Link to="/profile" className="block" onClick={() => setMenuOpen(false)}>
                  Profile
                </Link>
                <button
                  onClick={handleLogout}
                  className="block text-left w-full"
                >
                  Log Out
                </button>
              </>
            ) : (
              <>
                <Link to="/login" className="block" onClick={() => setMenuOpen(false)}>
                  Log In
                </Link>
                <Link to="/signup" className="block" onClick={() => setMenuOpen(false)}>
                  Sign Up
                </Link>
              </>
            )}
          </div>
        )}
      </nav>

      {/* Modals */}
      {showPostModal && <PostFlyerModal isOpen={showPostModal} onClose={() => setShowPostModal(false)} />}
      {showLoginModal && <LoginPromptModal onClose={() => setShowLoginModal(false)} />}
    </>
  );
}
