import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from './supabaseClient';
import Navbar from './Navbar';
import Footer from './Footer';
import BigBoardEventsGrid from './BigBoardEventsGrid';
import SportsTonightSidebar from './SportsTonightSidebar';
import RecentActivity from './RecentActivity';
import CityHolidayAlert from './CityHolidayAlert';
import { Helmet } from 'react-helmet';
import MoreEventsBanner from './MoreEventsBanner';
import PopularGroups from './PopularGroups';


// Sidebar "Upcoming Traditions"
function UpcomingSidebarBulletin({ previewCount = 10 }) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const today0 = new Date(); today0.setHours(0, 0, 0, 0);

  // Helper: Parse and format dates
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

    <div className="relative">
      {/* Heart image popping out above */}
      <img
        src="https://qdartpzrxmftmaftfdbd.supabase.co/storage/v1/object/public/group-images//OurPhilly-CityHeart-1.png"
        alt="City Heart"
        className="absolute right-0 -top-20 w-1/2 z-0 pointer-events-none select-none"
        style={{ filter: "drop-shadow(0 4px 16px rgba(0,0,0,0.08))" }}
        aria-hidden="true"
      />
      {/* Card content above heart */}
      <div className="relative z-10">
        <h3 className="font-[Barrio] text-lg text-indigo-900 mb-2">Upcoming Traditions</h3>
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
    </div>
  );
}

function formatTime(timeStr) {
    if (!timeStr) return '';
    // Handles "18:00" or "18:00:00" -> "6:00 p.m."
    const [hourStr, minStr] = timeStr.split(':');
    let hour = parseInt(hourStr, 10);
    const min = minStr || '00';
    const ampm = hour >= 12 ? 'p.m.' : 'a.m.';
    hour = hour % 12 || 12;
    return `${hour}:${min.padStart(2, '0')} ${ampm}`;
  }

  
  
  
  export default function MainEventsDetail() {
    const { venue, slug } = useParams();
    const [event, setEvent] = useState(null);
    const [venueData, setVenueData] = useState(null);
    const [relatedEvents, setRelatedEvents] = useState([]);
    const [loading, setLoading] = useState(true);
  
    // Fetch event + venue
    useEffect(() => {
      (async () => {
        setLoading(true);
        // Get event by slug + venue
        const { data: events, error } = await supabase
          .from('all_events')
          .select('*')
          .eq('slug', slug)
          .limit(1);
        if (error || !events?.length) return setLoading(false);
        setEvent(events[0]);
  
        // Get venue info
        const { data: venues } = await supabase
          .from('venues')
          .select('*')
          .eq('slug', venue)
          .limit(1);
        setVenueData(venues?.[0] || null);
  
        // Get other events at this venue (exclude current)
        if (venues?.[0]) {
          const { data: moreEvents } = await supabase
            .from('all_events')
            .select('id, name, slug, start_date, start_time, image, venues:venue_id(name, slug)')
            .eq('venue_id', venues[0].id)
            .neq('slug', slug)
            .order('start_date', { ascending: true })
            .limit(5);
          setRelatedEvents(moreEvents || []);
        }
  
        setLoading(false);
      })();
    }, [venue, slug]);
  
    const dateFmt = (dateString) => {
        if (!dateString) return '';
        // split "YYYY-MM-DD" into [year,month,day]
        const [year, month, day] = dateString.split('-');
        // create a Date in local time
        const local = new Date(+year, +month - 1, +day);
        return local.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric'
        });
      };
  
    if (loading) {
      return (
        <div className="flex flex-col min-h-screen">
          <Navbar />
          <div className="flex-grow flex items-center justify-center">
            <div className="text-2xl text-gray-500">Loading…</div>
          </div>
          <Footer />
        </div>
      );
    }
    if (!event) {
      return (
        <div className="flex flex-col min-h-screen">
          <Navbar />
          <div className="flex-grow flex items-center justify-center">
            <div className="text-2xl text-red-600">Event not found.</div>
          </div>
          <Footer />
        </div>
      );
    }

  // — SEO: title & description purely from the event
  const rawTitle = event.name || 'Event Details';
  const pageTitle =
    rawTitle.length > 60
      ? rawTitle.slice(0, 57).trim() + '…'
      : rawTitle;
  const desc = event.description || `Learn more about ${rawTitle}.`;
  const metaDescription =
    desc.length > 155
      ? desc.slice(0, 152).trim() + '…'
      : desc;
  
