// src/Navbar.jsx
import React, { useState, useContext } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import SubmitGroupModal from './SubmitGroupModal';
import PostFlyerModal from './PostFlyerModal';
import { AuthContext } from './AuthProvider';
import { supabase } from './supabaseClient';

export default function Navbar() {
  const { user } = useContext(AuthContext);
  const location = useLocation();
  const navigate = useNavigate();

  const [menuOpen, setMenuOpen] = useState(false);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [showPostModal, setShowPostModal] = useState(false);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  const openGroupModal = () => {
    setShowSubmitModal(true);
    setMenuOpen(false);
  };

  const openPostModal = () => {
    setShowPostModal(true);
    setMenuOpen(false);
  };

  const linkClass = (path) =>
    `hover:text-gray-900 transition ${
      location.pathname.startsWith(path)
        ? 'text-gray-900 font-semibold'
        : 'text-gray-700'
    }`;

  return (
    <>
      <nav className="fixed top-0 w-full bg-white shadow z-50">
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
                  className={`flex items-center space-x-1 ${linkClass('/groups')}`}
                >
                  <span>Contact</span>
                </Link>
              </li>
            </ul>

            {/* Auth */}
            <div className="flex items-center space-x-6">
              {user ? (
                <>
                  <Link to="/profile" className={linkClass('/profile')}>
                    My Plans
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

        {/* Mobile slide-out */}
        {menuOpen && (
          <div className="md:hidden bg-white shadow-lg px-4 py-6 space-y-4 text-base font-medium">
            <Link to="/groups" className="block" onClick={() => setMenuOpen(false)}>
              Claim Your Group
            </Link>
            <Link
              to="/contact"
              className={`flex items-center space-x-1 ${linkClass('/groups')}`}
            >
              <span>Contact</span>
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
                  My Plans
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
      {showSubmitModal && <SubmitGroupModal onClose={() => setShowSubmitModal(false)} />}
      {showPostModal && <PostFlyerModal isOpen={showPostModal} onClose={() => setShowPostModal(false)} />}
    </>
  );
}
