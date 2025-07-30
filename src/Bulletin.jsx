import React, { useState, useEffect, useContext } from 'react';
import { supabase } from './supabaseClient';
import { AuthContext } from './AuthProvider';
import { Link } from 'react-router-dom';
import Navbar from './Navbar';
import Footer from './Footer';
import RecentActivity from './RecentActivity';

import EventFavorite from './EventFavorite.jsx';

// Helpers
const parseDate = (datesStr) => {
  if (!datesStr) return null;
  const [first] = datesStr.split(/through|–|-/);
  return new Date(first.trim());
};
const formatShortDate = (d) =>
  d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
const subtractDays = (date, days) => {
  const d = new Date(date);
  d.setDate(d.getDate() - days);
  return d;
};
const nextNthWeekday = (weekday, nth, fromDate) => {
  const year = fromDate.getFullYear();
  const month = fromDate.getMonth();
  let d = new Date(year, month, 1);
  const diff = (7 + weekday - d.getDay()) % 7;
  d.setDate(1 + diff + 7 * (nth - 1));
  if (d < fromDate) {
    d = new Date(year, month + 1, 1);
    const diff2 = (7 + weekday - d.getDay()) % 7;
    d.setDate(1 + diff2 + 7 * (nth - 1));
  }
  return d;
};
const SPECIAL_IMG =
  'https://qdartpzrxmftmaftfdbd.supabase.co/storage/v1/object/sign/group-images/ourphilly.png?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1cmwiOiJncm91cC1pbWFnZXMvb3VycGhpbGx5LnBuZyIsImlhdCI6MTc0NjE5NzA4NywiZXhwIjozMzI4MjE5NzA4N30.434M6ZJNUVZCGRMp4PnJmj-VuX-199Eg3k-y6b-qls4';

