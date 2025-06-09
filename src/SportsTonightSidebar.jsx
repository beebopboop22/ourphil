// src/SportsTonightSidebar.jsx
import React, { useEffect, useState } from 'react';

const teamSlugs = [
  'philadelphia-phillies',
  'philadelphia-76ers',
  'philadelphia-eagles',
  'philadelphia-flyers',
  'philadelphia-union',
];

export default function SportsTonightSidebar() {
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        let allEvents = [];
        for (const slug of teamSlugs) {
          const res = await fetch(
            `https://api.seatgeek.com/2/events?performers.slug=${slug}&per_page=10&sort=datetime_local.asc&client_id=${import.meta.env.VITE_SEATGEEK_CLIENT_ID}`
          );
          const data = await res.json();
          allEvents.push(...(data.events || []));
        }
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tonight = allEvents.filter(evt => {
          const d = new Date(evt.datetime_local);
          d.setHours(0, 0, 0, 0);
          return d.getTime() === today.getTime();
        });
        tonight.sort((a, b) => new Date(a.datetime_local) - new Date(b.datetime_local));
        setGames(tonight);
      } catch {
        setGames([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="w-full mb-6">
     

      {loading ? (
        <div className="text-center py-4 text-gray-500">Loading games…</div>
      ) : games.length === 0 ? (
        <div className="text-center text-gray-400 text-sm py-2">No games tonight</div>
        
      ) : (
        <div className="space-y-1">
          {games.map(evt => {
            const home = evt.performers.find(p => p.home_team) || evt.performers[0];
            const away = evt.performers.find(p => !p.home_team) || evt.performers[1] || home;
            const localName = home.name.replace(/^Philadelphia /, '');
            const visitorName = away.name.replace(/^Philadelphia /, '');
            const gameTime = new Date(evt.datetime_local).toLocaleTimeString('en-US', {
              hour: 'numeric',
              minute: '2-digit',
            });
            const venueName = evt.venue?.name || '';

            return (
              
              <a
                key={evt.id}
                href={evt.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 hover:bg-gray-50 px-2 py-1 rounded transition text-sm"
              >
                {/* Home logo + name */}
                <h3 className="font-[Barrio] text-xl text-indigo-900 pr-5">
        TONIGHT&apos;S GAMES: 
      </h3>
                <img
                  src={home.image || '/placeholder.svg'}
                  alt={home.name}
                  className="w-5 h-5 rounded-full object-cover border border-gray-200"
                />
                <span className="font-semibold text-[#28313e]">{localName}</span>

                {/* vs */}
                <span className="text-gray-500">vs</span>

                {/* Visitor name + logo */}
                <span className="font-semibold text-[#28313e]">{visitorName}</span>
                

                {/* Time & venue */}
                <span className=" text-gray-600 whitespace-nowrap">
                  {gameTime} @ {venueName}
                </span>
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}
