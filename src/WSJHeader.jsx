// src/WSJHeader.jsx
import React from 'react';

const WSJHeader = () => {
  return (
    <div className="w-full border-b border-gray-300 text-xs font-serif tracking-wide uppercase bg-white text-gray-800">      

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
         
        </div>
      </div>
    </div>
  );
};

export default WSJHeader;
