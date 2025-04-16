import React from 'react';

const PlatformPromoBillboard = ({
  image,
  headline1,
  headline2,
  cta,
  ribbonText,
  link
}) => {
  return (
    <section className="relative w-full max-w-[900px] h-[160px] mx-auto overflow-hidden rounded-xl border-4 border-yellow-400 shadow-xl">

<img
  src={image}
  className="absolute inset-0 w-full h-full object-cover filter brightness-110"
/>

      <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/40 to-black/70"></div>

      <a href={link} target="_blank" rel="noopener noreferrer">
        <div className="relative z-10 w-full h-full flex flex-col justify-center items-center text-white cursor-pointer">

          <div className="flex flex-wrap justify-center items-center gap-2 text-center drop-shadow-lg">
            <h2 className="text-xl md:text-2xl italic font-extrabold text-yellow-300">
              {headline1}
            </h2>
            <h2 className="inline text-base md:text-lg">
              {headline2}
            </h2>
          </div>

          <p className="mt-2 text-yellow-400 text-sm md:text-lg font-extrabold tracking-widest animate-pulse">
            {cta}
          </p>

        </div>
      </a>

      {ribbonText && (
        <div className="absolute top-2 left-2 bg-red-600 text-white text-[11px] px-2 py-0.5 font-bold rotate-[-6deg] shadow-md">
          {ribbonText.toUpperCase()}
        </div>
      )}
    </section>
  );
};

export default PlatformPromoBillboard;
