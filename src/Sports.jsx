import React, { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';

const SportsPage = () => {
  const [games, setGames] = useState([]);

  useEffect(() => {
    const fetchGames = async () => {
      const { data, error } = await supabase.from('games').select('*');

      if (error) {
        console.error('Error fetching games:', error);
        return;
      }

      const today = new Date();

      const upcomingGames = data.filter((game) => {
        const [month, day, year] = game.Date.split('/');
        const gameDate = new Date(2000 + parseInt(year), parseInt(month) - 1, parseInt(day));
        return gameDate >= today;
      });

      setGames(
        upcomingGames.sort((a, b) => {
          const [am, ad, ay] = a.Date.split('/').map(Number);
          const [bm, bd, by] = b.Date.split('/').map(Number);
          const aDate = new Date(2000 + ay, am - 1, ad);
          const bDate = new Date(2000 + by, bm - 1, bd);
          return aDate - bDate;
        })
      );
    };

    fetchGames();
  }, []);

  const getDayOfWeek = (dateStr) => {
    const [month, day, year] = dateStr.split('/');
    const date = new Date(2000 + parseInt(year), parseInt(month) - 1, parseInt(day));
    return date.toLocaleDateString('en-US', { weekday: 'short' });
  };

  const isHomeGame = (location) => {
    return location?.toLowerCase().includes('citizens bank');
  };

  return (
    <div className="bg-white py-10 px-4">
      <div className="max-w-screen-xl mx-auto">
        <h2 className="text-black text-2xl font-bold mb-1 text-left">🎉 Upcoming Phillies Games</h2>
        <p className="text-gray-600 text-sm mb-4 text-left">Catch a game before the season’s over</p>
        <div className="relative">
          <div className="overflow-x-auto">
            <div className="flex gap-6 w-max">
              {games.map((game, index) => (
                <a
                  key={game.id}
                  href={game['Ticket link']}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`rounded-2xl overflow-hidden shadow hover:shadow-xl transition-transform hover:scale-105 w-80 flex-shrink-0 ${isHomeGame(game.Location) ? 'bg-yellow-50' : 'bg-white'}`}
                  style={{ animationDelay: `${index * 0.1}s` }}
                >
                  <div className="relative">
                    <img
                      src={game.Image}
                      alt={game.Subject}
                      className="w-full h-48 object-cover rounded-t-2xl"
                    />
                    <div className="absolute top-2 left-2 bg-black/60 text-white text-xs px-2 py-1 rounded-full">
                      {getDayOfWeek(game.Date)}
                    </div>
                  </div>
                  <div className="px-4 py-3 h-[120px] flex flex-col justify-center">
                    <div className="text-sm font-medium text-gray-800 leading-snug truncate">
                      {game.Subject}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">{game.Date}</div>
                    <div className="text-sm text-indigo-600 font-semibold mt-1">Tickets</div>
                  </div>
                </a>
              ))}
              {games.length === 0 && (
                <div className="text-gray-500 text-sm mt-6">No upcoming games found.</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SportsPage;



