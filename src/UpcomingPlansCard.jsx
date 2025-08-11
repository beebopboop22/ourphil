import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from './supabaseClient';
import { RRule } from 'rrule';
import { FaTwitter, FaFacebook, FaInstagram, FaTiktok } from 'react-icons/fa';

const logoUrl = 'https://qdartpzrxmftmaftfdbd.supabase.co/storage/v1/object/public/group-images//logoo.png';

function parseEventsDateRange(startStr, explicitEnd) {
  if (!startStr) return { start: null, end: null };
  const [startPart, rangeEnd] = startStr.split(/through|–|-/);
  const [m1, d1, y1] = startPart.trim().split('/').map(Number);
  const start = new Date(y1, m1 - 1, d1);
  let end = start;
  if (explicitEnd) {
    const [m2, d2, y2] = explicitEnd.split('/').map(Number);
    end = new Date(y2, m2 - 1, d2);
  } else if (rangeEnd) {
    const parts = rangeEnd.trim().split('/').map(Number);
    if (parts.length === 3) end = new Date(parts[2], parts[0] - 1, parts[1]);
    else end = new Date(y1, parts[0] - 1, parts[1]);
  }
  return { start, end };
}

function parseISODateLocal(str) {
  if (!str) return null;
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function formatDisplayDate(date) {
  if (!date) return '';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.round((date - today) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Tomorrow';
  if (diffDays > 1 && diffDays < 7)
    return date.toLocaleDateString('en-US', { weekday: 'long' });
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
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
          .select('id,slug,"E Name","E Image",Dates,"End Date"')
          .in('id', idsByTable.events);
        data?.forEach(e => {
          all.push({
            id: e.id,
            slug: e.slug,
            title: e['E Name'],
            image: e['E Image'],
            start_date: e.Dates,
            end_date: e['End Date'],
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
          if (ev.source_table === 'events') {
            const { start, end } = parseEventsDateRange(ev.start_date, ev.end_date);
            const display = formatDisplayDate(start);
            return { ...ev, _date: start, _end: end, displayDate: display };
          }
          const d = parseISODateLocal(ev.start_date);
          const display = formatDisplayDate(d);
          return { ...ev, _date: d, _end: d, displayDate: display };
        })
        .filter(ev => ev._date && ev._end && ev._end >= today)
        .sort((a, b) => a._date - b._date)
        .slice(0, 10)
        .map(({ _date, _end, ...rest }) => rest);

      setEvents(upcoming);
      setLoading(false);
    };
    load();
  }, [slug]);

  const embedImages = async node => {
    const imgs = Array.from(node.getElementsByTagName('img'));
    const originals = [];
    await Promise.all(
      imgs.map(async img => {
        if (img.src.startsWith('data:')) return;
        originals.push([img, img.src]);
        try {
          const res = await fetch(img.src, { mode: 'cors' });
          if (!res.ok) {
            throw new Error(`Failed to fetch ${img.src}: ${res.status}`);
          }
          const blob = await res.blob();
          const reader = new FileReader();
          const dataUrl = await new Promise(resolve => {
            reader.onload = () => resolve(reader.result);
            reader.readAsDataURL(blob);
          });
          img.src = dataUrl;
          // Ensure the embedded image is fully loaded before export
          if (img.decode) {
            try {
              await img.decode();
            } catch (err) {
              console.warn('decode image', err);
            }
          }
        } catch (e) {
          console.warn('embed image', e);
        }
      })
    );
    return () => {
      originals.forEach(([img, src]) => {
        img.src = src;
      });
    };
  };

  const handleShare = async network => {
    void network;
    // Export only the inner square card so the resulting image is 1080×1080
    const card = document.getElementById('plans-card');
    if (!card) return;
    try {
      const { toBlob } = await import('https://esm.sh/html-to-image');
      const cleanup = await embedImages(card);
      const size = card.offsetWidth;
      const scale = 1080 / size;
      const blob = await toBlob(card, {
        width: 1080,
        height: 1080,
        pixelRatio: 1,
        style: { transform: `scale(${scale})`, transformOrigin: 'top left' },
        cacheBust: true,
        // Exclude elements (like the close and share buttons) marked with data-no-export
        filter: node => !(node instanceof HTMLElement && node.dataset.noExport !== undefined),
      });
      cleanup();
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
    <div className="min-h-screen bg-white flex flex-col items-center justify-center py-8">
      <div className="mb-4 flex justify-center" data-no-export>
        <button
          onClick={() => navigate(-1)}
          className="text-gray-500 hover:text-gray-700 text-sm"
        >
          Go Back
        </button>
      </div>
      <div className="relative">
        <button
          onClick={() => navigate(-1)}
          className="absolute -top-4 -right-4 text-gray-500 hover:text-gray-700"
          aria-label="Close"
          data-no-export
        >
          ×
        </button>
        <div
          id="plans-card-wrapper"
          className="relative bg-white w-[540px] max-w-full aspect-[9/16] flex items-center justify-center"
        >
          <div
            id="plans-card"
            className="relative bg-white w-full aspect-square rounded-lg shadow flex flex-col px-8 pt-6 pb-0 overflow-hidden"
          >
          <header className="flex items-center gap-2 mb-3">
            <img src={logoUrl} alt="Our Philly" className="h-8" crossOrigin="anonymous" />
            <span className="text-[10px] text-gray-600">Make your Philly plans at ourphilly.org</span>
          </header>
        <div className="flex flex-col items-center mb-2">
          <span className="text-sm font-semibold">{profile.username || profile.slug}</span>
        </div>
        {events.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-gray-500 text-sm">No upcoming events saved.</div>
        ) : (
          <>
            <div className="text-center text-xs uppercase tracking-wide text-gray-500 border-b pb-1 mb-2">
              Upcoming plans
            </div>
            <ul className="flex-1 divide-y text-xs">
              {events.map(ev => (
                <li key={`${ev.source_table}-${ev.id}`} className="py-1 truncate">
                  {ev.title} - {ev.displayDate}
                </li>
              ))}
            </ul>
          </>
        )}
        <img
          src="https://qdartpzrxmftmaftfdbd.supabase.co/storage/v1/object/public/group-images/meet-gritty-formatted.png"
          alt="Mascot"
          className="w-16 self-start mt-2 block"
          crossOrigin="anonymous"
        />
        <div className="flex justify-center gap-4 mt-4 pb-4" data-no-export>
          <button onClick={() => handleShare('twitter')} aria-label="Share to Twitter">
            <FaTwitter className="text-sky-500" />
          </button>
          <button onClick={() => handleShare('facebook')} aria-label="Share to Facebook">
            <FaFacebook className="text-blue-600" />
          </button>
          <button onClick={() => handleShare('instagram')} aria-label="Share to Instagram Stories">
            <FaInstagram className="text-pink-500" />
          </button>
          <button onClick={() => handleShare('tiktok')} aria-label="Share to TikTok">
            <FaTiktok className="text-black" />
          </button>
        </div>
          </div>
        </div>
      </div>
    </div>
  );
}

