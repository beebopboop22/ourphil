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
  const [desktopMenuOpen, setDesktopMenuOpen] = useState(false);
  const [showPostModal, setShowPostModal] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const navRef = useRef(null);
  const [navHeight, setNavHeight] = useState(0);

  useEffect(() => {
    setMenuOpen(false);
    setDesktopMenuOpen(false);
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
      setDesktopMenuOpen(false);
      return;
    }
    setShowPostModal(true);
    setMenuOpen(false);
    setDesktopMenuOpen(false);
  };

  const linkClass = (path) =>
    `transition hover:text-gray-900 ${
      location.pathname.startsWith(path)
        ? 'text-gray-900 font-semibold'
        : 'text-gray-700'
    }`;

  const navOffset = navHeight || 128;

  const closeOverlays = () => {
    setDesktopMenuOpen(false);
  };

  return (
    <>
      <nav
        ref={navRef}
        className="fixed top-0 w-full bg-white shadow z-50"
        style={style}
        data-nav-root
      >
        <div className="mx-auto w-full max-w-screen-xl px-4 py-3">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:gap-4">
            {/* Logo and mobile menu toggle */}
            <div className="flex items-center justify-between gap-3 md:flex-none md:justify-start md:gap-4">
              <Link to="/" className="flex-shrink-0">
                <img
                  src="https://qdartpzrxmftmaftfdbd.supabase.co/storage/v1/object/public/group-images//logoo.png"
                  alt="Our Philly Logo"
                  className="h-6 w-auto md:h-10"
                />
              </Link>

              <button
                type="button"
                className="flex-shrink-0 md:hidden"
                aria-expanded={menuOpen}
                aria-label="Toggle navigation menu"
                onClick={() => setMenuOpen((open) => !open)}
              >
                {menuOpen ? (
                  <X className="h-6 w-6 text-gray-700" />
                ) : (
                  <Menu className="h-6 w-6 text-gray-700" />
                )}
              </button>
            </div>

            <div className="flex w-full flex-col gap-3 md:flex-1 md:flex-row md:items-center md:gap-4">
              <NavbarSearch
                className="w-full min-w-0 flex-1 md:max-w-xl"
                buttonClassName="px-3 py-1 text-xs md:px-4 md:py-2 md:text-sm"
                onFocus={closeOverlays}
              />

              {/* Desktop actions */}
              <div className="ml-auto hidden items-center gap-4 text-sm font-medium md:flex">
                {user && (
                  <Link to="/profile" className={linkClass('/profile')}>
                    My Plans
                  </Link>
                )}
                <Link to="/map" className={linkClass('/map')}>
                  Map
                </Link>
                <div
                  className="relative"
                  onBlur={(event) => {
                    if (!event.currentTarget.contains(event.relatedTarget)) {
                      setDesktopMenuOpen(false);
                    }
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setDesktopMenuOpen((open) => !open)}
                    onFocus={() => setDesktopMenuOpen(true)}
                    className="flex items-center gap-1 text-gray-700 transition hover:text-gray-900"
                    aria-haspopup="true"
                    aria-expanded={desktopMenuOpen}
                  >
                    <span>Menu</span>
                    <ChevronDown className={`h-4 w-4 transition-transform ${desktopMenuOpen ? 'rotate-180' : ''}`} />
                  </button>
                  {desktopMenuOpen && (
                    <div className="absolute right-0 z-50 mt-3 w-48 rounded-xl border border-gray-200 bg-white py-3 shadow-lg">
                      <Link
                        to="/all-guides/"
                        className="block px-4 py-2 text-sm text-gray-700 transition hover:bg-indigo-50 hover:text-indigo-700"
                      >
                        Guides
                      </Link>
                      <Link
                        to="/groups"
                        className="block px-4 py-2 text-sm text-gray-700 transition hover:bg-indigo-50 hover:text-indigo-700"
                      >
                        Groups
                      </Link>
                      <button
                        type="button"
                        onClick={() => {
                          openPostModal();
                          setDesktopMenuOpen(false);
                        }}
                        className="block w-full px-4 py-2 text-left text-sm text-gray-700 transition hover:bg-indigo-50 hover:text-indigo-700"
                      >
                        Post Event
                      </button>
                      <div className="my-2 h-px bg-gray-100" aria-hidden="true" />
                      <Link
                        to="/contact"
                        className="block px-4 py-2 text-sm text-gray-700 transition hover:bg-indigo-50 hover:text-indigo-700"
                      >
                        Contact
                      </Link>
                      <Link
                        to="/mailing-list"
                        className="block px-4 py-2 text-sm text-gray-700 transition hover:bg-indigo-50 hover:text-indigo-700"
                      >
                        Newsletter
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
            </div>
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
              {user && (
                <Link to="/profile" className="block" onClick={() => setMenuOpen(false)}>
                  My Plans
                </Link>
              )}
              <Link to="/map" className="block" onClick={() => setMenuOpen(false)}>
                Map
              </Link>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Menu</p>
              <div className="space-y-4">
                <Link to="/all-guides/" className="block" onClick={() => setMenuOpen(false)}>
                  Guides
                </Link>
                <Link to="/groups" className="block" onClick={() => setMenuOpen(false)}>
                  Groups
                </Link>
                <button
                  onClick={() => {
                    openPostModal();
                    setMenuOpen(false);
                  }}
                  className="block w-full text-left"
                >
                  Post Event
                </button>
                <Link to="/contact" className="block" onClick={() => setMenuOpen(false)}>
                  Contact
                </Link>
                <Link to="/mailing-list" className="block" onClick={() => setMenuOpen(false)}>
                  Newsletter
                </Link>
                <Link to="/about" className="block" onClick={() => setMenuOpen(false)}>
                  About
                </Link>
              </div>
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
