import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from './supabaseClient';
import { RRule } from 'rrule';

const logoUrl = 'https://qdartpzrxmftmaftfdbd.supabase.co/storage/v1/object/public/group-images//logoo.png';

function parseEventsDate(str) {
  if (!str) return null;
  const [first] = str.split(/through|–|-/);
  const [m, d, y] = first.trim().split('/').map(Number);
  return new Date(y, m - 1, d);
}

function parseISODateLocal(str) {
  if (!str) return null;
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function formatDisplayDate(date, startTime) {
  if (!date) return '';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.round((date - today) / (1000 * 60 * 60 * 24));
  const weekday = date.toLocaleDateString('en-US', { weekday: 'long' });
  let prefix;
  if (diffDays === 0) prefix = 'Today';
  else if (diffDays === 1) prefix = 'Tomorrow';
  else if (diffDays > 1 && diffDays < 7) prefix = `This ${weekday}`;
  else prefix = weekday;
  const datePart = date.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
  let timePart = '';
  if (startTime) {
    const [h = 0, m = 0] = startTime.split(':').map(Number);
    const dt = new Date();
    dt.setHours(h, m);
    timePart = dt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }).toLowerCase();
  }
  return `${prefix}, ${datePart}${timePart ? `, ${timePart}` : ''}`;
}

