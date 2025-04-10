// src/WSJHeader.jsx
import React from 'react';

const WSJHeader = () => {
  return (
    <div className="w-full border-b border-gray-300 text-xs font-serif tracking-wide uppercase bg-white text-gray-800">
      {/* Top Strip */}
      <div className="flex justify-between items-center px-4 py-2 max-w-screen-xl mx-auto">
        <div className="flex gap-4">
          <span className="hover:underline cursor-pointer">Spring Sale</span>
          <span className="hover:underline cursor-pointer">English Edition</span>
          <span className="hover:underline cursor-pointer">Print Edition</span>
          <span className="hover:underline cursor-pointer">Video</span>
          <span className="hover:underline cursor-pointer">Audio</span>
        </div>
      </div>

      {/* Main Navigation */}
      <div className="flex flex-wrap justify-center px-4 py-2 border-t border-gray-200 max-w-screen-xl mx-auto text-[11px] font-semibold">
        <div className="flex flex-wrap gap-5 justify-center">
          <span className="hover:underline cursor-pointer">Latest Headlines</span>
          <span className="hover:underline cursor-pointer">More</span>
          <span className="hover:underline cursor-pointer">Latest</span>
          <span className="hover:underline cursor-pointer">World</span>
          <span className="hover:underline cursor-pointer">Business</span>
          <span className="hover:underline cursor-pointer">U.S.</span>
          <span className="hover:underline cursor-pointer">Politics</span>
          <span className="hover:underline cursor-pointer">Economy</span>
          <span className="hover:underline cursor-pointer">Tech</span>
          <span className="hover:underline cursor-pointer">Markets & Finance</span>
          <span className="hover:underline cursor-pointer">Opinion</span>
          <span className="hover:underline cursor-pointer">Arts</span>
          <span className="hover:underline cursor-pointer">Lifestyle</span>
          <span className="hover:underline cursor-pointer">Real Estate</span>
          <span className="hover:underline cursor-pointer">Personal Finance</span>
          <span className="hover:underline cursor-pointer">Health</span>
          <span className="hover:underline cursor-pointer">Style</span>
          <span className="hover:underline cursor-pointer">Sports</span>
        </div>
      </div>
    </div>
  );
};

export default WSJHeader;
