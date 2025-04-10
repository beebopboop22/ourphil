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
        .limit(1)
        .single();

      if (error) {
        console.error('Error fetching voicemail:', error);
        return;
      }

      setLatestAudio(data);
    };

    fetchLatestAudio();
  }, []);

  return (
    <section className="w-full px-6 py-16 bg-gray-50 border-b border-gray-200 text-center">
      <h2 className="text-3xl font-extrabold text-gray-900 mb-6">
        Philly's Anonymous Voicemail
      </h2>

      {latestAudio?.url && (
        <audio controls className="w-full max-w-md mx-auto rounded shadow-sm mb-6">
          <source src={latestAudio.url} type="audio/mpeg" />
          Your browser does not support the audio element.
        </audio>
      )}

      <a
        href="tel:2153233324"
        className="inline-block px-8 py-3 bg-red-600 hover:bg-blue-700 text-white text-lg font-semibold rounded-lg shadow-md transition"
      >
        Leave a Voicemail Now
      </a>
    </section>
  );
};

export default HeroVoicemail;