export default function UpcomingPlansCard() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!slug) return;
    const load = async () => {
      const { data: prof } = await supabase
        .from('profiles')
        .select('id,username,slug,image_url')
        .eq('slug', slug)
        .single();
      if (!prof) {
        setLoading(false);
        return;
      }
      setProfile(prof);

      const { data: favs } = await supabase
        .from('event_favorites')
        .select('event_id,event_int_id,event_uuid,source_table')
        .eq('user_id', prof.id);

      const idsByTable = {};
      (favs || []).forEach(r => {
        const tbl = r.source_table;
        let id;
        if (tbl === 'all_events') id = r.event_int_id;
        else if (tbl === 'events') id = r.event_id;
        else id = r.event_uuid;
        if (!id) return;
        idsByTable[tbl] = idsByTable[tbl] || [];
        idsByTable[tbl].push(id);
      });

      const all = [];
      if (idsByTable.all_events?.length) {
        const { data } = await supabase
          .from('all_events')
          .select('id,name,slug,image,start_date,venues:venue_id(name,slug)')
          .in('id', idsByTable.all_events);
        data?.forEach(e => {
          all.push({
            id: e.id,
            slug: e.slug,
            title: e.name,
            image: e.image,
            start_date: e.start_date,
            source_table: 'all_events',
          });
        });
      }
      if (idsByTable.events?.length) {
        const { data } = await supabase
          .from('events')
          .select('id,slug,"E Name","E Image",Dates')
          .in('id', idsByTable.events);
        data?.forEach(e => {
          all.push({
            id: e.id,
            slug: e.slug,
            title: e['E Name'],
            image: e['E Image'],
            start_date: e.Dates,
            source_table: 'events',
          });
        });
      }
      if (idsByTable.big_board_events?.length) {
        const { data } = await supabase
          .from('big_board_events')
          .select('id,slug,title,start_date,start_time,big_board_posts!big_board_posts_event_id_fkey(image_url)')
          .in('id', idsByTable.big_board_events);
        data?.forEach(ev => {
          let img = '';
          const path = ev.big_board_posts?.[0]?.image_url || '';
          if (path) {
            const { data: { publicUrl } } = supabase.storage
              .from('big-board')
              .getPublicUrl(path);
            img = publicUrl;
          }
          all.push({
            id: ev.id,
            slug: ev.slug,
            title: ev.title,
            start_date: ev.start_date,
            start_time: ev.start_time,
            image: img,
            source_table: 'big_board_events',
          });
        });
      }
      if (idsByTable.group_events?.length) {
        const { data } = await supabase
          .from('group_events')
          .select('id,slug,title,start_date,start_time,groups(imag,slug)')
          .in('id', idsByTable.group_events);
        data?.forEach(ev => {
          all.push({
            id: ev.id,
            slug: ev.slug,
            title: ev.title,
            start_date: ev.start_date,
            start_time: ev.start_time,
            image: ev.groups?.imag || '',
            source_table: 'group_events',
          });
        });
      }
      if (idsByTable.recurring_events?.length) {
        const { data } = await supabase
          .from('recurring_events')
          .select('id,slug,name,start_date,start_time,end_date,rrule,image_url')
          .in('id', idsByTable.recurring_events);
        data?.forEach(ev => {
          try {
            const opts = RRule.parseString(ev.rrule);
            opts.dtstart = new Date(`${ev.start_date}T${ev.start_time}`);
            if (ev.end_date) opts.until = new Date(`${ev.end_date}T23:59:59`);
            const rule = new RRule(opts);
            const today0 = new Date();
            today0.setHours(0, 0, 0, 0);
            const next = rule.after(today0, true);
            if (next) {
              all.push({
                id: ev.id,
                slug: ev.slug,
                title: ev.name,
                start_date: next.toISOString().slice(0, 10),
                start_time: ev.start_time,
                image: ev.image_url,
                source_table: 'recurring_events',
              });
            }
          } catch (err) {
            console.error('rrule parse', err);
          }
        });
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const upcoming = all
        .map(ev => {
          const d = ev.source_table === 'events'
            ? parseEventsDate(ev.start_date)
            : parseISODateLocal(ev.start_date);
          const display = formatDisplayDate(d, ev.start_time);
          return { ...ev, _date: d, displayDate: display };
        })
        .filter(ev => ev._date && ev._date >= today)
        .sort((a, b) => a._date - b._date)
        .slice(0, 7)
        .map(({ _date, ...rest }) => rest);

      setEvents(upcoming);
      setLoading(false);
    };
    load();
  }, [slug]);

  const handleShare = async () => {
    const card = document.getElementById('plans-card');
    if (!card) return;
    try {
      const { toBlob } = await import('https://esm.sh/html-to-image');
      const blob = await toBlob(card);
      if (!blob) throw new Error('image generation failed');
      const file = new File([blob], 'plans.png', { type: 'image/png' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: 'My Philly plans' });
      } else {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'plans.png';
        link.click();
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      console.error(err);
      alert('Unable to share image');
    }
  };

  if (loading) {
    return <div className="min-h-screen bg-neutral-50 flex items-center justify-center">Loading…</div>;
  }
  if (!profile) {
    return <div className="min-h-screen bg-neutral-50 flex items-center justify-center">Profile not found</div>;
  }

  return (
    <div className="min-h-screen bg-neutral-900 flex items-center justify-center p-2">
      <div
        id="plans-card"
        className="relative bg-white w-full h-screen max-w-sm rounded-lg shadow flex flex-col p-4"
      >
        <button
          onClick={() => navigate(-1)}
          className="absolute top-2 left-2 text-gray-500 hover:text-gray-700"
          aria-label="Close"
        >
          ×
        </button>
        <header className="flex justify-between items-center mb-4 mt-4">
          <div className="flex items-center gap-2">
            <img src={logoUrl} alt="Our Philly" className="h-8" />
          </div>
          <div className="flex items-center gap-2">
            {profile.image_url && (
              <img src={profile.image_url} alt="avatar" className="w-8 h-8 rounded-full object-cover" />
            )}
            <span className="text-sm font-semibold">{profile.username || profile.slug}</span>
          </div>
        </header>
        {events.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-gray-500 text-sm">No upcoming events saved.</div>
        ) : (
          <ul className="flex-1 divide-y overflow-hidden">
            {events.map(ev => (
              <li key={`${ev.source_table}-${ev.id}`} className="flex items-center gap-4 py-4">
                {ev.image && (
                  <img src={ev.image} alt="" className="w-24 h-16 object-cover rounded" />
                )}
                <div className="min-w-0">
                  <div className="text-base font-semibold truncate">{ev.title}</div>
                  <div className="text-sm text-gray-600">{ev.displayDate}</div>
                </div>
              </li>
            ))}
          </ul>
        )}
        <button onClick={handleShare} className="self-end mt-4 text-sm px-4 py-2 bg-indigo-600 text-white rounded">
          Share
        </button>
      </div>
    </div>
  );
}

