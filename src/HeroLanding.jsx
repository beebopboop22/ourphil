import React, { useState } from 'react';

const HeroLanding = () => {
  const [email, setEmail] = useState('');

  return (
    <section className="relative w-full bg-white border-b border-gray-200 py-24 px-6 overflow-hidden">

      {/* GIANT Background Heart */}
      <img 
        src="https://qdartpzrxmftmaftfdbd.supabase.co/storage/v1/object/sign/group-images/OurPhilly-CityHeart-1.png?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1cmwiOiJncm91cC1pbWFnZXMvT3VyUGhpbGx5LUNpdHlIZWFydC0xLnBuZyIsImlhdCI6MTc0NDMxMTA1NywiZXhwIjoxMjI0NTc5OTA1N30.WtdVvSM34QK-G-4WOYqehPvaU401WYf8E26LoSxSEIg"
        alt="Heart Logo"
        className="absolute w-[1200px] bottom-[-250px] right-1/2 translate-x-1/2 opacity-10 rotate-12 pointer-events-none z-0"
      />

      <div className="relative max-w-screen-xl mx-auto flex flex-col items-center text-center z-10">

        <h1 className="text-6xl sm:text-7xl font-black mb-4 leading-tight tracking-tight font-[Barrio] text-black">
          DIG INTO PHILLY
        </h1>

        <div className="flex flex-wrap justify-center gap-2 text-md mb-6 text-gray-600 font-medium">
          <a href="/groups" className="hover:text-black">Groups</a>
          <span>&bull;</span>
          <a href="/sports" className="hover:text-black">Sports</a>
          <span>&bull;</span>
          <a href="/concerts" className="hover:text-black">Concerts</a>
          <span>&bull;</span>
          <a href="/trivia" className="hover:text-black">Trivia</a>
          <span>&bull;</span>
          <a href="/voicemail" className="hover:text-black">Voicemail</a>
        </div>

        <div className="border-t border-gray-300 w-64 mb-10"></div>

        <div className="flex w-full max-w-sm">
          <input
            type="email"
            placeholder="Your email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            className="flex-grow px-4 py-3 border border-gray-300 rounded-l-lg focus:outline-none"
          />
          <button
            onClick={() => alert(`Subscribed: ${email}`)}
            className="bg-black text-white font-semibold px-6 py-3 rounded-r-lg hover:bg-gray-800 transition"
          >
            Subscribe
          </button>
        </div>

      </div>
    </section>
  );
};

export default HeroLanding;



