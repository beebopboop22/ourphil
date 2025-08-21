import React from 'react';
import { Link } from 'react-router-dom';

export default function LoginPromptModal({ onClose }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-xl w-full max-w-sm shadow-xl p-6 text-center relative">
        <h2 className="text-2xl font-bold mb-4">Log In Required</h2>
        <p className="mb-6">Please log in to post events.</p>
        <div className="flex justify-center space-x-4">
          <Link
            to="/login"
            onClick={onClose}
            className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700"
          >
            Log In
          </Link>
          <button
            onClick={onClose}
            className="px-4 py-2 border rounded hover:bg-gray-100"
          >
            Cancel
          </button>
        </div>
        <button
          onClick={onClose}
          className="absolute top-2 right-3 text-gray-400 hover:text-black text-xl"
        >
          &times;
        </button>
      </div>
    </div>
  );
}
