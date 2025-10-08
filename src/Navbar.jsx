// src/Navbar.jsx
import React, { useState, useContext, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ChevronDown, Menu, X } from 'lucide-react';
import { FaInstagram } from 'react-icons/fa';
import PostFlyerModal from './PostFlyerModal';
import { AuthContext } from './AuthProvider';
import { supabase } from './supabaseClient';
import NavTagMenu from './NavTagMenu';
import LoginPromptModal from './LoginPromptModal';
import NavbarSearch from './components/NavbarSearch';

export default function Navbar({ style, bottomBanner }) {
  const { user } = useContext(AuthContext);
  const location = useLocation();
  const navigate = useNavigate();

  const [menuOpen, setMenuOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [showPostModal, setShowPostModal] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const navRef = useRef(null);
  const [navHeight, setNavHeight] = useState(0);

  useEffect(() => {
    setMenuOpen(false);
    setMoreOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const measure = () => {
      if (navRef.current) {
        setNavHeight(navRef.current.getBoundingClientRect().height);
      }
    };

    measure();

    let observer;
    if (typeof ResizeObserver !== 'undefined' && navRef.current) {
      observer = new ResizeObserver(measure);
      observer.observe(navRef.current);
    }

    window.addEventListener('resize', measure);

    return () => {
      window.removeEventListener('resize', measure);
      if (observer) {
        observer.disconnect();
      }
    };
  }, []);

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
    `transition hover:text-gray-900 ${
      location.pathname.startsWith(path)
        ? 'text-gray-900 font-semibold'
        : 'text-gray-700'
    }`;

  const navOffset = navHeight || 128;

  const closeOverlays = () => {
    setMoreOpen(false);
  };

  return (
    <>
      <nav ref={navRef} className="fixed top-0 w-full bg-white shadow z-50" style={style}>
        <div className="mx-auto flex h-20 max-w-screen-xl items-center gap-4 px-4">
          {/* Logo */}
          <Link to="/" className="flex-shrink-0">
            <img
              src="https://qdartpzrxmftmaftfdbd.supabase.co/storage/v1/object/public/group-images//logoo.png"
              alt="Our Philly Logo"
              className="h-10 w-auto"
            />
          </Link>

          <div className="flex flex-1 items-center gap-4">
            <NavbarSearch
              className="w-full"
              buttonClassName="px-3 py-1 text-xs md:px-4 md:py-2 md:text-sm"
              onFocus={closeOverlays}
            />

            {/* Desktop actions */}
            <div className="hidden items-center gap-4 text-sm font-medium md:flex">
              <Link to="/all-guides/" className={linkClass('/all-guides')}>
                Guides
              </Link>
              <Link to="/groups" className={linkClass('/groups')}>
                Groups
              </Link>
              {user && (
                <Link to="/profile" className={linkClass('/profile')}>
                  My Plans
                </Link>
              )}
              <button
                onClick={openPostModal}
                className="rounded-full border border-indigo-200 bg-indigo-50 px-4 py-2 text-indigo-700 transition hover:border-indigo-300 hover:bg-indigo-100"
              >
                Post Event
              </button>
              <div
                className="relative"
                onBlur={(event) => {
                  if (!event.currentTarget.contains(event.relatedTarget)) {
                    setMoreOpen(false);
                  }
                }}
              >
                <button
                  type="button"
                  onClick={() => setMoreOpen((open) => !open)}
                  onFocus={() => setMoreOpen(true)}
                  className="flex items-center gap-1 text-gray-700 transition hover:text-gray-900"
                  aria-haspopup="true"
                  aria-expanded={moreOpen}
                >
                  <span>More</span>
                  <ChevronDown className={`h-4 w-4 transition-transform ${moreOpen ? 'rotate-180' : ''}`} />
                </button>
                {moreOpen && (
                  <div className="absolute right-0 z-50 mt-3 w-40 rounded-xl border border-gray-200 bg-white py-3 shadow-lg">
                    <Link
                      to="/contact"
                      className="block px-4 py-2 text-sm text-gray-700 transition hover:bg-indigo-50 hover:text-indigo-700"
                    >
                      Contact
                    </Link>
                    <Link
                      to="/about"
                      className="block px-4 py-2 text-sm text-gray-700 transition hover:bg-indigo-50 hover:text-indigo-700"
                    >
                      About
                    </Link>
                  </div>
                )}
              </div>
              <a
                href="https://www.instagram.com/ourphillydotorg/"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Instagram"
                className="text-gray-700 transition hover:text-gray-900"
              >
                <FaInstagram className="h-5 w-5" />
              </a>
              {user ? (
                <button
                  onClick={handleLogout}
                  className="text-gray-700 transition hover:text-gray-900"
                >
                  Log Out
                </button>
              ) : (
                <>
                  <Link to="/login" className={linkClass('/login')}>
                    Log In
                  </Link>
                  <Link
                    to="/signup"
                    className="rounded-full bg-gray-900 px-4 py-2 text-white transition hover:bg-gray-700"
                  >
                    Sign Up
                  </Link>
                </>
              )}
            </div>

            {/* Mobile menu button */}
            <button
              className="md:hidden"
              onClick={() => setMenuOpen((open) => !open)}
            >
              {menuOpen ? (
                <X className="h-6 w-6 text-gray-700" />
              ) : (
                <Menu className="h-6 w-6 text-gray-700" />
              )}
            </button>
          </div>
        </div>

        <NavTagMenu />

        {/* Mobile slide-out */}
        {menuOpen && (
          <div className="space-y-6 bg-white px-4 py-6 text-base font-medium shadow-lg md:hidden">
            <NavbarSearch
              className="w-full"
              buttonClassName="px-3 py-1 text-xs"
              onFocus={closeOverlays}
              onSubmitComplete={() => setMenuOpen(false)}
            />
            <div className="flex items-center gap-4">
              <a
                href="https://www.instagram.com/ourphillydotorg/"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Instagram"
                className="text-gray-700 transition hover:text-gray-900"
              >
                <FaInstagram className="h-5 w-5" />
              </a>
            </div>
            <div className="space-y-4">
              <Link to="/all-guides/" className="block" onClick={() => setMenuOpen(false)}>
                Guides
              </Link>
              <Link to="/groups" className="block" onClick={() => setMenuOpen(false)}>
                Groups
              </Link>
              {user && (
                <Link to="/profile" className="block" onClick={() => setMenuOpen(false)}>
                  My Plans
                </Link>
              )}
              <button
                onClick={openPostModal}
                className="block w-full text-left"
              >
                Post Event
              </button>
            </div>
            <div className="space-y-4 border-t border-gray-200 pt-4">
              <Link to="/contact" className="block" onClick={() => setMenuOpen(false)}>
                Contact
              </Link>
              <Link to="/about" className="block" onClick={() => setMenuOpen(false)}>
                About
              </Link>
            </div>
            <div className="space-y-4 border-t border-gray-200 pt-4">
              {user ? (
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    handleLogout();
                  }}
                  className="block w-full text-left"
                >
                  Log Out
                </button>
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
          </div>
        )}
      </nav>

      {bottomBanner && (
        <div
          className="relative z-40 bg-[#bf3d35] text-white shadow-lg"
          style={{ marginTop: navOffset }}
        >
          <div className="mx-auto max-w-screen-xl px-4">{bottomBanner}</div>
        </div>
      )}

      {/* Modals */}
      {showPostModal && (
        <PostFlyerModal isOpen={showPostModal} onClose={() => setShowPostModal(false)} />
      )}
      {showLoginModal && <LoginPromptModal onClose={() => setShowLoginModal(false)} />}
    </>
  );
}
