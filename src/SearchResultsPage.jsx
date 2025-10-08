import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Link, useSearchParams } from 'react-router-dom';
import Navbar from './Navbar';
import Footer from './Footer';
import { supabase } from './supabaseClient';
import { getDetailPathForItem } from './utils/eventDetailPaths';
import {
  getZonedDate,
  setStartOfDay,
  PHILLY_TIME_ZONE,
  parseEventDateValue,
  formatLongWeekday,
  formatMonthDay,
} from './utils/dateUtils.js';

const escapeForIlike = (value) => value.replace(/[\\%_]/g, (char) => `\\${char}`);

const truncate = (text, length = 160) => {
  if (!text) return '';
  if (text.length <= length) return text;
  return `${text.slice(0, length - 1)}…`;
};

export default function SearchResultsPage() {
  const [searchParams] = useSearchParams();
  const query = (searchParams.get('q') || '').trim();

  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const todayIso = useMemo(() => {
    const today = setStartOfDay(getZonedDate(new Date(), PHILLY_TIME_ZONE));
    return today.toISOString().slice(0, 10);
  }, []);

  useEffect(() => {
    let ignore = false;

    const run = async () => {
      if (!query) {
        setResults([]);
        setError(null);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const sanitized = escapeForIlike(query);
        const likePattern = `%${sanitized}%`;
        const filterPattern = likePattern.replace(/,/g, '\\,').replace(/\)/g, '\\)');
        const { data, error: fetchError } = await supabase
          .from('all_events')
          .select(
            `id, name, description, image, start_date, end_date, start_time, end_time, slug, venue_id, link`
          )
          .gte('start_date', todayIso)
          .or(`name.ilike.${filterPattern},description.ilike.${filterPattern}`)
          .order('start_date', { ascending: true })
          .order('start_time', { ascending: true, nullsFirst: true })
          .limit(200);
        if (fetchError) throw fetchError;
        if (!ignore) {
          setResults((data || []).map((row) => ({ ...row, source_table: 'all_events' })));
        }
      } catch (err) {
        if (!ignore) {
          console.error(err);
          setError('Something went wrong while searching. Please try again.');
          setResults([]);
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    };

    run();

    return () => {
      ignore = true;
    };
  }, [query, todayIso]);

  const pageTitle = query ? `Search results for "${query}" | Our Philly` : 'Search events | Our Philly';

  const enhancedResults = useMemo(() =>
    results.map((event) => {
      const startDate = parseEventDateValue(event.start_date);
      const endDate = parseEventDateValue(event.end_date);
      const weekday = startDate ? formatLongWeekday(startDate) : null;
      const dateRange = startDate
        ? endDate && endDate.getTime() !== startDate.getTime()
          ? `${formatMonthDay(startDate)} – ${formatMonthDay(endDate)}`
          : formatMonthDay(startDate)
        : 'Date TBA';
      const detailPath = getDetailPathForItem(event) || '/';

      return {
        ...event,
        startDate,
        endDate,
        weekday,
        dateRange,
        detailPath,
      };
    }),
  [results]);

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      <Helmet>
        <title>{pageTitle}</title>
        {query && <meta name="robots" content="noindex" />}
      </Helmet>
      <Navbar />
      <main className="flex-1 px-4 pb-16 pt-28">
        <div className="mx-auto flex max-w-5xl flex-col gap-8">
          <header className="space-y-2">
            <h1 className="text-3xl font-bold text-gray-900">Search</h1>
            {query ? (
              <p className="text-base text-gray-600">
                Showing upcoming events matching <span className="font-semibold">“{query}”</span>.
              </p>
            ) : (
              <p className="text-base text-gray-600">
                Start typing in the search bar to find upcoming events, festivals, and guides around Philly.
              </p>
            )}
          </header>

          {loading && (
            <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center text-gray-600 shadow-sm">
              Searching events…
            </div>
          )}

          {error && !loading && (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center text-red-800">
              {error}
            </div>
          )}

          {!loading && !error && query && enhancedResults.length === 0 && (
            <div className="space-y-6 rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">No upcoming events found</h2>
                <p className="mt-2 text-gray-600">
                  We couldn’t find any upcoming events that match “{query}”. Try a different keyword or browse our curated guides below.
                </p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Link
                  to="/all-guides/"
                  className="rounded-xl border border-indigo-100 bg-indigo-50 px-5 py-4 text-indigo-700 transition hover:border-indigo-200 hover:bg-indigo-100"
                >
                  Explore Our Guides
                </Link>
                <Link
                  to="/this-weekend-in-philadelphia/"
                  className="rounded-xl border border-pink-100 bg-pink-50 px-5 py-4 text-pink-700 transition hover:border-pink-200 hover:bg-pink-100"
                >
                  This Weekend in Philadelphia
                </Link>
              </div>
            </div>
          )}

          {!loading && !error && enhancedResults.length > 0 && (
            <div className="grid gap-6 md:grid-cols-2">
              {enhancedResults.map((event) => (
                <Link
                  key={`${event.source_table}-${event.id}`}
                  to={event.detailPath}
                  className="group flex h-full flex-col overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-md"
                >
                  {event.image && (
                    <div className="aspect-[4/3] w-full overflow-hidden bg-gray-100">
                      <img
                        src={event.image}
                        alt={event.name || 'Event image'}
                        className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                        loading="lazy"
                      />
                    </div>
                  )}
                  <div className="flex flex-1 flex-col gap-3 p-6">
                    <div className="space-y-1">
                      {event.weekday && (
                        <p className="text-sm font-semibold uppercase tracking-wide text-indigo-600">
                          {event.weekday}
                        </p>
                      )}
                      <h2 className="text-lg font-semibold text-gray-900">{event.name}</h2>
                      <p className="text-sm text-gray-600">{event.dateRange}</p>
                    </div>
                    {event.description && (
                      <p className="line-clamp-3 text-sm text-gray-600">
                        {truncate(event.description, 200)}
                      </p>
                    )}
                    <div className="mt-auto flex items-center justify-between text-sm font-semibold text-indigo-600">
                      <span>View details</span>
                      <span aria-hidden="true">→</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
