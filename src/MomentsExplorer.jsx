// /src/MomentsExplorer.jsx

import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { moments } from './utils/moments';
import Navbar from './Navbar';
import Footer from './Footer';

const MomentsExplorer = () => {
  const navigate = useNavigate();
  const { id } = useParams();

  const getRandomMoment = () => {
    const randomIndex = Math.floor(Math.random() * moments.length);
    return moments[randomIndex];
  };

  const [currentMoment, setCurrentMoment] = useState(() => {
    if (id) {
      const found = moments.find(m => m.id === id);
      return found || getRandomMoment();
    } else {
      return getRandomMoment();
    }
  });

  useEffect(() => {
    if (id && id !== currentMoment.id) {
      const found = moments.find(m => m.id === id);
      if (found) setCurrentMoment(found);
    }
  }, [id]);

  const goToNextMoment = () => {
    const next = getRandomMoment();
    setCurrentMoment(next);
    navigate(`/moments/${next.id}`, { replace: true });
  };

  const selectMoment = (moment) => {
    setCurrentMoment(moment);
    navigate(`/moments/${moment.id}`, { replace: true });
  };

  return (
    <>
      <div className="min-h-screen flex flex-col bg-neutral-50 pt-20 relative">
        <Navbar />

        <div className="relative py-16 px-4 mb-8">
          <div className="relative max-w-screen-xl mx-auto z-10 text-center">
            <h2 className="text-5xl font-[Barrio] text-gray-800 mb-6">
              MOMENTS OF PHILLY
            </h2>

            <div className="relative w-full max-w-3xl mx-auto mb-8">
              <div className="rounded-xl overflow-hidden shadow-lg bg-black">
                <iframe
                  key={currentMoment.id}
                  src={`https://www.youtube.com/embed/${currentMoment.id}?autoplay=1&controls=1`}
                  title={currentMoment.title}
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  className="w-full aspect-video"
                ></iframe>
              </div>
            </div>

            <div className="flex justify-center mb-10">
              <button
                onClick={goToNextMoment}
                className="inline-block bg-indigo-600 text-white font-bold text-lg px-8 py-3 rounded-full shadow hover:bg-indigo-700 hover:scale-105 transition-all duration-200"
              >
                🎬 Next Moment →
              </button>
            </div>

            <div className="flex gap-4 overflow-x-auto pb-4">
              {moments.map(moment => (
                <button
                  key={moment.id}
                  onClick={() => selectMoment(moment)}
                  className={`flex-shrink-0 w-[200px] p-4 text-center rounded-xl border ${
                    moment.id === currentMoment.id ? 'bg-white text-black font-bold' : 'bg-gray-800 text-white'
                  } hover:bg-white hover:text-black transition shadow`}
                >
                  {moment.title}
                </button>
              ))}
            </div>
          </div>
        </div>

        <Footer />
      </div>
    </>
  );
};

export default MomentsExplorer;