return (

    <>
    <Helmet>
        <title>{pageTitle} | Our Philly Concierge</title>
        <meta name="description" content={metaDescription} />
    </Helmet>

      <div className="flex flex-col min-h-screen">
        <Navbar />


        <div className="pt-20">
        <MoreEventsBanner />

  <CityHolidayAlert />
</div>
        {/* Hero: image only, shorter */}
        <div className="relative w-full h-52 bg-[#28313e] flex items-center justify-center overflow-hidden">

          {event.image ? (
            <img
              src={event.image}
              alt={event.name}
              className="absolute inset-0 w-full h-full object-cover opacity-80"
            />
          ) : (
            <div className="absolute inset-0 bg-[#28313e]" />
          )}
        </div>
  
        {/* Event info box */}
        <div className="relative z-10 w-full max-w-3xl mx-auto -mt-16 mb-8">
          <div className="bg-white rounded-2xl shadow-xl px-8 py-6 flex flex-col items-center border border-gray-100 relative">
            <h1 className="text-4xl font-[Barrio] font-bold mb-1 text-[#28313e] text-center">
              {event.name}
            </h1>
            {/* Description just below event name, small text */}
            {event.description && (
              <p className="text-gray-500 text-sm mb-2 text-center max-w-2xl">{event.description}</p>
            )}
            <div className="text-xl mb-1 text-gray-800">
              {dateFmt(event.start_date)}
              {event.end_date && event.end_date !== event.start_date
                ? ` – ${dateFmt(event.end_date)}`
                : ''}
              {event.start_time && (
                <span className="ml-2">⏰ {formatTime(event.start_time)}</span>
              )}
            </div>
            <div className="text-lg text-indigo-700 font-semibold text-center">
              {venueData?.name}
            </div>
            {venueData && (
              <div className="text-sm text-gray-500 mt-1 text-center">
                {venueData.address && <span>{venueData.address}, </span>}
                {venueData.city && <span>{venueData.city}, </span>}
                {venueData.state && <span>{venueData.state} </span>}
                {venueData.zip && <span>{venueData.zip}</span>}
                {venueData.website && (
                  <>
                    <span> | </span>
                    <a
                      href={venueData.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-indigo-600 underline"
                    >
                      {venueData.website.replace(/^https?:\/\//, '')}
                    </a>
                  </>
                )}
              </div>
            )}
  
            {/* Website button: "dangling" below box */}
            {event.link && (
              <a
                href={event.link}
                target="_blank"
                rel="noopener noreferrer"
                className="absolute left-1/2 transform -translate-x-1/2 translate-y-4 bg-[#bf3d35] text-white font-bold px-8 py-3 rounded-full shadow-lg text-lg border-4 border-white hover:bg-[#a92d23] transition-all"
                style={{
                  bottom: -30,
                  zIndex: 20,
                  minWidth: 200,
                  whiteSpace: 'nowrap',
                }}
              >
                Let's Go Then!
              </a>
            )}
          </div>
        </div>
  
        {/* Main content: left then sidebar (sidebar stacks beneath on mobile) */}
<main className="flex flex-col md:flex-row gap-8 container mx-auto px-4 py-8 flex-grow">
  {/* Left: Related events */}
  <div className="md:w-2/3 w-full">
    {/* Related events at this venue */}
    {relatedEvents.filter(evt => {
      // only keep events whose start_date is today or later
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const evtDate = new Date(evt.start_date);
      evtDate.setHours(0, 0, 0, 0);
      return evtDate >= today;
    }).length > 0 && (
      <div className="mt-8">
        <h3 className="font-[Barrio] text-2xl mb-4 text-[#28313e]">
          More at {venueData?.name}
        </h3>
        <div className="grid grid-cols-1 gap-6">
          {relatedEvents
            .filter(evt => {
              const today = new Date();
              today.setHours(0, 0, 0, 0);
              const evtDate = new Date(evt.start_date);
              evtDate.setHours(0, 0, 0, 0);
              return evtDate >= today;
            })
            .map((evt) => (
              <Link
                key={evt.id}
                to={
                  evt.slug && evt.venues?.slug
                    ? `/${evt.venues.slug}/${evt.slug}`
                    : '#'
                }
                className="relative rounded-2xl overflow-hidden shadow-lg group min-h-[160px] flex items-end transition-transform hover:scale-[1.03]"
                style={{
                  backgroundImage: evt.image
                    ? `url('${evt.image}')`
                    : 'linear-gradient(90deg, #28313e 60%, #bf3d35 100%)',
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                  minHeight: '160px',
                }}
              >
                {/* Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/50 to-black/20 z-0 transition-opacity group-hover:opacity-80" />
                <div className="relative z-10 w-full flex flex-col px-8 py-5">
                  <h4 className="font-[Barrio] text-2xl text-white drop-shadow font-bold mb-1 leading-snug">
                    {evt.name}
                  </h4>
                  <div className="uppercase text-gray-200 text-xs tracking-wide italic font-semibold">
                    {evt.venues?.name || venueData?.name || ''}
                  </div>
                </div>
              </Link>
            ))}
        </div>
      </div>
    )}
  </div>

  {/* Right: Sidebar */}
  <aside className="md:w-1/3 w-full space-y-8">
    {/* 1. Sports tonight */}
    <SportsTonightSidebar />
    {/* 2. Upcoming Traditions */}
    <div className="bg-white p-4 rounded-lg shadow">
      <UpcomingSidebarBulletin previewCount={10} />
    </div>
  </aside>
</main>

        <BigBoardEventsGrid />
        <PopularGroups />
        <Footer />
      </div>
      </>
    );
    
  }