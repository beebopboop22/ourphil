// src/Navbar.jsx
import React, { useState, useContext } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import SubmitGroupModal from './SubmitGroupModal';
import { AuthContext } from './AuthProvider';
import { supabase } from './supabaseClient';

const Navbar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);
  const [menuOpen, setMenuOpen] = useState(false);
  const [showSubmitModal, setShowSubmitModal] = useState(false);

  const handleOpenModal = () => {
    setShowSubmitModal(true);
    setMenuOpen(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  return (
    <>
      <nav className="w-full bg-white shadow-md fixed top-0 left-0 right-0 z-50 h-20">
        <div className="max-w-screen-xl mx-auto flex justify-between items-center px-4 h-full">
          {/* Logo */}
          <Link to="/" className="flex items-center">
            <img
              src="https://qdartpzrxmftmaftfdbd.supabase.co/storage/v1/object/sign/group-images/logoo.png?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6InN0b3JhZ2UtdXJsLXNpZ25pbmcta2V5Xzk3ODQwNDNhLTIyOTYtNDVmNC04YTUyLTg0OTgwYjEyZjdjNyJ9.eyJ1cmwiOiJncm91cC1pbWFnZXMvbG9nb28ucG5nIiwiaWF0IjoxNzQ2MjA3OTcxLCJleHAiOjMzMjgyMjA3OTcxfQ.QCI5vOHOOPg7HXYUK5msQTAxJIT3Y72W0qPP6gITv4E"
              alt="Our Philly Logo"
              className="h-10 w-auto"
            />
          </Link>

          {/* Desktop Links */}
          <div className="hidden md:flex items-center space-x-6 text-sm font-medium">
            <Link to="/bulletin" className="text-gray-700 hover:text-gray-900 transition">
              Bulletin
            </Link>
            <Link to="/upcoming-events" className="text-gray-700 hover:text-gray-900 transition">
              Events
            </Link>
            <Link to="/groups" className="text-gray-700 hover:text-gray-900 transition">
              Groups
            </Link>
            <Link to="/voicemail" className="text-gray-700 hover:text-gray-900 transition">
              Voicemail
            </Link>

            {user ? (
              <>
                <Link to="/profile" className="text-gray-700 hover:text-gray-900 transition">
                  Profile
                </Link>
                <button onClick={handleLogout} className="text-gray-700 hover:text-gray-900 transition">
                  Log Out
                </button>
              </>
            ) : (
              <>
                <Link to="/login" className="text-gray-700 hover:text-gray-900 transition">
                  Log In
                </Link>
                <Link to="/signup" className="text-indigo-600 hover:text-indigo-800 font-semibold transition">
                  Sign Up
                </Link>
              </>
            )}

            {/* + Add a Group at the far right */}
            <button
              onClick={handleOpenModal}
              className="bg-indigo-600 text-white px-4 py-2 rounded-full hover:bg-indigo-700 transition"
            >
              + Add a Group
            </button>
          </div>

          {/* Mobile Menu Button */}
          <button className="md:hidden" onClick={() => setMenuOpen(!menuOpen)}>
            {menuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {/* Mobile Menu */}
        {menuOpen && (
          <div className="md:hidden bg-white shadow-md px-4 pt-4 pb-6 space-y-4 text-sm font-medium">
            <Link to="/bulletin" className="block" onClick={() => setMenuOpen(false)}>
              Bulletin
            </Link>
            <Link to="/upcoming-events" className="block" onClick={() => setMenuOpen(false)}>
              Events
            </Link>
            <Link to="/groups" className="block" onClick={() => setMenuOpen(false)}>
              Groups
            </Link>
            <Link to="/voicemail" className="block" onClick={() => setMenuOpen(false)}>
              Voicemail
            </Link>

          

            {user ? (
              <>
                <Link to="/profile" className="block" onClick={() => setMenuOpen(false)}>
                  Profile
                </Link>
                <button onClick={handleLogout} className="block">
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

<button
              onClick={handleOpenModal}
              className="w-full bg-indigo-600 text-white px-4 py-2 rounded-full hover:bg-indigo-700 transition"
            >
              + Add a Group
            </button>
          </div>
        )}
      </nav>

      {/* Submit-Group Modal */}
      {showSubmitModal && <SubmitGroupModal onClose={() => setShowSubmitModal(false)} />}
    </>
  );
};

export default Navbar;
