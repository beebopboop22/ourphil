// src/BigBoardEventsGrid.jsx
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from './supabaseClient';
import PostFlyerModal from './PostFlyerModal';
import useEventFavorite from './utils/useEventFavorite';

const pillStyles = [
  'bg-green-100 text-indigo-800',
  'bg-teal-100 text-teal-800',
  'bg-pink-100 text-pink-800',
  'bg-blue-100 text-blue-800',
  'bg-orange-100 text-orange-800',
  'bg-yellow-100 text-yellow-800',
  'bg-purple-100 text-purple-800',
  'bg-red-100 text-red-800',
];

function FavoriteState({ event_id, source_table, children }) {
  const state = useEventFavorite({ event_id, source_table });
  return children(state);
}

export default function BigBoardEventsGrid() {
  const [events, setEvents] = useState([]);
  const [tagMap, setTagMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  const iconUrl =
    'https://qdartpzrxmftmaftfdbd.supabase.co/storage/v1/object/public/group-images/Our-Philly-Concierge_Illustration-1.png';
  const pinUrl =
    'https://qdartpzrxmftmaftfdbd.supabase.co/storage/v1/object/public/group-images/push-pin-green.png';

  // Parse 'YYYY-MM-DD' as local date
  function parseISODateLocal(str) {
    if (!str) return null;
    const [y, m, d] = str.split('-').map(Number);
    return new Date(y, m - 1, d);
  }

  // Compute full-day difference
  const dayDiff = (dateStr) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const d = parseISODateLocal(dateStr);
    d.setHours(0, 0, 0, 0);
    return Math.floor((d - today) / (1000 * 60 * 60 * 24));
  };

  // Generate bubble label
  const getDisplayDay = (dateStr) => {
    const d = parseISODateLocal(dateStr);
    const diff = dayDiff(dateStr);
    if (diff === 0) return 'TODAY';
    if (diff === 1) return 'TOMORROW';
    if (diff > 1 && diff < 7) {
      const wd = d.toLocaleDateString('en-US', { weekday: 'long' }).toUpperCase();
      return `THIS ${wd}`;
    }
    if (diff >= 7 && diff < 14) {
      const wd = d.toLocaleDateString('en-US', { weekday: 'long' }).toUpperCase();
      return `NEXT ${wd}`;
    }
    return d
      .toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      .toUpperCase();
  };

  // Fetch Big Board events
  useEffect(() => {
    (async () => {
      const today = new Date().toISOString().split('T')[0];
      const { data, error } = await supabase
        .from('big_board_events')
        .select(`
          id,
          title,
          start_date,
          slug,
          big_board_posts!big_board_posts_event_id_fkey(image_url)
        `)
        .gte('start_date', today)
        .order('start_date', { ascending: true });

      if (error) {
        console.error(error);
        setLoading(false);
        return;
      }

      const enriched = await Promise.all(
        data.map(async (ev) => {
          const key = ev.big_board_posts?.[0]?.image_url;
          const { data: urlData } = await supabase
            .storage
            .from('big-board')
            .getPublicUrl(key);
          return { ...ev, imageUrl: urlData.publicUrl };
        })
      );

      setEvents(enriched);
      setLoading(false);
    })();
  }, []);

  // Fetch tags for these big_board_events
  useEffect(() => {
    if (!events.length) return;

    supabase
      .from('taggings')
      .select('tags(name,slug),taggable_id')
      .eq('taggable_type', 'big_board_events')
      .in('taggable_id', events.map((ev) => ev.id))
      .then(({ data, error }) => {
        if (error) {
          console.error('Error loading tags:', error);
          return;
        }
        const map = {};
        data.forEach(({ taggable_id, tags }) => {
          if (!map[taggable_id]) map[taggable_id] = [];
          map[taggable_id].push(tags);
        });
        setTagMap(map);
      });
  }, [events]);

  return (
    <div className="w-full py-12" style={{ backgroundColor: '#bf3d35' }}>
      <div className="max-w-screen-xl mx-auto px-4 text-center">
        <h2 className="text-white sm:text-5xl text-3xl font-[Barrio] mb-6">
          COMMUNITY SUBMISSIONS
        </h2>
        <button
          onClick={() => setShowModal(true)}
          className="bg-indigo-600 text-white px-6 py-3 rounded-md shadow hover:bg-indigo-700 transition"
        >
          Post Now!
        </button>
      </div>

      {loading ? (
        <p className="text-white text-center mt-12">Loading submissions…</p>
      ) : (
        <div className="overflow-x-auto !overflow-y-visible scrollbar-hide mt-8 px-4">
          <div className="flex gap-6 pb-4">
            {events.map((ev) => {
              const label = getDisplayDay(ev.start_date);
              const diff = dayDiff(ev.start_date);
              const bgColor =
                diff === 0 ? 'bg-green-500' :
                diff === 1 ? 'bg-blue-500' :
                'bg-gray-500';

              return (
                <FavoriteState
                  key={ev.id}
                  event_id={ev.id}
                  source_table="big_board_events"
                >
                  {({ isFavorite, toggleFavorite, loading }) => (
                    <div className="flex-shrink-0">
                      <Link
                        to={`/big-board/${ev.slug}`}
                        className={`relative min-w-[280px] max-w-[280px] bg-white rounded-xl shadow-md hover:shadow-lg transform hover:scale-105 transition overflow-hidden ${isFavorite ? 'ring-2 ring-indigo-600' : ''}`}
                      >
                        {/* Day bubble */}
                        <div
                          className={`absolute top-3 left-3 text-white text-xs font-bold px-3 py-1 rounded-full ${bgColor} z-20`}
                        >
                          {label}
                        </div>

                        {/* Image + Badge */}
                        <div className="relative h-48">
                          <img
                            src={ev.imageUrl}
                            alt={ev.title}
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute inset-x-0 bottom-0 h-6 bg-indigo-600 flex items-center justify-center z-20">
                            <span className="text-xs font-bold text-white uppercase">
                              COMMUNITY SUBMISSION
                            </span>
                          </div>
                          <img
                            src={iconUrl}
                            alt=""
                            role="presentation"
                            loading="lazy"
                            className="absolute bottom-3 right-3 w-8 h-8 z-30"
                          />
                        </div>

                        {/* Title */}
                        <div className="p-4 text-center">
                          <h3 className="text-lg font-semibold text-indigo-800">
                            {ev.title}
                          </h3>

                          {/* TAGS footer */}
                          {(() => {
                            const tags = tagMap[ev.id] || [];
                            if (tags.length === 0) return null;
                            const primary = tags[0];
                            const extraCount = tags.length - 1;
                            return (
                              <div className="mt-2 flex items-center justify-center space-x-2">
                                <span className="text-xs font-bold text-gray-500 uppercase flex-shrink-0">
                                  TAGS:
                                </span>
                                <Link
                                  to={`/tags/${primary.slug}`}
                                  className={`
                                    ${pillStyles[0]}
                                    text-xs font-semibold
                                    px-2 py-1
                                    rounded-full
                                    flex-shrink-0
                                    hover:opacity-80 transition
                                  `}
                                >
                                  #{primary.name}
                                </Link>
                                {extraCount > 0 && (
                                  <span className="text-xs text-gray-600 flex-shrink-0">
                                    +{extraCount} more
                                  </span>
                                )}
                              </div>
                            );
                          })()}
                        </div>
                      </Link>
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          toggleFavorite();
                        }}
                        disabled={loading}
                        className={`mt-2 w-full border border-indigo-600 rounded-md py-2 font-semibold transition-colors ${isFavorite ? 'bg-indigo-600 text-white' : 'bg-white text-indigo-600 hover:bg-indigo-600 hover:text-white'}`}
                      >
                        {isFavorite ? 'In the Plans' : 'Add to Plans'}
                      </button>
                    </div>
                  )}
                </FavoriteState>
              );
            })}
          </div>
        </div>
      )}

      <PostFlyerModal isOpen={showModal} onClose={() => setShowModal(false)} />
    </div>
  );
}
