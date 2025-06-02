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
              {/* Find Community dropdown */}
              <li>
              <Link
                to="/"
                className={`flex items-center space-x-1 ${linkClass('/groups')}`}
              >
                <span>Events</span>
              </Link>
            </li>
              {/* Find Community dropdown */}
              <li>
              <Link
                to="/groups"
                className={`flex items-center space-x-1 ${linkClass('/groups')}`}
              >
                <span>Groups</span>
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

        {/* Mobile slide-out */}
        {menuOpen && (
          <div className="md:hidden bg-white shadow-lg px-4 py-6 space-y-4 text-base font-medium">
            
            <Link to="/" className="block" onClick={() => setMenuOpen(false)}>
               Events
            </Link>
            <Link to="/groups" className="block" onClick={() => setMenuOpen(false)}>
               Groups
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
