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
        // Only show games happening today
        const tonight = allEvents.filter(evt => {
          const date = new Date(evt.datetime_local);
          date.setHours(0, 0, 0, 0);
          return date.getTime() === today.getTime();
        });
        // Sort by time
        tonight.sort((a, b) => new Date(a.datetime_local) - new Date(b.datetime_local));
        setGames(tonight);
      } catch (err) {
        setGames([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="relative bg-white p-4 rounded-lg shadow mb-6">
      <h3 className="font-[Barrio] text-2xl text-indigo-900 mb-2 flex items-center">
        TONIGHT&apos;S GAMES
      </h3>
      {loading ? (
        <div className="text-center py-4 text-gray-500">Loading games…</div>
      ) : games.length === 0 ? (
        <div className="text-center text-gray-400 text-sm py-2">No games tonight</div>
      ) : (
        <div className="space-y-3">
          {games.map(evt => {
            const home = evt.performers.find(p => p.home_team);
            const away = evt.performers.find(p => !p.home_team);
            const local = home || evt.performers[0];
            const visitor = away || evt.performers[1] || evt.performers[0];
            const gameTime = new Date(evt.datetime_local).toLocaleTimeString('en-US', {
              hour: 'numeric',
              minute: '2-digit',
            });
            return (
              <a
                key={evt.id}
                href={evt.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 rounded-md hover:bg-gray-50 p-2 transition"
              >
                <div className="flex items-center gap-1">
                  
                  <img
                    src={local?.image || '/placeholder.svg'}
                    alt={local?.name}
                    className="w-8 h-8 rounded-full object-cover border border-gray-200"
                  />
                </div>
                <div className="flex-1 pl-2">
                  <div className="font-semibold text-sm text-[#28313e] leading-tight">
                    {local?.name?.replace(/^Philadelphia /, '')}
                    <span className="mx-1 text-gray-400">vs</span>
                    {visitor?.name?.replace(/^Philadelphia /, '')}
                    <span className="ml-2 text-gray-600 font-normal">{gameTime}</span>
                  </div>
                  <div className="text-xs text-gray-400">{evt.venue?.name}</div>
                </div>
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}
