// src/BigBoardEventsGrid.jsx
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from './supabaseClient';
import PostFlyerModal from './PostFlyerModal';

export default function BigBoardEventsGrid() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  const iconUrl =
    'https://qdartpzrxmftmaftfdbd.supabase.co/storage/v1/object/public/group-images/Our-Philly-Concierge_Illustration-1.png';
  const pinUrl =
    'https://qdartpzrxmftmaftfdbd.supabase.co/storage/v1/object/public/group-images/push-pin-green.png';
  const boardBg =
    'https://qdartpzrxmftmaftfdbd.supabase.co/storage/v1/object/public/group-images/bulletin-board-2.jpeg';
  const paperBg =
    'https://qdartpzrxmftmaftfdbd.supabase.co/storage/v1/object/public/group-images/loose-leaf-paper.jpg';

  // ── Helpers ────────────────────────────────────────────────────────────────
  // Parse 'YYYY-MM-DD' as local date (midnight)
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

  // Returns "TODAY", "TOMORROW", "THIS XDAY", or "NEXT XDAY", else formatted
  const getDisplayDay = (dateStr) => {
    const d = parseISODateLocal(dateStr);
    const diff = dayDiff(dateStr);
    if (diff === 0) return 'TODAY';
    if (diff === 1) return 'TOMORROW';
    if (diff > 1 && diff < 7) {
      const weekday = d
        .toLocaleDateString('en-US', { weekday: 'long' })
        .toUpperCase();
      return `THIS ${weekday}`;
    }
    if (diff >= 7 && diff < 14) {
      const weekday = d
        .toLocaleDateString('en-US', { weekday: 'long' })
        .toUpperCase();
      return `NEXT ${weekday}`;
    }
    return d
      .toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      .toUpperCase();
  };

  useEffect(() => {
    (async () => {
      // iso-string for today (YYYY-MM-DD)
      const today = new Date().toISOString().split('T')[0];

      const { data, error } = await supabase
        .from('big_board_events')
        .select(`
          id,
          title,
          start_date,
          slug,
          big_board_posts!big_board_posts_event_id_fkey (
            image_url
          )
        `)
        .gte('start_date', today)
        .order('start_date', { ascending: true });

      if (error) {
        console.error('Error loading events:', error);
      } else {
        const enriched = await Promise.all(
          data.map(async (ev) => {
            const imgKey = ev.big_board_posts?.[0]?.image_url;
            const {
              data: { publicUrl },
            } = supabase.storage.from('big-board').getPublicUrl(imgKey);
            return { ...ev, imageUrl: publicUrl };
          })
        );
        setEvents(enriched);
      }
      setLoading(false);
    })();
  }, []);

  return (
    <div
      className="w-full py-12 relative overflow-x-hidden"
      style={{
        backgroundImage: `url('${boardBg}')`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      {/* Side pins on the board */}
      <img
        src={pinUrl}
        alt=""
        className="hidden md:block absolute top-8 -left-8 w-10 h-10 rotate-12 pointer-events-none"
      />
      <img
        src={pinUrl}
        alt=""
        className="hidden md:block absolute bottom-8 -right-8 w-10 h-10 -rotate-12 pointer-events-none"
      />

      <div className="max-w-screen-xl mx-auto px-4">
        {/* Centered paper title with pin */}
        <div className="relative mb-8 flex flex-col items-center">
          <div className="relative inline-block">
            <div
              className="w-full py-6 px-8"
              style={{
                backgroundImage: `url('${paperBg}')`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
              }}
            >
              <h2 className="text-[#28313e] sm:text-4xl text-2xl font-[Barrio] leading-snug text-center">
                POST IT TO THE BIG BOARD
              </h2>
              <p className="text-[#28313e] sm:text-xl text-2xl leading-snug text-center">
              Post event flyers to drop them on our calendar

              </p>

              
            </div>
            {/* Pin on paper */}
            <img
              src={pinUrl}
              alt="Pinned"
              className="absolute -top-4 left-1/2 w-16 h-12 transform -translate-x-1/2 rotate-6 z-20 pointer-events-none"
            />
          </div>
          {/* Button below headline */}
          <button
            onClick={() => setShowModal(true)}
            className="mt-4 bg-indigo-600 text-white text-sm font-semibold px-6 py-2 rounded hover:bg-indigo-700 transition"
          >
            Post Now!
          </button>
        </div>

        {loading ? (
          <p className="text-white">Loading submissions…</p>
        ) : (
          <div className="overflow-x-auto !overflow-y-visible scrollbar-hide">
            <div className="flex gap-4 pb-4">
              {events.map((ev) => {
                const diff = dayDiff(ev.start_date);
                const label = getDisplayDay(ev.start_date);
                const bgColor =
                  diff === 0
                    ? 'bg-green-500'
                    : diff === 1
                    ? 'bg-blue-500'
                    : 'bg-gray-500';

                const displayDate = parseISODateLocal(ev.start_date);

                return (
                  <Link
                    key={ev.id}
                    to={`/big-board/${ev.slug}`}
                    className="relative min-w-[280px] max-w-[280px] bg-white rounded-xl shadow-md hover:shadow-lg transition-transform hover:scale-105 overflow-visible flex flex-col"
                  >
                    {/* push-pin overlay */}
                    <img
                      src={pinUrl}
                      alt="Pinned"
                      className="absolute right-0 top-1 w-20 h-12 transform rotate-12 z-50 pointer-events-none"
                    />

                    <div className="relative">
                      <img
                        src={ev.imageUrl}
                        alt={ev.title}
                        className="w-full h-36 object-cover"
                      />

                      <img
                        src={iconUrl}
                        alt="Community submission"
                        className="absolute bottom-0 right-2 w-12 h-12 z-20"
                      />

                      <div
                        className={`
                          absolute top-2 left-2 text-white text-sm font-bold px-3 py-0.5 rounded-full shadow-md z-10 ${bgColor}
                        `}
                      >
                        {label}
                      </div>
                    </div>

                    <div className="p-4 flex flex-col justify-between flex-grow">
                      <h3 className="text-md font-semibold text-indigo-800 mb-1 line-clamp-2">
                        {ev.title}
                      </h3>
                      <p className="text-xs text-gray-500">
                        📅{' '}
                        {displayDate.toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                        })}
                      </p>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* PostFlyerModal opens when showModal=true */}
      <PostFlyerModal isOpen={showModal} onClose={() => setShowModal(false)} />
    </div>
  );
}
