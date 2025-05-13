// src/Navbar.jsx

import React, { useState, useContext } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Menu, X, ChevronDown } from 'lucide-react';
import SubmitGroupModal from './SubmitGroupModal';
import { AuthContext } from './AuthProvider';
import { supabase } from './supabaseClient';

export default function Navbar() {
  const { user } = useContext(AuthContext);
  const location = useLocation();
  const navigate = useNavigate();

  const [menuOpen, setMenuOpen] = useState(false);
  const [showSubmitModal, setShowSubmitModal] = useState(false);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };
  const openGroupModal = () => {
    setShowSubmitModal(true);
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
              src="https://qdartpzrxmftmaftfdbd.supabase.co/storage/v1/object/sign/group-images/logoo.png?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6InN0b3JhZ2UtdXJsLXNpZ25pbmcta2V5Xzk3ODQwNDNhLTIyOTYtNDVmNC04YTUyLTg0OTgwYjEyZjdjNyJ9.eyJ1cmwiOiJncm91cC1pbWFnZXMvbG9nb28ucG5nIiwiaWF0IjoxNzQ2MjA3OTcxLCJleHAiOjMzMjgyMjA3OTcxfQ.QCI5vOHOOPg7HXYUK5msQTAxJIT3Y72W0qPP6gITv4E"
              alt="Our Philly Logo"
              className="h-10 w-auto"
            />
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center space-x-8 text-base">
            {/* Primary grouped nav */}
            <ul className="flex items-center space-x-6 font-medium">
              {/* Big Board with NEW! */}
              <li className="flex items-center">
                <Link to="/board" className={linkClass('/board')}>
                  Big Board
                </Link>
                <span className="italic text-xs ml-1 text-indigo-600">NEW!</span>
              </li>

              {/* Find Events dropdown */}
              <li className="relative group">
                <Link
                  to="/upcoming-events"
                  className={`flex items-center space-x-1 ${linkClass('/upcoming-events')}`}
                >
                  <span>Find Events</span>
                  <ChevronDown className="w-4 h-4 text-gray-500" />
                </Link>
                <ul className="pointer-events-none opacity-0 group-hover:opacity-100 group-hover:pointer-events-auto transition-all absolute top-full w-36 bg-white rounded-md shadow-lg py-2">
                  <li>
                    <Link
                      to="/upcoming-events"
                      className="block px-4 py-2 text-gray-700 hover:bg-gray-100"
                    >
                      Events
                    </Link>
                  </li>
                  <li>
                    <Link
                      to="/bulletin"
                      className="block px-4 py-2 text-gray-700 hover:bg-gray-100"
                    >
                      Traditions
                    </Link>
                  </li>
                </ul>
              </li>

              {/* Find Community dropdown */}
              <li className="relative group">
                <Link
                  to="/groups"
                  className={`flex items-center space-x-1 ${linkClass('/groups')}`}
                >
                  <span>Find Community</span>
                  <ChevronDown className="w-4 h-4 text-gray-500" />
                </Link>
                <ul className="pointer-events-none opacity-0 group-hover:opacity-100 group-hover:pointer-events-auto transition-all absolute top-full w-36 bg-white rounded-md shadow-lg py-2">
                  <li>
                    <Link
                      to="/groups"
                      className="block px-4 py-2 text-gray-700 hover:bg-gray-100"
                    >
                      Groups
                    </Link>
                  </li>
                  <li>
                    <Link
                      to="/voicemail"
                      className="block px-4 py-2 text-gray-700 hover:bg-gray-100"
                    >
                      Voicemail
                    </Link>
                  </li>
                </ul>
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

        {/* Mobile slide-out */}
        {menuOpen && (
          <div className="md:hidden bg-white shadow-lg px-4 py-6 space-y-4 text-base font-medium">
            <Link to="/board" className="block" onClick={() => setMenuOpen(false)}>
              Big Board
            </Link>
            <Link to="/upcoming-events" className="block" onClick={() => setMenuOpen(false)}>
              Find Events
            </Link>
            <Link to="/bulletin" className="block" onClick={() => setMenuOpen(false)}>
              Traditions
            </Link>
            <Link to="/groups" className="block" onClick={() => setMenuOpen(false)}>
              Find Community
            </Link>
            <Link to="/voicemail" className="block" onClick={() => setMenuOpen(false)}>
              Voicemail
            </Link>

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

      {/* Submit-Group Modal */}
      {showSubmitModal && <SubmitGroupModal onClose={() => setShowSubmitModal(false)} />}
    </>
  );
}
