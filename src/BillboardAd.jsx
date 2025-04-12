// src/components/BillboardAd.jsx
import React from 'react';

const BillboardAd = () => {
  return (
    <section className="relative w-full h-[200px] overflow-hidden">
      
      {/* Background Gritty Image filling entire space */}
      <img
        src="https://media.zenfs.com/en/insidehook_952/fdcb5052770964925698fc74e4be025e" 
        alt="Gritty Billboard"
        className="absolute inset-0 w-full h-full object-cover"
      />

      {/* Overlay Content */}
      <div className="absolute inset-0 bg-gradient-to-b from-white/10 to-transparent"></div>
      <div className="relative z-10 w-full h-full flex flex-col justify-center items-center bg-black/60 text-white">
        
      <div className="flex flex-wrap justify-center items-center gap-4 text-center drop-shadow-lg">
      <h2 className="text-3xl md:text-5xl italic font-extrabold text-yellow-300">
        HURT AT WORK?
      </h2>
          
          <h2 className="text-3xl md:text-5xl font-extrabold">
            HURT THEM BACK.
          </h2>
        </div>

        <p className="mt-2 text-yellow-400 text-lg md:text-2xl font-bold tracking-widest">
          1-800-Go-Gritty
        </p>

      </div>
        {/* Fake Ribbon */}
  <div className="absolute top-2 left-2 bg-red-600 text-white text-xs px-2 py-1 font-bold rotate-[-5deg]">
    FREE CONSULTATION
  </div>

    </section>
  );
};

export default BillboardAd;

