// src/VenuePage.jsx
import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import Navbar from './Navbar';
import Footer from './Footer';
import { Link, useParams } from 'react-router-dom';

// 🟡 Inline Sidebar "Bulletin" (duplicate design, no desc)
function UpcomingSidebarBulletin({ previewCount = 10 }) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const today0 = new Date(); today0.setHours(0,0,0,0);

  const parseDate = (datesStr) => {
    if (!datesStr) return null;
    const [first] = datesStr.split(/through|–|-/);
    return new Date(first.trim());
  };
  const formatShortDate = (d) =>
    d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  useEffect(() => {
    (async () => {
      try {
        const { data, error } = await supabase
          .from('events')
          .select(`id, slug, "E Name", Dates, "End Date", "E Image"`)
          .order('Dates', { ascending: true });
        if (error) throw error;

        const dynamic = data
          .map((e) => {
            const start = parseDate(e.Dates);
            const end = parseDate(e['End Date']) || start;
            const sd = new Date(start); sd.setHours(0, 0, 0, 0);
            const ed = new Date(end);   ed.setHours(0, 0, 0, 0);
            const single = !e['End Date'] || e['End Date'].trim() === e.Dates.trim();
            let updateText;
            if (today0.getTime() === sd.getTime()) {
              updateText = single
                ? `${e['E Name']} is today!`
                : `${e['E Name']} starts today!`;
            } else if (!single && today0.getTime() === ed.getTime()) {
              updateText = `${e['E Name']} ends today!`;
            } else if (today0 < sd) {
              updateText = single
                ? `${e['E Name']} is ${formatShortDate(sd)}!`
                : `${e['E Name']} starts ${formatShortDate(sd)}!`;
            } else if (today0 > ed) {
              updateText = null;
            } else {
              updateText = `${e['E Name']} is on!`;
            }
            return { ...e, start: sd, end: ed, updateText };
          })
          .filter((evt) => evt.end >= today0 && !!evt.updateText)
          .slice(0, previewCount);

        setEvents(dynamic);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    })();
  }, [previewCount]);

  if (loading) return <div className="text-center py-4 text-gray-500">Loading…</div>;

  return (
    <div>
      <h3 className="font-[Barrio] text-lg text-indigo-900 mb-2">Upcoming</h3>
      <div>
        {events.map((evt, idx) => {
          const isActive = evt.start && evt.end && today0 >= evt.start && today0 <= evt.end;
          const bgCls = idx % 2 === 0 ? 'bg-white' : 'bg-gray-50';
          const href = evt.slug
            ? evt.slug.startsWith('http')
              ? evt.slug
              : `/events/${evt.slug}`
            : null;
          const Wrapper = href ? 'a' : 'div';
          const linkProps = href
            ? { href, ...(href.startsWith('http') ? { target: '_blank', rel: 'noopener noreferrer' } : {}) }
            : {};
          return React.createElement(
            Wrapper,
            {
              key: evt.id,
              className: `${bgCls} flex items-center space-x-4 border-b border-gray-200 py-3 px-2 ${href ? 'hover:bg-gray-100 cursor-pointer' : ''}`,
              ...linkProps,
            },
            isActive && <span className="block w-3 h-3 bg-green-500 rounded-full animate-ping flex-shrink-0" />,
            evt['E Image'] && (
              <img
                src={evt['E Image']}
                alt="avatar"
                className="w-8 h-8 rounded-full object-cover flex-shrink-0"
              />
            ),
            <div className="flex-1">
              <div className="flex justify-between items-center">
                <p className="text-sm font-semibold text-gray-800">{evt.updateText}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function VenuePage() {
  const { venue } = useParams(); // venue slug from URL
  const [venueData, setVenueData] = useState(null);
  const [loadingVenue, setLoadingVenue] = useState(true);

  const [events, setEvents] = useState([]);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [page, setPage] = useState(1);
  const EVENTS_PER_PAGE = 7;

  useEffect(() => {
    (async () => {
      setLoadingVenue(true);
      // Fetch venue by slug
      const { data, error } = await supabase
        .from('venues')
        .select('*')
        .eq('slug', venue)
        .single();
      if (!error && data) setVenueData(data);
      setLoadingVenue(false);
    })();
  }, [venue]);

  useEffect(() => {
    (async () => {
      setLoadingEvents(true);
      // Fetch events at this venue, order by soonest
      const { data, error } = await supabase
        .from('all_events')
        .select('id, name, link, image, start_date, start_time, end_time, end_date, description, slug')
        .eq('venue_id', venueData?.id)
        .order('start_date', { ascending: true });
      if (!error && data) setEvents(data);
      setLoadingEvents(false);
    })();
  }, [venueData]);

  const pageCount = Math.ceil(events.length / EVENTS_PER_PAGE);
  const pagedEvents = events.slice((page-1)*EVENTS_PER_PAGE, page*EVENTS_PER_PAGE);

  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />

      {/* Venue Hero - edge-to-edge image with overlay */}
      <section className="relative h-80 md:h-96 w-full flex items-end justify-center mb-8">
        {venueData?.image_url ? (
          <img
            src={venueData.image_url}
            alt={venueData.name}
            className="absolute inset-0 w-full h-full object-cover object-center z-0"
            style={{filter:'brightness(0.6)'}}
          />
        ) : (
          <div className="absolute inset-0 w-full h-full bg-[#28313e] z-0" />
        )}
        <div className="relative z-10 w-full px-4 py-8">
          <div className="max-w-3xl mx-auto bg-black/60 rounded-2xl p-8 text-white shadow-lg flex flex-col items-center">
            {venueData?.name && (
              <h1 className="text-4xl md:text-5xl font-[Barrio] font-bold mb-3 text-center">{venueData.name}</h1>
            )}
            {(venueData?.address || venueData?.city) && (
              <p className="text-md mb-2 text-center font-semibold">
                {venueData?.address && <span>{venueData.address}, </span>}
                {venueData?.city && <span>{venueData.city}, </span>}
                {venueData?.state && <span>{venueData.state} </span>}
                {venueData?.zip && <span>{venueData.zip}</span>}
              </p>
            )}
            {venueData?.website && (
              <a href={venueData.website} target="_blank" rel="noopener noreferrer" className="text-indigo-200 underline text-lg mt-2 block">
                {venueData.website.replace(/^https?:\/\//, '')}
              </a>
            )}
          </div>
        </div>
      </section>

      {/* Main content */}
      <main className="flex flex-col-reverse md:flex-row gap-8 container mx-auto px-4 py-8 flex-grow">
        <div className="md:w-2/3 w-full">
          <h2 className="text-3xl font-semibold mb-4 text-[#28313e]">
            {loadingEvents
              ? 'Loading events…'
              : events.length
                ? `Upcoming at ${venueData?.name}`
                : 'No events scheduled'}
          </h2>
          {loadingEvents ? null : (
            <>
              <div className="grid grid-cols-1 gap-6">
                {pagedEvents.map(evt => (
                  <Link
                    key={evt.id}
                    to={`/things/${venue}/${evt.slug}`}
                    className="flex bg-white rounded-lg shadow hover:shadow-lg overflow-hidden"
                  >
                    {evt.image && (
                      <img
                        src={evt.image}
                        alt={evt.name}
                        className="w-40 h-40 object-cover flex-shrink-0"
                      />
                    )}
                    <div className="p-4 flex flex-col justify-between">
                      <div>
                        <h3 className="text-xl font-bold mb-1 text-[#28313e]">{evt.name}</h3>
                        <p className="text-gray-600 text-sm mb-2 line-clamp-2">
                          {evt.description}
                        </p>
                      </div>
                      <div className="text-gray-500 text-sm">
                        📅 {evt.start_date}
                        {evt.start_time && ` ⏰ ${evt.start_time.slice(0,5)}`}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
              {pageCount > 1 && (
                <div className="flex justify-center mt-6 space-x-2">
                  {[...Array(pageCount)].map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setPage(i + 1)}
                      className={`px-4 py-2 rounded-full border ${
                        page === i + 1
                          ? 'bg-[#28313e] text-white'
                          : 'bg-white text-[#28313e] border-[#28313e] hover:bg-[#28313e] hover:text-white'
                      } font-semibold transition`}
                    >
                      {i + 1}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
        {/* Sidebar */}
        <aside className="md:w-1/3 w-full space-y-8">
          <div className="bg-white p-4 rounded-lg shadow">
            <UpcomingSidebarBulletin previewCount={10} />
          </div>
        </aside>
      </main>
      <Footer />
    </div>
  );
}
