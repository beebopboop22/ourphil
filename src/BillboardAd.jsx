import React from 'react';

const BillboardAd = () => {
  return (
    <section className="relative w-full h-[100px] overflow-hidden">
      
      {/* Background Gritty Image */}
      <img
        src="https://media.zenfs.com/en/insidehook_952/fdcb5052770964925698fc74e4be025e" 
        alt="Gritty Billboard"
        className="absolute inset-0 w-full h-full object-cover"
      />

      {/* Overlay Content */}
      <div className="absolute inset-0 bg-gradient-to-b from-white/10 to-transparent"></div>
      
      <div className="relative z-10 w-full h-full flex flex-col justify-center items-center bg-black/60 text-white">
        
        <div className="flex flex-wrap justify-center items-center gap-2 text-center drop-shadow-lg">
          <h2 className="text-xl md:text-3xl italic font-extrabold text-yellow-300">
            HURT AT WORK?
          </h2>
          
          <h2 className="text-xl md:text-3xl font-extrabold">
            HURT THEM BACK.
          </h2>
        </div>

        <p className="mt-1 text-yellow-400 text-sm md:text-lg font-bold tracking-widest">
          1-800-Go-Gritty
        </p>

      </div>

      {/* Ribbon */}
      <div className="absolute top-1 left-1 bg-red-600 text-white text-[10px] px-1 py-0.5 font-bold rotate-[-5deg]">
        FREE CONSULTATION
      </div>

    </section>
  );
};

export default BillboardAd;


