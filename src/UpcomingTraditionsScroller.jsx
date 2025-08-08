import React, { useEffect, useState, useContext } from 'react';
import { supabase } from './supabaseClient';
import { AuthContext } from './AuthProvider';
import { Link, useNavigate } from 'react-router-dom';
import useEventFavorite from './utils/useEventFavorite';
import { FaStar } from 'react-icons/fa';

function FavoriteState({ event_id, source_table, children }) {
  const state = useEventFavorite({ event_id, source_table });
  return children(state);
}

export default function UpcomingTraditionsScroller() {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  const parseDate = datesStr => {
    if (!datesStr) return null;
    const [first] = datesStr.split(/through|–|-/);
    const parts = first.trim().split('/');
    if (parts.length !== 3) return null;
    const [m, d, y] = parts.map(Number);
    const dt = new Date(y, m - 1, d);
    return isNaN(dt) ? null : dt;
  };

  useEffect(() => {
    (async () => {
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const { data, error } = await supabase
        .from('events')
        .select(`id, slug, "E Name", Dates, "End Date", "E Image"`)
        .order('Dates', { ascending: true });
      if (error) {
        console.error('Error loading events:', error);
        setLoading(false);
        return;
      }
      const upcoming = data
        .map(e => {
          const start = parseDate(e.Dates);
          if (!start) return null;
          const end = e['End Date'] ? parseDate(e['End Date']) : start;
          if (!end) return null;
          return { ...e, start, end };
        })
        .filter(e => e && e.end >= today)
        .sort((a, b) => a.start - b.start)
        .slice(0, 20);
      setEvents(upcoming);
      setLoading(false);
    })();
  }, []);

  return (
    <div className="mt-8">
      <h3 className="text-xl font-[Barrio] text-indigo-900 mb-1">HIGHLIGHT: Upcoming Philly Traditions</h3>
      <p className="text-gray-700 mb-4">These events happen every year and are coming up!</p>
      {loading ? (
        <p className="text-center">Loading…</p>
      ) : !events.length ? (
        <p className="text-center">No upcoming traditions.</p>
      ) : (
        <div className="overflow-x-auto scrollbar-hide">
          <div className="flex gap-4 pb-2">
            {events.map(evt => (
              <FavoriteState key={evt.id} event_id={evt.id} source_table="events">
                {({ isFavorite, toggleFavorite, loading }) => {
                  const handleToggle = async e => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (!user) {
                      navigate('/login');
                      return;
                    }
                    await toggleFavorite();
                  };
                  return (
                    <div className="w-40 flex-shrink-0">
                      <Link to={`/events/${evt.slug}`} className="block relative w-full h-24 rounded-lg overflow-hidden shadow">
                        <img src={evt['E Image']} alt={evt['E Name']} className="w-full h-full object-cover" />
                        <div className="absolute top-1 left-1 bg-yellow-400 text-white p-1 rounded-full">
                          <FaStar className="w-3 h-3" />
                        </div>
                      </Link>
                      <h4 className="mt-2 text-sm font-semibold text-gray-800 line-clamp-2">{evt['E Name']}</h4>
                      <button
                        onClick={handleToggle}
                        disabled={loading}
                        className={`mt-1 w-full border border-indigo-600 rounded-md py-1 text-xs font-semibold transition-colors ${
                          isFavorite
                            ? 'bg-indigo-600 text-white'
                            : 'bg-white text-indigo-600 hover:bg-indigo-600 hover:text-white'
                        }`}
                      >
                        {isFavorite ? 'In the Plans' : 'Add to Plans'}
                      </button>
                    </div>
                  );
                }}
              </FavoriteState>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

