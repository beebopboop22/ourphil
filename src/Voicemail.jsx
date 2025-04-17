// src/HeroVoicemail.jsx
import React, { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';

const HeroVoicemail = () => {
  const [latestAudio, setLatestAudio] = useState(null);

  useEffect(() => {
    const fetchLatestAudio = async () => {
      const { data, error } = await supabase
        .from('Audio')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1);

      if (error) {
        console.error('Error fetching voicemail:', error);
        return;
      }

      setLatestAudio(data[0]);
    };

    fetchLatestAudio();
  }, []);

  return (
    <section className="w-full bg-blue-900 text-white flex items-center justify-center px-6 py-20">
      <div className="max-w-xl w-full text-center">

        <p className="text-3xl md:text-4xl font-extrabold tracking-wide mb-2">
          <a href="tel:2158398394" className="hover:underline">(215) 839-8394</a>
        </p>

        <h2 className="text-4xl md:text-5xl font-[Barrio] mb-6">
          Philly's Anonymous Voicemail
        </h2>

        <p className="text-lg md:text-xl mb-8">
          Observations or complaints — whatever’s on your mind.
        </p>

        {latestAudio?.url && (
          <audio controls className="w-full mb-8">
            <source src={latestAudio.url} type="audio/mpeg" />
            Your browser does not support the audio element.
          </audio>
        )}

        <a
          href="tel:2158398394"
          className="inline-block px-10 py-4 bg-yellow-400 hover:bg-yellow-500 text-blue-900 text-lg font-extrabold rounded-full shadow-lg transition tracking-wide"
        >
          Leave a Voicemail Now
        </a>

      </div>
    </section>
  );
};

export default HeroVoicemail;
