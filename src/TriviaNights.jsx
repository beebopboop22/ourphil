import React, { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';
import Navbar from './Navbar';

const daysOfWeek = [
  'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'
];

const TriviaNights = () => {
  const [triviaList, setTriviaList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState(daysOfWeek[new Date().getDay()]);

  useEffect(() => {
    const fetchTrivia = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('trivia')
        .select('*')
        .eq('Day', selectedDay);

      if (error) {
        console.error('Error fetching trivia nights:', error);
      } else {
        setTriviaList(data);
      }
      setLoading(false);
    };

    fetchTrivia();
  }, [selectedDay]);

  return (
    <div className="min-h-screen bg-stone-100 from-yellow-50 to-gray-100">
      <Navbar />

      <div className="py-10 px-6">
        <h1 className="text-4xl font-extrabold text-center text-yellow-600 mb-6 drop-shadow-sm">
          🎉 Trivia Nights on {selectedDay}
        </h1>

        <div className="flex justify-center mb-10">
          <select
            id="day-select"
            value={selectedDay}
            onChange={(e) => setSelectedDay(e.target.value)}
            className="text-lg font-semibold bg-white text-gray-800 border-2 border-yellow-500 rounded-lg px-5 py-3 shadow-lg focus:ring-2 focus:ring-yellow-400 focus:outline-none transition"
          >
            {daysOfWeek.map((day) => (
              <option key={day} value={day}>{day}</option>
            ))}
          </select>
        </div>

        {loading ? (
          <p className="text-gray-500 text-center text-lg">Loading trivia magic...</p>
        ) : triviaList.length === 0 ? (
          <p className="text-gray-600 text-center text-lg">No trivia nights listed for this day.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 px-4">
            {triviaList.map((item) => (
              <div
                key={item.id}
                className="bg-white border border-yellow-300 rounded-xl p-5 shadow-md hover:shadow-xl transition hover:scale-[1.02]"
              >
                <a
                  href={item.link || '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block"
                >
                  <p className="text-xl font-bold text-yellow-700 mb-1">{item.Bar}</p>
                  <p className="text-sm text-gray-700">{item.Time} — {item.Neighborhood}</p>
                </a>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default TriviaNights;








