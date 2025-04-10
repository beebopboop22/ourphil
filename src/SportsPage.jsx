// src/SportsPage.jsx
import React, { useEffect, useState } from 'react';
import Navbar from './Navbar';


const SportsPage = () => {
  const [games, setGames] = useState([]);

  useEffect(() => {
    setGames([
      {
        id: 1,
        homeTeam: 'Philadelphia Eagles',
        awayTeam: 'Dallas Cowboys',
        date: 'Oct 12, 2025',
        price: '$75',
        homeLogo: '/images/eagles.png',
        awayLogo: '/images/cowboys.png',
        url: 'https://example.com/eagles-vs-cowboys'
      },
      {
        id: 2,
        homeTeam: 'Philadelphia Phillies',
        awayTeam: 'Atlanta Braves',
        date: 'Oct 14, 2025',
        price: '$45',
        homeLogo: '/images/phillies.png',
        awayLogo: '/images/braves.png',
        url: 'https://example.com/phillies-vs-braves'
      },
      {
        id: 3,
        homeTeam: 'Philadelphia 76ers',
        awayTeam: 'Boston Celtics',
        date: 'Oct 16, 2025',
        price: '$60',
        homeLogo: '/images/sixers.png',
        awayLogo: '/images/celtics.png',
        url: 'https://example.com/76ers-vs-celtics'
      },
    ]);
  }, []);

  return (
    <div className="min-h-screen bg-white-100 py-10 px-4">
      <Navbar />

      <div className="max-w-screen-xl mx-auto">
      <h2 className="text-black text-2xl font-bold mb-1 text-left">🎉 Upcoming Home Games</h2>
      <p className="text-gray-600 text-sm mb-4 text-left">Iasd;jfa;lskfj;alsd</p>
        <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {games.map((game, index) => (
            <a
              key={game.id}
              href={game.url}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-white rounded-2xl shadow hover:shadow-xl transition-transform hover:scale-105 overflow-hidden flex flex-col h-80"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <div className="flex items-center justify-center gap-4 bg-white-50 h-2/3 p-4">
                <img src={game.homeLogo} alt={game.homeTeam} className="h-full w-1/3 object-contain" />
                <div className="text-lg font-semibold text-gray-800">vs</div>
                <img src={game.awayLogo} alt={game.awayTeam} className="h-full w-1/3 object-contain" />
              </div>
              <div className="bg-white px-4 py-3 h-1/3 flex flex-col justify-center">
                <div className="text-sm font-medium text-gray-800 truncate">
                  {game.homeTeam} vs {game.awayTeam}
                </div>
                <div className="text-xs text-gray-500">{game.date}</div>
                <div className="text-sm text-indigo-600 font-semibold mt-1">Tickets from {game.price}</div>
              </div>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
};

export default SportsPage;

