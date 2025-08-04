// src/Footer.jsx
import React, { useContext } from 'react';
import { Link } from 'react-router-dom';
import { AuthContext } from './AuthProvider';

const Footer = () => {
  const { user } = useContext(AuthContext);
  const year = new Date().getFullYear();
  const heartUrl =
    'https://qdartpzrxmftmaftfdbd.supabase.co/storage/v1/object/sign/group-images/OurPhilly-CityHeart-1.png?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1cmwiOiJncm91cC1pbWFnZXMvT3VyUGhpbGx5LUNpdHlIZWFydC0xLnBuZyIsImlhdCI6MTc0NTYxMjg5OSwiZXhwIjozMzI4MTYxMjg5OX0.NniulJ-CMLkbor5PBSay30rMbFwtGFosxvhAkBKGFbU';

  return (
    <footer className="relative bg-gray-900 text-gray-300 pt-64 pb-12 px-6 overflow-visible">
      {/* clipping window: only top half of heart shows */}
      <div className="absolute bottom-0 right-0 h-64 w-[600px]  pointer-events-none">
        <img
          src={heartUrl}
          alt="Heart"
          className="absolute bottom-0 right-0 w-3/4 h-auto opacity-100"
        />
      </div>

      <div className="max-w-screen-xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-10 relative z-10">
        {/* Brand / Copyright */}
        <div className="col-span-1 md:col-span-2">
        <img
              src="https://qdartpzrxmftmaftfdbd.supabase.co/storage/v1/object/sign/group-images/logoo.png?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1cmwiOiJncm91cC1pbWFnZXMvbG9nb28ucG5nIiwiaWF0IjoxNzQ1NzYzMzA5LCJleHAiOjMzMjgxNzYzMzA5fQ.5BrTLfgwYzwT3UnYsqOkaJKLTP4pDVME_T-l7fyllc0"
              alt="Our Philly Logo"
              className="h-20 w-auto"
            />
          <p className="text-sm text-gray-400 mb-4">
            Making community more accessible in the city.
          </p>
        {user ? (
          <p className="text-sm text-gray-400 mb-4">
            <Link to="/profile" className="text-indigo-400 hover:underline">View My Plans</Link> and share your plans card.
          </p>
        ) : (
          <p className="text-sm text-gray-400 mb-4">
            <Link to="/signup" className="text-indigo-400 hover:underline">Sign up</Link> to save events and get a weekly digest.
          </p>
        )}

        <p className="text-sm text-gray-400 mb-4">
          <Link to="/faq" className="text-indigo-400 hover:underline">FAQ</Link>
        </p>

        <p className="text-xs text-gray-500">&copy; {year} Our Philly. All rights reserved.</p>
        </div>

        {/* empty spacer to align heart */}
        <div className="col-span-1 md:col-span-2" />
      </div>
    </footer>
  );
};

export default Footer;