export default function Bulletin({ previewCount = Infinity }) {
  const { user } = useContext(AuthContext);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [favCounts, setFavCounts] = useState({});

  useEffect(() => {
    (async () => {
      const today0 = new Date();
      today0.setHours(0, 0, 0, 0);
      const tomorrow0 = new Date(today0);
      tomorrow0.setDate(tomorrow0.getDate() + 1);

      try {
        // Fetch dynamic events
        const { data, error } = await supabase
          .from('events')
          .select(`id, slug, "E Name", Dates, "End Date", "E Image", "E Description"`)
          .order('Dates', { ascending: true });
        if (error) throw error;

        const dynamic = data
          .map((e) => {
            const start = parseDate(e.Dates);
            const end = parseDate(e['End Date']) || start;
            const sd = new Date(start);
            sd.setHours(0, 0, 0, 0);
            const ed = new Date(end);
            ed.setHours(0, 0, 0, 0);
            const single = !e['End Date'] || e['End Date'].trim() === e.Dates.trim();
            let updateText;

            if (today0.getTime() === sd.getTime()) {
              updateText = single
                ? `${e['E Name']} is today!`
                : `${e['E Name']} starts today!`;
            } else if (!single && today0.getTime() === ed.getTime()) {
              updateText = `${e['E Name']} ends today!`;
            } else if (tomorrow0.getTime() === sd.getTime()) {
              updateText = single
                ? `${e['E Name']} is tomorrow!`
                : `${e['E Name']} starts tomorrow!`;
            } else if (today0 < sd) {
              updateText = single
                ? `${e['E Name']} is ${formatShortDate(sd)}!`
                : `${e['E Name']} starts ${formatShortDate(sd)}!`;
            } else if (today0 > ed) {
              updateText = `${e['E Name']} ended.`;
            } else {
              updateText = `${e['E Name']} is on!`;
            }

            return { ...e, start: sd, end: ed, updateText };
          })
          .filter((evt) => evt.end >= today0)
          .slice(0, 15);

        // Prepare special fixed entries
        const fixed = [];
        // First Friday (today)
        const off = nextNthWeekday(5, 1, today0);
        if (today0.getTime() === off.getTime()) {
          fixed.push({
            id: 'fixed-ocff',
            start: today0,
            end: today0,
            updateText: 'Old City First Friday is today!',
            'E Image': SPECIAL_IMG,
            'E Description': 'Gallery crawl & design pop-ups.',
            slug: 'https://www.oldcitydistrict.org/first-friday',
          });
        }
        // Museums & volunteer reminders day-before
        const specials = [
          {
            fn: () => nextNthWeekday(0, 1, today0),
            text: 'Pay-what-you-wish at PMA tomorrow!',
            desc: 'First Sunday, 5–8:45pm',
            slug: 'https://philamuseum.org',
          },
          {
            fn: () => nextNthWeekday(0, 1, today0),
            text: 'Barnes Foundation free tomorrow!',
            desc: 'First Sunday, 10–4pm',
            slug: 'https://barnesfoundation.org',
          },
          {
            fn: () => nextNthWeekday(6, 2, today0),
            text: 'Second Saturday volunteer tomorrow!',
            desc: 'Park restoration 2nd Sat',
            slug: 'https://loveyourpark.org/volunteer/secondsaturdays',
          },
        ];
        specials.forEach(({ fn, text, desc, slug }) => {
          const d = fn();
          if (subtractDays(d, 1).getTime() === today0.getTime()) {
            fixed.push({
              id: `fixed-${text.slice(0, 5)}`,
              start: today0,
              end: today0,
              updateText: text,
              'E Image': SPECIAL_IMG,
              'E Description': desc,
              slug,
            });
          }
        });

        setEvents([...fixed, ...dynamic]);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Load favorite counts
  useEffect(() => {
    if (!events.length) return;
    (async () => {
      const ids = events
        .filter((e) => !String(e.id).startsWith('fixed'))
        .map((e) => e.id);
      if (!ids.length) return;
      const { data } = await supabase
        .from('event_favorites')
        .select('event_id')
        .in('event_id', ids);
      const counts = {};
      data.forEach((r) => (counts[r.event_id] = (counts[r.event_id] || 0) + 1));
      setFavCounts(counts);
    })();
  }, [events]);

  // No per-user favorites fetch; handled in EventFavorite component

  if (loading) return <div className="text-center py-12">Loading bulletin…</div>;

  const today0 = new Date();
  today0.setHours(0, 0, 0, 0);
  const display = events.slice(0, previewCount);

  return (
    <>
      {/* Print-specific CSS scoped to this component */}
      <style>
        {`
          @media print {
            /* Hide site chrome */
            #bulletin-print-wrapper .no-print,
            #bulletin-print-wrapper nav,
            #bulletin-print-wrapper footer,
            #bulletin-print-wrapper .favorite-button {
              display: none !important;
            }

            /* Expand print wrapper full-width */
            #bulletin-print-wrapper {
              width: 100%;
              max-width: 100%;
              margin: 0;
              padding: 0;
            }

            /* Remove padding/margins that push content off-page */
            #bulletin-print-wrapper .px-4,
            #bulletin-print-wrapper .mx-auto {
              padding: 0 !important;
              margin: 0 !important;
            }

            /* Prevent item breaks across pages */
            #bulletin-print-wrapper .bulletin-item {
              page-break-inside: avoid;
              break-inside: avoid;
            }

            /* Slightly smaller font so content fits on one sheet */
            #bulletin-print-wrapper {
              font-size: 12pt;
              line-height: 1.2;
            }
          }
        `}
      </style>

      {/* Navbar (hidden when printing) */}
      <Navbar className="no-print" />
      <RecentActivity className="no-print" />

      {/* Main bulletin content */}
      <div
        id="bulletin-print-wrapper"
        className="max-w-screen-md mx-auto py-12 px-4 relative z-10 mt-20"
      >
        <h1 className="text-5xl mt-20 font-[Barrio] font-bold text-center mb-8">
          Upcoming
        </h1>

        <div>
          {display.map((evt, idx) => {
            const sd = evt.start;
            const ed = evt.end;
            const isActive = sd && ed && today0 >= sd && today0 <= ed;
            const bgCls = idx % 2 === 0 ? 'bg-white' : 'bg-gray-50';
            const href = evt.slug
              ? evt.slug.startsWith('http')
                ? evt.slug
                : `/events/${evt.slug}`
              : null;
            const Wrapper = href ? 'a' : 'div';
            const linkProps = href
              ? {
                  href,
                  ...(href.startsWith('http')
                    ? { target: '_blank', rel: 'noopener noreferrer' }
                    : {}),
                }
              : {};

            return React.createElement(
              Wrapper,
              {
                key: evt.id,
                className: `${bgCls} flex items-start space-x-4 border-b border-gray-200 py-6 bulletin-item ${
                  href ? 'hover:bg-gray-100 cursor-pointer' : ''
                }`,
                ...linkProps,
              },
              isActive && (
                <span className="block w-3 h-3 bg-green-500 rounded-full animate-ping mt-2 mr-1 flex-shrink-0" />
              ),
              evt['E Image'] && (
                <img
                  src={evt['E Image']}
                  alt=""
                  className="w-12 h-12 rounded-full object-cover flex-shrink-0"
                />
              ),
              <div className="flex-1">
                <div className="flex justify-between items-center">
                  <p className="text-lg font-semibold text-gray-800">
                    {evt.updateText}
                  </p>
                  {!String(evt.id).startsWith('fixed') && (
                    <EventFavorite
                      event_id={evt.id}
                      source_table="events"
                      count={favCounts[evt.id] || 0}
                      onCountChange={delta =>
                        setFavCounts(c => ({ ...c, [evt.id]: (c[evt.id] || 0) + delta }))
                      }
                      className="favorite-button no-print"
                    />
                  )}
                </div>
                {evt['E Description'] && (
                  <p className="text-sm text-gray-600 mt-1">
                    {evt['E Description']}
                  </p>
                )}
              </div>
            );
          })}
        </div>

        {events.length > previewCount && (
          <div className="text-center mt-6 no-print">
            <Link
              to="/bulletin"
              className="inline-block bg-indigo-600 text-white text-xl font-semibold px-10 py-4 rounded-2xl shadow-lg hover:bg-indigo-700 transform hover:scale-105 transition"
            >
              View Full Bulletin
            </Link>
          </div>
        )}
      </div>

      {/* Footer (hidden when printing) */}
      <Footer className="no-print" />
    </>
  );
}
