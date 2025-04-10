import React, { useEffect, useState } from 'react';

const highlights = [
  {
    image: 'https://plus.unsplash.com/premium_photo-1670984940156-c7f833fe8397?q=80&w=2070&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',
    day: 'Monday Nights',
  },
  {
    image: 'https://images.unsplash.com/photo-1644772887405-83a72f84e4de?q=80&w=2187&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',
    day: 'Tuesday Nights',
  },
  {
    image: 'https://images.unsplash.com/photo-1656423376398-d25176c5ab49?q=80&w=2187&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',
    day: 'Wednesday Nights',
  },
];

const RotatingFeatureBox = () => {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setIndex((prevIndex) => (prevIndex + 1) % highlights.length);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  const current = highlights[index];

  return (
    <div className="w-full my-20 px-4 flex justify-center">
      <div className="relative w-full max-w-6xl rounded-3xl overflow-hidden bg-white shadow-xl">
        <div className="w-full h-[400px] md:h-[500px] relative">
          <img
            src={current.image}
            alt="Highlight"
            className="w-full h-full object-cover transition-opacity duration-1000"
          />
          <div className="absolute inset-0 bg-black/40 flex flex-col items-start justify-end px-8 pb-10 text-left">
            <h2 className="text-white text-3xl md:text-5xl font-bold drop-shadow-lg mb-2">
              Quizzo & Trivia
            </h2>
            <p className="text-white text-xl md:text-2xl font-medium drop-shadow-md">
              {current.day}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RotatingFeatureBox;




