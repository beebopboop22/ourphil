// src/Navbar.jsx
import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import SubmitGroupModal from './SubmitGroupModal';

const Navbar = () => {
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [showSubmitModal, setShowSubmitModal] = useState(false);

  const handleOpenModal = () => {
    setShowSubmitModal(true);
    setMenuOpen(false); // close mobile menu if open
  };

  return (
    <>
      <nav className="w-full bg-white shadow-md fixed top-0 left-0 right-0 z-50 h-20">
        <div className="max-w-screen-xl mx-auto flex justify-between items-center px-4 h-full">
          {/* Logo */}
          <Link to="/" className="flex items-center">
            <img
              src="https://qdartpzrxmftmaftfdbd.supabase.co/storage/v1/object/sign/group-images/logoo.png?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1cmwiOiJncm91cC1pbWFnZXMvbG9nb28ucG5nIiwiaWF0IjoxNzQzODY0MDk4LCJleHAiOjk0NzgyMzg2NDA5OH0.Od0PxsOqyLjqCP2ZN9UAaG821mVvIEaOHq_ACf3Dwsg"
              alt="Philly Groups Logo"
              className="h-10 w-auto"
            />
          </Link>

          {/* Mobile Menu Button */}
          <button className="md:hidden" onClick={() => setMenuOpen(!menuOpen)}>
            {menuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>

          {/* Desktop Links */}
          <div className="hidden md:flex items-center space-x-6 text-sm font-medium">
            <Link to="/" className={`hover:text-indigo-600 transition ${location.pathname === '/' ? 'text-indigo-600' : 'text-gray-800'}`}>Home</Link>
            <Link to="/groups" className={`hover:text-indigo-600 transition ${location.pathname === '/groups' ? 'text-indigo-600' : 'text-gray-800'}`}>Groups</Link>
            <button
              onClick={handleOpenModal}
              className="bg-indigo-600 text-white px-4 py-2 rounded-full text-sm hover:bg-indigo-700 transition"
            >
              + Add a Group
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {menuOpen && (
          <div className="md:hidden bg-white shadow-md px-4 pt-4 pb-6 space-y-4 text-sm font-medium">
            <Link to="/" className="block text-gray-800 hover:text-indigo-600" onClick={() => setMenuOpen(false)}>Home</Link>
            <Link to="/sports" className="block text-gray-800 hover:text-indigo-600" onClick={() => setMenuOpen(false)}>Sports</Link>
            <Link to="/trivia" className="block text-gray-800 hover:text-indigo-600" onClick={() => setMenuOpen(false)}>Trivia</Link>
            <Link to="/groups" className="block text-indigo-600 hover:underline" onClick={() => setMenuOpen(false)}>Groups</Link>
            <button
              onClick={handleOpenModal}
              className="w-full bg-indigo-600 text-white px-4 py-2 rounded-full text-sm hover:bg-indigo-700 transition"
            >
              + Add a Group
            </button>
          </div>
        )}
      </nav>

      {/* Modal */}
      {showSubmitModal && (
        <SubmitGroupModal onClose={() => setShowSubmitModal(false)} />
      )}
    </>
  );
};

export default Navbar;

